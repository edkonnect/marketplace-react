/**
 * Sync PAST sessions from Acuity for a SINGLE parent.
 *
 * Usage:
 *   pnpm tsx scripts/sync-acuity-past-sessions-parent.ts munidinesh@gmail.com
 *
 * Strategy:
 * - Fetch appointments per calendarID (only tutors linked to this parent)
 * - Filter client-side to match the parent's email(s) in Acuity
 * - TALLY: find platform sessions with no matching Acuity appointment → stale rows
 *   → preserve notes from stale rows before deleting
 * - 3-step lookup: exact match → same-day match (fix wrong tz) → insert
 * - Print final session table for manual verification
 * - Recalculate sessionsCompleted for this parent
 *
 * Safe to re-run — idempotent.
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, subscriptions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

const PARENT_EMAIL = process.argv[2]?.toLowerCase().trim();
if (!PARENT_EMAIL) {
  console.error("Usage: pnpm tsx scripts/sync-acuity-past-sessions-parent.ts <parent-email> [start-date]");
  console.error("  start-date defaults to 2025-04-01, e.g. 2024-01-01");
  process.exit(1);
}
// Optional start date override: pnpm tsx ... parent@email.com 2024-01-01
const START_DATE_ARG = process.argv[3]?.trim();

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

// Date range: start date → 2 days ago
const MIN_DATE = START_DATE_ARG ?? "2025-04-01";
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 2);
const MAX_DATE = cutoff.toISOString().split("T")[0];

// ── Known email aliases (some parents use different emails in Acuity) ────────
const PARENT_EMAIL_ALIASES: Record<string, string[]> = {
  "nithdeepsai@gmail.com": ["nithdeepsai@gmail.com", "nithilansai@gmail.com"],
  "nirmal.adlin.usa@gmail.com": ["nirmal.adlin.usa@gmail.com", "neola.rini@gmail.com", "nichelle.riji@gmail.com"],
  "krithika1412@gmail.com": ["krithika1412@gmail.com", "krithikar06@gmail.com", "varshak0211@gmail.com", "sanabiyer@gmail.com"],
  "param_palani@yahoo.com": ["param_palani@yahoo.com", "dhruvparram@gmail.com"],
  "ashok.sree@gmail.com": ["ashok.sree@gmail.com", "ashok.athiappan@gmail.com"],
  "jeelanimanikindi@gmail.com": ["jeelanimanikindi@gmail.com", "hafsa.numu@gmail.com"],
};

// ── Acuity calendarID → tutor primary email ───────────────────────────────────
const CALENDAR_TO_EMAIL: Record<number, string> = {
  9518516:  "dolon.mukherjee.2011@gmail.com",   // Ms. Dolon        → id 50
  13134669: "bichuskumar8@gmail.com",             // Mr. Bichu        → id 54
  12924725: "vgerarrd@gmail.com",                 // Mr. Gerard       → id 75
  7992988:  "gopisiri4268@gmail.com",             // Mr. Gopi         → id 72
  10639379: "akalyangupta@gmail.com",             // Mr. Kalyan       → id 53
  6631240:  "mustaqmic@gmail.com",                // Mr. Mustaq       → id 61
  8838338:  "naushadteaches@gmail.com",           // Mr. Naushad      → id 76
  7722765:  "pmudi.bppimt@gmail.com",             // Mr. Prasenjit    → id 66
  13611648: "ramesh030199@gmail.com",             // Mr. Ramesh       → id 56
  9584519:  "aish30george@gmail.com",             // Ms. Aishwarya    → id 69
  12748025: "anittadominic123@gmail.com",         // Ms. Anita        → id 51
  7203343:  "appysisodia@yahoo.com",              // Ms. Apoorva      → id 24
  5824683:  "maya.math289@gmail.com",             // Ms. Maya         → id 47
  9886816:  "mercyraniyedidi@gmail.com",          // Ms. Mercy Rani   → id 30
  12804136: "nalini.cheena@gmail.com",            // Ms. Nalini       → id 59
  4056973:  "shritisharma@gmail.com",             // Ms. Shriti       → id 23
  8255661:  "sivasankare.g@gmail.com",            // Ms. Sivasankaree → id 57
  7137621:  "sivasankare.g@gmail.com",            // Ms. Sivasankaree → id 57
  13204478: "codegems27@gmail.com",               // Ms. Vasudha      → id 77
  11083164: "vinaybalasisodia@gmail.com",         // Ms. Vinayabala   → id 71
  13821319: "seswar8180@gmail.com",               // SriAditya/Eswar  → id 43
  12585605: "chintalapati.vrs@gmail.com",         // Sriilalit        → id 52
  13801030: "sharved2508@gmail.com",              // Mr. Goury        → id 70
  12986707: "shafirasik757575@gmail.com",         // Ms. Shafia       → id 58
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
  71128121: 299, 26804614: 299,
  14691576: 95,   // High School Math US → HSPT Math

  // Math — AP / A Level
  71556848: 33, 87502622: 33, 87525059: 33,

  // Math — SAT/ACT/PSAT
  19034374: 1,    // PSAT/SAT/ACT Math - Private Session
  14701559: 1,    // PSAT/SAT/ACT Math - Free Trial Session
  14792692: 25,   // PSAT/SAT/ACT English - Private Session
  15690898: 25,   // PSAT/SAT/ACT English - Free Trial Session

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

  // Misc
  31198809: null, 78945546: null, 72851734: null, 72851975: null, 74022709: null, 74023161: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEmails(raw: string): string[] {
  return (raw || "").split(/[,;]/).map((e) => e.toLowerCase().trim()).filter(Boolean);
}

function extractZoomUrl(location: string): string | null {
  if (!location) return null;
  const match = location.match(/https:\/\/[^\s]+zoom\.us\/j\/[^\s]+/);
  return match ? match[0] : null;
}

// Fetch appointments per calendar using sliding maxDate window.
// Per-calendar is required to get PAST appointments from Acuity (bulk endpoint only returns future).
// Acuity ignores offset for per-calendar fetches, so we paginate by sliding maxDate backward.
async function fetchBulkForParent(acuityEmails: Set<string>, calendarIds: Set<number>): Promise<any[]> {
  const all: any[] = [];

  for (const calId of calendarIds) {
    let calCount = 0;
    let windowMax = MAX_DATE;
    const minMs = new Date(MIN_DATE).getTime();
    const seenIds = new Set<number>();

    process.stdout.write(`  📅 calendarID=${calId}...`);

    while (true) {
      const params = new URLSearchParams({
        calendarID: String(calId),
        minDate: MIN_DATE, maxDate: windowMax,
        max: "500",
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      let res: Response;
      try {
        res = await fetch(`${ACUITY_BASE}/appointments?${params}`, {
          headers: { Authorization: `Basic ${AUTH}` },
          signal: controller.signal,
        });
      } catch {
        clearTimeout(timeout);
        process.stdout.write(` timeout\n`);
        break;
      }
      clearTimeout(timeout);
      if (!res.ok) { process.stdout.write(` error ${res.status}\n`); break; }
      const page = await res.json();
      if (!Array.isArray(page) || page.length === 0) break;

      const minMs = new Date(MIN_DATE).getTime();
      const maxMs = new Date(MAX_DATE + "T23:59:59Z").getTime();
      // Filter new (unseen) appointments for this parent within date range
      const forParent = page.filter((a: any) => {
        if (seenIds.has(a.id)) return false;
        const t = new Date(a.datetime).getTime();
        if (t < minMs || t > maxMs) return false;
        return parseEmails(a.email).some((e) => acuityEmails.has(e));
      });
      // Track all seen IDs to detect when window stops moving
      let newTotal = 0;
      for (const a of page) {
        if (!seenIds.has(a.id)) { seenIds.add(a.id); newTotal++; }
      }

      all.push(...forParent);
      calCount += forParent.length;

      // If fewer than 500 returned, we have everything in this window
      if (page.length < 500) break;

      // Slide window: set maxDate to oldest date in this page minus 1 day
      const oldestMs = new Date(page[page.length - 1].datetime).getTime();
      if (oldestMs <= minMs) break; // reached start of range
      if (newTotal === 0) break; // no new items, window stuck

      const newMax = new Date(oldestMs - 86400000); // subtract 1 day
      windowMax = newMax.toISOString().split("T")[0];
    }

    if (calCount > 0) {
      process.stdout.write(` ${calCount} matched\n`);
    } else {
      process.stdout.write(` 0 matched\n`);
    }
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB not available"); process.exit(1); }

  console.log(`\n📅 Syncing past sessions for: ${PARENT_EMAIL}`);
  console.log(`   Date range: ${MIN_DATE} → ${MAX_DATE}\n`);

  // Load parent
  const parentRows = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, PARENT_EMAIL));
  if (parentRows.length === 0) {
    console.error(`❌ Parent not found: ${PARENT_EMAIL}`);
    process.exit(1);
  }
  const parentId = parentRows[0].id;
  console.log(`👤 Parent ID: ${parentId}`);

  // Determine all emails this parent uses in Acuity
  const acuityEmails = new Set<string>(
    PARENT_EMAIL_ALIASES[PARENT_EMAIL] ?? [PARENT_EMAIL]
  );
  console.log(`   Acuity emails: ${[...acuityEmails].join(", ")}`);

  // Load all tutors
  const allTutors = await db.select({ id: users.id, email: users.email })
    .from(users).where(eq(users.role, "tutor"));
  const tutorEmailToId: Record<string, number> = {};
  const tutorIdToName: Record<number, string> = {};
  for (const t of allTutors) {
    tutorEmailToId[t.email.toLowerCase()] = t.id;
  }
  const allTutorNames = await db.select({ id: users.id, name: users.name })
    .from(users).where(eq(users.role, "tutor"));
  for (const t of allTutorNames) tutorIdToName[t.id] = t.name;

  // Load parent's subscriptions to determine which tutors to query
  const parentSubs = await db.select({
    id: subscriptions.id,
    courseId: subscriptions.courseId,
    preferredTutorId: subscriptions.preferredTutorId,
    status: subscriptions.status,
    studentFirstName: subscriptions.studentFirstName,
  }).from(subscriptions).where(eq(subscriptions.parentId, parentId));

  // Build subMap for ALL tutors (not just current) — past sessions may have different tutor
  const subMap: Record<string, number> = {};
  for (const s of parentSubs) {
    if (!s.preferredTutorId) continue;
    const key = `${parentId}-${s.preferredTutorId}-${s.courseId}`;
    if (!subMap[key] || s.status === "active") subMap[key] = s.id;
  }
  console.log(`   Subscriptions: ${parentSubs.length}`);

  // ALL calendarIDs from CALENDAR_TO_EMAIL — past sessions may come from any tutor
  const allCalendarIds = new Set<number>(
    Object.keys(CALENDAR_TO_EMAIL).map(Number)
  );

  // Bulk fetch all appointments in date range, filter client-side for this parent
  // No calendarID restriction — fetch from ALL tutors to catch previous tutor sessions
  console.log(`📦 Bulk fetching appointments (filtering for this parent client-side)...`);
  const acuityAppointments = await fetchBulkForParent(acuityEmails, allCalendarIds);
  console.log(`\n✅ ${acuityAppointments.length} Acuity appointments found for ${PARENT_EMAIL}\n`);

  // Build set of valid (tutorId, scheduledAtMs) from Acuity
  const validAcuityKeys = new Set<string>();
  for (const appt of acuityAppointments) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;
    const ms = new Date(appt.datetime).getTime();
    if (!isNaN(ms)) validAcuityKeys.add(`${tutorId}:${ms}`);
  }

  // ── TALLY: find stale platform sessions (not in Acuity) ─────────────────────
  const minMs = new Date(MIN_DATE).getTime();
  const maxMs = new Date(MAX_DATE + "T23:59:59Z").getTime();

  const platformSessions = await db.execute(sql`
    SELECT s.id, s.tutorId, s.courseId, s.scheduledAt, s.status,
      s.studentFirstName, s.subscriptionId, s.feedbackFromTutor,
      u.name as tutorName
    FROM sessions s
    JOIN users u ON u.id = s.tutorId
    WHERE s.parentId = ${parentId}
      AND s.scheduledAt >= ${minMs}
      AND s.scheduledAt <= ${maxMs}
      AND s.id >= 30000
    ORDER BY s.scheduledAt DESC
  `);
  const platformRows = (platformSessions as any)[0] as any[];

  console.log(`🔍 Tallying ${platformRows.length} platform sessions against Acuity...\n`);

  let staleDeleted = 0, notesPreserved = 0;

  for (const row of platformRows) {
    // Skip scheduled/upcoming — these are from the upcoming sync, keep them
    if (row.status === "scheduled" || row.status === "upcoming") continue;

    const key = `${row.tutorId}:${Number(row.scheduledAt)}`;
    if (validAcuityKeys.has(key)) continue; // Matches Acuity — keep it

    // No Acuity match — this is a stale row
    console.log(`🗑️  Stale: id=${row.id} tutor=${row.tutorName} ${new Date(Number(row.scheduledAt)).toISOString()} status=${row.status} notes=${row.feedbackFromTutor ? "YES" : "none"}`);

    if (row.feedbackFromTutor) {
      // Find the correct same-day session to move notes to
      const sameDay = await db.execute(sql`
        SELECT id FROM sessions
        WHERE tutorId = ${row.tutorId}
          AND parentId = ${parentId}
          AND DATE(FROM_UNIXTIME(scheduledAt/1000)) = DATE(FROM_UNIXTIME(${Number(row.scheduledAt)}/1000))
          AND id != ${row.id}
          AND status != 'cancelled'
        LIMIT 1
      `);
      const sameDayRows = (sameDay as any)[0] as any[];
      if (sameDayRows?.length > 0) {
        await db.execute(sql`
          UPDATE sessions SET
            feedbackFromTutor = COALESCE(feedbackFromTutor, ${row.feedbackFromTutor})
          WHERE id = ${sameDayRows[0].id}
        `);
        console.log(`   → Notes moved to session id=${sameDayRows[0].id}`);
        notesPreserved++;
      } else {
        console.log(`   ⚠️  No same-day session to move notes to — keeping row to preserve notes`);
        continue; // Don't delete if we can't preserve the notes
      }
    }

    await db.execute(sql`DELETE FROM sessions WHERE id = ${row.id}`);
    staleDeleted++;
  }

  console.log(`\n✅ Stale rows deleted: ${staleDeleted}, Notes preserved: ${notesPreserved}\n`);

  // ── Process Acuity appointments: 3-step lookup ───────────────────────────────
  const unknownTypes = new Set<number>();
  let inserted = 0, updated = 0, timeFixed = 0, notesAdded = 0, skipped = 0;

  console.log(`⚙️  Processing ${acuityAppointments.length} Acuity appointments...`);

  for (const appt of acuityAppointments) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;

    const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
    if (courseId === undefined) { unknownTypes.add(appt.appointmentTypeID); continue; }
    if (courseId === null) continue;

    const scheduledAtMs = new Date(appt.datetime).getTime();
    if (isNaN(scheduledAtMs)) continue;

    const duration = parseInt(appt.duration, 10) || 60;
    const meetingUrl = extractZoomUrl(appt.location || "");
    // Try exact tutor match first, then fall back to any sub for this course
    // (handles case where tutor changed — past sessions had different preferredTutorId)
    const subKey = `${parentId}-${tutorId}-${courseId}`;
    const subKeyAnyTutor = Object.keys(subMap).find(k => k.startsWith(`${parentId}-`) && k.endsWith(`-${courseId}`));
    const subscriptionId = subMap[subKey] ?? (subKeyAnyTutor ? subMap[subKeyAnyTutor] : null);
    const studentFirstName = (appt.firstName || "").trim() || null;
    const studentLastName = (appt.lastName || "").trim() || null;
    const notes = (appt.notes || "").trim() || null;
    const sessionStatus = appt.noShow === true ? "no_show" : "completed";

    try {
      // Step 1: exact match
      const exactMatch = await db.execute(sql`
        SELECT id, status, feedbackFromTutor, subscriptionId, courseId
        FROM sessions
        WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs}
        LIMIT 1
      `);
      const exactRows = (exactMatch as any)[0] as any[];

      if (exactRows?.length > 0) {
        const row = exactRows[0];
        const needsStatusFix = !["completed", "cancelled", "no_show"].includes(row.status);
        const needsNotes = notes && !row.feedbackFromTutor;
        const needsSubLink = !row.subscriptionId && subscriptionId;
        const needsCoursefix = row.id >= 30000 && row.courseId !== courseId;

        if (needsStatusFix || needsNotes || needsSubLink || needsCoursefix) {
          await db.execute(sql`
            UPDATE sessions SET
              status = CASE WHEN status NOT IN ('completed', 'cancelled', 'no_show') THEN ${sessionStatus} ELSE status END,
              feedbackFromTutor = COALESCE(feedbackFromTutor, ${notes}),
              subscriptionId = COALESCE(subscriptionId, ${subscriptionId}),
              courseId = CASE WHEN id >= 30000 THEN ${courseId} ELSE courseId END,
              studentFirstName = COALESCE(studentFirstName, ${studentFirstName}),
              studentLastName = COALESCE(studentLastName, ${studentLastName})
            WHERE id = ${row.id}
          `);
          updated++;
          if (needsNotes) notesAdded++;
        } else {
          skipped++;
        }
        continue;
      }

      // Step 2: same-day match (fix wrong timezone)
      const sameDayMatch = await db.execute(sql`
        SELECT id, status, feedbackFromTutor, subscriptionId, courseId, scheduledAt
        FROM sessions
        WHERE tutorId = ${tutorId}
          AND parentId = ${parentId}
          AND DATE(FROM_UNIXTIME(scheduledAt/1000)) = DATE(FROM_UNIXTIME(${scheduledAtMs}/1000))
          AND (studentFirstName = ${studentFirstName} OR studentFirstName IS NULL)
          AND status != 'cancelled'
        LIMIT 1
      `);
      const sameDayRows = (sameDayMatch as any)[0] as any[];

      if (sameDayRows?.length > 0) {
        const row = sameDayRows[0];
        await db.execute(sql`
          UPDATE sessions SET
            scheduledAt = ${scheduledAtMs},
            status = CASE WHEN status NOT IN ('completed', 'cancelled', 'no_show') THEN ${sessionStatus} ELSE status END,
            feedbackFromTutor = COALESCE(feedbackFromTutor, ${notes}),
            subscriptionId = COALESCE(subscriptionId, ${subscriptionId}),
            courseId = CASE WHEN id >= 30000 THEN ${courseId} ELSE courseId END,
            studentFirstName = COALESCE(studentFirstName, ${studentFirstName}),
            studentLastName = COALESCE(studentLastName, ${studentLastName}),
            meetingUrl = COALESCE(meetingUrl, ${meetingUrl})
          WHERE id = ${row.id}
        `);
        timeFixed++;
        updated++;
        continue;
      }

      // Step 3: insert
      await db.execute(sql`
        INSERT IGNORE INTO sessions
          (subscriptionId, tutorId, parentId, scheduledAt, duration, status, isTrial, courseId, meetingUrl, meetingPlatform, studentFirstName, studentLastName, feedbackFromTutor)
        VALUES
          (${subscriptionId}, ${tutorId}, ${parentId}, ${scheduledAtMs}, ${duration}, ${sessionStatus}, 0, ${courseId}, ${meetingUrl}, 'Zoom', ${studentFirstName}, ${studentLastName}, ${notes})
      `);
      inserted++;
    } catch (err: any) {
      console.error(`❌ Error appt id=${appt.id}: ${err.message}`);
    }
  }

  // ── Recalculate sessionsCompleted for this parent ────────────────────────────
  await db.execute(sql`
    UPDATE subscriptions sub
    SET sub.sessionsCompleted = (
      SELECT COUNT(*) FROM sessions s
      WHERE s.parentId = sub.parentId
        AND s.tutorId = sub.preferredTutorId
        AND s.courseId = sub.courseId
        AND s.studentFirstName = sub.studentFirstName
        AND s.status = 'completed'
    )
    WHERE sub.parentId = ${parentId}
      AND sub.preferredTutorId IS NOT NULL
  `);

  if (unknownTypes.size > 0) {
    console.log(`\n⚠️  Unknown appointmentTypeIDs:`);
    for (const t of unknownTypes) console.log(`   ${t}`);
  }

  // ── Print final session table ─────────────────────────────────────────────────
  const finalSessions = await db.execute(sql`
    SELECT s.id, s.scheduledAt, s.courseId, s.status, s.studentFirstName,
      s.subscriptionId, s.feedbackFromTutor,
      u.name as tutorName,
      c.title as courseName
    FROM sessions s
    JOIN users u ON u.id = s.tutorId
    LEFT JOIN courses c ON c.id = s.courseId
    WHERE s.parentId = ${parentId}
    ORDER BY s.scheduledAt DESC
    LIMIT 100
  `);
  const finalRows = (finalSessions as any)[0] as any[];

  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log(`📋 All sessions for ${PARENT_EMAIL} (${finalRows.length} total, newest first)`);
  console.log("═══════════════════════════════════════════════════════════════════════════════");
  console.log(`${"ID".padEnd(7)} | ${"Date".padEnd(12)} | ${"Time".padEnd(8)} | ${"Course".padEnd(20)} | ${"Tutor".padEnd(20)} | ${"Status".padEnd(10)} | ${"Student".padEnd(12)} | Notes`);
  console.log(`${"-".repeat(7)}-|-${"-".repeat(12)}-|-${"-".repeat(8)}-|-${"-".repeat(20)}-|-${"-".repeat(20)}-|-${"-".repeat(10)}-|-${"-".repeat(12)}-|------`);

  for (const r of finalRows) {
    const d = new Date(Number(r.scheduledAt));
    const date = d.toISOString().split("T")[0];
    const time = d.toISOString().split("T")[1].substring(0, 5);
    const course = (r.courseName || `courseId=${r.courseId}`).substring(0, 20).padEnd(20);
    const tutor = (r.tutorName || "?").substring(0, 20).padEnd(20);
    const status = (r.status || "?").substring(0, 10).padEnd(10);
    const student = (r.studentFirstName || "?").substring(0, 12).padEnd(12);
    const notes = r.feedbackFromTutor ? "✓" : "";
    console.log(`${String(r.id).padEnd(7)} | ${date} | ${time}  | ${course} | ${tutor} | ${status} | ${student} | ${notes}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════════════════════");
  console.log("🎉 Sync complete!");
  console.log(`   Stale rows deleted       : ${staleDeleted}`);
  console.log(`   Notes preserved          : ${notesPreserved}`);
  console.log(`   Inserted                 : ${inserted}`);
  console.log(`   Updated (no time change) : ${updated - timeFixed}`);
  console.log(`   Time fixed (wrong tz)    : ${timeFixed}`);
  console.log(`   Notes added              : ${notesAdded}`);
  console.log(`   Skipped (no change)      : ${skipped}`);
  console.log("═══════════════════════════════════════════════════════════════════════════════");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
