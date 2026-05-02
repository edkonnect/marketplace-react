import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Check session 16209
const r = await db.execute(sql`
  SELECT s.id, s.tutorId, s.parentId, s.scheduledAt,
    FROM_UNIXTIME(s.scheduledAt/1000) as dt_utc,
    s.status, s.studentFirstName, s.courseId, s.subscriptionId,
    u.name as tutorName
  FROM sessions s
  JOIN users u ON u.id = s.tutorId
  WHERE s.id = 16209
`);
console.log("Session 16209:", JSON.stringify((r as any)[0], null, 2));

// Also check all Mercy Rani sessions for munidinesh around April 17-18
const r2 = await db.execute(sql`
  SELECT s.id, s.scheduledAt,
    FROM_UNIXTIME(s.scheduledAt/1000) as dt_utc,
    s.status, s.studentFirstName
  FROM sessions s
  WHERE s.tutorId = 30 AND s.parentId = 111
    AND s.scheduledAt BETWEEN 1744934400000 AND 1745193600000
  ORDER BY s.scheduledAt
`);
console.log("\nMercy Rani sessions Apr 17-18 for munidinesh:", JSON.stringify((r2 as any)[0], null, 2));

process.exit(0);
