/**
 * Sync upcoming sessions from Acuity into the platform DB.
 *
 * - Fetches all appointments from today → +365 days (including cancelled)
 * - Matches parent by email, tutor by calendarID → tutor email → DB user
 * - Parses Acuity `datetime` (ISO with offset) directly to UTC — no manual tz math
 * - Inserts new sessions, skips duplicates (tutorId + scheduledAt unique constraint)
 * - Updates cancelled appointments → sets session status to 'cancelled'
 * - Links subscriptionId when a matching active subscription is found
 *
 * Run daily on EC2:
 *   pnpm tsx scripts/sync-acuity-upcoming-sessions.ts
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, sessions, subscriptions } from "../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

// ── Acuity credentials ────────────────────────────────────────────────────────
const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

// ── Acuity calendarID → tutor primary email ───────────────────────────────────
// Primary email = first email listed in Acuity calendar (the tutor's personal email)
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
  // Note: Ashwin (9344460), Shreyas (8111305), Surya (12765565), Wajendra (8509330),
  //       Aditi (8397933), Lavanya (11328467), Sheela (4000884), Shriya (7129143),
  //       Shweta (8255661 conflict), Jisha (13222214), Manisha (13518317)
  //       are not in prod DB — their appointments will be skipped
};

// ── Acuity appointmentTypeID → platform courseId ─────────────────────────────
// Covers the appointment types seen in production. null = skip (no matching course)
const APPT_TYPE_TO_COURSE: Record<number, number | null> = {
  // Computer Science / Programming
  57218677: 51,   // Middle School Computer Science → IB Computer Science (51)
  54015900: 51,   // High School Computer Science → IB Computer Science (51)
  61243720: 51,   // High School Computer Science - Free trial → IB Computer Science (51)
  76604953: 21,   // Computer Programming - Python → Python Level 1 (21)
  84510036: 22,   // Computer Programming - Java → Java Programming for Beginners (22)
  84052873: 69,   // AP Computer Science → AP Computer Science A (69)

  // Math — Elementary
  14691452: null, // Elementary School Math - Private (US) — no matching course
  14793473: null, // Elementary School Math - Free Trial — no matching course
  26804440: null, // Elementary School Mathematics - CBSE/ICSE — no matching course
  38753649: null, // Elementary School Mathematics - Free Trial CBSE — no matching course
  38754939: null, // Elementary School Math - Free Trial (GCSE) — no matching course
  38754970: null, // Elementary School Math - Private (GCSE) — no matching course
  49843342: null, // Elementary School Math - Private (AUS) — no matching course
  25031851: null, // Elementary School Math - Summer Course — no matching course
  19017079: null, // Elementary School Math - Group Session — no matching course

  // Math — Middle School
  71128291: 293,  // Middle School Math - Private (IG/IB) → Middle School Math Grade 7 (293)

  // Math — High School
  71128121: 299,  // High School Math - Private (IG/IB) → High School Mathematics (299)
  26804614: 299,  // High School Mathematics - Private (CBSE/ICSE/IG/IB/State) → High School Mathematics (299)

  // Math — AP / A Level
  71556848: 33,   // AP Calculus - Private Session → AP CALCULUS AB (33)
  87502622: 33,   // AP Calculus - Free Trial → AP CALCULUS AB (33)
  27561406: 251,  // A Level Math - Private Session → A Level Mathematics (251)
  27561385: 251,  // A Level Math - Free Trial → A Level Mathematics (251)

  // Math — Other
  59210772: null, // JEE - Mathematics — no matching course

  // English — Elementary
  16723795: 115,  // Elementary School English - Free Trial (US) → Elementary level English (115)
  16723876: 115,  // Elementary School English - Group Session (US) → Elementary level English (115)
  24510098: 115,  // Elementary School English - Private (US) → Elementary level English (115)
  27314309: 115,  // Elementary School English - Free Trial (CBSE/ICSE/IG/IB/State) → Elementary level English (115)
  27314322: 115,  // Elementary School English - Private (CBSE/ICSE/IG/IB/State) → Elementary level English (115)
  38755753: 115,  // Elementary School English - Free Trial (UK) → Elementary level English (115)
  38755818: 115,  // Elementary School English - Private (UK) → Elementary level English (115)
  49843317: 115,  // Elementary School English - Private (AUS) → Elementary level English (115)
  31251347: 115,  // Elementary School English - Summer Course → Elementary level English (115)

  // English — Middle School
  71170467: 114,  // Middle School English - Private (IG/IB) → Middle School English (114)

  // English — High School
  71128100: 116,  // High School English - Private (IG/IB) → High School English (116)

  // English — A Level
  30219038: 252,  // A Level English - Private Session → A Level English (252)
  30219026: 252,  // A Level English - Free Trial → A Level English (252)

  // English — AP / Test Prep
  88415090: 29,   // AP Language → AP Language (29)
  34108709: 276,  // On-Demand English Private Tutoring → Spoken English (276)
  55339864: 276,  // Spoken English - Private Sessions → Spoken English (276)
  62762521: 276,  // Spoken English - Free Trial → Spoken English (276)

  // SAT / ACT
  55339838: 25,   // Trial Lesson - Edkonnect Academy → SAT English (25)
  40643350: 25,   // SAT Trial Lesson → SAT English (25)

  // Business English / Spoken / IELTS / PTE
  25157139: 63,   // Business English - Private Session → Business English (63)
  25157101: 63,   // Business English - Free Trial → Business English (63)
  44199566: 63,   // Business/Technical Writing - Free Trial → Business English (63)
  44199912: 63,   // Business/Technical Writing - Private → Business English (63)
  48657229: 63,   // Business English - Private 30min → Business English (63)
  37280049: 63,   // Business English - Private 2hr → Business English (63)
  32458048: 63,   // Business English - Group Session → Business English (63)
  80404280: 43,   // PTE Academics → Pearson Test of English- PTE Academic (43)
  31263147: 41,   // IELTS/TOEFL - Private Session → IELTS General (41)
  31263177: 41,   // IELTS/TOEFL - Free Trial → IELTS General (41)

  // Science — High School Physics
  71128190: 84,   // High School Physics - Private (IG/IB) → AP Physics 1 (84)
  46157449: 84,   // High School Science - Private (GCSE) → AP Physics 1 (84)
  46157379: 84,   // High School Science - Free Trial (GCSE) → AP Physics 1 (84)
  56889632: null, // NEET - Physics (Free Trial) — no matching course

  // Science — High School Biology
  71128157: 227,  // High School Biology - Private (IG/IB) → IB DP Biology (227)
  35389384: 227,  // Biology - Private (CBSE/ICSE/IB/IG/State) → IB DP Biology (227)
  35389295: 227,  // Biology - Free Trial (CBSE/ICSE/IB/IG/State) → IB DP Biology (227)
  35389450: 227,  // Biology - Free Trial (US) → IB DP Biology (227)
  35389891: 227,  // Biology - Private (US) → IB DP Biology (227)
  48083214: 227,  // High School Biology - Private (GCSE) → IB DP Biology (227)

  // Science — High School Chemistry
  71128144: 226,  // High School Chemistry - Private (IG/IB) → IB DP Chemistry (226)
  28978757: 226,  // Chemistry - Private (CBSE/ICSE/IG/IB/State) → IB DP Chemistry (226)
  28978734: 226,  // Chemistry - Free Trial (CBSE/ICSE/IG/IB/State) → IB DP Chemistry (226)
  31913387: 226,  // Chemistry - Private (US) → IB DP Chemistry (226)
  31913430: 226,  // Chemistry - Free Trial (US) → IB DP Chemistry (226)
  40922081: 226,  // Chemistry Foundation Course → IB DP Chemistry (226)

  // Science — Middle School
  71128249: 228,  // Middle School Science - Private (IG/IB) → IB DP ESS (228) — closest match
  71170563: 226,  // Middle School Chemistry - Private (IG/IB) → IB DP Chemistry (226)

  // Hindi
  63049663: 255,  // High School Hindi → IB MYP 1 Hindi (255)
  74079295: 255,  // Middle School Hindi → IB MYP 1 Hindi (255)

  // Form courses (Malaysia/Singapore)
  39842697: 254,  // Form 6 - Free Trial → Form 6 Course (254)
  39842708: 254,  // Form 6 - Private Sessions → Form 6 Course (254)
  52027965: 253,  // Form 4 - Free Trial → Form 4 Course (253)
  52027983: 253,  // Form 4 - Private Sessions → Form 4 Course (253)

  // German
  46627128: 58,   // German A1 - Free Trial → German Language Course (58)
  46627181: 58,   // German A1 - Private Session → German Language Course (58)
  54274277: 58,   // German - Private Session → German Language Course (58)
  54274313: 58,   // German - Free Trial → German Language Course (58)

  // MBA / CAT / GRE / Other
  41024493: 118,  // MBA - PI → MBA - PI (118)
  38819183: null, // CAT/XAT Prep - Private — no matching course
  38819198: null, // CAT/XAT Prep - Free Trial — no matching course
  40310481: null, // GRE/GMAT - Private — no matching course
  40310452: null, // GRE/GMAT - Free Trial — no matching course

  // AP / College (US)
  37431356: null, // AP Course - Private (generic) — too generic to map
  37431358: null, // AP Course - Free Trial (generic) — too generic to map
  43468047: null, // College Courses - Private — no matching course
  34033973: null, // College Counselling — no matching course
  38087738: null, // College Courses - Free Trial — no matching course
  35257646: null, // Summer Course - Basic Java — no matching course

  // Board Exam Crash Course
  39814134: null, // Board Exam Crash Course - Free Trial
  39814142: null, // Board Exam Crash Course - Private 90min
  40615548: null, // Board Exam Crash Course - Private 60min
  40615562: null, // Board Exam Crash Course - Private 120min

  // Middle School Math - US variant
  14474827: 293,  // Middle School Math - Private Session (US) → Middle School Math Grade 7 (293)

  // High School Math - US variant
  14691576: 299,  // High School Math - Private Session (US) → High School Mathematics (299)

  // Middle School English - US / CBSE variants
  38757538: 114,  // Middle School English - Private Session (US) → Middle School English (114)
  27314289: 114,  // Middle School English - Private Session (CBSE/ICSE/IG/IB/State) → Middle School English (114)

  // High School English - US variant
  38756951: 116,  // High School English - Private Session (US) → High School English (116)

  // PSAT / SAT / ACT combined
  19034374: 1,    // PSAT/SAT/ACT Math - Private Session → SAT Math (1)
  14701559: 1,    // PSAT/SAT/ACT Math - Free Trial Session → SAT Math (1)
  14792692: 25,   // PSAT/SAT/ACT English - Private Session → SAT English (25)
  15690898: 25,   // PSAT/SAT/ACT English - Free Trial Session → SAT English (25)

  // Middle School Science - CBSE/ICSE
  33654551: 228,  // Middle School Science - Private Session (CBSE/ICSE/IB/IG/State) → IB DP ESS (228)

  // Misc
  31198809: null, // Additional half hour class — no matching course
  78945546: null, // Parent-Tutor conference — not a tutoring session
  72851734: null, // High School Social Science — no matching course
  72851975: null, // High School Social Science - Free Trial — no matching course
  74022709: null, // Spanish - Free Trial — no matching course
  74023161: null, // Middle School Spanish — no matching course
};

// ── Acuity API helpers ────────────────────────────────────────────────────────

async function fetchAppointments(minDate: string, maxDate: string, includeCanceled: boolean): Promise<any[]> {
  const params = new URLSearchParams({
    minDate,
    maxDate,
    max: "1000",
  });
  if (includeCanceled) params.set("canceled", "true");

  const url = `${ACUITY_BASE}/appointments?${params}`;
  console.log(`  → GET ${url}`);

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${AUTH}` },
  });

  if (!res.ok) {
    console.error(`Acuity API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// Extract Zoom URL from Acuity location string
function extractZoomUrl(location: string): string | null {
  if (!location) return null;
  const match = location.match(/https:\/\/[^\s]+zoom\.us\/j\/[^\s]+/);
  return match ? match[0] : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB not available");
    process.exit(1);
  }

  // Date range: today → +365 days
  const today = new Date();
  const minDate = today.toISOString().split("T")[0];
  const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  console.log(`📅 Syncing Acuity appointments: ${minDate} → ${maxDate}`);

  // 1. Build tutor email → DB user ID map (lowercase for matching)
  const allTutors = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, "tutor"));

  const tutorEmailToId: Record<string, number> = {};
  for (const t of allTutors) {
    tutorEmailToId[t.email.toLowerCase()] = t.id;
  }

  // 2. Build parent email → DB user ID map
  const allParents = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, "parent"));

  const parentEmailToId: Record<string, number> = {};
  for (const p of allParents) {
    parentEmailToId[p.email.toLowerCase()] = p.id;
  }

  console.log(`👤 ${allParents.length} parents, 🎓 ${allTutors.length} tutors loaded`);

  // 3. Build subscription lookup: parentId-tutorId-courseId → subscriptionId
  const allSubs = await db
    .select({
      id: subscriptions.id,
      parentId: subscriptions.parentId,
      courseId: subscriptions.courseId,
      preferredTutorId: subscriptions.preferredTutorId,
      status: subscriptions.status,
    })
    .from(subscriptions);

  const subMap: Record<string, number> = {};
  for (const s of allSubs) {
    if (!s.preferredTutorId) continue;
    const key = `${s.parentId}-${s.preferredTutorId}-${s.courseId}`;
    // Prefer active subscriptions; don't overwrite active with non-active
    if (!subMap[key] || s.status === "active") {
      subMap[key] = s.id;
    }
  }

  // 4. Fetch scheduled appointments
  const scheduled = await fetchAppointments(minDate, maxDate, false);
  console.log(`📦 ${scheduled.length} scheduled appointments from Acuity`);

  // 5. Fetch cancelled appointments (to sync cancellations)
  const cancelled = await fetchAppointments(minDate, maxDate, true);
  // Only keep the ones that are actually cancelled
  const cancelledOnly = cancelled.filter((a) => a.canceled === true);
  console.log(`🚫 ${cancelledOnly.length} cancelled appointments from Acuity`);

  // Build set of valid (tutorId:scheduledAtMs) and acuity appointment IDs for ghost cleanup
  const validAcuityKeys = new Set<string>();
  const validAcuityIds = new Set<string>(); // acuityAppointmentId values seen in this fetch
  for (const appt of scheduled) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;
    const ms = new Date(appt.datetime).getTime();
    if (!isNaN(ms)) validAcuityKeys.add(`${tutorId}:${ms}`);
    validAcuityIds.add(String(appt.id));
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let noParent = 0;
  let noTutor = 0;
  let noCourse = 0;
  let ghostDeleted = 0;

  // 6. Process scheduled appointments → insert/skip
  for (const appt of scheduled) {
    // Acuity sometimes stores multiple emails comma-separated — try each one
    const emailCandidates = (appt.email || "").split(/[,;]/).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
    const parentId = emailCandidates.reduce((found: number | undefined, email: string) => found ?? parentEmailToId[email], undefined as number | undefined);

    if (!parentId) {
      noParent++;
      continue;
    }

    // Resolve tutor from calendarID
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) {
      console.warn(`⚠️  No tutor email mapped for calendarID=${appt.calendarID} (${appt.calendar})`);
      noTutor++;
      continue;
    }
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) {
      noTutor++;
      continue;
    }

    // Resolve course
    const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
    if (courseId === undefined) {
      console.warn(`⚠️  Unknown appointmentTypeID=${appt.appointmentTypeID} (${appt.type})`);
      noCourse++;
      continue;
    }
    if (courseId === null) {
      // Known but no platform course — skip silently
      skipped++;
      continue;
    }

    // Parse datetime — Acuity includes UTC offset so new Date() gives correct UTC
    const scheduledAtMs = new Date(appt.datetime).getTime();
    if (isNaN(scheduledAtMs)) {
      console.error(`❌ Could not parse datetime: ${appt.datetime}`);
      skipped++;
      continue;
    }

    const duration = parseInt(appt.duration, 10) || 60;
    const meetingUrl = extractZoomUrl(appt.location || "");

    // Find subscription
    const subKey = `${parentId}-${tutorId}-${courseId}`;
    const subscriptionId = subMap[subKey] ?? null;

    const studentFirstName = (appt.firstName || "").trim() || null;
    const studentLastName = (appt.lastName || "").trim() || null;

    try {
      await db.execute(sql`
        INSERT IGNORE INTO sessions
          (subscriptionId, tutorId, parentId, scheduledAt, duration, status, isTrial, courseId, meetingUrl, meetingPlatform, studentFirstName, studentLastName, acuityAppointmentId)
        VALUES
          (${subscriptionId}, ${tutorId}, ${parentId}, ${scheduledAtMs}, ${duration}, 'scheduled', 0, ${courseId}, ${meetingUrl}, 'Zoom', ${studentFirstName}, ${studentLastName}, ${String(appt.id)})
      `);
      inserted++;
    } catch (err: any) {
      console.error(`❌ Insert error appt id=${appt.id}: ${err.message}`);
    }
  }

  // 7. Process cancellations → update existing sessions to cancelled
  for (const appt of cancelledOnly) {
    const emailCandidates = (appt.email || "").split(/[,;]/).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
    const parentId = emailCandidates.reduce((found: number | undefined, email: string) => found ?? parentEmailToId[email], undefined as number | undefined);
    if (!parentId) continue;

    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;

    const scheduledAtMs = new Date(appt.datetime).getTime();
    if (isNaN(scheduledAtMs)) continue;

    try {
      await db
        .update(sessions)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(sessions.tutorId, tutorId),
            eq(sessions.scheduledAt, scheduledAtMs),
            eq(sessions.parentId, parentId),
            sql`${sessions.status} = 'scheduled'`
          )
        );
      updated++;
    } catch (err: any) {
      console.error(`❌ Cancel update error appt id=${appt.id}: ${err.message}`);
    }
  }

  // 8. Ghost session cleanup — delete scheduled sessions that no longer exist in Acuity
  // This handles rescheduled/deleted appointments that the cancellation sync misses
  const minMs = new Date(minDate).getTime();
  const maxMs = new Date(maxDate + "T23:59:59Z").getTime();

  const platformScheduled = await db.execute(sql`
    SELECT id, tutorId, scheduledAt, parentId, acuityAppointmentId
    FROM sessions
    WHERE status = 'scheduled'
      AND scheduledAt >= ${minMs}
      AND scheduledAt <= ${maxMs}
  `);
  const platformRows = (platformScheduled as any)[0] as any[];

  // Build set of tutorIds we manage via Acuity (from CALENDAR_TO_EMAIL)
  const acuityManagedTutorIds = new Set<number>(
    Object.values(CALENDAR_TO_EMAIL)
      .map((email) => tutorEmailToId[email.toLowerCase()])
      .filter(Boolean) as number[]
  );

  // Build set of parentIds that appear in this Acuity fetch (only clean up their sessions)
  const acuityParentIds = new Set<number>();
  for (const appt of scheduled) {
    const emails = (appt.email || "").split(/[,;]/).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
    for (const e of emails) {
      const pid = parentEmailToId[e];
      if (pid) acuityParentIds.add(pid);
    }
  }

  for (const row of platformRows) {
    const key = `${row.tutorId}:${Number(row.scheduledAt)}`;
    if (validAcuityKeys.has(key)) continue; // Still exists in Acuity — keep it

    // If session has an acuityAppointmentId set, it's a verified real appointment — skip ghost cleanup
    // (handles sessions for tutors whose calendar hits the bulk fetch 1000-result limit)
    if (row.acuityAppointmentId) continue;

    // Only clean up sessions for Acuity-managed tutors AND parents we saw in Acuity
    // This avoids deleting manually-created sessions or sessions for non-migrated parents
    if (!acuityManagedTutorIds.has(row.tutorId)) continue;
    if (!acuityParentIds.has(row.parentId)) continue;

    await db.execute(sql`DELETE FROM sessions WHERE id = ${row.id}`);
    ghostDeleted++;
    console.log(`🗑️  Ghost deleted: session id=${row.id} tutorId=${row.tutorId} scheduledAt=${new Date(Number(row.scheduledAt)).toISOString()}`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("🎉 Acuity sync complete!");
  console.log(`   Inserted   : ${inserted}`);
  console.log(`   Skipped    : ${skipped} (duplicates or no course mapping)`);
  console.log(`   Cancelled  : ${updated} (status updated)`);
  console.log(`   Ghosts del : ${ghostDeleted} (rescheduled/deleted in Acuity)`);
  console.log(`   No parent  : ${noParent} (email not in platform)`);
  console.log(`   No tutor   : ${noTutor} (calendarID not mapped or not in DB)`);
  console.log(`   No course  : ${noCourse} (unknown appointmentTypeID)`);
  console.log("═══════════════════════════════════════");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
