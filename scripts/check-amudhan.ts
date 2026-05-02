import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();
const parent = ((await db.execute(sql`SELECT id FROM users WHERE email = 'ashok.sree@gmail.com'`)) as any)[0][0];

const rows = ((await db.execute(sql`
  SELECT s.id, s.scheduledAt, s.status, s.studentFirstName, s.studentLastName,
    c.title as course, u.firstName as tutorFirst, u.lastName as tutorLast
  FROM sessions s
  JOIN courses c ON c.id = s.courseId
  JOIN users u ON u.id = s.tutorId
  WHERE s.parentId = ${parent.id}
    AND s.scheduledAt >= ${new Date("2026-04-20").getTime()}
    AND s.scheduledAt < ${new Date("2026-04-23").getTime()}
  ORDER BY s.scheduledAt
`)) as any)[0] as any[];

for (const r of rows) {
  const d = new Date(Number(r.scheduledAt));
  console.log(`id=${r.id} ${d.toISOString()} status=${r.status} ${r.course} — ${r.tutorFirst} ${r.tutorLast} (${r.studentFirstName})`);
}
process.exit(0);
