/**
 * Migrate sessions from legacy_staging.sessions into the main platform DB.
 *
 * - Only processes parents already migrated (matched by email, case-insensitive)
 * - Converts session_date + session_time + timezone → UTC bigint (scheduledAt)
 * - Inserts new sessions with notes + feedbackFromTutor
 * - Skips duplicates (unique constraint on tutorId + scheduledAt)
 * - Links subscriptionId after insert
 *
 * Run on EC2:
 *   pnpm tsx scripts/migrate-sessions-from-staging.ts
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, sessions, subscriptions } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ── Legacy course ID → New platform course ID ────────────────────────────────
const LEGACY_COURSE_MAP: Record<number, number> = {
  1:   null!,  // Math - Elementary Level — no course ID in new platform
  2:   25,     // SAT/ACT - English Reading and Writing
  3:   276,    // English - Reading and Writing (generic) → Advanced English
  4:   1,      // SAT/ACT - Math Test Prep
  5:   4,      // Math - Middle School Level
  6:   177,    // Math - High School Level (default GR9+)
  9:   null!,  // Summer Course - Middle School — no course ID
  14:  4,      // Middle School Math-CBSE/ICSE/IB/State (default)
  15:  150,    // High School Math - CBSE/ICSE/IB/State (default GR11)
  16:  115,    // Elementary School English - CBSE/ICSE/IB/State
  17:  139,    // Middle School English - CBSE/ICSE/IB/State (default)
  22:  219,    // Middle School Physics-CBSE/ICSE/IB/State
  25:  113,    // English - Reading and Writing (Elementary Level)
  26:  114,    // English - Reading and Writing (Middle School Level)
  33:  276,    // English - Reading and Writing (High School Level)
  35:  220,    // Middle School Chemistry - CBSE/ICSE/IB/STATE
  36:  124,    // Middle School Science - CBSE/ICSE/IB/STATE
  37:  154,    // High School Chemistry - CBSE/ICSE/IB/STATE
  45:  162,    // High School Biology - CBSE/ICSE/IB/State
  61:  157,    // High School Physics - CBSE/ICSE/IB/State
  79:  1,      // Digital SAT Math
  80:  25,     // Digital SAT English
  83:  221,    // Middle School Biology - CBSE/ICSE/IB/STATE
  92:  51,     // High School Computers Science - CBSE/ICSE/IG/IB/STATE
  94:  276,    // Spoken English and Grammar
  99:  25,     // SAT Foundation - English
  100: 92,     // ACT Math
  101: 75,     // ACT English
  103: null!,  // AS Pure Mathematics — no course ID
  104: null!,  // AS Probability and Statistics — no course ID
  107: null!,  // Middle School Computer Science — no course ID
  108: 12,     // Computer programming - Python
  116: 33,     // AP Calculus
  117: 22,     // Computer Programming - Java
  118: 88,     // AP Computer Science
  119: 84,     // AP Physics
  123: 82,     // AP Chemistry
};

// ── Timezone conversion ───────────────────────────────────────────────────────
// Converts a local date+time string to UTC milliseconds using the given IANA timezone
function localToUtcMs(dateStr: string, timeStr: string, timezone: string): bigint {
  // Build ISO-like string and interpret in given timezone
  const localStr = `${dateStr}T${timeStr}`;
  // Use Intl to find the UTC offset for this timezone at this date
  const date = new Date(localStr);
  // Get the UTC time by formatting the date in the target timezone and comparing
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  const diff = date.getTime() - tzDate.getTime();
  return BigInt(date.getTime() + diff);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB not available");
    process.exit(1);
  }

  // 1. Fetch all migrated parent emails → id map (lowercase for matching)
  const parentRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, "parent"));

  const parentMap: Record<string, number> = {};
  for (const p of parentRows) {
    parentMap[p.email.toLowerCase()] = p.id;
  }

  console.log(`📋 Loaded ${Object.keys(parentMap).length} migrated parents`);

  // 2. Fetch all sessions from legacy_staging (via raw query on same DB connection)
  const stagingRows: any[] = await db.execute(
    `SELECT
       s.id,
       s.parent_email,
       s.student_first_name,
       s.student_last_name,
       s.student_grade,
       s.course_id,
       s.tutor_id,
       s.session_date,
       s.session_time,
       s.timezone,
       s.duration_min,
       s.status,
       s.is_trial,
       s.notes,
       s.feedback_from_tutor,
       s.meeting_platform
     FROM legacy_staging.sessions s` as any
  );

  const rows = Array.isArray(stagingRows[0]) ? stagingRows[0] : stagingRows;
  console.log(`📦 Total staging sessions: ${rows.length}`);

  // 3. Fetch all subscriptions for parentId linking + tutor resolution
  const subRows = await db
    .select({
      id: subscriptions.id,
      parentId: subscriptions.parentId,
      courseId: subscriptions.courseId,
      studentFirstName: subscriptions.studentFirstName,
      preferredTutorId: subscriptions.preferredTutorId,
    })
    .from(subscriptions);

  // Build lookup: parentId-courseId-studentFirstName → { subscriptionId, tutorId }
  const subMap: Record<string, { subId: number; tutorId: number | null }> = {};
  for (const s of subRows) {
    const key = `${s.parentId}-${s.courseId}-${s.studentFirstName?.toLowerCase()}`;
    subMap[key] = { subId: s.id, tutorId: s.preferredTutorId ?? null };
  }

  // 4. Process each staging session
  let inserted = 0;
  let skipped = 0;
  let noParent = 0;
  let noTutor = 0;
  let errors = 0;

  for (const row of rows) {
    const emailKey = row.parent_email?.toLowerCase();
    const parentId = parentMap[emailKey];

    if (!parentId) {
      noParent++;
      continue;
    }

    // Normalize status to valid enum values
    const rawStatus = (row.status || "").toLowerCase();
    const statusMap: Record<string, string> = {
      active: "scheduled",
      scheduled: "scheduled",
      completed: "completed",
      cancelled: "cancelled",
      canceled: "cancelled",
      no_show: "no_show",
    };
    const status = statusMap[rawStatus] ?? "scheduled";

    // Convert local time → UTC bigint
    const dateStr = typeof row.session_date === "string"
      ? row.session_date
      : new Date(row.session_date).toISOString().split("T")[0];
    const timeStr = typeof row.session_time === "string"
      ? row.session_time
      : String(row.session_time).padStart(8, "0");
    const timezone = row.timezone || "America/New_York";

    let scheduledAtMs: bigint;
    try {
      scheduledAtMs = localToUtcMs(dateStr, timeStr, timezone);
    } catch (e) {
      console.error(`❌ Timezone conversion failed for row id=${row.id}: ${dateStr} ${timeStr} ${timezone}`);
      errors++;
      continue;
    }

    // Map legacy course ID → new platform course ID
    const newCourseId = LEGACY_COURSE_MAP[row.course_id] ?? null;
    if (!newCourseId) {
      noTutor++; // reusing counter for "no course mapping"
      continue;
    }

    // Find subscriptionId and tutorId from main DB subscription
    const subKey = `${parentId}-${newCourseId}-${row.student_first_name?.toLowerCase()}`;
    const subEntry = subMap[subKey] ?? null;
    const subscriptionId = subEntry?.subId ?? null;
    const tutorId = subEntry?.tutorId ?? 3; // fallback to Arunn Sivaan if no subscription match

    try {
      await db.insert(sessions).values({
        parentId,
        tutorId,
        courseId: newCourseId,
        scheduledAt: scheduledAtMs,
        duration: row.duration_min ?? 60,
        status: status as any,
        studentFirstName: row.student_first_name,
        studentLastName: row.student_last_name ?? null,
        studentGrade: row.student_grade ?? null,
        notes: row.feedback_from_tutor ?? null,
        feedbackFromTutor: row.notes ?? null,
        meetingPlatform: row.meeting_platform ?? "Zoom",
        isTrial: row.is_trial === 1 || row.is_trial === true,
        subscriptionId,
      } as any);
      inserted++;
    } catch (err: any) {
      if (err.code === "ER_DUP_ENTRY") {
        skipped++;
      } else {
        console.error(`❌ Insert error row id=${row.id}: ${err.message}`);
        errors++;
      }
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log("🎉 Session migration complete!");
  console.log(`   Inserted  : ${inserted}`);
  console.log(`   Skipped   : ${skipped} (duplicates)`);
  console.log(`   No parent : ${noParent} (not in migrated parents)`);
  console.log(`   No mapping: ${noTutor} (legacy course ID has no new platform course ID)`);
  console.log(`   Errors    : ${errors}`);
  console.log("═══════════════════════════════════════");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
