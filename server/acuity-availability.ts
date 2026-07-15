/**
 * Live Acuity availability lookup — used by the "This Week" tab of
 * TutorAvailabilityModal so parents see real, up-to-the-second open slots
 * (already excludes every booking on the tutor's Acuity calendar, regardless
 * of whether that booking ever synced into our own `sessions` table).
 *
 * Unlike acuity-sync.ts (which pulls appointments INTO our DB), this module
 * never writes anything — it just asks Acuity "what's open right now" and
 * passes that straight through.
 *
 * IMPORTANT: Acuity's `date` query param for /availability/times is
 * interpreted in the CALENDAR's own timezone, not UTC and not the viewer's
 * timezone. Requesting dates using UTC day boundaries caused a bug where
 * slots got fetched for the wrong Acuity day and displayed under the wrong
 * label in the UI. To avoid this, we compute the date range using the
 * tutor's actual Acuity calendar timezone, and fetch a couple of buffer
 * days on each side — the client re-buckets every slot by its real absolute
 * timestamp into the viewer's local days anyway, so extra buffer days are
 * harmless (just get filtered out), while missing a day is not.
 */

import { resolveTrialAppointmentType, TUTOR_TO_CALENDAR } from "./acuity-maps";
import { ENV } from "./_core/env";

const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const getAuth = () => Buffer.from(`${ENV.acuityUserId}:${ENV.acuityApiKey}`).toString("base64");

export type DayAvailability = {
  date: string; // YYYY-MM-DD, in the calendar's own timezone (as requested)
  slots: Array<{ time: string; slotsAvailable: number }>; // raw Acuity times, ISO with offset
};

export type LiveAvailabilityResult =
  | { ok: true; days: DayAvailability[] }
  | { ok: false; reason: "no_appointment_type" | "no_calendar" | "acuity_error" };

// ── Appointment-types cache ────────────────────────────────────────────────
let apptTypesCache: { data: Record<number, number[]>; fetchedAt: number } | null = null;
const APPT_TYPES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCalendarIdsByApptType(): Promise<Record<number, number[]>> {
  if (apptTypesCache && Date.now() - apptTypesCache.fetchedAt < APPT_TYPES_CACHE_TTL_MS) {
    return apptTypesCache.data;
  }
  const res = await fetch(`${ACUITY_BASE}/appointment-types`, {
    headers: { Authorization: `Basic ${getAuth()}` },
  });
  if (!res.ok) {
    console.error(`[AcuityAvailability] appointment-types fetch failed: ${res.status}`);
    return apptTypesCache?.data ?? {};
  }
  const data = await res.json();
  const map: Record<number, number[]> = {};
  if (Array.isArray(data)) {
    for (const t of data) {
      if (t && typeof t.id === "number" && Array.isArray(t.calendarIDs)) {
        map[t.id] = t.calendarIDs;
      }
    }
  }
  apptTypesCache = { data: map, fetchedAt: Date.now() };
  return map;
}

// ── Calendar timezone cache ────────────────────────────────────────────────
// So we know which timezone to compute "day N from today" in, per calendar.
let calendarTzCache: { data: Record<number, string>; fetchedAt: number } | null = null;
const CALENDAR_TZ_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — timezone almost never changes

async function getCalendarTimezones(): Promise<Record<number, string>> {
  if (calendarTzCache && Date.now() - calendarTzCache.fetchedAt < CALENDAR_TZ_CACHE_TTL_MS) {
    return calendarTzCache.data;
  }
  const res = await fetch(`${ACUITY_BASE}/calendars`, {
    headers: { Authorization: `Basic ${getAuth()}` },
  });
  if (!res.ok) {
    console.error(`[AcuityAvailability] calendars fetch failed: ${res.status}`);
    return calendarTzCache?.data ?? {};
  }
  const data = await res.json();
  const map: Record<number, string> = {};
  if (Array.isArray(data)) {
    for (const c of data) {
      if (c && typeof c.id === "number" && typeof c.timezone === "string") {
        map[c.id] = c.timezone;
      }
    }
  }
  calendarTzCache = { data: map, fetchedAt: Date.now() };
  return map;
}

/** YYYY-MM-DD for "today + offsetDays", computed in the given IANA timezone. */
function dateStringInTimezone(offsetDays: number, timezone: string): string {
  // Get "now" as a Date, then shift by offsetDays worth of real days, then
  // read the calendar date as seen in `timezone` using Intl (DST-safe).
  const now = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

async function fetchTimesForDate(
  appointmentTypeId: number,
  calendarId: number,
  date: string
): Promise<Array<{ time: string; slotsAvailable: number }>> {
  const params = new URLSearchParams({
    appointmentTypeID: String(appointmentTypeId),
    calendarID: String(calendarId),
    date,
  });
  const res = await fetch(`${ACUITY_BASE}/availability/times?${params}`, {
    headers: { Authorization: `Basic ${getAuth()}` },
  });
  if (!res.ok) {
    console.error(`[AcuityAvailability] availability/times error ${res.status} for ${date}`);
    return [];
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data
    .filter((s) => s && typeof s.time === "string" && typeof s.slotsAvailable === "number")
    .map((s) => ({ time: s.time, slotsAvailable: s.slotsAvailable }));
}

/**
 * Get real-time open slots for a tutor, for a specific course, over the next
 * `numDays` days (default 7 — matches the modal's "next 7 days" window).
 *
 * Requests are aligned to the tutor's own Acuity calendar timezone (with one
 * buffer day on each side) so results land on the correct Acuity day
 * regardless of server/viewer timezone. The caller re-buckets every slot by
 * its real absolute timestamp into the viewer's local days, so buffer days
 * are safe — extra slots outside the requested window are simply dropped.
 *
 * Returns { ok: false } if we can't resolve which Acuity appointment type to
 * query (e.g. this tutor doesn't teach this course, or isn't mapped in Acuity
 * yet) — callers should fall back to the recurring `tutor_availability` table
 * in that case rather than showing an error.
 */
export async function getLiveTutorAvailability(
  tutorId: number,
  courseId: number,
  numDays: number = 7
): Promise<LiveAvailabilityResult> {
  const calendarIdsByApptType = await getCalendarIdsByApptType();

  const appointmentTypeId = resolveTrialAppointmentType(courseId, tutorId, calendarIdsByApptType);
  if (!appointmentTypeId) {
    return { ok: false, reason: "no_appointment_type" };
  }

  const calendarId = TUTOR_TO_CALENDAR[tutorId];
  if (!calendarId) {
    return { ok: false, reason: "no_calendar" };
  }

  try {
    const calendarTimezones = await getCalendarTimezones();
    const calendarTz = calendarTimezones[calendarId] || "America/New_York";

    const days: DayAvailability[] = [];
    // Buffer: -1 day before, numDays+1 days after, so the viewer's 7-day
    // window is always fully covered even across large timezone gaps
    // (e.g. an India-based viewer looking at a US tutor's calendar).
    for (let offset = -1; offset <= numDays; offset++) {
      const date = dateStringInTimezone(offset, calendarTz);
      const slots = await fetchTimesForDate(appointmentTypeId, calendarId, date);
      days.push({ date, slots });
    }
    return { ok: true, days };
  } catch (err: any) {
    console.error(`[AcuityAvailability] getLiveTutorAvailability failed for tutor=${tutorId} course=${courseId}: ${err.message}`);
    return { ok: false, reason: "acuity_error" };
  }
}