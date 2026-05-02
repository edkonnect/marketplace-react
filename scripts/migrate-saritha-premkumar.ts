/**
 * Migration script: Saritha Premkumar (parent) + 1 student (Siddhiksha) + sessions
 *
 * Run on EC2:
 *   pnpm tsx scripts/migrate-saritha-premkumar.ts
 *
 * Safe to re-run — checks for existing email before inserting.
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, parentProfiles, subscriptions, sessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const TEMP_PASSWORD = "Admin@123";

const TUTOR_ANITTA_ID = 51;   // Anitta Dominic
const TUTOR_NALINI_ID = 59;   // Nalini Sharma

const COURSE_MS_MATH_ID = 4;      // Middle School Math - Level I
const COURSE_MS_ENGLISH_ID = 114; // Middle School English

// ── ET to UTC ms ──────────────────────────────────────────────────────────────

/** EDT = UTC-4 */
function edtToUtcMs(dateStr: string): bigint {
  const edtOffsetMs = 4 * 60 * 60 * 1000;
  return BigInt(new Date(dateStr).getTime() + edtOffsetMs);
}

// ── Sessions ──────────────────────────────────────────────────────────────────

interface SessionEntry {
  scheduledAtMs: bigint;
  durationMin: number;
  tutorId: number;
  courseId: number;
  status: string;
  notes: string;
}

function buildSessions(): SessionEntry[] {
  return [
    // March 31, 2026 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-03-31T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 1 — Nalini — MS English
    { scheduledAtMs: edtToUtcMs("2026-04-01T19:30:00"), durationMin: 60, tutorId: TUTOR_NALINI_ID, courseId: COURSE_MS_ENGLISH_ID, status: "scheduled", notes: "Middle School English — Ms. Nalini Sharma" },
    // April 2 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-04-02T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 3 — Nalini — MS English
    { scheduledAtMs: edtToUtcMs("2026-04-03T19:30:00"), durationMin: 60, tutorId: TUTOR_NALINI_ID, courseId: COURSE_MS_ENGLISH_ID, status: "scheduled", notes: "Middle School English — Ms. Nalini Sharma" },
    // April 5 — Anitta — MS Math [canceled]
    { scheduledAtMs: edtToUtcMs("2026-04-05T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "cancelled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 7 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-04-07T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 8 — Nalini — MS English
    { scheduledAtMs: edtToUtcMs("2026-04-08T19:30:00"), durationMin: 60, tutorId: TUTOR_NALINI_ID, courseId: COURSE_MS_ENGLISH_ID, status: "scheduled", notes: "Middle School English — Ms. Nalini Sharma" },
    // April 9 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-04-09T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 10 — Nalini — MS English
    { scheduledAtMs: edtToUtcMs("2026-04-10T19:30:00"), durationMin: 60, tutorId: TUTOR_NALINI_ID, courseId: COURSE_MS_ENGLISH_ID, status: "scheduled", notes: "Middle School English — Ms. Nalini Sharma" },
    // April 12 — Anitta — MS Math [canceled]
    { scheduledAtMs: edtToUtcMs("2026-04-12T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "cancelled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 14 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-04-14T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 15 — Nalini — MS English
    { scheduledAtMs: edtToUtcMs("2026-04-15T19:30:00"), durationMin: 60, tutorId: TUTOR_NALINI_ID, courseId: COURSE_MS_ENGLISH_ID, status: "scheduled", notes: "Middle School English — Ms. Nalini Sharma" },
    // April 16 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-04-16T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 17 — Nalini — MS English
    { scheduledAtMs: edtToUtcMs("2026-04-17T19:30:00"), durationMin: 60, tutorId: TUTOR_NALINI_ID, courseId: COURSE_MS_ENGLISH_ID, status: "scheduled", notes: "Middle School English — Ms. Nalini Sharma" },
    // April 19 — Anitta — MS Math [canceled]
    { scheduledAtMs: edtToUtcMs("2026-04-19T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "cancelled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 21 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-04-21T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 22 — Nalini — MS English
    { scheduledAtMs: edtToUtcMs("2026-04-22T19:30:00"), durationMin: 60, tutorId: TUTOR_NALINI_ID, courseId: COURSE_MS_ENGLISH_ID, status: "scheduled", notes: "Middle School English — Ms. Nalini Sharma" },
    // April 23 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-04-23T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
    // April 24 — Nalini — MS English
    { scheduledAtMs: edtToUtcMs("2026-04-24T19:30:00"), durationMin: 60, tutorId: TUTOR_NALINI_ID, courseId: COURSE_MS_ENGLISH_ID, status: "scheduled", notes: "Middle School English — Ms. Nalini Sharma" },
    // April 28 — Anitta — MS Math
    { scheduledAtMs: edtToUtcMs("2026-04-28T20:30:00"), durationMin: 60, tutorId: TUTOR_ANITTA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", notes: "Middle School Math — Ms. Anitta Dominic" },
  ];
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
    .where(eq(users.email, "sari12j@gmail.com"))
    .limit(1);

  if (existing.length > 0) {
    const parentUserId = existing[0].id;
    console.log(`ℹ️  User already exists (id: ${parentUserId}). Reinserting sessions only...`);
    const sessionEntries = buildSessions();
    let inserted = 0;
    for (const s of sessionEntries) {
      await db.insert(sessions).values({
        parentId: parentUserId,
        tutorId: s.tutorId,
        courseId: s.courseId,
        scheduledAt: s.scheduledAtMs,
        duration: s.durationMin,
        status: s.status,
        studentFirstName: "Siddhiksha",
        studentLastName: "Premkumar",
        studentGrade: "7",
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
    email: "sari12j@gmail.com",
    passwordHash,
    firstName: "Saritha",
    lastName: "Premkumar",
    name: "Saritha Premkumar",
    role: "parent",
    userType: "parent",
    phoneNumber: "+13022579053",
    timezone: "America/New_York",
    emailVerified: true,
    accountSetupComplete: true,
    openId: randomUUID(),
  });

  const parentUserId = (userResult as any).insertId as number;
  console.log(`  ✓ User created — id: ${parentUserId}`);

  // 4. Insert parentProfile
  console.log("Inserting parent profile...");
  await db.insert(parentProfiles).values({
    userId: parentUserId,
    childrenInfo: JSON.stringify([
      { firstName: "Siddhiksha", lastName: "Premkumar", grade: "7" },
    ]),
    preferredContactMethod: "email",
    timezone: "America/New_York",
  });
  console.log("  ✓ Parent profile created");

  // 5. Insert subscriptions
  console.log("Inserting subscriptions...");
  const startDate = new Date("2025-09-01");

  await db.insert(subscriptions).values({
    parentId: parentUserId,
    courseId: COURSE_MS_MATH_ID,
    studentFirstName: "Siddhiksha",
    studentLastName: "Premkumar",
    studentGrade: "7",
    status: "active",
    startDate,
    paymentStatus: "paid",
  } as any);
  console.log("  ✓ Subscription: Siddhiksha — Middle School Math - Level I");

  await db.insert(subscriptions).values({
    parentId: parentUserId,
    courseId: COURSE_MS_ENGLISH_ID,
    studentFirstName: "Siddhiksha",
    studentLastName: "Premkumar",
    studentGrade: "7",
    status: "active",
    startDate,
    paymentStatus: "paid",
  } as any);
  console.log("  ✓ Subscription: Siddhiksha — Middle School English Homework Help");

  // 6. Insert sessions
  console.log("\nInserting sessions...");
  const sessionEntries = buildSessions();
  let inserted = 0;
  for (const s of sessionEntries) {
    await db.insert(sessions).values({
      parentId: parentUserId,
      tutorId: s.tutorId,
      courseId: s.courseId,
      scheduledAt: s.scheduledAtMs,
      duration: s.durationMin,
      status: s.status,
      studentFirstName: "Siddhiksha",
      studentLastName: "Premkumar",
      studentGrade: "7",
      notes: s.notes,
      meetingPlatform: "Zoom",
    } as any);
    inserted++;
  }
  console.log(`  ✓ ${inserted} sessions inserted`);

  console.log("\n═══════════════════════════════════════");
  console.log("✅ Migration complete!");
  console.log(`   Parent user ID : ${parentUserId}`);
  console.log(`   Email          : sari12j@gmail.com`);
  console.log(`   Temp password  : ${TEMP_PASSWORD}`);
  console.log("   ⚠️  Share temp password with parent and ask them to reset it.");
  console.log("═══════════════════════════════════════\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
