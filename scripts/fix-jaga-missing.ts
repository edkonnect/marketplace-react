import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Get a reference session for parentId=97, tutorId=52 (Sriilalit)
const ref = ((await db.execute(sql`
  SELECT id, courseId, subscriptionId, tutorId, duration, acuityAppointmentId
  FROM sessions
  WHERE parentId = 97 AND tutorId = 52 AND status = 'scheduled'
  LIMIT 1
`)) as any)[0][0];

console.log("Reference session:", ref);

// 3 missing sessions (EDT → UTC):
// Apr 21 7:30 PM EDT = Apr 22 00:30:00 UTC
// Apr 23 7:30 PM EDT = Apr 24 00:30:00 UTC  
// Apr 25 11:30 AM EDT = Apr 25 15:30:00 UTC
const missing = [
  { ms: new Date("2026-04-22T00:30:00.000Z").getTime(), acuityId: null },
  { ms: new Date("2026-04-24T00:30:00.000Z").getTime(), acuityId: null },
  { ms: new Date("2026-04-25T15:30:00.000Z").getTime(), acuityId: null },
];

for (const { ms } of missing) {
  const existing = ((await db.execute(sql`
    SELECT id FROM sessions WHERE parentId = 97 AND tutorId = 52 AND scheduledAt = ${ms}
  `)) as any)[0][0];
  if (existing) {
    console.log(`Already exists: ${new Date(ms).toISOString()} id=${existing.id}`);
    continue;
  }
  await db.execute(sql`
    INSERT INTO sessions (parentId, tutorId, courseId, subscriptionId, scheduledAt, status, duration, isMigrated)
    VALUES (97, ${ref.tutorId}, ${ref.courseId}, ${ref.subscriptionId}, ${ms}, 'scheduled', ${ref.duration}, 0)
  `);
  console.log(`✅ Inserted: ${new Date(ms).toISOString()}`);
}

// Verify
const rows = ((await db.execute(sql`
  SELECT id, scheduledAt FROM sessions WHERE parentId = 97 AND status = 'scheduled' ORDER BY scheduledAt
`)) as any)[0] as any[];
console.log(`\nTotal scheduled: ${rows.length}`);
for (const r of rows) console.log(`  ${r.id} ${new Date(Number(r.scheduledAt)).toISOString().slice(0,16)}`);

process.exit(0);
