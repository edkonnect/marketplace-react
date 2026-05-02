import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const email = process.argv[2];
if (!email) { console.error("Usage: ... check-parent-subs.ts <email>"); process.exit(1); }

const db = await getDb();

const parent = (await db.execute(sql`SELECT id, name, email FROM users WHERE email = ${email}`) as any)[0][0];
if (!parent) { console.error("Parent not found"); process.exit(1); }
console.log(`Parent: ${parent.name} (id=${parent.id})\n`);

const subs = await db.execute(sql`
  SELECT s.id, s.status, s.courseId, s.preferredTutorId,
    s.studentFirstName, s.sessionsCompleted,
    c.title as courseName, u.name as tutorName
  FROM subscriptions s
  LEFT JOIN courses c ON c.id = s.courseId
  LEFT JOIN users u ON u.id = s.preferredTutorId
  WHERE s.parentId = ${parent.id}
  ORDER BY s.status, s.id
`);
const rows = (subs as any)[0] as any[];
console.log(`Subscriptions (${rows.length}):`);
for (const r of rows) {
  console.log(`  id=${r.id} status=${r.status} course=${r.courseName} tutor=${r.tutorName} student=${r.studentFirstName} completed=${r.sessionsCompleted}`);
}

process.exit(0);
