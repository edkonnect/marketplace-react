/**
 * Sync PAST sessions from Acuity into the platform DB for ALL parents.
 *
 * Strategy:
 * - Bulk fetch ALL appointments in date range (fast, single paginated stream)
 * - For each appointment: match tutor via calendarID, parent via email
 * - Lookup existing session by exact (tutorId + scheduledAt) first
 * - If not found: try same-day match (tutorId + parentId + DATE + studentFirstName)
 *   → fixes sessions that were imported with wrong timezone (tutor tz instead of UTC)
 * - Update scheduledAt in place, preserving existing notes/feedbackFromTutor
 * - Insert if truly missing
 * - Cancelled sessions: insert if missing so they show in platform
 * - At end: recalculate sessionsCompleted for all subscriptions
 *
 * Safe to re-run — idempotent.
 *
 * Run:
 *   pnpm tsx scripts/sync-acuity-past-sessions.ts
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, subscriptions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

// Date range: April 2025 → 2 days ago (avoid overlap with upcoming sync which handles yesterday/today)
const MIN_DATE = "2025-04-01";
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 2);
const MAX_DATE = cutoff.toISOString().split("T")[0];

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
  27561406: 251, 27561385: 251,

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
  71170467: 114, 38757538: 114, 27314289: 114,

  // English — High School
  71128100: 116, 38756951: 116,

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

async function fetchAllBulk(includeCancelled: boolean): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const minMs = new Date(MIN_DATE).getTime();
  const maxMs = new Date(MAX_DATE + "T23:59:59Z").getTime();

  while (true) {
    const params = new URLSearchParams({
      minDate: MIN_DATE, maxDate: MAX_DATE,
      max: "500", offset: String(offset),
    });
    if (includeCancelled) params.set("canceled", "true");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
    let res: Response;
    try {
      res = await fetch(`${ACUITY_BASE}/appointments?${params}`, {
        headers: { Authorization: `Basic ${AUTH}` },
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      console.error(`⏱️  Timeout/error at offset=${offset}: ${err.message}`);
      break;
    }
    clearTimeout(timeout);
    if (!res.ok) { console.error(`Acuity error ${res.status}`); break; }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;

    // For cancelled, Acuity ignores minDate/maxDate — filter client-side
    // Also stop paginating if all items in this page are before our range
    const inRange = page.filter((a: any) => {
      const t = new Date(a.datetime).getTime();
      return t >= minMs && t <= maxMs;
    });
    all.push(...inRange);
    console.log(`  → ${all.length} in-range (page ${page.length}, offset=${offset})`);

    if (page.length < 500) break;

    // If the entire page is before our date range, stop paginating
    const lastMs = new Date(page[page.length - 1].datetime).getTime();
    if (lastMs < minMs) {
      console.log(`  → All items before ${MIN_DATE}, stopping pagination`);
      break;
    }

    offset += 500;
  }
  return all;
}

function extractZoomUrl(location: string): string | null {
  if (!location) return null;
  const match = location.match(/https:\/\/[^\s]+zoom\.us\/j\/[^\s]+/);
  return match ? match[0] : null;
}

function parseEmails(raw: string): string[] {
  return (raw || "").split(/[,;]/).map((e) => e.toLowerCase().trim()).filter(Boolean);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB not available"); process.exit(1); }

  console.log(`📅 Syncing past Acuity sessions: ${MIN_DATE} → ${MAX_DATE}\n`);

  // Build lookup maps
  const allTutors = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "tutor"));
  const tutorEmailToId: Record<string, number> = {};
  for (const t of allTutors) tutorEmailToId[t.email.toLowerCase()] = t.id;

  const allParents = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.role, "parent"));
  const parentEmailToId: Record<string, number> = {};
  for (const p of allParents) parentEmailToId[p.email.toLowerCase()] = p.id;

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

  console.log(`👤 ${allParents.length} parents, 🎓 ${allTutors.length} tutors loaded`);

  // Fetch all appointments in bulk
  console.log(`\n📦 Fetching scheduled appointments...`);
  const scheduled = await fetchAllBulk(false);
  console.log(`📦 ${scheduled.length} scheduled appointments\n`);

  // Skip cancelled fetch — Acuity ignores minDate/maxDate for canceled=true
  // and returns ALL cancelled appointments ever (26000+). Past cancelled sessions
  // are not critical for the platform, so we skip them here.
  const cancelled: any[] = [];
  console.log(`📦 Skipping cancelled appointments fetch (Acuity returns all-time data ignoring date range)\n`);

  const unknownTypes = new Set<number>();
  let inserted = 0, updated = 0, timeFixed = 0, notesAdded = 0, cancelledInserted = 0, skipped = 0;

  // ── Process scheduled appointments ──────────────────────────────────────────
  console.log(`⚙️  Processing ${scheduled.length} scheduled appointments...`);
  for (const appt of scheduled) {
    // Resolve tutor
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;

    // Resolve parent
    const emails = parseEmails(appt.email);
    const parentId = emails.reduce((found: number | undefined, e) => found ?? parentEmailToId[e], undefined as number | undefined);
    if (!parentId) continue; // not a migrated parent

    // Resolve course
    const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
    if (courseId === undefined) { unknownTypes.add(appt.appointmentTypeID); continue; }
    if (courseId === null) continue;

    const scheduledAtMs = new Date(appt.datetime).getTime(); // correct UTC from Acuity
    if (isNaN(scheduledAtMs)) continue;

    const duration = parseInt(appt.duration, 10) || 60;
    const meetingUrl = extractZoomUrl(appt.location || "");
    const subKey = `${parentId}-${tutorId}-${courseId}`;
    const subscriptionId = subMap[subKey] ?? null;
    const studentFirstName = (appt.firstName || "").trim() || null;
    const studentLastName = (appt.lastName || "").trim() || null;
    const notes = (appt.notes || "").trim() || null;
    const sessionStatus = appt.noShow === true ? "no_show" : "completed";

    try {
      // Step 1: exact match by tutorId + scheduledAt (unique key)
      const exactMatch = await db.execute(sql`
        SELECT id, status, feedbackFromTutor, subscriptionId, courseId
        FROM sessions
        WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs}
        LIMIT 1
      `);
      const exactRows = (exactMatch as any)[0] as any[];

      if (exactRows?.length > 0) {
        // Exact match found — update if needed
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

      // Step 2: same-day match — find session on same UTC date, same tutor+parent+student
      // This fixes sessions imported with wrong timezone (tutor tz instead of UTC)
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
        // Same-day match — fix the scheduledAt + update other fields
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

      // Step 3: truly missing — insert
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

  // ── Process cancelled appointments ──────────────────────────────────────────
  console.log(`\n⚙️  Processing ${cancelled.length} cancelled appointments...`);
  for (const appt of cancelled) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;

    const emails = parseEmails(appt.email);
    const parentId = emails.reduce((found: number | undefined, e) => found ?? parentEmailToId[e], undefined as number | undefined);
    if (!parentId) continue;

    const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
    if (courseId === undefined || courseId === null) continue;

    const scheduledAtMs = new Date(appt.datetime).getTime();
    if (isNaN(scheduledAtMs)) continue;

    const duration = parseInt(appt.duration, 10) || 60;
    const subKey = `${parentId}-${tutorId}-${courseId}`;
    const subscriptionId = subMap[subKey] ?? null;
    const studentFirstName = (appt.firstName || "").trim() || null;
    const studentLastName = (appt.lastName || "").trim() || null;

    try {
      // Check exact match first
      const exactMatch = await db.execute(sql`
        SELECT id FROM sessions WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs} LIMIT 1
      `);
      const exactRows = (exactMatch as any)[0] as any[];

      if (exactRows?.length > 0) {
        // Update to cancelled if not already completed
        await db.execute(sql`
          UPDATE sessions SET status = 'cancelled'
          WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs}
            AND parentId = ${parentId}
            AND status NOT IN ('completed', 'cancelled')
        `);
      } else {
        // Check same-day match
        const sameDayMatch = await db.execute(sql`
          SELECT id FROM sessions
          WHERE tutorId = ${tutorId} AND parentId = ${parentId}
            AND DATE(FROM_UNIXTIME(scheduledAt/1000)) = DATE(FROM_UNIXTIME(${scheduledAtMs}/1000))
            AND status NOT IN ('completed', 'cancelled')
          LIMIT 1
        `);
        const sameDayRows = (sameDayMatch as any)[0] as any[];

        if (sameDayRows?.length > 0) {
          await db.execute(sql`
            UPDATE sessions SET scheduledAt = ${scheduledAtMs}, status = 'cancelled'
            WHERE id = ${sameDayRows[0].id}
          `);
        } else {
          // Insert as cancelled
          await db.execute(sql`
            INSERT IGNORE INTO sessions
              (subscriptionId, tutorId, parentId, scheduledAt, duration, status, isTrial, courseId, meetingPlatform, studentFirstName, studentLastName)
            VALUES
              (${subscriptionId}, ${tutorId}, ${parentId}, ${scheduledAtMs}, ${duration}, 'cancelled', 0, ${courseId}, 'Zoom', ${studentFirstName}, ${studentLastName})
          `);
          cancelledInserted++;
        }
      }
    } catch (err: any) {
      console.error(`❌ Cancel error appt id=${appt.id}: ${err.message}`);
    }
  }

  // ── Recalculate sessionsCompleted ────────────────────────────────────────────
  console.log(`\n🔢 Updating sessionsCompleted for all subscriptions...`);
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
    WHERE sub.preferredTutorId IS NOT NULL
  `);

  if (unknownTypes.size > 0) {
    console.log(`\n⚠️  Unknown appointmentTypeIDs (add to APPT_TYPE_TO_COURSE):`);
    for (const t of unknownTypes) console.log(`   ${t}`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("🎉 Past session sync complete!");
  console.log(`   Inserted (completed/no_show) : ${inserted}`);
  console.log(`   Inserted (cancelled)         : ${cancelledInserted}`);
  console.log(`   Updated (no time change)     : ${updated - timeFixed}`);
  console.log(`   Time fixed (wrong tz)        : ${timeFixed}`);
  console.log(`   Notes added                  : ${notesAdded}`);
  console.log(`   Skipped (no change needed)   : ${skipped}`);
  console.log("═══════════════════════════════════════");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
