import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();
const parentId = 152;

// Apr 20 20:00 EDT = Apr 21 00:00 UTC → acuityId=1681528971 (tutorId=56, cal 13611648=ramesh)
// Apr 26 20:00 EDT = Apr 27 00:00 UTC → acuityId=1681430970 (tutorId=59, cal 12804136=nalini)
// Apr 27 20:00 EDT = Apr 28 00:00 UTC → acuityId=1681528976 (tutorId=56, cal 13611648=ramesh)

const fixes = [
  { ms: new Date("2026-04-21T00:00:00.000Z").getTime(), acuityId: "1681528971" },
  { ms: new Date("2026-04-27T00:00:00.000Z").getTime(), acuityId: "1681430970" },
  { ms: new Date("2026-04-28T00:00:00.000Z").getTime(), acuityId: "1681528976" },
];

for (const { ms, acuityId } of fixes) {
  const row = ((await db.execute(sql`
    SELECT id FROM sessions WHERE parentId = ${parentId} AND scheduledAt = ${ms} AND (acuityAppointmentId IS NULL OR acuityAppointmentId = '')
  `)) as any)[0][0];
  if (!row) { console.log(`Already set or not found: ${new Date(ms).toISOString()}`); continue; }
  await db.execute(sql`UPDATE sessions SET acuityAppointmentId = ${acuityId} WHERE id = ${row.id}`);
  console.log(`✅ id=${row.id} → acuityId=${acuityId}`);
}
process.exit(0);
