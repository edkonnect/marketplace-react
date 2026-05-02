/**
 * TEST: Sync past sessions from Acuity for ONE parent only.
 * Parent: nithdeepsai@gmail.com
 *
 * Run:
 *   pnpm tsx scripts/sync-acuity-past-sessions-test.ts
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, sessions, subscriptions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const TEST_PARENT_EMAIL = "nithdeepsai@gmail.com";
// All emails this parent uses in Acuity (comma-separated accounts)
const TEST_PARENT_ACUITY_EMAILS = ["nithdeepsai@gmail.com", "nithilansai@gmail.com"];
// Only fetch these tutor calendars (calendarIDs for Mustaq and Apoorva)
const TEST_CALENDAR_IDS = [6631240, 7203343];

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

const APPT_TYPE_TO_COURSE: Record<number, number | null> = {
  57218677: 51, 54015900: 51, 61243720: 51,
  76604953: 21, 84510036: 22, 84052873: 69,
  14691452: null, 14793473: null, 26804440: null, 38753649: null,
  38754939: null, 38754970: null, 49843342: null, 25031851: null, 19017079: null,
  71128291: 293, 14474827: 293,
  71128121: 299, 26804614: 299,
  14691576: 95,
  71556848: 33, 87502622: 33,
  27561406: 251, 27561385: 251,
  19034374: 1, 14701559: 1, 14792692: 25, 15690898: 25,
  59210772: null,
  16723795: 115, 16723876: 115, 24510098: 115, 27314309: 115, 27314322: 115,
  38755753: 115, 38755818: 115, 49843317: 115, 31251347: 115,
  71170467: 114, 38757538: 114, 27314289: 114,
  71128100: 116, 38756951: 116,
  30219038: 252, 30219026: 252,
  88415090: 29, 34108709: 276, 55339864: 276, 62762521: 276,
  55339838: 25, 40643350: 25,
  25157139: 63, 25157101: 63, 44199566: 63, 44199912: 63,
  48657229: 63, 37280049: 63, 32458048: 63,
  80404280: 43, 31263147: 41, 31263177: 41,
  71128190: 84, 46157449: 84, 46157379: 84, 56889632: null,
  71128157: 227, 35389384: 227, 35389295: 227, 35389450: 227, 35389891: 227, 48083214: 227,
  71128144: 226, 28978757: 226, 28978734: 226, 31913387: 226, 31913430: 226, 40922081: 226,
  71128249: 228, 71170563: 226, 33654551: 228,
  63049663: 255, 74079295: 255,
  39842697: 254, 39842708: 254, 52027965: 253, 52027983: 253,
  46627128: 58, 46627181: 58, 54274277: 58, 54274313: 58,
  41024493: 118, 38819183: null, 38819198: null, 40310481: null, 40310452: null,
  37431356: null, 37431358: null, 43468047: null, 34033973: null, 38087738: null, 35257646: null,
  39814134: null, 39814142: null, 40615548: null, 40615562: null,
  31198809: null, 78945546: null, 72851734: null, 72851975: null, 74022709: null, 74023161: null,
};

async function fetchAppointmentsForCalendar(calendarId: number, minDate: string, maxDate: string, includeCancelled: boolean): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({ minDate, maxDate, max: "500", offset: String(offset), calendarID: String(calendarId) });
    if (includeCancelled) params.set("canceled", "true");
    const url = `${ACUITY_BASE}/appointments?${params}`;
    console.log(`  → GET ${url}`);
    const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
    if (!res.ok) { console.error(`Acuity error: ${res.status}`); break; }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < 500) break;
    offset += 500;
  }
  return all;
}

async function fetchAllAppointments(minDate: string, maxDate: string): Promise<any[]> {
  const all: any[] = [];
  for (const calId of TEST_CALENDAR_IDS) {
    console.log(`  → Fetching calendarID=${calId} (scheduled)...`);
    const scheduled = await fetchAppointmentsForCalendar(calId, minDate, maxDate, false);
    console.log(`     ${scheduled.length} scheduled`);

    console.log(`  → Fetching calendarID=${calId} (cancelled)...`);
    const cancelled = await fetchAppointmentsForCalendar(calId, minDate, maxDate, true);
    const cancelledOnly = cancelled.filter((a) => a.canceled === true);
    console.log(`     ${cancelledOnly.length} cancelled`);

    all.push(...scheduled, ...cancelledOnly);
  }
  return all;
}

function extractZoomUrl(location: string): string | null {
  if (!location) return null;
  const match = location.match(/https:\/\/[^\s]+zoom\.us\/j\/[^\s]+/);
  return match ? match[0] : null;
}

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB not available"); process.exit(1); }

  const minDate = "2025-12-11";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = yesterday.toISOString().split("T")[0];

  console.log(`📅 Syncing past Acuity sessions for ${TEST_PARENT_EMAIL}`);
  console.log(`   Range: ${minDate} → ${maxDate}\n`);

  // Load tutor map
  const allTutors = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "tutor"));
  const tutorEmailToId: Record<string, number> = {};
  for (const t of allTutors) tutorEmailToId[t.email.toLowerCase()] = t.id;

  // Get parent ID
  const parentRows = await db.select({ id: users.id }).from(users).where(eq(users.email, TEST_PARENT_EMAIL));
  if (!parentRows.length) { console.error(`Parent not found: ${TEST_PARENT_EMAIL}`); process.exit(1); }
  const parentId = parentRows[0].id;
  console.log(`✅ Parent found: id=${parentId}\n`);

  // Build subscription map for this parent
  const allSubs = await db.select({
    id: subscriptions.id,
    courseId: subscriptions.courseId,
    preferredTutorId: subscriptions.preferredTutorId,
    status: subscriptions.status,
    studentFirstName: subscriptions.studentFirstName,
  }).from(subscriptions).where(eq(subscriptions.parentId, parentId));

  const subMap: Record<string, number> = {};
  for (const s of allSubs) {
    if (!s.preferredTutorId) continue;
    const key = `${s.preferredTutorId}-${s.courseId}`;
    if (!subMap[key] || s.status === "active") subMap[key] = s.id;
  }
  console.log(`📋 ${allSubs.length} subscriptions loaded for parent\n`);

  // Fetch all past appointments
  const allAppts = await fetchAllAppointments(minDate, maxDate);

  // Filter to this parent only (Acuity email filter param doesn't work reliably)
  const parentAppts = allAppts.filter((a) => {
    // Acuity stores multiple emails separated by comma OR semicolon
    const emails = (a.email || "").split(/[,;]/).map((e: string) => e.toLowerCase().trim());
    return TEST_PARENT_ACUITY_EMAILS.some((pe) => emails.includes(pe.toLowerCase()));
  });

  console.log(`\n📦 ${allAppts.length} total, ${parentAppts.length} appointments for ${TEST_PARENT_EMAIL}`);

  const scheduled = parentAppts.filter((a) => !a.canceled);
  const cancelled = parentAppts.filter((a) => a.canceled === true);
  const noShows = scheduled.filter((a) => a.noShow === true);
  console.log(`   ✅ ${scheduled.length} scheduled/completed (${noShows.length} no-shows)`);
  console.log(`   🚫 ${cancelled.length} cancelled\n`);

  let inserted = 0, updated = 0, notesAdded = 0, statusFixed = 0, skipped = 0;

  for (const appt of scheduled) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) {
      console.warn(`⚠️  No tutor mapped for calendarID=${appt.calendarID} (${appt.calendar})`);
      continue;
    }
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) { console.warn(`⚠️  Tutor email not in DB: ${tutorEmail}`); continue; }

    const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
    if (courseId === undefined) {
      console.warn(`⚠️  Unknown appointmentTypeID=${appt.appointmentTypeID} (${appt.type})`);
      continue;
    }
    if (courseId === null) { skipped++; continue; }

    const scheduledAtMs = new Date(appt.datetime).getTime();
    if (isNaN(scheduledAtMs)) { console.error(`❌ Bad datetime: ${appt.datetime}`); continue; }

    const duration = parseInt(appt.duration, 10) || 60;
    const meetingUrl = extractZoomUrl(appt.location || "");
    const subscriptionId = subMap[`${tutorId}-${courseId}`] ?? null;
    const studentFirstName = (appt.firstName || "").trim() || null;
    const studentLastName = (appt.lastName || "").trim() || null;
    const notes = (appt.notes || "").trim() || null;
    // Acuity noShow field tells us if student didn't show up
    const sessionStatus = appt.noShow === true ? "no_show" : "completed";

    // Check if exists
    const existing = await db.execute(sql`
      SELECT id, status, feedbackFromTutor, subscriptionId, courseId
      FROM sessions
      WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs}
      LIMIT 1
    `);
    const rows = (existing as any)[0] as any[];

    if (rows && rows.length > 0) {
      const row = rows[0];
      const needsStatusFix = row.status !== "completed" && row.status !== "cancelled" && row.status !== "no_show";
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
        console.log(`  ✏️  Updated session id=${row.id} | status_fix=${needsStatusFix} notes=${needsNotes} sub=${needsSubLink} course=${needsCoursefix}`);
        updated++;
        if (needsNotes) notesAdded++;
        if (needsStatusFix) statusFixed++;
      } else {
        console.log(`  ⏭️  Skipped session id=${row.id} (no changes needed)`);
        skipped++;
      }
    } else {
      await db.execute(sql`
        INSERT IGNORE INTO sessions
          (subscriptionId, tutorId, parentId, scheduledAt, duration, status, isTrial, courseId, meetingUrl, meetingPlatform, studentFirstName, studentLastName, feedbackFromTutor)
        VALUES
          (${subscriptionId}, ${tutorId}, ${parentId}, ${scheduledAtMs}, ${duration}, ${sessionStatus}, 0, ${courseId}, ${meetingUrl}, 'Zoom', ${studentFirstName}, ${studentLastName}, ${notes})
      `);
      console.log(`  ➕ Inserted new session | tutor=${tutorId} course=${courseId} date=${new Date(scheduledAtMs).toISOString().split('T')[0]}`);
      inserted++;
    }
  }

  // Process cancellations — update if exists, insert if not
  for (const appt of cancelled) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;

    const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
    if (courseId === undefined || courseId === null) continue;

    const scheduledAtMs = new Date(appt.datetime).getTime();
    if (isNaN(scheduledAtMs)) continue;

    const duration = parseInt(appt.duration, 10) || 60;
    const subscriptionId = subMap[`${tutorId}-${courseId}`] ?? null;
    const studentFirstName = (appt.firstName || "").trim() || null;
    const studentLastName = (appt.lastName || "").trim() || null;

    // Check if exists
    const existing = await db.execute(sql`
      SELECT id FROM sessions WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs} LIMIT 1
    `);
    const rows = (existing as any)[0] as any[];

    if (rows && rows.length > 0) {
      await db.execute(sql`
        UPDATE sessions SET status = 'cancelled'
        WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs}
          AND parentId = ${parentId}
          AND status NOT IN ('completed', 'cancelled')
      `);
    } else {
      // Insert as cancelled so it shows in the platform
      await db.execute(sql`
        INSERT IGNORE INTO sessions
          (subscriptionId, tutorId, parentId, scheduledAt, duration, status, isTrial, courseId, meetingPlatform, studentFirstName, studentLastName)
        VALUES
          (${subscriptionId}, ${tutorId}, ${parentId}, ${scheduledAtMs}, ${duration}, 'cancelled', 0, ${courseId}, 'Zoom', ${studentFirstName}, ${studentLastName})
      `);
      console.log(`  🚫 Inserted cancelled session | tutor=${tutorId} course=${courseId} date=${new Date(scheduledAtMs).toISOString().split('T')[0]}`);
    }
  }

  // Update sessionsCompleted for this parent's subscriptions
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

  console.log("\n═══════════════════════════════════════");
  console.log(`🎉 Done for ${TEST_PARENT_EMAIL}`);
  console.log(`   Inserted   : ${inserted}`);
  console.log(`   Updated    : ${updated} (notes: ${notesAdded}, status: ${statusFixed})`);
  console.log(`   Skipped    : ${skipped}`);
  console.log("═══════════════════════════════════════");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
