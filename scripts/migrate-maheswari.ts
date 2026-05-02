/**
 * Migration script: Maheswari (parent) + 3 students + sessions
 *
 * Students:
 *   - Sai Lakshika (Grade 5) — Elementary Level English
 *   - Sai Lakshitha (Grade 5) — Elementary Level English
 *   - Sai Akshath Pari Kumaran (Grade 7) — Middle School Math + Python Level 1
 *
 * Run on EC2:
 *   pnpm tsx scripts/migrate-maheswari.ts
 *
 * Safe to re-run — checks for existing email before inserting.
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, parentProfiles, subscriptions, sessions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const TEMP_PASSWORD = "Admin@123";

// Tutor IDs
const TUTOR_APOORVA_ID = 24;  // Ms. Apoorva Sisodia
const TUTOR_MAYA_ID    = 47;  // Ms. Maya Balan
const TUTOR_DOLON_ID   = 50;  // Ms. Dolon Mukherjee

// Course IDs
const COURSE_ELEM_ENGLISH_ID = 115;  // Elementary Level English
const COURSE_MS_MATH_ID      = 4;    // Middle School Math Level I
const COURSE_PYTHON_ID       = 21;   // Python Level 1

// ── Timezone helpers ──────────────────────────────────────────────────────────

/** EST = UTC-5 (Nov 2 – Mar 7) */
function estToUtcMs(dateStr: string): bigint {
  const offsetMs = 5 * 60 * 60 * 1000;
  return BigInt(new Date(dateStr).getTime() + offsetMs);
}

/** EDT = UTC-4 (Mar 8 – Nov 1) */
function edtToUtcMs(dateStr: string): bigint {
  const offsetMs = 4 * 60 * 60 * 1000;
  return BigInt(new Date(dateStr).getTime() + offsetMs);
}

/** IST = UTC+5:30 — for Dolon's Python sessions shown in IST */
function istToUtcMs(dateStr: string): bigint {
  const offsetMs = 5.5 * 60 * 60 * 1000;
  return BigInt(new Date(dateStr).getTime() - offsetMs);
}

// ── Session list ──────────────────────────────────────────────────────────────

interface SessionEntry {
  scheduledAtMs: bigint;
  durationMin: number;
  tutorId: number;
  courseId: number;
  status: string;
  studentFirstName: string;
  studentLastName: string;
  studentGrade: string;
  notes: string;
}

function buildSessions(): SessionEntry[] {
  const sessions: SessionEntry[] = [];

  // ─────────────────────────────────────────────────────────────
  // SAI LAKSHIKA — Elementary English (course 115, tutor Apoorva)
  // ─────────────────────────────────────────────────────────────

  // Jun 26, 2025 — Free Trial — SKIP

  // Jul 7, 2025 — Summer Course (EDT)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-07T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jul 10, 2025
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-10T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jul 17, 2025
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-17T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jul 24, 2025 — cancelled
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-24T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jul 31, 2025 — cancelled
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-31T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 5, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-05T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 7, 2025 (Thursday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-07T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 14, 2025 — cancelled
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-14T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 21, 2025
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-21T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 26, 2025 (Tuesday 8:30pm)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-26T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 28, 2025 (Thursday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-28T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });

  // Sep 4, 2025 (Thursday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-04T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 11, 2025 (Thursday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-11T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 13, 2025 — Parent-Tutor conference — SKIP
  // Sep 18, 2025 (Thursday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-18T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 25, 2025 (Thursday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-25T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 30, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-30T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 7, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-07T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 14, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-14T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 21, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-21T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 28, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-28T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 4, 2025 (Tuesday) — EST starts Nov 2
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-04T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 11, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-11T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 20, 2025 (Thursday 6:30pm) — cancelled
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-20T18:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 25, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-25T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 27, 2025 (Thursday 10:00am)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-27T10:00:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 4, 2025 (Thursday 6:30pm)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-04T18:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 9, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-09T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 16, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-16T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 23, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-23T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 1, 2026 (Thursday 8:30pm) — cancelled per data
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-01T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 6, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-06T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 13, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-13T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 20, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-20T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 27, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-27T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 3, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-03T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 10, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-10T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 17, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-17T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 24, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-24T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Mar 3, 2026 (Tuesday) — EST
  sessions.push({ scheduledAtMs: estToUtcMs("2026-03-03T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Mar 10, 2026 (Tuesday) — EDT starts Mar 8
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-10T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Mar 17, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-17T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Mar 24, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-24T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 3, 2026 (Friday) — upcoming
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-03T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 7, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-07T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 14, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-14T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 21, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-21T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 28, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-28T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // May 5, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-05-05T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // May 12, 2026 (Tuesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-05-12T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshika", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });

  // ─────────────────────────────────────────────────────────────────
  // SAI LAKSHITHA — Elementary English (course 115, tutor Apoorva)
  // ─────────────────────────────────────────────────────────────────

  // Jun 25, 2025 — Free Trial — SKIP

  // Jul 2, 2025 (Wednesday 8:30pm EDT)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-02T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jul 9, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-09T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jul 16, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-16T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jul 23, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-23T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jul 30, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-07-30T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 6, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-06T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 13, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-13T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 20, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-20T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Aug 27, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-08-27T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 3, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-03T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 4, 2025 (Thursday) — cancelled — SKIP (Apoorva already has Sai Lakshika at same time)
  // Sep 10, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-10T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 11, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika's session same time)
  // Sep 17, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-17T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 18, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Sep 24, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-09-24T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Sep 25, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Oct 1, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-01T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 2, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Oct 8, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-08T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 9, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Oct 15, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-15T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 16, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Oct 22, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-22T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 23, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Oct 29, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2025-10-29T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Oct 30, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Nov 5, 2025 (Wednesday EST)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-05T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 6, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Nov 12, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-12T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 13, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Nov 19, 2025 (Wednesday) — cancelled
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-19T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 20, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika's Nov 20 cancelled 6:30pm — Lakshika 6:30pm is different, but Lakshika also has no 7:30pm Nov 20, so keep)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-20T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 26, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-26T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Nov 27, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika's 10am slot — different time, keep 9am)
  // Nov 27, 2025 (Thursday 9:00am) — cancelled — different time from Lakshika's 10am, keep
  sessions.push({ scheduledAtMs: estToUtcMs("2025-11-27T09:00:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 3, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-03T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 4, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika's 6:30pm — different, keep)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-04T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 10, 2025 (Wednesday) — cancelled
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-10T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 11, 2025 (Thursday 8:30pm)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-11T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 11, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika)
  // Dec 17, 2025 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-17T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 18, 2025 (Thursday 7:30pm) — SKIP (conflicts with Sai Lakshika's Dec 16 Tue — different day, keep)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-18T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 23, 2025 (Tuesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-23T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Dec 25, 2025 (Thursday 7:30pm) — cancelled — SKIP (conflicts with Sai Lakshika's Dec 23 Tue — different day, keep)
  sessions.push({ scheduledAtMs: estToUtcMs("2025-12-25T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 7, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-07T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 8, 2026 (Thursday 6:30pm) — cancelled
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-08T18:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 14, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-14T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 21, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-21T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Jan 28, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-01-28T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 4, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-04T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 11, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-11T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 12, 2026 (Thursday 7:30pm)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-12T19:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 18, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-18T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Feb 25, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-25T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Mar 4, 2026 (Wednesday EST)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-03-04T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Mar 11, 2026 (Wednesday EDT)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-11T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Mar 18, 2026 (Wednesday) — cancelled
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-18T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "cancelled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Mar 25, 2026 (Wednesday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-25T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "completed", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 1, 2026 (Wednesday) — upcoming
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-01T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 8, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-08T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 15, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-15T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 22, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-22T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // Apr 29, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-29T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // May 6, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-05-06T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });
  // May 13, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-05-13T20:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_ELEM_ENGLISH_ID, status: "scheduled", studentFirstName: "Sai Lakshitha", studentLastName: "", studentGrade: "5", notes: "Elementary English — Ms. Apoorva" });

  // ────────────────────────────────────────────────────────────────────────────
  // SAI AKSHATH PARI KUMARAN — Middle School Math (course 4, tutor Maya)
  // ────────────────────────────────────────────────────────────────────────────

  // Feb 8, 2026 — Free Trial — SKIP

  // Feb 15, 2026 (Sunday 7:00pm EST)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-15T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Feb 22, 2026 (Sunday)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-02-22T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Mar 1, 2026 (Sunday EST)
  sessions.push({ scheduledAtMs: estToUtcMs("2026-03-01T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Mar 8, 2026 (Sunday EDT)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-08T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Mar 15, 2026 (Sunday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-15T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Mar 22, 2026 (Sunday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-22T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Mar 29, 2026 (Sunday)
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-03-29T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Apr 5, 2026 (Sunday) — upcoming
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-05T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Apr 12, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-12T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Apr 19, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-19T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // Apr 26, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-04-26T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // May 3, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-05-03T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });
  // May 10, 2026
  sessions.push({ scheduledAtMs: edtToUtcMs("2026-05-10T19:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_MS_MATH_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Middle School Math — Ms. Maya" });

  // ────────────────────────────────────────────────────────────────────────────
  // SAI AKSHATH PARI KUMARAN — Python Level 1 (course 21, tutor Dolon, IST times)
  // ────────────────────────────────────────────────────────────────────────────

  // Nov 15, 2025 (Saturday 7:30pm IST)
  sessions.push({ scheduledAtMs: istToUtcMs("2025-11-15T19:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Feb 6, 2026 (Friday 7:30am IST)
  sessions.push({ scheduledAtMs: istToUtcMs("2026-02-06T07:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Feb 13, 2026 (Friday 7:30am IST)
  sessions.push({ scheduledAtMs: istToUtcMs("2026-02-13T07:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Feb 20, 2026 (Friday 7:00am IST)
  sessions.push({ scheduledAtMs: istToUtcMs("2026-02-20T07:00:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Feb 27, 2026 (Friday 7:30am IST)
  sessions.push({ scheduledAtMs: istToUtcMs("2026-02-27T07:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Mar 6, 2026 (Friday 7:30am IST)
  sessions.push({ scheduledAtMs: istToUtcMs("2026-03-06T07:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Mar 11, 2026 (Wednesday 5:30am IST) — cancelled
  sessions.push({ scheduledAtMs: istToUtcMs("2026-03-11T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "cancelled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Mar 18, 2026 (Wednesday 5:30am IST) — cancelled
  sessions.push({ scheduledAtMs: istToUtcMs("2026-03-18T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "cancelled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Mar 25, 2026 (Wednesday 5:30am IST)
  sessions.push({ scheduledAtMs: istToUtcMs("2026-03-25T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Apr 1, 2026 (Wednesday 5:30am IST) — past (today)
  sessions.push({ scheduledAtMs: istToUtcMs("2026-04-01T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "completed", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Apr 8, 2026 — upcoming
  sessions.push({ scheduledAtMs: istToUtcMs("2026-04-08T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Apr 15, 2026
  sessions.push({ scheduledAtMs: istToUtcMs("2026-04-15T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Apr 22, 2026
  sessions.push({ scheduledAtMs: istToUtcMs("2026-04-22T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // Apr 29, 2026
  sessions.push({ scheduledAtMs: istToUtcMs("2026-04-29T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // May 6, 2026
  sessions.push({ scheduledAtMs: istToUtcMs("2026-05-06T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // May 13, 2026
  sessions.push({ scheduledAtMs: istToUtcMs("2026-05-13T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // May 20, 2026
  sessions.push({ scheduledAtMs: istToUtcMs("2026-05-20T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });
  // May 27, 2026
  sessions.push({ scheduledAtMs: istToUtcMs("2026-05-27T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_PYTHON_ID, status: "scheduled", studentFirstName: "Sai Akshath Pari Kumaran", studentLastName: "", studentGrade: "7", notes: "Python Level 1 — Ms. Dolon" });

  return sessions;
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
    .where(eq(users.email, "Sairammaheshwari@gmail.com"))
    .limit(1);

  if (existing.length > 0) {
    const parentUserId = existing[0].id;
    console.log(`ℹ️  User already exists (id: ${parentUserId}). Reinserting sessions only...`);
    const sessionEntries = buildSessions();
    let inserted = 0;
    for (const s of sessionEntries) {
      try {
        await db.insert(sessions).values({
          parentId: parentUserId,
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
        } as any);
        inserted++;
      } catch (err: any) {
        if (err?.code === "ER_DUP_ENTRY") {
          console.warn(`  ⚠️  Duplicate skipped: ${s.studentFirstName} @ ${new Date(Number(s.scheduledAtMs)).toISOString()}`);
        } else {
          throw err;
        }
      }
    }
    console.log(`  ✓ ${inserted} sessions inserted`);
    console.log("\n✅ Done (sessions-only re-run)");
    process.exit(0);
  }

  // 2. Hash password
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);

  // 3. Insert parent user
  console.log("Inserting parent user...");
  const [userResult] = await db.insert(users).values({
    email: "Sairammaheshwari@gmail.com",
    passwordHash,
    firstName: "Maheswari",
    lastName: "",
    name: "Maheswari",
    role: "parent",
    userType: "parent",
    phoneNumber: "+16825210038",
    timezone: "America/New_York",
    emailVerified: true,
    accountSetupComplete: true,
    openId: randomUUID(),
  } as any);
  const parentUserId = (userResult as any).insertId as number;
  console.log(`  ✓ User created — id: ${parentUserId}`);

  // 4. Insert parentProfile
  console.log("Inserting parent profile...");
  await db.insert(parentProfiles).values({
    userId: parentUserId,
    childrenInfo: JSON.stringify([
      { firstName: "Sai Lakshika", lastName: "", grade: "5" },
      { firstName: "Sai Lakshitha", lastName: "", grade: "5" },
      { firstName: "Sai Akshath Pari Kumaran", lastName: "", grade: "7" },
    ]),
    preferredContactMethod: "email",
    timezone: "America/New_York",
  } as any);
  console.log("  ✓ Parent profile created");

  // 5. Insert subscriptions
  console.log("Inserting subscriptions...");

  await db.insert(subscriptions).values({
    parentId: parentUserId,
    courseId: COURSE_ELEM_ENGLISH_ID,
    studentFirstName: "Sai Lakshika",
    studentLastName: "",
    studentGrade: "5",
    status: "active",
    startDate: new Date("2025-06-27"),
    paymentStatus: "paid",
    preferredTutorId: TUTOR_APOORVA_ID,
  } as any);
  console.log("  ✓ Subscription: Sai Lakshika — Elementary Level English");

  await db.insert(subscriptions).values({
    parentId: parentUserId,
    courseId: COURSE_ELEM_ENGLISH_ID,
    studentFirstName: "Sai Lakshitha",
    studentLastName: "",
    studentGrade: "5",
    status: "active",
    startDate: new Date("2025-06-30"),
    paymentStatus: "paid",
    preferredTutorId: TUTOR_APOORVA_ID,
  } as any);
  console.log("  ✓ Subscription: Sai Lakshitha — Elementary Level English");

  await db.insert(subscriptions).values({
    parentId: parentUserId,
    courseId: COURSE_MS_MATH_ID,
    studentFirstName: "Sai Akshath Pari Kumaran",
    studentLastName: "",
    studentGrade: "7",
    status: "active",
    startDate: new Date("2026-02-08"),
    paymentStatus: "paid",
    preferredTutorId: TUTOR_MAYA_ID,
  } as any);
  console.log("  ✓ Subscription: Sai Akshath Pari Kumaran — Middle School Math");

  await db.insert(subscriptions).values({
    parentId: parentUserId,
    courseId: COURSE_PYTHON_ID,
    studentFirstName: "Sai Akshath Pari Kumaran",
    studentLastName: "",
    studentGrade: "7",
    status: "active",
    startDate: new Date("2026-02-06"),
    paymentStatus: "paid",
    preferredTutorId: TUTOR_DOLON_ID,
  } as any);
  console.log("  ✓ Subscription: Sai Akshath Pari Kumaran — Python Level 1");

  // 6. Insert sessions
  console.log("\nInserting sessions...");
  const sessionEntries = buildSessions();
  let inserted = 0;
  for (const s of sessionEntries) {
    try {
      await db.insert(sessions).values({
        parentId: parentUserId,
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
      } as any);
      inserted++;
    } catch (err: any) {
      if (err?.code === "ER_DUP_ENTRY") {
        console.warn(`  ⚠️  Duplicate skipped: ${s.studentFirstName} @ ${new Date(Number(s.scheduledAtMs)).toISOString()}`);
      } else {
        throw err;
      }
    }
  }
  console.log(`  ✓ ${inserted} sessions inserted`);

  // 7. Link sessions to subscriptions
  console.log("\nLinking sessions to subscriptions...");

  // Get subscription IDs
  const subs = await db
    .select({ id: subscriptions.id, courseId: subscriptions.courseId, studentFirstName: subscriptions.studentFirstName })
    .from(subscriptions)
    .where(eq(subscriptions.parentId, parentUserId));

  for (const sub of subs) {
    const { rowsAffected } = await db
      .update(sessions)
      .set({ subscriptionId: sub.id } as any)
      .where(
        and(
          eq(sessions.parentId, parentUserId),
          eq(sessions.courseId, sub.courseId),
          eq((sessions as any).studentFirstName, sub.studentFirstName)
        )
      ) as any;
    console.log(`  ✓ Linked ${rowsAffected ?? "?"} sessions → subscription ${sub.id} (${sub.studentFirstName}, course ${sub.courseId})`);
  }

  console.log("\n✅ Migration complete!");
  console.log(`   Parent user id: ${parentUserId}`);
  console.log(`   Total sessions attempted: ${sessionEntries.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
