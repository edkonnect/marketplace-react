/**
 * Migration script: Radha Kumari (legacy parent) + 2 students + sessions
 *
 * Run on EC2:
 *   npx tsx scripts/migrate-radha-kumari.ts
 *
 * Safe to re-run — checks for existing email before inserting.
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, parentProfiles, subscriptions, sessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ── Config ────────────────────────────────────────────────────────────────────

const TEMP_PASSWORD = "Admin@123"; // Show to user, force reset on first login

// Tutor IDs (from prod DB)
const TUTOR_SRIILALIT_ID = 52; // Sriilalit Narayana Chintalapati
const TUTOR_MAYA_ID = 47;      // Maya Balan
const TUTOR_NALINI_ID = 59;    // Nalini Sharma (nalini.cheena@gmail.com)

// Course IDs (mapped to closest existing)
const COURSE_SAT_ENGLISH_ID = 25;    // SAT (for PSAT/SAT/ACT English)
const COURSE_HS_MATH_ID = 95;        // HSPT Math (for High School Math)
const COURSE_SAT_MATH_ID = 1;        // SAT Math Prep (for PSAT/SAT/ACT Math)

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a local ET datetime string to UTC milliseconds (bigint).
 *  ET = UTC-4 (EDT, March–November) */
function etToUtcMs(dateStr: string): bigint {
  // dateStr e.g. "2026-03-29T08:00:00"
  const etOffsetMs = 4 * 60 * 60 * 1000; // EDT = UTC-4
  const localMs = new Date(dateStr).getTime();
  return BigInt(localMs + etOffsetMs);
}

/** Build a list of {date, startHour, startMin, durationMin, tutorId, courseId} entries */
interface SessionEntry {
  scheduledAtMs: bigint;
  durationMin: number;
  tutorId: number | null;
  courseId: number | null;
  studentFirstName: string;
  studentLastName: string;
  studentGrade: string;
  notes: string;
}

function buildSessions(parentId: number): SessionEntry[] {
  const entries: SessionEntry[] = [];

  // ── Exact dates from Acuity (all sessions are for Arun Kumareasan) ──────────
  //
  // Sundays: 8:00am Nalini (PSAT/SAT/ACT English) + 7:30pm Sriilalit (High School Math)
  // Fridays: 7:30pm Maya (PSAT/SAT/ACT Math)

  const exactSundays = [
    "2026-04-05", "2026-04-12", "2026-04-19", "2026-04-26",
    "2026-05-03", "2026-05-10", "2026-05-17", "2026-05-24", "2026-05-31",
    "2026-06-07", "2026-06-14", "2026-06-21", "2026-06-28",
    "2026-07-05", "2026-07-12", "2026-07-19", "2026-07-26",
  ];

  // Fridays per Acuity: Apr 3, 10, 17, 24 | May 1, 8 (no more after that in data)
  const exactFridays = [
    "2026-04-03", "2026-04-10", "2026-04-17", "2026-04-24",
    "2026-05-01", "2026-05-08",
  ];

  for (const d of exactSundays) {
    // 8:00am — Nalini — PSAT/SAT/ACT English
    entries.push({
      scheduledAtMs: etToUtcMs(`${d}T08:00:00`),
      durationMin: 60,
      tutorId: TUTOR_NALINI_ID,
      courseId: COURSE_SAT_ENGLISH_ID,
      studentFirstName: "Arun",
      studentLastName: "Kumareasan",
      studentGrade: "9",
      notes: "PSAT/SAT/ACT English — Ms. Nalini Sharma",
    });
    // 7:30pm — Sriilalit — High School Math
    entries.push({
      scheduledAtMs: etToUtcMs(`${d}T19:30:00`),
      durationMin: 60,
      tutorId: TUTOR_SRIILALIT_ID,
      courseId: COURSE_HS_MATH_ID,
      studentFirstName: "Arun",
      studentLastName: "Kumareasan",
      studentGrade: "9",
      notes: "High School Math — Sriilalit Narayana",
    });
  }

  for (const d of exactFridays) {
    // 7:30pm — Maya — PSAT/SAT/ACT Math
    entries.push({
      scheduledAtMs: etToUtcMs(`${d}T19:30:00`),
      durationMin: 60,
      tutorId: TUTOR_MAYA_ID,
      courseId: COURSE_SAT_MATH_ID,
      studentFirstName: "Arun",
      studentLastName: "Kumareasan",
      studentGrade: "9",
      notes: "PSAT/SAT/ACT Math — Ms. Maya",
    });
  }

  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB not available");
    process.exit(1);
  }

  // 1. Check if parent already exists
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "ssggkk@gmail.com"))
    .limit(1);

  if (existing.length > 0) {
    // Parent exists — just reinsert sessions
    const parentUserId = existing[0].id;
    console.log(`ℹ️  User already exists (id: ${parentUserId}). Reinserting sessions only...`);
    const sessionEntries = buildSessions(parentUserId);
    let inserted = 0;
    for (const s of sessionEntries) {
      await db.insert(sessions).values({
        parentId: parentUserId,
        tutorId: s.tutorId,
        courseId: s.courseId,
        scheduledAt: s.scheduledAtMs,
        duration: s.durationMin,
        status: "scheduled",
        studentFirstName: s.studentFirstName,
        studentLastName: s.studentLastName,
        studentGrade: s.studentGrade,
        notes: s.notes,
        meetingPlatform: "Zoom",
      } as any);
      inserted++;
    }
    console.log(`✅ ${inserted} sessions inserted for parentId ${parentUserId}`);
    process.exit(0);
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);

  // 3. Insert parent user
  console.log("Inserting parent user...");
  const [userResult] = await db.insert(users).values({
    email: "ssggkk@gmail.com",
    passwordHash,
    firstName: "Radha",
    lastName: "Kumareasan",
    name: "Radha Kumareasan",
    role: "parent",
    userType: "parent",
    phoneNumber: "+17813309147",
    timezone: "America/New_York",
    emailVerified: true,
    accountSetupComplete: true,
    // Force password reset on first login
  });

  const parentUserId = (userResult as any).insertId as number;
  console.log(`  ✓ User created — id: ${parentUserId}`);

  // 4. Insert parentProfile
  console.log("Inserting parent profile...");
  await db.insert(parentProfiles).values({
    userId: parentUserId,
    childrenInfo: JSON.stringify([
      { firstName: "Arun", lastName: "Kumareasan", grade: "9" },
      { firstName: "Atal", lastName: "Kumaresan", grade: "9" },
    ]),
    preferredContactMethod: "email",
    timezone: "America/New_York",
  });
  console.log("  ✓ Parent profile created");

  // 5. Insert subscriptions (legacy enrollments — historical, status=completed or active)
  console.log("Inserting legacy subscriptions...");

  const legacyEnrollments = [
    // ARUN — skipped: Math - Elementary Level (not in platform)
    { firstName: "Arun", lastName: "Kumareasan", grade: "9", courseId: 4,   title: "Math - Middle School Level → Middle School Math - Level I",   status: "completed" as const, startDate: null,                   subType: "on_demand" },
    { firstName: "Arun", lastName: "Kumareasan", grade: "9", courseId: 95,  title: "Math - High School Level → HSPT Math",                         status: "active"    as const, startDate: null,                   subType: "subscription" },
    { firstName: "Arun", lastName: "Kumareasan", grade: "9", courseId: 96,  title: "Olympiad Math → Vedic math",                                   status: "completed" as const, startDate: new Date("2021-07-07"), subType: "subscription" },
    { firstName: "Arun", lastName: "Kumareasan", grade: "9", courseId: 101, title: "English - Reading and Writing (MS Level) → Middle School English Homework Help", status: "active" as const, startDate: null, subType: "subscription" },
    { firstName: "Arun", lastName: "Kumareasan", grade: "9", courseId: 1,   title: "Digital SAT Math → SAT Math Prep",                             status: "active"    as const, startDate: null,                   subType: "subscription" },
    { firstName: "Arun", lastName: "Kumareasan", grade: "9", courseId: 25,  title: "Digital SAT English → SAT",                                    status: "active"    as const, startDate: null,                   subType: "subscription" },
    // ATAL — skipped: SAT/ACT - Math Test Prep, Discrete Math (not in platform)
    { firstName: "Atal", lastName: "Kumaresan",  grade: "9", courseId: 101, title: "SAT/ACT - English Reading and Writing → Middle School English Homework Help", status: "completed" as const, startDate: new Date("2021-07-10"), subType: "on_demand" },
    { firstName: "Atal", lastName: "Kumaresan",  grade: "9", courseId: 95,  title: "Math - High School Level → HSPT Math",                         status: "completed" as const, startDate: new Date("2021-07-10"), subType: "on_demand" },
  ];

  for (const enr of legacyEnrollments) {
    await db.insert(subscriptions).values({
      parentId: parentUserId,
      courseId: enr.courseId ?? 1, // placeholder courseId=1 (SAT Math Prep) — update manually
      studentFirstName: enr.firstName,
      studentLastName: enr.lastName,
      studentGrade: enr.grade,
      status: enr.status,
      startDate: enr.startDate ?? new Date("2024-01-01"), // legacy — exact date unknown
      paymentStatus: "paid",
    } as any);
    console.log(`  ✓ Subscription: ${enr.firstName} — ${enr.title}`);
  }

  // 6. Insert upcoming sessions
  console.log("\nInserting upcoming sessions...");
  const sessionEntries = buildSessions(parentUserId);

  let inserted = 0;
  for (const s of sessionEntries) {
    await db.insert(sessions).values({
      parentId: parentUserId,
      tutorId: s.tutorId,
      courseId: s.courseId,
      scheduledAt: s.scheduledAtMs,
      duration: s.durationMin,
      status: "scheduled",
      studentFirstName: s.studentFirstName,
      studentLastName: s.studentLastName,
      studentGrade: s.studentGrade,
      notes: s.notes,
      meetingPlatform: "Zoom",
    } as any);
    inserted++;
  }
  console.log(`  ✓ ${inserted} sessions inserted`);

  console.log("\n═══════════════════════════════════════");
  console.log("✅ Migration complete!");
  console.log(`   Parent user ID : ${parentUserId}`);
  console.log(`   Email          : ssggkk@gmail.com`);
  console.log(`   Temp password  : ${TEMP_PASSWORD}`);
  console.log("   ⚠️  Share temp password with parent and ask them to reset it.");
  console.log("   ⚠️  Subscription courseIds are set to placeholder (id:1) — update manually.");
  console.log("   ⚠️  Sessions for Nalini Sharma have tutorId=2 (Gitesh placeholder) — update when she joins.");
  console.log("═══════════════════════════════════════\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
