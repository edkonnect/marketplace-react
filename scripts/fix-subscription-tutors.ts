/**
 * One-time script: fix subscription tutors for 63 migrated parents
 *
 * Problem: During migration, subscriptions were assigned tutors via course_tutors.
 * If the actual tutor wasn't in course_tutors for that course, a fallback
 * primary tutor was assigned instead (often Arunn, id=3) — wrong.
 *
 * Fix: For each subscription of a migrated parent, find the next upcoming session
 * for that parentId + courseId. If found, set preferredTutorId = session.tutorId.
 * getSubscriptionsByParentId already prioritises preferredTutorId (priority 1),
 * so My Subscriptions will immediately show the correct tutor.
 *
 * Run on EC2:
 *   pnpm tsx scripts/fix-subscription-tutors.ts
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { subscriptions, sessions, users } from "../drizzle/schema";
import { sql, eq, and, gte, asc } from "drizzle-orm";

async function main() {
  console.log("=== Fix Subscription Tutors ===\n");

  const db = await getDb();
  if (!db) { console.error("Database not available"); process.exit(1); }

  // Get all subscriptions for migrated parents (id 81-143)
  const subs = await db
    .select({
      id: subscriptions.id,
      parentId: subscriptions.parentId,
      courseId: subscriptions.courseId,
      preferredTutorId: subscriptions.preferredTutorId,
      studentFirstName: subscriptions.studentFirstName,
    })
    .from(subscriptions)
    .where(sql`${subscriptions.parentId} BETWEEN 81 AND 143`);

  console.log(`Found ${subs.length} subscriptions for migrated parents\n`);

  let updated = 0;
  let skipped = 0;
  let noSession = 0;
  const noSessionList: { subId: number; parentId: number; courseId: number }[] = [];

  const now = Date.now();

  for (const sub of subs) {
    // Find the next upcoming session for this parentId + courseId
    const sessionRows = await db
      .select({ tutorId: sessions.tutorId })
      .from(sessions)
      .where(
        and(
          eq(sessions.parentId, sub.parentId),
          eq(sessions.courseId, sub.courseId),
          gte(sessions.scheduledAt, now),
          eq(sessions.status, "scheduled"),
          eq(sessions.isTrial, false)
        )
      )
      .orderBy(asc(sessions.scheduledAt))
      .limit(1);

    if (sessionRows.length === 0) {
      noSession++;
      noSessionList.push({ subId: sub.id, parentId: sub.parentId, courseId: sub.courseId });
      continue;
    }

    const sessionTutorId = sessionRows[0].tutorId;

    if (sessionTutorId === sub.preferredTutorId) {
      skipped++;
      continue;
    }

    // Update preferredTutorId to match the Acuity-assigned tutor
    await db
      .update(subscriptions)
      .set({ preferredTutorId: sessionTutorId })
      .where(eq(subscriptions.id, sub.id));

    console.log(`  Sub ${sub.id} (parent ${sub.parentId}, course ${sub.courseId}): preferredTutorId ${sub.preferredTutorId ?? "null"} -> ${sessionTutorId}`);
    updated++;
  }

  console.log("\n========================================");
  console.log("=== Summary ===");
  console.log(`Updated:    ${updated}`);
  console.log(`Skipped (already correct): ${skipped}`);
  console.log(`No upcoming session found:  ${noSession}`);

  if (noSessionList.length > 0) {
    console.log("\n=== Subscriptions with no upcoming session (tutor unchanged) ===");
    for (const row of noSessionList) {
      console.log(`  sub ${row.subId} | parent ${row.parentId} | course ${row.courseId}`);
    }
  }

  process.exit(0);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
