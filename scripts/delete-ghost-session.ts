import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Check before deleting
const r = await db.execute(sql`
  SELECT s.id, s.scheduledAt, FROM_UNIXTIME(s.scheduledAt/1000) as dt_utc,
    s.status, s.studentFirstName, s.courseId, s.feedbackFromTutor,
    u.name as tutorName, p.email as parentEmail
  FROM sessions s
  JOIN users u ON u.id = s.tutorId
  JOIN users p ON p.id = s.parentId
  WHERE s.id IN (30627, 30628, 30629)
`);
const rows = (r as any)[0] as any[];
console.log("Sessions to delete:");
for (const row of rows) console.log(JSON.stringify(row));

await db.execute(sql`DELETE FROM sessions WHERE id IN (30627, 30628, 30629)`);
console.log("✅ Deleted sessions 30627, 30628, 30629");

process.exit(0);
