import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Map: scheduledAt UTC ms → Acuity appointment ID
const fixes = [
  { ms: new Date("2026-04-21T23:30:00.000Z").getTime(), acuityId: "1674010011" }, // Apr 21 7:30 PM EDT
  { ms: new Date("2026-04-24T00:30:00.000Z").getTime(), acuityId: "1673893908" }, // Apr 23 7:30 PM EDT  (wait - Apr 23 7:30pm EDT = Apr 24 00:30 UTC? Let me check: -0400 so 19:30-04:00 = 23:30 UTC = Apr 23 23:30 UTC)
  { ms: new Date("2026-04-25T15:30:00.000Z").getTime(), acuityId: "1674865509" }, // Apr 25 11:30 AM EDT
];

// Actually recalculate: 2026-04-21T19:30:00-0400 = 2026-04-21T23:30:00Z
// 2026-04-23T19:30:00-0400 = 2026-04-23T23:30:00Z
// 2026-04-25T11:30:00-0400 = 2026-04-25T15:30:00Z

const actualFixes = [
  { ms: new Date("2026-04-21T23:30:00.000Z").getTime(), acuityId: "1674010011" },
  { ms: new Date("2026-04-23T23:30:00.000Z").getTime(), acuityId: "1673893908" },
  { ms: new Date("2026-04-25T15:30:00.000Z").getTime(), acuityId: "1674865509" },
];

for (const { ms, acuityId } of actualFixes) {
  const row = ((await db.execute(sql`
    SELECT id, scheduledAt FROM sessions WHERE parentId = 97 AND tutorId = 52 AND scheduledAt = ${ms}
  `)) as any)[0][0];
  if (!row) {
    console.log(`❌ Not found: ${new Date(ms).toISOString()}`);
    continue;
  }
  await db.execute(sql`UPDATE sessions SET acuityAppointmentId = ${acuityId} WHERE id = ${row.id}`);
  console.log(`✅ id=${row.id} ${new Date(ms).toISOString()} → acuityId=${acuityId}`);
}
process.exit(0);
