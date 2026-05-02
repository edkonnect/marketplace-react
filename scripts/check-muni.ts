import "dotenv/config";
import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

const db = await getDb();
const rows = await db.execute(sql`
  SELECT s.id, s.tutorId, s.courseId, s.scheduledAt,
    FROM_UNIXTIME(s.scheduledAt/1000) as dt_utc,
    s.status, s.studentFirstName, s.subscriptionId,
    u.name as tutorName
  FROM sessions s
  JOIN users u ON u.id = s.tutorId
  WHERE s.parentId = (SELECT id FROM users WHERE email = 'munidinesh@gmail.com')
  ORDER BY s.scheduledAt DESC
  LIMIT 40
`);
for (const r of (rows as any)[0]) {
  console.log("ROW: " + JSON.stringify(r));
}
process.exit(0);
