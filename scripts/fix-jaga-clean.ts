import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Check studentFirstName and acuityAppointmentId for all 13
const rows = ((await db.execute(sql`
  SELECT id, scheduledAt, studentFirstName, acuityAppointmentId
  FROM sessions WHERE parentId = 97 AND status = 'scheduled' ORDER BY scheduledAt
`)) as any)[0] as any[];

for (const r of rows) {
  const d = new Date(Number(r.scheduledAt)).toISOString().slice(0,16);
  console.log(`id=${r.id} ${d} student="${r.studentFirstName ?? 'NULL'}" acuityId=${r.acuityAppointmentId ?? 'NULL'}`);
}
process.exit(0);
