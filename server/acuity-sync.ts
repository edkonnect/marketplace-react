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
import { users, subscriptions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { CALENDAR_TO_TUTOR, APPT_TYPE_TO_COURSE, splitEmails, extractZoomUrl, toIst } from "./acuity-maps";
import { upsertAcuitySession, resolveAcuityAppt, type AcuityAppt, type AcuityLookups } from "./acuity-upsert";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const CALENDAR_TO_EMAIL: Record<number, string> = {
  9518516:  "dolon.mukherjee.2011@gmail.com",
  13134669: "bichuskumar8@gmail.com",
  12924725: "vgerarrd@gmail.com",
  7992988:  "gopisiri4268@gmail.com",
  10639379: "akalyangupta@gmail.com",
  6631240:  "mustaqmic@gmail.com",
  8838338:  "naushadteaches@gmail.com",
  7722765:  "pmudi.bppimt@gmail.com",
  13611648: "ramesh030199@gmail.com",
  9584519:  "aish30george@gmail.com",
  12748025: "anittadominic123@gmail.com",
  7203343:  "appysisodia@yahoo.com",
  5824683:  "maya.math289@gmail.com",
  9886816:  "mercyraniyedidi@gmail.com",
  12804136: "nalini.cheena@gmail.com",
  4056973:  "shritisharma@gmail.com",
  8255661:  "sivasankare.g@gmail.com",
  7137621:  "sivasankare.g@gmail.com",
  13204478: "codegems27@gmail.com",
  11083164: "vinaybalasisodia@gmail.com",
  13821319: "seswar8180@gmail.com",
  12585605: "chintalapati.vrs@gmail.com",
  13801030: "sharved2508@gmail.com",
  12986707: "shafirasik757575@gmail.com",
  9344460:  "brianolsen1127.work@gmail.com",
};

const APPT_TYPE_TO_COURSE: Record<number, number | null> = {
  57218677: 51, 54015900: 51, 61243720: 51, 76604953: 21, 84510036: 22, 84052873: 69,
  14691452: null, 14793473: null, 26804440: null, 38753649: null, 38754939: null,
  38754970: null, 49843342: null, 25031851: null, 19017079: null,
  15003877: 4,  15003878: 4,  26720095: 4,  26720224: 4,  38626468: 4,  38626518: 4,
  49843348: 4,  25031855: 4,  19016965: 4,  26720233: null, 38626548: null,
  15003875: 2,  15003876: 2,  26720089: 2,  26720227: 2,  38626456: 2,  38626521: 2,
  49843345: 2,  25031852: 2,  19016957: 2,
  15003879: 3,  15003880: 3,  26720098: 3,  26720221: 3,  38626471: 3,  38626515: 3,
  49843351: 3,  25031858: 3,  19016973: 3,
  15003881: 5,  15003882: 5,  26720101: 5,  26720218: 5,  38626474: 5,  38626512: 5,
  49843354: 5,  25031861: 5,  19016981: 5,
  26720215: 6,  15003883: 6,  15003884: 6,  26720104: 6,  38626477: 6,  38626509: 6,
  49843357: 6,  25031864: 6,  19016989: 6,
  26720212: 7,  15003885: 7,  15003886: 7,  26720107: 7,  38626480: 7,  38626506: 7,
  49843360: 7,  25031867: 7,  19016997: 7,
  15003887: 8,  15003888: 8,  26720110: 8,  26720209: 8,  38626483: 8,  38626503: 8,
  49843363: 8,  25031870: 8,  19017005: 8,
  25031873: 9,  15003889: 9,  15003890: 9,  26720113: 9,  26720206: 9,  38626486: 9,
  38626500: 9,  49843366: 9,  19017013: 9,
  19034374: 1,  14688321: 1,  14688322: 1,  26805219: 1,  26805255: 1,  38753637: 1,
  38753676: 1,  49843321: 1,  25031828: 1,  19016867: 1,  61243689: 1,
  14688323: 25, 14688324: 25, 26805228: 25, 26805249: 25, 38753643: 25, 38753670: 25,
  49843327: 25, 25031834: 25, 19016885: 25, 61243695: 25,
  14688325: 26, 14688326: 26, 26805234: 26, 26805243: 26, 38753664: 26,
  49843333: 26, 25031840: 26, 19016903: 26, 61243701: 26,
  14688327: 114, 14688328: 114, 26805240: 114, 26805237: 114,
  38753655: 114, 38753658: 114, 49843339: 114, 25031846: 114, 19016921: 114,
  61243707: 114, 61243713: 114, 61243719: 114,
  52792024: 293, 52792025: 293,
  14891471: 33, 14891472: 33,
  26805264: null, 38753682: null, 49843309: null, 25031816: null, 19016831: null,
  61243677: null, 61243683: null,
  74022709: null, 74023161: null,
  14792692: 25,
  38756951: 116, 38756927: 116,
  // High School Math (US + CBSE + IG/IB)
  14691576: 299, 71128121: 299, 26804614: 299,
  // Biology (US + IB/IG/CBSE variants)
  35389891: 227, 71128157: 227, 35389384: 227, 35389295: 227, 35389450: 227, 48083214: 227,
  // Middle School Math (US)
  14474827: 293,
  // High School English (CBSE)
  27314258: 116,
  // Middle School English (CBSE + US)
  27314289: 114, 38757538: 114,
  // Elementary School English (US)
  24510098: 115,
  // Chemistry (CBSE)
  28978757: 15,
  // Middle School Science (CBSE)
  33654551: null,
  // SAT Foundation English
  58068542: 25,
  // Free Trial sessions
  14701559: 1, 15690898: 25,
  // Middle School Mathematics (CBSE)
  26804574: 293,
  // AP Statistics
  87525059: 68,
  // AP Calculus
  71556848: 33,
  // Additional half hour class
  31198809: null,
  // IELTS/TOEFL
  31263147: 41, 31263177: 41,
  30863827: 163,
};

async function fetchAppointments(minDate: string, maxDate: string, includeCanceled: boolean): Promise<any[]> {
  const params = new URLSearchParams({ minDate, maxDate, max: "2000" });
  if (includeCanceled) params.set("canceled", "true");
  const res = await fetch(`${ACUITY_BASE}/appointments?${params}`, {
    headers: { Authorization: `Basic ${AUTH}` },
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

/** Build the lookups the shared upsert/resolver needs (parent emails + subscriptions). */
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

  return { parentEmailToId, subByParentCourseStudent };
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
      parentEmail: splitEmails(appt.email)[0] || "—",
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
