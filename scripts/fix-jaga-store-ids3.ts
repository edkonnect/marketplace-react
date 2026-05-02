import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

const fixes = [
  { ms: new Date("2026-04-22T00:30:00.000Z").getTime(), acuityId: "1674010011" },
  { ms: new Date("2026-04-24T00:30:00.000Z").getTime(), acuityId: "1673893908" },
  { ms: new Date("2026-04-25T15:30:00.000Z").getTime(), acuityId: "1674865509" },
];

for (const { ms, acuityId } of fixes) {
  const row = ((await db.execute(sql`
    SELECT id FROM sessions WHERE parentId = 97 AND tutorId = 52 AND scheduledAt = ${ms}
      AND (acuityAppointmentId IS NULL OR acuityAppointmentId = '')
  `)) as any)[0][0];
  if (!row) { console.log(`Already set or not found: ${new Date(ms).toISOString()}`); continue; }
  await db.execute(sql`UPDATE sessions SET acuityAppointmentId = ${acuityId} WHERE id = ${row.id}`);
  console.log(`✅ id=${row.id} ${new Date(ms).toISOString()} → acuityId=${acuityId}`);
}
process.exit(0);
