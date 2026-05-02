import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// ashok.sree@gmail.com — SAT Math (courseId=1) with Maya Balan (id=47), student=Amudhan
const parentId = 85;
const tutorId = 47;   // Maya Balan
const courseId = 1;   // SAT Math
const studentFirstName = "Amudhan";
const studentLastName = "Ashok";
const startDate = new Date("2026-03-24");

// Check it doesn't already exist
const existing = await db.execute(sql`
  SELECT id FROM subscriptions
  WHERE parentId = ${parentId} AND courseId = ${courseId} AND preferredTutorId = ${tutorId}
`);
if ((existing as any)[0].length > 0) {
  console.log("Subscription already exists:", (existing as any)[0][0]);
  process.exit(0);
}

await db.execute(sql`
  INSERT INTO subscriptions
    (parentId, courseId, preferredTutorId, studentFirstName, studentLastName,
     status, startDate, sessionsCompleted, paymentStatus, paymentPlan,
     firstInstallmentPaid, secondInstallmentPaid)
  VALUES
    (${parentId}, ${courseId}, ${tutorId}, ${studentFirstName}, ${studentLastName},
     'active', ${startDate}, 0, 'paid', 'monthly', 1, 0)
`);

const newSub = (await db.execute(sql`
  SELECT id FROM subscriptions
  WHERE parentId = ${parentId} AND courseId = ${courseId} AND preferredTutorId = ${tutorId}
`) as any)[0][0];

console.log(`✅ Created subscription id=${newSub.id} — SAT Math / Maya Balan / Amudhan Ashok`);

// Link existing sessions to this subscription
await db.execute(sql`
  UPDATE sessions SET subscriptionId = ${newSub.id}
  WHERE parentId = ${parentId} AND tutorId = ${tutorId} AND courseId = ${courseId}
    AND subscriptionId IS NULL
`);
console.log("✅ Linked existing sessions to new subscription");

// Recalculate sessionsCompleted
await db.execute(sql`
  UPDATE subscriptions SET sessionsCompleted = (
    SELECT COUNT(*) FROM sessions
    WHERE parentId = ${parentId} AND tutorId = ${tutorId} AND courseId = ${courseId}
      AND status = 'completed'
  )
  WHERE id = ${newSub.id}
`);
console.log("✅ sessionsCompleted updated");

process.exit(0);
