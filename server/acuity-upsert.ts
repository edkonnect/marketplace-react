/**
 * Shared Acuity → sessions upsert logic.
 *
 * Used by BOTH the real-time webhook (acuity-webhook.ts) and the polling/manual
 * sync (acuity-sync.ts) so the two code paths produce identical rows. Keying the
 * upsert on acuityAppointmentId (with a fallback to the (tutorId, scheduledAt)
 * unique index) means reschedules and field corrections self-heal instead of
 * being silently skipped, while manually-entered notes/feedback are preserved.
 */

import { sql } from "drizzle-orm";
import {
  CALENDAR_TO_TUTOR,
  APPT_TYPE_TO_COURSE,
  TRIAL_APPOINTMENT_TYPES,
  extractZoomUrl,
  splitEmails,
} from "./acuity-maps";

export type AcuityAppt = {
  id: number | string;
  firstName?: string;
  lastName?: string;
  email?: string;
  datetime: string;
  duration?: string | number;
  calendarID: number;
  appointmentTypeID: number;
  location?: string;
  canceled?: boolean;
};

/** Pre-built lookups so the batch sync doesn't query per-row. */
export type AcuityLookups = {
  /** lowercased parent email -> user id */
  parentEmailToId: Record<string, number>;
  /** key `${parentId}-${courseId}-${studentFirstLower}` -> subscription id (prefer active) */
  subByParentCourseStudent: Record<string, number>;
};

export type UpsertResult =
  | { ok: true; action: "inserted" | "updated" | "unchanged"; sessionId?: number }
  | { ok: false; reason: "unmapped_calendar"; calendarID: number }
  | { ok: false; reason: "no_parent"; emails: string[] }
  | { ok: false; reason: "unmapped_type"; typeID: number }
  | { ok: false; reason: "bad_datetime" };

type Db = NonNullable<Awaited<ReturnType<typeof import("./db").getDb>>>;

/**
 * Resolve the platform IDs for an Acuity appointment without writing anything.
 * Returns a skip reason if the appointment can't be mapped.
 */
export function resolveAcuityAppt(
  appt: AcuityAppt,
  lookups: AcuityLookups,
): UpsertResult & {
  tutorId?: number;
  parentId?: number;
  courseId?: number | null;
  subscriptionId?: number | null;
  scheduledAtMs?: number;
  duration?: number;
  meetingUrl?: string | null;
  isTrial?: boolean;
  studentFirstName?: string | null;
  studentLastName?: string | null;
} {
  const tutorId = CALENDAR_TO_TUTOR[appt.calendarID];
  if (!tutorId) return { ok: false, reason: "unmapped_calendar", calendarID: appt.calendarID };

  const emails = splitEmails(appt.email);
  let parentId: number | undefined;
  for (const e of emails) {
    if (lookups.parentEmailToId[e]) { parentId = lookups.parentEmailToId[e]; break; }
  }
  if (!parentId) return { ok: false, reason: "no_parent", emails };

  const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
  const isTrial = TRIAL_APPOINTMENT_TYPES.has(appt.appointmentTypeID);
  if (courseId === undefined) return { ok: false, reason: "unmapped_type", typeID: appt.appointmentTypeID };
  // Known type but no matching course: only sync if it's a trial.
  if (courseId === null && !isTrial) return { ok: false, reason: "unmapped_type", typeID: appt.appointmentTypeID };

  const scheduledAtMs = new Date(appt.datetime).getTime();
  if (Number.isNaN(scheduledAtMs)) return { ok: false, reason: "bad_datetime" };

  const duration = parseInt(String(appt.duration ?? ""), 10) || 60;
  const meetingUrl = extractZoomUrl(appt.location);
  const studentFirstName = (appt.firstName || "").trim() || null;
  const studentLastName = (appt.lastName || "").trim() || null;

  let subscriptionId: number | null = null;
  if (courseId != null && studentFirstName) {
    const key = `${parentId}-${courseId}-${studentFirstName.toLowerCase()}`;
    subscriptionId = lookups.subByParentCourseStudent[key] ?? null;
  }

  return {
    ok: true, action: "unchanged",
    tutorId, parentId, courseId, subscriptionId,
    scheduledAtMs, duration, meetingUrl, isTrial, studentFirstName, studentLastName,
  };
}

/**
 * Upsert a single Acuity appointment into the sessions table.
 * Self-heals existing rows (matched by acuityAppointmentId, else by the
 * (tutorId, scheduledAt) unique slot) without clobbering notes/feedback/rating.
 */
export async function upsertAcuitySession(
  db: Db,
  appt: AcuityAppt,
  lookups: AcuityLookups,
): Promise<UpsertResult> {
  const r = resolveAcuityAppt(appt, lookups);
  if (!r.ok) return r;

  const {
    tutorId, parentId, courseId, subscriptionId,
    scheduledAtMs, duration, meetingUrl, isTrial, studentFirstName, studentLastName,
  } = r;

  const acuityId = String(appt.id);
  // Past sessions land as completed so tutors can add notes; future as scheduled.
  const status = scheduledAtMs! < Date.now() ? "completed" : "scheduled";

  // 1) Try to find the existing row for THIS appointment (handles reschedules &
  //    field corrections). Don't touch a row already marked cancelled here —
  //    the cancel loop owns that transition.
  const existing = (await db.execute(sql`
    SELECT id, status FROM sessions WHERE acuityAppointmentId = ${acuityId} LIMIT 1
  `)) as any;
  const existingRow = existing[0]?.[0];

  if (existingRow) {
    // A row the cancel loop set to cancelled stays cancelled; otherwise move
    // scheduled<->completed based on time. notes/feedback/rating are untouched.
    const nextStatus = existingRow.status === "cancelled" ? "cancelled" : status;
    await db.execute(sql`
      UPDATE sessions SET
        tutorId = ${tutorId},
        parentId = ${parentId},
        scheduledAt = ${scheduledAtMs},
        duration = ${duration},
        courseId = ${courseId ?? null},
        meetingUrl = COALESCE(${meetingUrl}, meetingUrl),
        subscriptionId = COALESCE(${subscriptionId ?? null}, subscriptionId),
        studentFirstName = ${studentFirstName},
        studentLastName = ${studentLastName},
        isTrial = ${isTrial ? 1 : 0},
        status = ${nextStatus},
        updatedAt = NOW()
      WHERE id = ${existingRow.id}
    `);
    // Keep the subscription's preferredTutorId in sync with whichever tutor's
    // calendar this appointment is actually booked on, so the student shows up
    // correctly in that tutor's Students list and marketplace.
    if (subscriptionId) {
      await db.execute(sql`
        UPDATE subscriptions SET preferredTutorId = ${tutorId}
        WHERE id = ${subscriptionId} AND preferredTutorId != ${tutorId}
      `);
    }
    return { ok: true, action: "updated", sessionId: existingRow.id };
  }

  // 2) New appointment. INSERT, but if the (tutorId, scheduledAt) slot is already
  //    held by an old row (e.g. cancelled-then-rebooked same slot), take it over
  //    and re-point it at this appointment.
  const res = (await db.execute(sql`
    INSERT INTO sessions
      (subscriptionId, tutorId, parentId, scheduledAt, duration, status, isTrial,
       courseId, meetingUrl, meetingPlatform, studentFirstName, studentLastName, acuityAppointmentId)
    VALUES
      (${subscriptionId ?? null}, ${tutorId}, ${parentId}, ${scheduledAtMs}, ${duration}, ${status}, ${isTrial ? 1 : 0},
       ${courseId ?? null}, ${meetingUrl}, 'Zoom', ${studentFirstName}, ${studentLastName}, ${acuityId})
    ON DUPLICATE KEY UPDATE
      parentId = VALUES(parentId),
      duration = VALUES(duration),
      courseId = VALUES(courseId),
      meetingUrl = COALESCE(VALUES(meetingUrl), meetingUrl),
      subscriptionId = COALESCE(VALUES(subscriptionId), subscriptionId),
      studentFirstName = VALUES(studentFirstName),
      studentLastName = VALUES(studentLastName),
      isTrial = VALUES(isTrial),
      acuityAppointmentId = VALUES(acuityAppointmentId),
      status = IF(status = 'cancelled', VALUES(status), status),
      updatedAt = NOW()
  `)) as any;

  // mysql2 affectedRows: 1 = inserted, 2 = updated via ON DUPLICATE KEY.
  const affected = res[0]?.affectedRows ?? 0;
  if (subscriptionId) {
    await db.execute(sql`
      UPDATE subscriptions SET preferredTutorId = ${tutorId}
      WHERE id = ${subscriptionId} AND preferredTutorId != ${tutorId}
    `);
  }
  return { ok: true, action: affected === 1 ? "inserted" : "updated" };
}
