/**
 * Migration script: Meera Shankar (parent) + 1 student (Sachchit) + sessions
 *
 * Run on EC2:
 *   pnpm tsx scripts/migrate-sachchit-shankar.ts
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

// Tutor IDs
const TUTOR_DOLON_ID       = 50;  // Ms. Dolon Mukherjee
const TUTOR_SRIILALIT_ID   = 52;  // Sriilalit Narayana (AP Calculus)
const TUTOR_BICHU_ID       = 54;  // Mr. Bichu S Kumar (AP Physics)
const TUTOR_PRASENJITH_ID  = 3;   // Mr. Prasenjith → Arun Sivaan
const TUTOR_SHREYAS_ID     = 3;   // Mr. Shreyas Lenkala → Arun Sivaan
const TUTOR_MERCY_ID       = 30;  // Ms. Mercy Rani (SAT English)
const TUTOR_MUSTAQ_ID      = 61;  // Mr. Mustaq (SAT Math)
const TUTOR_APOORVA_ID     = 24;  // Ms. Apoorva (SAT English)
const TUTOR_MAYA_ID        = 47;  // Ms. Maya (SAT Math)
const TUTOR_SHRITI_ID      = 23;  // Ms. Shriti (SAT English)

// Course IDs
const COURSE_SAT_MATH_ID   = 1;   // SAT Math Prep
const COURSE_SAT_ENG_ID    = 25;  // SAT (English)
const COURSE_CALCULUS_ID   = 88;  // High School Calculus
const COURSE_CS_ID         = 69;  // AP Computer Science A
const COURSE_PHYSICS_ID    = 84;  // AP Physics 1

// ── EST/EDT to UTC ms ─────────────────────────────────────────────────────────

/** EST = UTC-5 */
function estToUtcMs(dateStr: string): bigint {
  const offsetMs = 5 * 60 * 60 * 1000;
  return BigInt(new Date(dateStr).getTime() + offsetMs);
}

/** EDT = UTC-4 */
function edtToUtcMs(dateStr: string): bigint {
  const offsetMs = 4 * 60 * 60 * 1000;
  return BigInt(new Date(dateStr).getTime() + offsetMs);
}

// ── Session list ──────────────────────────────────────────────────────────────

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
    // ── 2024 ──────────────────────────────────────────────────────────────────

    // Nov 26 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2024-11-26T17:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Nov 27 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2024-11-27T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Nov 29 — Apoorva — SAT English
    { scheduledAtMs: estToUtcMs("2024-11-29T21:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Apoorva" },

    // Nov 30 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2024-11-30T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Dec 3 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-03T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },
    // Dec 3 — Shriti — SAT English
    { scheduledAtMs: estToUtcMs("2024-12-03T19:30:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Shriti" },

    // Dec 7 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2024-12-07T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Dec 8 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-08T11:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Dec 10 — Shriti — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-10T19:30:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Shriti" },
    // Dec 10 — Shriti — SAT English
    { scheduledAtMs: estToUtcMs("2024-12-10T17:30:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Shriti" },

    // Dec 14 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-14T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },
    // Dec 14 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2024-12-14T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Dec 15 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-15T11:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Dec 17 — Shriti — SAT English
    { scheduledAtMs: estToUtcMs("2024-12-17T20:00:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Shriti" },
    // Dec 17 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-17T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },
    // Dec 17 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2024-12-17T19:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Dec 18 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2024-12-18T19:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Dec 19 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2024-12-19T19:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Dec 21 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2024-12-21T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Dec 22 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2024-12-22T09:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Dec 24 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-24T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Dec 26 — Shriti — SAT English
    { scheduledAtMs: estToUtcMs("2024-12-26T08:45:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Shriti" },

    // Dec 27 — Maya — SAT Math
    { scheduledAtMs: estToUtcMs("2024-12-27T10:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Ms. Maya" },
    // Dec 27 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-27T10:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },
    // Dec 27 — Shriti — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-27T08:45:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Shriti" },

    // Dec 29 — Maya — SAT Math
    { scheduledAtMs: estToUtcMs("2024-12-29T20:00:00"), durationMin: 60, tutorId: TUTOR_MAYA_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Ms. Maya" },
    // Dec 29 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2024-12-29T10:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },
    // Dec 29 — Shriti — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-29T08:45:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Shriti" },

    // Dec 30 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2024-12-30T18:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },
    // Dec 30 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2024-12-30T10:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },
    // Dec 30 — Shriti — SAT English
    { scheduledAtMs: estToUtcMs("2024-12-30T08:45:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Shriti" },

    // Dec 31 — Shriti — SAT English
    { scheduledAtMs: estToUtcMs("2024-12-31T19:30:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Shriti" },
    // Dec 31 — Shriti — SAT English (8:45am slot)
    { scheduledAtMs: estToUtcMs("2024-12-31T08:45:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Shriti" },
    // Dec 31 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-31T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },
    // Dec 31 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: estToUtcMs("2024-12-31T10:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // ── 2025 ──────────────────────────────────────────────────────────────────

    // Jan 4 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-01-04T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jan 6 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-01-06T20:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Jan 7 — Shriti — SAT English
    { scheduledAtMs: estToUtcMs("2025-01-07T19:30:00"), durationMin: 60, tutorId: TUTOR_SHRITI_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Shriti" },
    // Jan 7 — Mercy — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-07T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },
    // Jan 7 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-07T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Jan 11 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-01-11T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jan 12 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-12T17:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Jan 14 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-01-14T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Jan 14 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-14T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Jan 15 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-01-15T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jan 16 — Mercy — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-16T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Jan 18 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-18T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Jan 19 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-01-19T13:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },
    // Jan 19 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-01-19T20:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jan 20 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-01-20T11:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },
    // Jan 20 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-20T18:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },
    // Jan 20 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-20T20:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Jan 21 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-01-21T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Jan 21 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-21T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Jan 22 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-01-22T15:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Jan 25 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-01-25T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },
    // Jan 25 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-01-25T10:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Jan 28 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-01-28T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Jan 28 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-01-28T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Feb 1 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-02-01T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Feb 3 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-02-03T17:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Feb 4 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-02-04T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Feb 4 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-02-04T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Feb 6 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-02-06T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Feb 7 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-02-07T18:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Feb 8 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-02-08T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Feb 11 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-02-11T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Feb 11 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-02-11T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Feb 13 — Mercy — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-02-13T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Feb 15 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: estToUtcMs("2025-02-15T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Feb 16 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-02-16T11:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Feb 17 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-02-17T10:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },
    // Feb 17 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-02-17T12:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Feb 18 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-02-18T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Feb 18 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-02-18T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Feb 20 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-02-20T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Feb 22 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-02-22T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Feb 25 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-02-25T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Feb 25 — Apoorva — SAT English [cancelled]
    { scheduledAtMs: estToUtcMs("2025-02-25T17:30:00"), durationMin: 60, tutorId: TUTOR_APOORVA_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Apoorva" },

    // Feb 27 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-02-27T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Feb 28 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-02-28T15:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Mar 1 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-03-01T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Mar 4 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-03-04T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Mar 5 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-03-05T18:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Mar 6 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-03-06T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Mar 6 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-03-06T20:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Mar 8 — Mustaq — SAT Math
    { scheduledAtMs: estToUtcMs("2025-03-08T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Mar 10 — Shreyas — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-03-10T16:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },
    // Mar 10 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-03-10T20:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Mar 11 — Mercy — SAT English
    { scheduledAtMs: estToUtcMs("2025-03-11T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Mar 11 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-03-11T20:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Mar 13 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-03-13T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Mar 15 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-03-15T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Mar 16 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-03-16T09:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Mar 17 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-03-17T16:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Mar 18 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-03-18T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Mar 20 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-03-20T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Mar 22 — Shreyas — AP Calculus [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-03-22T17:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Mar 25 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-03-25T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Mar 27 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-03-27T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Mar 29 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-03-29T13:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Apr 2 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-04-02T18:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Apr 19 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-04-19T10:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // May 2 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-05-02T20:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // May 3 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-05-03T17:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // May 10 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-05-10T19:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // May 11 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-05-11T19:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // May 13 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-05-13T20:00:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // May 14 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-05-14T15:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // May 15 — Shreyas — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-05-15T18:30:00"), durationMin: 60, tutorId: TUTOR_SHREYAS_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Mr. Shreyas Lenkala" },

    // Jun 10 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-06-10T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jun 14 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-06-14T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },
    // Jun 13 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-06-13T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Jun 17 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-06-17T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jun 21 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-06-21T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jun 24 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-06-24T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jun 25 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-06-25T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jun 26 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-06-26T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Jun 27 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-06-27T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Jun 28 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-06-28T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jun 30 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-06-30T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jul 1 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-07-01T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 2 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-07-02T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jul 3 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-03T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 5 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-07-05T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jul 7 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-07-07T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jul 8 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-07-08T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 10 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-10T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },
    // Jul 10 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-10T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Jul 12 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-07-12T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jul 14 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-14T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Jul 15 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-07-15T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Jul 15 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-15T19:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Jul 16 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-07-16T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 17 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-07-17T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 20 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-07-20T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 21 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-21T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Jul 22 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-22T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 24 — Mercy — SAT English [cancelled x2]
    { scheduledAtMs: edtToUtcMs("2025-07-24T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },
    { scheduledAtMs: edtToUtcMs("2025-07-24T08:00:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 25 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-07-25T08:00:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 28 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-28T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Jul 29 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-07-29T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },
    // Jul 29 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-07-29T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Jul 30 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-07-30T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Jul 31 — Mercy — SAT English [cancelled x2]
    { scheduledAtMs: edtToUtcMs("2025-07-31T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },
    { scheduledAtMs: edtToUtcMs("2025-07-31T08:00:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Aug 5 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-08-05T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Aug 5 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-08-05T05:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Aug 7 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-08-07T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },
    // Aug 7 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-08-07T08:00:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },
    // Aug 7 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-08-07T05:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Aug 11 — Mustaq — SAT Math [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-08-11T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "cancelled", notes: "SAT Math — Mr. Mustaq" },

    // Aug 12 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-08-12T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Aug 13 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-08-13T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Aug 14 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-08-14T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Aug 20 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-08-20T20:30:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Aug 21 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-08-21T19:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Sep 6 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-09-06T12:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Sep 9 — Sriilalit — AP Calculus (free trial)
    { scheduledAtMs: edtToUtcMs("2025-09-09T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // Sep 10 — Sriilalit — AP Calculus (free trial)
    { scheduledAtMs: edtToUtcMs("2025-09-10T20:00:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // Sep 11 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-09-11T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Sep 13 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-09-13T12:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Sep 14 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-09-14T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Sep 16 — Sriilalit — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-09-16T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // Sep 18 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-09-18T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Sep 20 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-09-20T12:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Sep 23 — Sriilalit — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-09-23T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // Sep 25 — Mercy — SAT English
    { scheduledAtMs: edtToUtcMs("2025-09-25T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "completed", notes: "SAT English — Ms. Mercy Rani" },

    // Sep 27 — Mustaq — SAT Math
    { scheduledAtMs: edtToUtcMs("2025-09-27T12:00:00"), durationMin: 60, tutorId: TUTOR_MUSTAQ_ID, courseId: COURSE_SAT_MATH_ID, status: "completed", notes: "SAT Math — Mr. Mustaq" },

    // Sep 30 — Sriilalit — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-09-30T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // Oct 2 — Mercy — SAT English [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-10-02T18:30:00"), durationMin: 60, tutorId: TUTOR_MERCY_ID, courseId: COURSE_SAT_ENG_ID, status: "cancelled", notes: "SAT English — Ms. Mercy Rani" },

    // Oct 3 — Dolon — AP Computer Science (free trial)
    { scheduledAtMs: edtToUtcMs("2025-10-03T06:00:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Oct 7 — Sriilalit — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-10-07T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // Oct 10 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2025-10-10T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Oct 14 — Sriilalit — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-10-14T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },
    // Oct 14 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2025-10-14T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Oct 17 — Prasenjith — AP Physics [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-10-17T05:30:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "cancelled", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Oct 21 — Sriilalit — AP Calculus
    { scheduledAtMs: edtToUtcMs("2025-10-21T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },
    // Oct 21 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2025-10-21T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Oct 24 — Prasenjith — AP Physics [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-10-24T05:30:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "cancelled", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Oct 28 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-10-28T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Oct 28 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2025-10-28T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Oct 31 — Prasenjith — AP Physics [cancelled]
    { scheduledAtMs: edtToUtcMs("2025-10-31T05:30:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "cancelled", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Nov 4 — Sriilalit — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-11-04T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },
    // Nov 4 — Dolon — AP Computer Science [cancelled]
    { scheduledAtMs: estToUtcMs("2025-11-04T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "cancelled", notes: "AP Computer Science A — Ms. Dolon" },

    // Nov 7 — Prasenjith — AP Physics
    { scheduledAtMs: estToUtcMs("2025-11-07T05:00:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Nov 11 — Sriilalit — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-11-11T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },
    // Nov 11 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2025-11-11T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Nov 15 — Prasenjith — AP Physics
    { scheduledAtMs: estToUtcMs("2025-11-15T05:00:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Nov 18 — Sriilalit — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-11-18T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },
    // Nov 18 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2025-11-18T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Nov 21 — Prasenjith — AP Physics
    { scheduledAtMs: estToUtcMs("2025-11-21T05:00:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Nov 25 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-11-25T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Nov 25 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2025-11-25T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Nov 28 — Prasenjith — AP Physics
    { scheduledAtMs: estToUtcMs("2025-11-28T05:00:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Dec 2 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-12-02T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Dec 2 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2025-12-02T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Dec 5 — Prasenjith — AP Physics
    { scheduledAtMs: estToUtcMs("2025-12-05T05:00:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Dec 9 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-12-09T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Dec 9 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2025-12-09T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Dec 12 — Prasenjith — AP Physics
    { scheduledAtMs: estToUtcMs("2025-12-12T05:00:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Dec 16 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-12-16T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Dec 16 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2025-12-16T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Dec 19 — Prasenjith — AP Physics [cancelled]
    { scheduledAtMs: estToUtcMs("2025-12-19T05:00:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "cancelled", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Dec 20 — Bichu — AP Physics
    { scheduledAtMs: estToUtcMs("2025-12-20T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Dec 23 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2025-12-23T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Dec 23 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2025-12-23T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Dec 26 — Prasenjith — AP Physics
    { scheduledAtMs: estToUtcMs("2025-12-26T05:00:00"), durationMin: 60, tutorId: TUTOR_PRASENJITH_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Prasenjith" },

    // Dec 27 — Bichu — AP Physics
    { scheduledAtMs: estToUtcMs("2025-12-27T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Dec 30 — Sriilalit — AP Calculus
    { scheduledAtMs: estToUtcMs("2025-12-30T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // ── 2026 ──────────────────────────────────────────────────────────────────

    // Jan 3 — Bichu — AP Physics
    { scheduledAtMs: estToUtcMs("2026-01-03T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Bichu S Kumar" },
    // Jan 3 — Dolon — AP Computer Science [cancelled]
    { scheduledAtMs: estToUtcMs("2026-01-03T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "cancelled", notes: "AP Computer Science A — Ms. Dolon" },

    // Jan 6 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2026-01-06T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Jan 6 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2026-01-06T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Jan 10 — Bichu — AP Physics
    { scheduledAtMs: estToUtcMs("2026-01-10T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Jan 13 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2026-01-13T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },

    // Jan 17 — Bichu — AP Physics
    { scheduledAtMs: estToUtcMs("2026-01-17T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Jan 20 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2026-01-20T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Jan 20 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2026-01-20T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Jan 24 — Bichu — AP Physics
    { scheduledAtMs: estToUtcMs("2026-01-24T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Jan 27 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2026-01-27T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },

    // Jan 31 — Bichu — AP Physics
    { scheduledAtMs: estToUtcMs("2026-01-31T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Feb 3 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-03T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Feb 3 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2026-02-03T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Feb 7 — Bichu — AP Physics
    { scheduledAtMs: estToUtcMs("2026-02-07T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "completed", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Feb 10 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-10T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Feb 10 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2026-02-10T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Feb 14 — Bichu — AP Physics [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-14T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "cancelled", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Feb 17 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-17T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Feb 17 — Dolon — AP Computer Science [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-17T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "cancelled", notes: "AP Computer Science A — Ms. Dolon" },

    // Feb 21 — Bichu — AP Physics [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-21T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "cancelled", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Feb 24 — Sriilalit — AP Calculus [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-24T18:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "cancelled", notes: "High School Calculus — Sriilalit Narayana" },
    // Feb 24 — Dolon — AP Computer Science [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-24T06:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "cancelled", notes: "AP Computer Science A — Ms. Dolon" },

    // Feb 28 — Bichu — AP Physics [cancelled]
    { scheduledAtMs: estToUtcMs("2026-02-28T09:30:00"), durationMin: 60, tutorId: TUTOR_BICHU_ID, courseId: COURSE_PHYSICS_ID, status: "cancelled", notes: "AP Physics 1 — Mr. Bichu S Kumar" },

    // Mar 3 — Sriilalit — AP Calculus
    { scheduledAtMs: estToUtcMs("2026-03-03T06:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // Mar 7 — Sriilalit — AP Calculus
    { scheduledAtMs: estToUtcMs("2026-03-07T06:30:00"), durationMin: 60, tutorId: TUTOR_SRIILALIT_ID, courseId: COURSE_CALCULUS_ID, status: "completed", notes: "High School Calculus — Sriilalit Narayana" },

    // Mar 10 — Dolon — AP Computer Science
    { scheduledAtMs: estToUtcMs("2026-03-10T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Mar 21 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-03-21T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Mar 28 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-03-28T06:00:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // Mar 31 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-03-31T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "completed", notes: "AP Computer Science A — Ms. Dolon" },

    // ── Upcoming ──────────────────────────────────────────────────────────────

    // Apr 7 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-04-07T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "scheduled", notes: "AP Computer Science A — Ms. Dolon" },

    // Apr 14 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-04-14T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "scheduled", notes: "AP Computer Science A — Ms. Dolon" },

    // Apr 21 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-04-21T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "scheduled", notes: "AP Computer Science A — Ms. Dolon" },

    // Apr 28 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-04-28T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "scheduled", notes: "AP Computer Science A — Ms. Dolon" },

    // May 5 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-05-05T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "scheduled", notes: "AP Computer Science A — Ms. Dolon" },

    // May 12 — Dolon — AP Computer Science
    { scheduledAtMs: edtToUtcMs("2026-05-12T05:30:00"), durationMin: 60, tutorId: TUTOR_DOLON_ID, courseId: COURSE_CS_ID, status: "scheduled", notes: "AP Computer Science A — Ms. Dolon" },
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
    .where(eq(users.email, "shankarmeera@gmail.com"))
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
        studentFirstName: "Sachchit",
        studentLastName: "Shankar",
        studentGrade: "11",
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
    email: "shankarmeera@gmail.com",
    passwordHash,
    firstName: "Meera",
    lastName: "Shankar",
    name: "Meera Shankar",
    role: "parent",
    userType: "parent",
    phoneNumber: "+13026056967",
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
      { firstName: "Sachchit", lastName: "Shankar", grade: "11" },
    ]),
    preferredContactMethod: "email",
    timezone: "America/New_York",
  });
  console.log("  ✓ Parent profile created");

  // 5. Insert subscriptions (only the two with Subscription status)
  console.log("Inserting subscriptions...");
  const subStartDate = new Date("2024-11-25");

  await db.insert(subscriptions).values({
    parentId: parentUserId,
    courseId: COURSE_SAT_MATH_ID,
    studentFirstName: "Sachchit",
    studentLastName: "Shankar",
    studentGrade: "11",
    status: "active",
    startDate: subStartDate,
    paymentStatus: "paid",
  } as any);
  console.log("  ✓ Subscription: Sachchit — SAT Math Prep");

  await db.insert(subscriptions).values({
    parentId: parentUserId,
    courseId: COURSE_SAT_ENG_ID,
    studentFirstName: "Sachchit",
    studentLastName: "Shankar",
    studentGrade: "11",
    status: "active",
    startDate: subStartDate,
    paymentStatus: "paid",
  } as any);
  console.log("  ✓ Subscription: Sachchit — SAT English");

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
      studentFirstName: "Sachchit",
      studentLastName: "Shankar",
      studentGrade: "11",
      notes: s.notes,
      meetingPlatform: "Zoom",
    } as any);
    inserted++;
  }
  console.log(`  ✓ ${inserted} sessions inserted`);

  console.log("\n═══════════════════════════════════════");
  console.log("✅ Migration complete!");
  console.log(`   Parent user ID : ${parentUserId}`);
  console.log(`   Email          : shankarmeera@gmail.com`);
  console.log(`   Temp password  : ${TEMP_PASSWORD}`);
  console.log("   ⚠️  Share temp password with parent and ask them to reset it.");
  console.log("═══════════════════════════════════════\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
