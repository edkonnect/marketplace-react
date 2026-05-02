/**
 * Sync upcoming Acuity sessions to the platform.
 *
 * Usage:
 *   pnpm tsx scripts/sync-acuity.ts                 # today-3 → today+120 (default)
 *   pnpm tsx scripts/sync-acuity.ts 2026-01-01      # custom minDate
 *   pnpm tsx scripts/sync-acuity.ts 2026-01-01 2026-06-30  # custom range
 *
 * What it does:
 *   1. Fetches all scheduled + cancelled appointments from every Acuity calendar
 *   2. Inserts new sessions (INSERT IGNORE — safe to re-run)
 *   3. Marks cancelled appointments as status='cancelled' in the platform
 *   4. Ghost-deletes scheduled sessions that no longer exist in Acuity
 *      (skips sessions with acuityAppointmentId set — those are verified real)
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { users, subscriptions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

// ── Acuity credentials ────────────────────────────────────────────────────────
const ACUITY_USER_ID = process.env.ACUITY_USER_ID ?? "18852823";
const ACUITY_API_KEY = process.env.ACUITY_API_KEY ?? "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");
const ACUITY_BASE = "https://acuityscheduling.com/api/v1";

// ── Acuity calendarID → tutor primary email ───────────────────────────────────
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
};

// ── Acuity appointmentTypeID → platform courseId ─────────────────────────────
const APPT_TYPE_TO_COURSE: Record<number, number | null> = {
  // Computer Science / Programming
  57218677: 51, 54015900: 51, 61243720: 51,
  76604953: 21, 84510036: 22, 84052873: 69,

  // Math — Elementary (no matching course)
  14691452: null, 14793473: null, 26804440: null, 38753649: null,
  38754939: null, 38754970: null, 49843342: null, 25031851: null, 19017079: null,

  // Math — Middle School
  71128291: 293, 14474827: 293, 26804574: 293,

  // Math — High School
  71128121: 299, 26804614: 299, 14691576: 299,

  // Math — AP / A Level
  71556848: 33, 87502622: 33, 87525059: 33,
  27561406: 251, 27561385: 251,

  // Math — SAT/ACT/PSAT
  19034374: 1, 14701559: 1,
  14792692: 25, 15690898: 25,

  // Math — Other
  59210772: null,

  // English — Elementary
  16723795: 115, 16723876: 115, 24510098: 115, 27314309: 115, 27314322: 115,
  38755753: 115, 38755818: 115, 49843317: 115, 31251347: 115,

  // English — Middle School
  71170467: 114, 38757538: 114, 27314289: 114, 38757488: 114,

  // English — High School
  71128100: 116, 38756951: 116, 38756927: 116,

  // English — A Level
  30219038: 252, 30219026: 252,

  // English — AP / Test Prep / Spoken
  88415090: 29,
  34108709: 276, 55339864: 276, 62762521: 276,

  // SAT / ACT
  55339838: 25, 40643350: 25,

  // Business English / IELTS / PTE
  25157139: 63, 25157101: 63, 44199566: 63, 44199912: 63,
  48657229: 63, 37280049: 63, 32458048: 63,
  80404280: 43, 31263147: 41, 31263177: 41,

  // Science — Physics
  71128190: 84, 46157449: 84, 46157379: 84, 56889632: null,

  // Science — Biology
  71128157: 227, 35389384: 227, 35389295: 227, 35389450: 227, 35389891: 227, 48083214: 227,

  // Science — Chemistry
  71128144: 226, 28978757: 226, 28978734: 226, 31913387: 226, 31913430: 226, 40922081: 226,

  // Science — Middle School
  71128249: 228, 71170563: 226, 33654551: 228,

  // Hindi
  63049663: 255, 74079295: 255,

  // Form courses
  39842697: 254, 39842708: 254, 52027965: 253, 52027983: 253,

  // German
  46627128: 58, 46627181: 58, 54274277: 58, 54274313: 58,

  // MBA / CAT / GRE / Other
  41024493: 118,
  38819183: null, 38819198: null, 40310481: null, 40310452: null,

  // AP / College (US)
  37431356: null, 37431358: null, 43468047: null, 34033973: null, 38087738: null, 35257646: null,

  // Board Exam Crash Course
  39814134: null, 39814142: null, 40615548: null, 40615562: null,

  // Additional half hour class (IELTS/TOEFL add-on, Nalini Sharma)
  31198809: 41,
  // Misc
  78945546: null, 72851734: null, 72851975: null, 74022709: null, 74023161: null,
};

// Some parents use a different email in Acuity vs the platform
const PARENT_EMAIL_ALIASES: Record<string, string[]> = {
  "minfantprabu@gmail.com": ["minfantprabu@gmail.com", "ipjophiel@gmail.com"],
  "narayanan.vijay@gmail.com": ["narayanan.vijay@gmail.com", "vijay.tanushri14@gmail.com"],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAppointmentsForCalendar(calendarId: number, minDate: string, maxDate: string, includeCanceled: boolean): Promise<any[]> {
  const params = new URLSearchParams({ minDate, maxDate, max: "1000", calendarID: String(calendarId) });
  if (includeCanceled) params.set("canceled", "true");

  const res = await fetch(`${ACUITY_BASE}/appointments?${params}`, {
    headers: { Authorization: `Basic ${AUTH}` },
  });

  if (!res.ok) {
    console.error(`Acuity API error for calendarId=${calendarId}: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchAppointments(minDate: string, maxDate: string, includeCanceled: boolean): Promise<any[]> {
  // Fetch per-calendar to avoid the 1000-record global limit
  const allResults: any[] = [];
  const seenIds = new Set<number>();

  for (const calendarId of Object.keys(CALENDAR_TO_EMAIL).map(Number)) {
    const appts = await fetchAppointmentsForCalendar(calendarId, minDate, maxDate, includeCanceled);
    for (const a of appts) {
      if (!seenIds.has(a.id)) {
        seenIds.add(a.id);
        allResults.push(a);
      }
    }
  }

  return allResults;
}

function extractZoomUrl(location: string): string | null {
  if (!location) return null;
  const match = location.match(/https:\/\/[^\s]+zoom\.us\/j\/[^\s]+/);
  return match ? match[0] : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const db = await getDb();
if (!db) { console.error("DB not available"); process.exit(1); }

const today = new Date();
const defaultMin = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
const defaultMax = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

const minDate = process.argv[2] ?? defaultMin;
const maxDate = process.argv[3] ?? defaultMax;

console.log(`\nSync range: ${minDate} → ${maxDate}\n`);

// Load tutors
const allTutors = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "tutor"));
const tutorEmailToId: Record<string, number> = {};
for (const t of allTutors) tutorEmailToId[t.email.toLowerCase()] = t.id;

// Load parents — build reverse alias map (acuity email → platform parentId)
const allParents = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "parent"));
const parentEmailToId: Record<string, number> = {};
for (const p of allParents) parentEmailToId[p.email.toLowerCase()] = p.id;

// Add alias mappings so Acuity alias emails resolve to the right parentId
for (const [platformEmail, aliases] of Object.entries(PARENT_EMAIL_ALIASES)) {
  const parentId = parentEmailToId[platformEmail.toLowerCase()];
  if (!parentId) continue;
  for (const alias of aliases) parentEmailToId[alias.toLowerCase()] = parentId;
}

// Load subscriptions
const allSubs = await db.select({
  id: subscriptions.id,
  parentId: subscriptions.parentId,
  courseId: subscriptions.courseId,
  preferredTutorId: subscriptions.preferredTutorId,
  status: subscriptions.status,
}).from(subscriptions);

const subMap: Record<string, number> = {};
for (const s of allSubs) {
  if (!s.preferredTutorId) continue;
  const key = `${s.parentId}-${s.preferredTutorId}-${s.courseId}`;
  if (!subMap[key] || s.status === "active") subMap[key] = s.id;
}

// Fetch from Acuity
const scheduled = await fetchAppointments(minDate, maxDate, false);
const cancelled = await fetchAppointments(minDate, maxDate, true);
const cancelledOnly = cancelled.filter((a) => a.canceled === true);

console.log(`Acuity: ${scheduled.length} scheduled, ${cancelledOnly.length} cancelled`);

// Build valid key set for ghost cleanup
const validAcuityKeys = new Set<string>();
for (const appt of scheduled) {
  const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
  if (!tutorEmail) continue;
  const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
  if (!tutorId) continue;
  const ms = new Date(appt.datetime).getTime();
  if (!isNaN(ms)) validAcuityKeys.add(`${tutorId}:${ms}`);
}

let inserted = 0;
let skipped = 0;
let cancelledCount = 0;
let ghostDeleted = 0;

// ── Insert scheduled sessions ─────────────────────────────────────────────────
for (const appt of scheduled) {
  const emailCandidates = (appt.email || "").split(/[,;]/).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
  const parentId = emailCandidates.reduce((found: number | undefined, email: string) => found ?? parentEmailToId[email], undefined as number | undefined);
  if (!parentId) { skipped++; continue; }

  const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
  if (!tutorEmail) { skipped++; continue; }
  const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
  if (!tutorId) { skipped++; continue; }

  const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
  if (courseId === undefined || courseId === null) { skipped++; continue; }

  const scheduledAtMs = new Date(appt.datetime).getTime();
  if (isNaN(scheduledAtMs)) { skipped++; continue; }

  const duration = parseInt(appt.duration, 10) || 60;
  const meetingUrl = extractZoomUrl(appt.location || "");
  const subKey = `${parentId}-${tutorId}-${courseId}`;
  const subscriptionId = subMap[subKey] ?? null;
  const studentFirstName = (appt.firstName || "").trim() || null;
  const studentLastName = (appt.lastName || "").trim() || null;

  try {
    // Check if this acuityAppointmentId already exists with a different scheduledAt (rescheduled)
    const existing = ((await db.execute(sql`
      SELECT id, scheduledAt, status FROM sessions WHERE acuityAppointmentId = ${String(appt.id)} LIMIT 1
    `)) as any)[0] as any[];

    if (existing.length > 0) {
      const existingSession = existing[0];
      if (existingSession.scheduledAt !== scheduledAtMs && existingSession.status !== 'cancelled') {
        // Acuity rescheduled this appointment — update scheduledAt in place
        // But first check if the new slot conflicts with another session for this tutor
        const conflict = ((await db.execute(sql`
          SELECT id FROM sessions WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs} AND id != ${existingSession.id} LIMIT 1
        `)) as any)[0] as any[];
        if (conflict.length === 0) {
          await db.execute(sql`UPDATE sessions SET scheduledAt = ${scheduledAtMs}, status = 'scheduled' WHERE id = ${existingSession.id}`);
          inserted++;
          console.log(`  ~ Rescheduled: id=${existingSession.id} → ${appt.datetime} parent=${appt.email} tutor=${tutorEmail}`);
        } else {
          console.warn(`  ! Reschedule conflict: acuityId=${appt.id} new slot ${appt.datetime} conflicts with session id=${conflict[0].id}`);
        }
      }
      // Already exists with same time — skip (INSERT IGNORE behaviour)
      skipped++;
      continue;
    }

    const result = await db.execute(sql`
      INSERT IGNORE INTO sessions
        (subscriptionId, tutorId, parentId, scheduledAt, duration, status, isTrial, courseId, meetingUrl, meetingPlatform, studentFirstName, studentLastName, acuityAppointmentId)
      VALUES
        (${subscriptionId}, ${tutorId}, ${parentId}, ${scheduledAtMs}, ${duration}, 'scheduled', 0, ${courseId}, ${meetingUrl}, 'Zoom', ${studentFirstName}, ${studentLastName}, ${String(appt.id)})
    `);
    const affected = (result as any)[0]?.affectedRows ?? 0;
    if (affected > 0) {
      inserted++;
      console.log(`  + Inserted: ${appt.datetime} parent=${appt.email} tutor=${tutorEmail} course=${courseId}`);
    } else {
      skipped++;
    }
  } catch (err: any) {
    console.error(`  ! Insert error appt id=${appt.id}: ${err.message}`);
  }
}

// ── Mark cancellations ────────────────────────────────────────────────────────
for (const appt of cancelledOnly) {
  const emailCandidates = (appt.email || "").split(/[,;]/).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
  const parentId = emailCandidates.reduce((found: number | undefined, email: string) => found ?? parentEmailToId[email], undefined as number | undefined);
  if (!parentId) continue;

  const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
  if (!tutorEmail) continue;
  const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
  if (!tutorId) continue;

  const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
  if (courseId === undefined || courseId === null) continue;

  const scheduledAtMs = new Date(appt.datetime).getTime();
  if (isNaN(scheduledAtMs)) continue;

  const duration = parseInt(appt.duration, 10) || 60;
  const meetingUrl = extractZoomUrl(appt.location || "");
  const subKey = `${parentId}-${tutorId}-${courseId}`;
  const subscriptionId = subMap[subKey] ?? null;
  const studentFirstName = (appt.firstName || "").trim() || null;
  const studentLastName = (appt.lastName || "").trim() || null;

  try {
    // Try to update existing scheduled row first
    const updateResult = await db.execute(sql`
      UPDATE sessions SET status = 'cancelled'
      WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs} AND parentId = ${parentId}
        AND status = 'scheduled'
      LIMIT 1
    `);
    const updated = (updateResult as any)[0]?.affectedRows ?? 0;

    if (updated === 0) {
      // No existing row — insert as cancelled directly
      await db.execute(sql`
        INSERT IGNORE INTO sessions
          (subscriptionId, tutorId, parentId, scheduledAt, duration, status, isTrial, courseId, meetingUrl, meetingPlatform, studentFirstName, studentLastName, acuityAppointmentId)
        VALUES
          (${subscriptionId}, ${tutorId}, ${parentId}, ${scheduledAtMs}, ${duration}, 'cancelled', 0, ${courseId}, ${meetingUrl}, 'Zoom', ${studentFirstName}, ${studentLastName}, ${String(appt.id)})
      `);
    }
    cancelledCount++;
  } catch (err: any) {
    console.error(`  ! Cancel error appt id=${appt.id}: ${err.message}`);
  }
}

// ── Auto-complete past scheduled sessions ─────────────────────────────────────
// Any session that is still 'scheduled' but whose time has passed should be 'completed'.
// Only touch sessions for Acuity-managed tutors to avoid affecting manually-created sessions.
const acuityManagedTutorIdsList = Object.values(CALENDAR_TO_EMAIL)
  .map((email) => tutorEmailToId[email.toLowerCase()])
  .filter(Boolean) as number[];

if (acuityManagedTutorIdsList.length > 0) {
  const nowMs = today.getTime();
  const autoCompleted = ((await db.execute(sql`
    UPDATE sessions
    SET status = 'completed'
    WHERE status = 'scheduled'
      AND scheduledAt < ${nowMs}
      AND tutorId IN (${sql.raw(acuityManagedTutorIdsList.join(','))})
  `)) as any)[0]?.affectedRows ?? 0;
  if (autoCompleted > 0) console.log(`  ✓ Auto-completed ${autoCompleted} past scheduled sessions`);
}

// ── Ghost session cleanup (future sessions only) ──────────────────────────────
// Only ghost-delete FUTURE scheduled sessions — past sessions should never be deleted.
const nowMs = today.getTime();
const maxMs = new Date(maxDate + "T23:59:59Z").getTime();

const platformRows = ((await db.execute(sql`
  SELECT id, tutorId, scheduledAt, parentId, acuityAppointmentId
  FROM sessions
  WHERE status = 'scheduled' AND scheduledAt >= ${nowMs} AND scheduledAt <= ${maxMs}
`)) as any)[0] as any[];

const acuityManagedTutorIds = new Set<number>(acuityManagedTutorIdsList);

const acuityParentIds = new Set<number>();
for (const appt of scheduled) {
  const emails = (appt.email || "").split(/[,;]/).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
  for (const e of emails) { const pid = parentEmailToId[e]; if (pid) acuityParentIds.add(pid); }
}

for (const row of platformRows) {
  const key = `${row.tutorId}:${Number(row.scheduledAt)}`;
  if (validAcuityKeys.has(key)) continue;
  if (row.acuityAppointmentId) continue; // verified real appointment — never ghost-delete
  if (!acuityManagedTutorIds.has(row.tutorId)) continue;
  if (!acuityParentIds.has(row.parentId)) continue;

  await db.execute(sql`DELETE FROM sessions WHERE id = ${row.id}`);
  ghostDeleted++;
  console.log(`  ~ Ghost deleted: session id=${row.id} tutorId=${row.tutorId} at ${new Date(Number(row.scheduledAt)).toISOString()}`);
}

console.log(`\n═══════════════════════════════════════`);
console.log(`✅ Inserted      : ${inserted}`);
console.log(`🚫 Cancelled     : ${cancelledCount}`);
console.log(`👻 Ghost deleted : ${ghostDeleted}`);
console.log(`⏭  Skipped       : ${skipped}`);
console.log(`═══════════════════════════════════════`);
process.exit(0);
