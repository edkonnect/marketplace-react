/**
 * Migration script: Thiru Bose (parent) + 1 student + sessions
 *
 * Student:
 *   - Adithi Bose (Grade 10) — SAT Math (course 1, Maya) + SAT English (course 25, Apoorva)
 *
 * Run on EC2:
 *   pnpm tsx scripts/migrate-thiru-bose.ts
 *
 * Safe to re-run — checks for existing email before inserting.
 *
 * Notes:
 *   - Free Trial sessions (Nov 25 & 26, 2025) skipped
 *   - Parent-Tutor conference (Jan 5, 2026) skipped
 *   - Upcoming sessions in year 2205 corrected to 2026
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, parentProfiles, subscriptions, sessions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

// ── Timezone helpers ──────────────────────────────────────────────────────────

/** EST = UTC-5 (Nov 2 – Mar 7) */
function estToUtcMs(dateStr: string): bigint {
  return BigInt(new Date(dateStr).getTime() + 5 * 60 * 60 * 1000);
}

/** EDT = UTC-4 (Mar 8 – Nov 1) */
function edtToUtcMs(dateStr: string): bigint {
  return BigInt(new Date(dateStr).getTime() + 4 * 60 * 60 * 1000);
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TUTOR_MAYA_ID    = 47;  // Ms. Maya Balan
const TUTOR_APOORVA_ID = 24;  // Ms. Apoorva Sisodia

const COURSE_SAT_MATH_ID    = 1;   // SAT Math Prep
const COURSE_SAT_ENGLISH_ID = 25;  // SAT English

// ── Session list ──────────────────────────────────────────────────────────────

interface SessionEntry {
  scheduledAtMs: bigint;
  durationMin: number;
  tutorId: number;
  courseId: number;
  status: "completed" | "cancelled" | "scheduled";
  studentFirstName: string;
  studentLastName: string;
  studentGrade: string;
  notes: string;
}

function buildSessions(): SessionEntry[] {
  const list: SessionEntry[] = [];

  // ── SAT MATH (Maya, Thursdays/Sundays/Tuesdays/Fridays 10pm EDT/EST) ────────

  // Nov 25, 2025 — Free Trial — SKIP

  // Dec 4, 2025 Thu 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2025-12-04T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Dec 11, 2025 Thu 10pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2025-12-11T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Dec 18, 2025 Thu 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2025-12-18T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Jan 1, 2026 Thu 10pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2026-01-01T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Jan 8, 2026 Thu 10pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2026-01-08T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Jan 11, 2026 Sun 8pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-01-11T20:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Jan 15, 2026 Thu 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-01-15T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Jan 22, 2026 Thu 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-01-22T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Feb 1, 2026 Sun 9pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2026-02-01T21:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Feb 5, 2026 Thu 10pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2026-02-05T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Feb 10, 2026 Tue 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-02-10T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Feb 12, 2026 Thu 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-02-12T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Feb 19, 2026 Thu 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-02-19T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Feb 26, 2026 Thu 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-02-26T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Mar 5, 2026 Thu 10pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-03-05T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Mar 12, 2026 Thu 10pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-12T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Mar 15, 2026 Sun 9pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-15T21:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Mar 19, 2026 Thu 10pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-19T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Mar 20, 2026 Fri 8:30pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-20T20:30:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Mar 26, 2026 Thu 10pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-26T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Apr 2, 2026 Thu 10pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-02T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Apr 9, 2026 Thu 10pm EDT — upcoming
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-09T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "scheduled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Apr 16, 2026 Thu 10pm EDT — upcoming
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-16T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "scheduled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Apr 23, 2026 Thu 10pm EDT — upcoming
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-23T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "scheduled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });
  // Apr 30, 2026 Thu 10pm EDT — upcoming
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-30T22:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "scheduled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT Math — Ms. Maya" });

  // ── SAT ENGLISH (Apoorva, Wed/Mon/Fri 9:30pm EDT/EST) ────────────────────────

  // Nov 26, 2025 — Free Trial — SKIP

  // Dec 3, 2025 Wed 9:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2025-12-03T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Dec 10, 2025 Wed 9:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2025-12-10T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Dec 17, 2025 Wed 9:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2025-12-17T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Jan 5, 2026 Mon — Parent-Tutor conference — SKIP
  // Jan 7, 2026 Wed 9:30pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2026-01-07T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Jan 14, 2026 Wed 9:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-01-14T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Jan 21, 2026 Wed 9:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-01-21T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Jan 28, 2026 Wed 9:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-01-28T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Feb 9, 2026 Mon 6:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-02-09T18:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Feb 11, 2026 Wed 9:30pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2026-02-11T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Feb 18, 2026 Wed 9:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-02-18T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Feb 25, 2026 Wed 9:30pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2026-02-25T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Mar 4, 2026 Wed 9:30pm EST
  list.push({ scheduledAtMs: estToUtcMs("2026-03-04T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Mar 11, 2026 Wed 9:30pm EDT — cancelled
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-11T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Mar 13, 2026 Fri 8:30pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-13T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Mar 18, 2026 Wed 9:30pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-18T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Mar 25, 2026 Wed 9:30pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-03-25T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Apr 3, 2026 Fri 9:30pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-03T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Apr 8, 2026 Wed 9:30pm EDT
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-08T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "completed", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Apr 15, 2026 Wed 9:30pm EDT — upcoming
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-15T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "scheduled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Apr 22, 2026 Wed 9:30pm EDT — upcoming
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-22T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "scheduled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Apr 29, 2026 Wed 9:30pm EDT — upcoming
  list.push({ scheduledAtMs: edtToUtcMs("2026-04-29T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "scheduled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });

  // ── Cancelled English sessions (originally listed as 2205, corrected to 2026) ─
  // Jan 28, 2026 Mon 9:30pm EST — cancelled (duplicate of Jan 28 Wed above, skip)
  // Feb 4, 2026 Mon 9:30pm EST — cancelled
  list.push({ scheduledAtMs: estToUtcMs("2026-02-04T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENGLISH_ID, status: "cancelled", studentFirstName: "Adithi", studentLastName: "Bose", studentGrade: "10", notes: "SAT English — Ms. Apoorva" });
  // Feb 11, 2026 — already added above as cancelled
  // Feb 18, 2026 — already added above as completed
  // Feb 25, 2026 — already added above as cancelled

  return list;
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
    .where(eq(users.email, "thirubose@gmail.com"))
    .limit(1);

  if (existing.length > 0) {
    console.log(`⚠️  Parent already exists (id=${existing[0].id}). Skipping.`);
    process.exit(0);
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash("Admin@123", 10);

  // 3. Insert parent user
  const [insertedUser] = await db.insert(users).values({
    openId: randomUUID(),
    email: "thirubose@gmail.com",
    passwordHash,
    firstName: "Thiru",
    lastName: "Bose",
    name: "Thiru Bose",
    role: "parent",
    userType: "parent",
    phoneNumber: "+14358817321",
    timezone: "America/New_York",
    emailVerified: true,
    accountSetupComplete: true,
  } as any);

  const parentId = (insertedUser as any).insertId as number;
  console.log(`✅ Parent inserted: id=${parentId}`);

  // 4. Insert parent profile
  await db.insert(parentProfiles).values({
    userId: parentId,
    childrenInfo: JSON.stringify([
      { firstName: "Adithi", lastName: "Bose", grade: "10" },
    ]),
    preferredContactMethod: "email",
    timezone: "America/New_York",
  } as any);
  console.log(`✅ Parent profile inserted`);

  // 5. Insert subscriptions
  const [sub1] = await db.insert(subscriptions).values({
    parentId,
    courseId: COURSE_SAT_MATH_ID,
    preferredTutorId: TUTOR_MAYA_ID,
    studentFirstName: "Adithi",
    studentLastName: "Bose",
    studentGrade: "10",
    status: "active",
    startDate: new Date("2025-12-01"),
    paymentStatus: "paid",
  } as any);
  const subMathId = (sub1 as any).insertId as number;
  console.log(`✅ SAT Math subscription inserted: id=${subMathId}`);

  const [sub2] = await db.insert(subscriptions).values({
    parentId,
    courseId: COURSE_SAT_ENGLISH_ID,
    preferredTutorId: TUTOR_APOORVA_ID,
    studentFirstName: "Adithi",
    studentLastName: "Bose",
    studentGrade: "10",
    status: "active",
    startDate: new Date("2025-12-01"),
    paymentStatus: "paid",
  } as any);
  const subEnglishId = (sub2 as any).insertId as number;
  console.log(`✅ SAT English subscription inserted: id=${subEnglishId}`);

  // 6. Insert sessions
  const sessionList = buildSessions();
  let inserted = 0;
  let skipped = 0;

  for (const s of sessionList) {
    try {
      await db.insert(sessions).values({
        parentId,
        tutorId: s.tutorId,
        courseId: s.courseId,
        scheduledAt: s.scheduledAtMs,
        duration: s.durationMin,
        status: s.status,
        studentFirstName: s.studentFirstName,
        studentLastName: s.studentLastName,
        studentGrade: s.studentGrade,
        notes: s.notes,
        meetingPlatform: "Zoom",
        isTrial: false,
      } as any);
      inserted++;
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        console.warn(`⚠️  Skipped duplicate: tutorId=${s.tutorId} at ${s.scheduledAtMs}`);
        skipped++;
      } else {
        throw err;
      }
    }
  }

  console.log(`✅ Sessions inserted: ${inserted}, skipped: ${skipped}`);

  // 7. Link subscriptionId
  await db.execute(
    `UPDATE sessions SET subscriptionId = ${subMathId}
     WHERE parentId = ${parentId} AND courseId = ${COURSE_SAT_MATH_ID}`
  );
  console.log(`✅ Linked subscriptionId=${subMathId} for SAT Math`);

  await db.execute(
    `UPDATE sessions SET subscriptionId = ${subEnglishId}
     WHERE parentId = ${parentId} AND courseId = ${COURSE_SAT_ENGLISH_ID}`
  );
  console.log(`✅ Linked subscriptionId=${subEnglishId} for SAT English`);

  console.log("\n🎉 Migration complete!");
  console.log(`   parentId        = ${parentId}`);
  console.log(`   subMathId       = ${subMathId}`);
  console.log(`   subEnglishId    = ${subEnglishId}`);
  console.log(`   Sessions:        ${inserted} inserted, ${skipped} skipped`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
