import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();
const rows = ((await db.execute(sql`
  SELECT s.id, s.scheduledAt, s.status, c.title as course, u.firstName, u.lastName
  FROM sessions s
  JOIN courses c ON c.id = s.courseId
  JOIN users u ON u.id = s.tutorId
  WHERE s.parentId = 97 AND s.status = 'scheduled'
  ORDER BY s.scheduledAt
`)) as any)[0] as any[];

console.log(`Scheduled sessions: ${rows.length}`);
for (const r of rows) {
  const d = new Date(Number(r.scheduledAt));
  console.log(`  ${r.id} ${d.toISOString().slice(0,16)} ${r.course} — ${r.firstName} ${r.lastName}`);
}
process.exit(0);
