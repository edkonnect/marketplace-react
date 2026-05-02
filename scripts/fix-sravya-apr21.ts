import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

const parent = ((await db.execute(sql`SELECT id FROM users WHERE email = 'deepsforever@gmail.com'`)) as any)[0][0];
const tutor = ((await db.execute(sql`SELECT id FROM users WHERE email = 'chintalapati.vrs@gmail.com'`)) as any)[0][0];

// Apr 21 8:30 PM EDT = Apr 22 00:30 UTC
const ms = new Date("2026-04-22T00:30:00.000Z").getTime();

// Check not already there
const existing = ((await db.execute(sql`SELECT id FROM sessions WHERE parentId = ${parent.id} AND tutorId = ${tutor.id} AND scheduledAt = ${ms}`)) as any)[0][0];
if (existing) { console.log(`Already exists: id=${existing.id}`); process.exit(0); }

// Get ref session for courseId/subscriptionId
const ref = ((await db.execute(sql`SELECT courseId, subscriptionId FROM sessions WHERE parentId = ${parent.id} AND tutorId = ${tutor.id} AND status = 'scheduled' LIMIT 1`)) as any)[0][0];

await db.execute(sql`
  INSERT INTO sessions (parentId, tutorId, courseId, subscriptionId, scheduledAt, duration, status, isTrial, isMigrated, studentFirstName, studentLastName, meetingPlatform, acuityAppointmentId)
  VALUES (${parent.id}, ${tutor.id}, ${ref.courseId}, ${ref.subscriptionId}, ${ms}, 60, 'scheduled', 0, 0, 'Sravya', 'Gurajala', 'Zoom', '1609590566')
`);
console.log(`✅ Inserted: Apr 21 8:30 PM EDT (Apr 22 00:30 UTC) — Sravya / Sriilalit / AP Calculus`);

const total = ((await db.execute(sql`SELECT COUNT(*) as cnt FROM sessions WHERE parentId = ${parent.id} AND status = 'scheduled'`)) as any)[0][0];
console.log(`Total scheduled for Sravya: ${total.cnt}`);
process.exit(0);
