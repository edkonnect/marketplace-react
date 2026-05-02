import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

const ms_sravya = new Date("2026-04-22T00:30:00.000Z").getTime();

// Delete the wrongly placed jagapathirajup duplicate at 00:30 UTC
await db.execute(sql`DELETE FROM sessions WHERE id = 39581`);
console.log("✅ Deleted ghost session id=39581 (wrong-time jagapathirajup duplicate)");

// Get Sravya's subscription/course ref
const parent = ((await db.execute(sql`SELECT id FROM users WHERE email = 'deepsforever@gmail.com'`)) as any)[0][0];
const ref = ((await db.execute(sql`SELECT courseId, subscriptionId FROM sessions WHERE parentId = ${parent.id} AND tutorId = 52 AND status = 'scheduled' LIMIT 1`)) as any)[0][0];

await db.execute(sql`
  INSERT INTO sessions (parentId, tutorId, courseId, subscriptionId, scheduledAt, duration, status, isTrial, isMigrated, studentFirstName, studentLastName, meetingPlatform, acuityAppointmentId)
  VALUES (${parent.id}, 52, ${ref.courseId}, ${ref.subscriptionId}, ${ms_sravya}, 60, 'scheduled', 0, 0, 'Sravya', 'Gurajala', 'Zoom', '1609590566')
`);
console.log("✅ Inserted Sravya Apr 21 8:30 PM EDT (Apr 22 00:30 UTC)");

// Verify jagapathirajup still has 11 (lost the ghost, still has real Srihitha at 23:30)
const jagaCount = ((await db.execute(sql`SELECT COUNT(*) as cnt FROM sessions WHERE parentId = 97 AND status = 'scheduled'`)) as any)[0][0];
const sravyaCount = ((await db.execute(sql`SELECT COUNT(*) as cnt FROM sessions WHERE parentId = ${parent.id} AND status = 'scheduled'`)) as any)[0][0];
console.log(`jagapathirajup scheduled: ${jagaCount.cnt}`);
console.log(`deepsforever scheduled: ${sravyaCount.cnt}`);
process.exit(0);
