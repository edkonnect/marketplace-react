import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Delete the 2 stale manually inserted sessions (superseded by proper sync)
await db.execute(sql`DELETE FROM sessions WHERE id IN (39582, 39583)`);
console.log("✅ Deleted stale manual sessions 39582 and 39583");

// Set studentFirstName on 40484 and 40483 (they have it already, double check)
// Also verify count
const rows = ((await db.execute(sql`
  SELECT id, scheduledAt, studentFirstName, acuityAppointmentId
  FROM sessions WHERE parentId = 97 AND status = 'scheduled' ORDER BY scheduledAt
`)) as any)[0] as any[];

console.log(`\nTotal scheduled: ${rows.length}`);
for (const r of rows) {
  const d = new Date(Number(r.scheduledAt)).toISOString().slice(0,16);
  console.log(`  id=${r.id} ${d} student="${r.studentFirstName ?? 'NULL'}"`);
}
process.exit(0);
