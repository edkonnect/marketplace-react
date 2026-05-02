import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();
const ms = new Date("2026-04-25T15:30:00.000Z").getTime();
const ref = ((await db.execute(sql`SELECT courseId, subscriptionId FROM sessions WHERE parentId = 97 AND tutorId = 52 AND status = 'scheduled' LIMIT 1`)) as any)[0][0];

await db.execute(sql`
  INSERT INTO sessions (parentId, tutorId, courseId, subscriptionId, scheduledAt, duration, status, isTrial, isMigrated, studentFirstName, studentLastName, meetingPlatform, acuityAppointmentId)
  VALUES (97, 52, ${ref.courseId}, ${ref.subscriptionId}, ${ms}, 60, 'scheduled', 0, 0, 'Srihitha', 'Pericharla', 'Zoom', '1674865509')
`);
console.log("✅ Inserted Apr 25 11:30 AM EDT (15:30 UTC) — Srihitha");

const total = ((await db.execute(sql`SELECT COUNT(*) as cnt FROM sessions WHERE parentId = 97 AND status = 'scheduled'`)) as any)[0][0];
console.log(`Total scheduled: ${total.cnt}`);
process.exit(0);
