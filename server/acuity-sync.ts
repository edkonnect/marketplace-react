/**
 * Acuity → Platform session sync (polling cron + admin "Sync Now" button).
 *
 * Shares ALL mapping + upsert logic with the real-time webhook via
 * server/acuity-maps.ts and server/acuity-upsert.ts — there is no separate copy
 * of the calendar/appointment-type maps here anymore.
 *
 * - Window: today −30d → +120d (catches recently-missed sessions + upcoming)
 * - Inserts/corrects sessions for parents already in the platform (upsert by
 *   acuityAppointmentId — reschedules & field fixes self-heal, notes preserved)
 * - Cancels sessions cancelled in Acuity
 * - Ghost-cleans sessions that no longer exist in Acuity
 * - Safe to run hourly and idempotent
 */

import { getDb } from "./db";
import { users, subscriptions, courses, acuityEmailAliases } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { CALENDAR_TO_TUTOR, APPT_TYPE_TO_COURSE, splitEmails, extractZoomUrl, toIst } from "./acuity-maps";
import { upsertAcuitySession, resolveAcuityAppt, type AcuityAppt, type AcuityLookups } from "./acuity-upsert";
import { ENV } from "./_core/env";

const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const getAuth = () => Buffer.from(`${ENV.acuityUserId}:${ENV.acuityApiKey}`).toString("base64");

async function fetchAppointments(minDate: string, maxDate: string, includeCanceled: boolean): Promise<any[]> {
  const params = new URLSearchParams({ minDate, maxDate, max: "2000" });
  if (includeCanceled) params.set("canceled", "true");
  const res = await fetch(`${ACUITY_BASE}/appointments?${params}`, {
    headers: { Authorization: `Basic ${getAuth()}` },
  });
  if (!res.ok) {
    console.error(`[AcuitySync] Acuity API error: ${res.status} ${res.statusText}`);
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  if (data.length >= 2000) {
    console.warn(`[AcuitySync] WARNING: Acuity returned exactly 2000 appointments — results may be truncated. Ghost cleanup skipped to be safe.`);
  }
  return data;
}

/** Build the lookups the shared upsert/resolver needs (parent emails + subscriptions + aliases). */
async function buildLookups(database: NonNullable<Awaited<ReturnType<typeof getDb>>>): Promise<AcuityLookups> {
  const allParents = await database.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "parent"));
  const parentEmailToId: Record<string, number> = {};
  for (const p of allParents) parentEmailToId[p.email.toLowerCase()] = p.id;

  const allSubs = await database
    .select({
      id: subscriptions.id,
      parentId: subscriptions.parentId,
      courseId: subscriptions.courseId,
      studentFirstName: subscriptions.studentFirstName,
      status: subscriptions.status,
    })
    .from(subscriptions);

  const subByParentCourseStudent: Record<string, number> = {};
  for (const s of allSubs) {
    const student = (s.studentFirstName || "").trim().toLowerCase();
    if (!student) continue;
    const key = `${s.parentId}-${s.courseId}-${student}`;
    if (!subByParentCourseStudent[key] || s.status === "active") subByParentCourseStudent[key] = s.id;
  }

  const aliases = await database.select({ acuityEmail: acuityEmailAliases.acuityEmail, userId: acuityEmailAliases.userId }).from(acuityEmailAliases);
  const parentAliasEmailToId: Record<string, number> = {};
  for (const a of aliases) parentAliasEmailToId[a.acuityEmail.toLowerCase()] = a.userId;

  return { parentEmailToId, subByParentCourseStudent, parentAliasEmailToId };
}

export async function syncAcuitySessions(): Promise<{
  inserted: number;
  updated: number;
  cancelled: number;
  skipped: number;
  ghostDeleted: number;
  noParent: number;
}> {
  const database = await getDb();
  if (!database) throw new Error("DB not available");

  const today = new Date();
  const minDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  console.log(`[AcuitySync] Syncing ${minDate} → ${maxDate}`);

  const lookups = await buildLookups(database);

  const scheduled = await fetchAppointments(minDate, maxDate, false);
  const cancelled = await fetchAppointments(minDate, maxDate, true);
  const cancelledOnly = cancelled.filter((a) => a.canceled === true);
  const scheduledTruncated = scheduled.length >= 2000;
  console.log(`[AcuitySync] ${scheduled.length} scheduled, ${cancelledOnly.length} cancelled from Acuity${scheduledTruncated ? " (WARNING: truncated)" : ""}`);

  // Set of valid (tutorId:scheduledAtMs) for ghost cleanup.
  const validAcuityKeys = new Set<string>();
  for (const appt of scheduled) {
    const tutorId = CALENDAR_TO_TUTOR[appt.calendarID];
    if (!tutorId) continue;
    const ms = new Date(appt.datetime).getTime();
    if (!Number.isNaN(ms)) validAcuityKeys.add(`${tutorId}:${ms}`);
  }

  let inserted = 0, updated = 0, skipped = 0, noParent = 0;

  // Insert / correct scheduled sessions via the shared upsert.
  for (const appt of scheduled as AcuityAppt[]) {
    try {
      const result = await upsertAcuitySession(database, appt, lookups);
      if (!result.ok) {
        if (result.reason === "no_parent") noParent++;
        else skipped++;
        continue;
      }
      if (result.action === "inserted") inserted++;
      else if (result.action === "updated") updated++;
    } catch (err: any) {
      console.error(`[AcuitySync] Upsert error appt id=${appt.id}: ${err.message}`);
    }
  }

  // Cancel sessions cancelled in Acuity. Only touch the row whose
  // acuityAppointmentId matches the cancelled appointment (or legacy NULL rows),
  // so a re-booked slot sharing the time isn't wrongly cancelled.
  let cancelled_count = 0;
  for (const appt of cancelledOnly as AcuityAppt[]) {
    const tutorId = CALENDAR_TO_TUTOR[appt.calendarID];
    if (!tutorId) continue;
    let parentId: number | undefined;
    for (const e of splitEmails(appt.email)) {
      if (lookups.parentEmailToId[e]) { parentId = lookups.parentEmailToId[e]; break; }
    }
    if (!parentId) continue;
    const scheduledAtMs = new Date(appt.datetime).getTime();
    if (Number.isNaN(scheduledAtMs)) continue;
    try {
      const cancelResult = (await database.execute(sql`
        UPDATE sessions SET status = 'cancelled', updatedAt = NOW()
        WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs} AND parentId = ${parentId}
          AND status = 'scheduled'
          AND (acuityAppointmentId = ${String(appt.id)} OR acuityAppointmentId IS NULL)
      `)) as any;
      if ((cancelResult[0]?.affectedRows ?? 0) > 0) cancelled_count++;
    } catch (err: any) {
      console.error(`[AcuitySync] Cancel error appt id=${appt.id}: ${err.message}`);
    }
  }

  // Ghost cleanup — scheduled platform sessions that no longer exist in Acuity.
  let ghostDeleted = 0;
  const minMs = new Date(minDate).getTime();
  const maxMs = new Date(maxDate + "T23:59:59Z").getTime();
  const platformScheduled = (await database.execute(sql`
    SELECT id, tutorId, scheduledAt, parentId, acuityAppointmentId
    FROM sessions WHERE status = 'scheduled' AND scheduledAt >= ${minMs} AND scheduledAt <= ${maxMs}
  `)) as any;
  const platformRows = platformScheduled[0] as any[];

  const acuityManagedTutorIds = new Set<number>(Object.values(CALENDAR_TO_TUTOR));
  const acuityParentIds = new Set<number>();
  for (const appt of scheduled) {
    for (const e of splitEmails(appt.email)) {
      const pid = lookups.parentEmailToId[e];
      if (pid) acuityParentIds.add(pid);
    }
  }

  if (!scheduledTruncated) {
    for (const row of platformRows) {
      const key = `${row.tutorId}:${Number(row.scheduledAt)}`;
      if (validAcuityKeys.has(key)) continue;
      if (row.acuityAppointmentId) continue; // only delete rows the sync never owned
      if (!acuityManagedTutorIds.has(row.tutorId)) continue;
      if (!acuityParentIds.has(row.parentId)) continue;
      await database.execute(sql`DELETE FROM sessions WHERE id = ${row.id}`);
      ghostDeleted++;
    }
  }

  console.log(`[AcuitySync] done — inserted:${inserted} updated:${updated} cancelled:${cancelled_count} skipped:${skipped} noParent:${noParent} ghostDeleted:${ghostDeleted}`);
  return { inserted, updated, cancelled: cancelled_count, skipped, ghostDeleted, noParent };
}

export type AcuityPreview = {
  toInsert: Array<{
    acuityId: string;
    tutorId: number;
    parentEmail: string;
    studentName: string;
    scheduledAtIst: string;
    durationMin: number;
    courseId: number | null;
    meetingUrl: string | null;
  }>;
  toUpdateCount: number;
  toCancelCount: number;
  skipped: {
    noParent: Array<{ emails: string; student: string; calendarID: number; whenIst: string }>;
    unmappedCalendar: Array<{ calendarID: number; count: number }>;
    unmappedType: Array<{ typeID: number; typeName: string; count: number }>;
  };
};

export async function previewAcuitySessions(): Promise<AcuityPreview> {
  const database = await getDb();
  if (!database) throw new Error("DB not available");

  const today = new Date();
  const minDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const lookups = await buildLookups(database);

  const scheduled = await fetchAppointments(minDate, maxDate, false);
  const cancelledAppts = await fetchAppointments(minDate, maxDate, true);
  const cancelledOnly = cancelledAppts.filter((a) => a.canceled === true);

  // Map acuityAppointmentId -> existing session (for insert-vs-update decision).
  const minMs = new Date(minDate).getTime();
  const maxMs = new Date(maxDate + "T23:59:59Z").getTime();
  const existing = (await database.execute(sql`
    SELECT acuityAppointmentId, tutorId, scheduledAt FROM sessions
    WHERE scheduledAt >= ${minMs} AND scheduledAt <= ${maxMs}
  `)) as any;
  const existingByAcuityId = new Set<string>();
  const existingBySlot = new Set<string>();
  for (const row of existing[0] as any[]) {
    if (row.acuityAppointmentId) existingByAcuityId.add(String(row.acuityAppointmentId));
    existingBySlot.add(`${row.tutorId}:${Number(row.scheduledAt)}`);
  }

  const toInsert: AcuityPreview["toInsert"] = [];
  let toUpdateCount = 0;
  const noParent: AcuityPreview["skipped"]["noParent"] = [];
  const unmappedCalendarCounts = new Map<number, number>();
  const unmappedTypeCounts = new Map<number, { name: string; count: number }>();

  for (const appt of scheduled as AcuityAppt[]) {
    const r = resolveAcuityAppt(appt, lookups);
    if (!r.ok) {
      if (r.reason === "unmapped_calendar") {
        unmappedCalendarCounts.set(appt.calendarID, (unmappedCalendarCounts.get(appt.calendarID) ?? 0) + 1);
      } else if (r.reason === "no_parent") {
        noParent.push({
          emails: r.emails.join(", ") || "—",
          student: [appt.firstName, appt.lastName].filter(Boolean).join(" ").trim() || "—",
          calendarID: appt.calendarID,
          whenIst: toIst(new Date(appt.datetime).getTime()),
        });
      } else if (r.reason === "unmapped_type") {
        const prev = unmappedTypeCounts.get(appt.appointmentTypeID);
        unmappedTypeCounts.set(appt.appointmentTypeID, {
          name: (appt as any).type || "",
          count: (prev?.count ?? 0) + 1,
        });
      }
      continue;
    }

    const acuityId = String(appt.id);
    const slotKey = `${r.tutorId}:${r.scheduledAtMs}`;
    if (existingByAcuityId.has(acuityId) || existingBySlot.has(slotKey)) {
      toUpdateCount++;
      continue;
    }

    toInsert.push({
      acuityId,
      tutorId: r.tutorId!,
      parentEmail: splitEmails(appt.email).join(", ") || "—",
      studentName: [appt.firstName, appt.lastName].filter(Boolean).join(" ").trim() || "—",
      scheduledAtIst: toIst(r.scheduledAtMs!),
      durationMin: r.duration!,
      courseId: r.courseId ?? null,
      meetingUrl: extractZoomUrl(appt.location),
    });
  }

  // Count cancellations that would actually flip a scheduled row.
  let toCancelCount = 0;
  for (const appt of cancelledOnly as AcuityAppt[]) {
    const tutorId = CALENDAR_TO_TUTOR[appt.calendarID];
    if (!tutorId) continue;
    const ms = new Date(appt.datetime).getTime();
    if (Number.isNaN(ms)) continue;
    if (existingBySlot.has(`${tutorId}:${ms}`)) toCancelCount++;
  }

  return {
    toInsert,
    toUpdateCount,
    toCancelCount,
    skipped: {
      noParent,
      unmappedCalendar: [...unmappedCalendarCounts.entries()].map(([calendarID, count]) => ({ calendarID, count })),
      unmappedType: [...unmappedTypeCounts.entries()].map(([typeID, v]) => ({ typeID, typeName: v.name, count: v.count })),
    },
  };
}

// ─── Missing Sessions Feature ─────────────────────────────────────────────────

async function fetchAppointmentById(acuityId: string): Promise<any | null> {
  const res = await fetch(`${ACUITY_BASE}/appointments/${acuityId}`, {
    headers: { Authorization: `Basic ${getAuth()}` },
  });
  if (!res.ok) {
    console.error(`[AcuitySync] fetchAppointmentById ${acuityId} failed: ${res.status}`);
    return null;
  }
  return await res.json();
}

type MissingLookups = AcuityLookups & {
  subCountByParentCourseStudent: Record<string, number>;
  tutorIdToName: Record<number, string>;
};

async function buildMissingLookups(
  database: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<MissingLookups> {
  const base = await buildLookups(database);

  const allTutors = await database
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.role, "tutor"));
  const tutorIdToName: Record<number, string> = {};
  for (const t of allTutors) {
    tutorIdToName[t.id] = [t.firstName, t.lastName].filter(Boolean).join(" ") || `Tutor ${t.id}`;
  }

  const allSubs = await database
    .select({
      id: subscriptions.id,
      parentId: subscriptions.parentId,
      courseId: subscriptions.courseId,
      studentFirstName: subscriptions.studentFirstName,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  const subCountByParentCourseStudent: Record<string, number> = {};
  for (const s of allSubs) {
    const student = (s.studentFirstName || "").trim().toLowerCase();
    if (!student) continue;
    const key = `${s.parentId}-${s.courseId}-${student}`;
    subCountByParentCourseStudent[key] = (subCountByParentCourseStudent[key] ?? 0) + 1;
  }

  return { ...base, subCountByParentCourseStudent, tutorIdToName, parentAliasEmailToId: base.parentAliasEmailToId };
}

export type MissingSession = {
  acuityId: string;
  tutorId: number;
  tutorName: string;
  parentEmail: string;
  studentName: string;
  scheduledAtMs: number;
  scheduledAtIst: string;
  durationMin: number;
  courseId: number | null;
  courseName: string | null;
  appointmentTypeName: string;
  meetingUrl: string | null;
  matchStatus: "ready" | "no_course" | "no_subscription" | "ambiguous";
  subscriptionId: number | null;
};

export async function getMissingAcuitySessions(): Promise<{
  sessions: MissingSession[];
  fetchedAt: string;
}> {
  const database = await getDb();
  if (!database) throw new Error("DB not available");

  const today = new Date();
  const minDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [lookups, scheduled, allCourses] = await Promise.all([
    buildMissingLookups(database),
    fetchAppointments(minDate, maxDate, false),
    database.select({ id: courses.id, title: courses.title }).from(courses),
  ]);

  const courseNameById: Record<number, string> = {};
  for (const c of allCourses) courseNameById[c.id] = c.title;

  // Fetch sessions already in DB for this window — by acuityAppointmentId AND by (tutorId, scheduledAt) slot.
  // Both checks are needed: acuityId for sessions synced with the ID set,
  // slot key for sessions synced before acuityAppointmentId was populated (or manually added).
  const minMs = new Date(minDate).getTime();
  const maxMs = new Date(maxDate + "T23:59:59Z").getTime();
  const existing = (await database.execute(sql`
    SELECT acuityAppointmentId, tutorId, scheduledAt FROM sessions
    WHERE scheduledAt >= ${minMs} AND scheduledAt <= ${maxMs}
  `)) as any;
  const existingAcuityIds = new Set<string>();
  const existingSlots = new Set<string>();
  for (const row of existing[0] as any[]) {
    if (row.acuityAppointmentId) existingAcuityIds.add(String(row.acuityAppointmentId));
    existingSlots.add(`${row.tutorId}:${Number(row.scheduledAt)}`);
  }

  const sessions: MissingSession[] = [];

  for (const appt of scheduled as AcuityAppt[]) {
    const acuityId = String(appt.id);
    if (existingAcuityIds.has(acuityId)) continue;
    // Also skip if the (tutor, time) slot already exists — session is on platform, just missing the acuityId link
    const tutorIdForSlot = CALENDAR_TO_TUTOR[appt.calendarID];
    const slotMs = new Date(appt.datetime).getTime();
    if (tutorIdForSlot && !Number.isNaN(slotMs) && existingSlots.has(`${tutorIdForSlot}:${slotMs}`)) continue;

    const r = resolveAcuityAppt(appt, lookups);

    // Skip if parent not in platform or tutor calendar unmapped
    if (!r.ok && (r.reason === "no_parent" || r.reason === "unmapped_calendar")) continue;

    const studentName = [appt.firstName, appt.lastName].filter(Boolean).join(" ").trim() || "—";
    const parentEmail = splitEmails(appt.email).join(", ") || "—";
    const scheduledAtMs = new Date(appt.datetime).getTime();
    const durationMin = parseInt(String(appt.duration ?? ""), 10) || 60;
    const meetingUrl = extractZoomUrl(appt.location);
    const appointmentTypeName = (appt as any).type || String(appt.appointmentTypeID);

    if (!r.ok && r.reason === "unmapped_type") {
      const tutorId = CALENDAR_TO_TUTOR[appt.calendarID];
      sessions.push({
        acuityId,
        tutorId: tutorId ?? 0,
        tutorName: tutorId ? (lookups.tutorIdToName[tutorId] ?? `Tutor ${tutorId}`) : "Unknown",
        parentEmail,
        studentName,
        scheduledAtMs,
        scheduledAtIst: Number.isNaN(scheduledAtMs) ? "—" : toIst(scheduledAtMs),
        durationMin,
        courseId: null,
        courseName: null,
        appointmentTypeName,
        meetingUrl,
        matchStatus: "no_course",
        subscriptionId: null,
      });
      continue;
    }

    if (!r.ok) continue;

    // Resolved ok — determine subscription match status.
    // courseId can be null for trial sessions (mapped to null intentionally) — treat as ready since
    // upsertAcuitySession handles trials without a subscriptionId.
    const studentFirst = (appt.firstName || "").trim().toLowerCase();
    const subKey = r.courseId != null && studentFirst ? `${r.parentId}-${r.courseId}-${studentFirst}` : null;
    const activeCount = subKey ? (lookups.subCountByParentCourseStudent[subKey] ?? 0) : 0;

    let matchStatus: MissingSession["matchStatus"];
    let subscriptionId: number | null = null;
    if (r.courseId == null) {
      // Trial session — no subscription needed, upsert handles it
      matchStatus = "ready";
    } else if (activeCount === 0) {
      matchStatus = "no_subscription";
    } else if (activeCount === 1) {
      matchStatus = "ready";
      subscriptionId = lookups.subByParentCourseStudent[subKey!] ?? null;
    } else {
      matchStatus = "ambiguous";
    }

    sessions.push({
      acuityId,
      tutorId: r.tutorId!,
      tutorName: lookups.tutorIdToName[r.tutorId!] ?? `Tutor ${r.tutorId}`,
      parentEmail,
      studentName,
      scheduledAtMs,
      scheduledAtIst: toIst(scheduledAtMs),
      durationMin,
      courseId: r.courseId ?? null,
      courseName: r.courseId != null ? (courseNameById[r.courseId] ?? null) : null,
      appointmentTypeName,
      meetingUrl,
      matchStatus,
      subscriptionId,
    });
  }

  // Sort: ready first, then by scheduled time
  sessions.sort((a, b) => {
    const order = { ready: 0, no_subscription: 1, ambiguous: 2, no_course: 3 };
    const o = order[a.matchStatus] - order[b.matchStatus];
    return o !== 0 ? o : a.scheduledAtMs - b.scheduledAtMs;
  });

  return { sessions, fetchedAt: new Date().toISOString() };
}

export async function forceSyncAcuitySession(
  acuityAppointmentId: string
): Promise<{ ok: boolean; action?: string; error?: string }> {
  const database = await getDb();
  if (!database) return { ok: false, error: "DB not available" };

  const appt = await fetchAppointmentById(acuityAppointmentId);
  if (!appt) return { ok: false, error: `Could not fetch appointment ${acuityAppointmentId} from Acuity` };

  try {
    const lookups = await buildLookups(database);
    const result = await upsertAcuitySession(database, appt as AcuityAppt, lookups);
    if (!result.ok) return { ok: false, error: result.reason };
    return { ok: true, action: result.action };
  } catch (err: any) {
    console.error(`[AcuitySync] forceSyncAcuitySession ${acuityAppointmentId} failed:`, err?.message);
    return { ok: false, error: err?.message ?? "Unknown error" };
  }
}
