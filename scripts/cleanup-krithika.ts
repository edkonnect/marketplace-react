import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();
const parentId = (await db.execute(sql`SELECT id FROM users WHERE email = 'krithika1412@gmail.com'`) as any)[0][0].id;
const arunnId = (await db.execute(sql`SELECT id FROM users WHERE name LIKE '%Arunn%'`) as any)[0][0]?.id;

console.log(`Parent ID: ${parentId}, Arunn ID: ${arunnId}`);

// Find sessions to delete:
// 1. Sessions with Arunn (dummy tutor)
// 2. Sessions before April 1 2025
const minMs = new Date("2025-04-01").getTime();

const toDelete = await db.execute(sql`
  SELECT s.id, s.scheduledAt, FROM_UNIXTIME(s.scheduledAt/1000) as dt,
    s.status, s.studentFirstName, s.feedbackFromTutor,
    u.name as tutorName
  FROM sessions s
  JOIN users u ON u.id = s.tutorId
  WHERE s.parentId = ${parentId}
    AND (s.tutorId = ${arunnId} OR s.scheduledAt < ${minMs})
  ORDER BY s.scheduledAt DESC
`);
const rows = (toDelete as any)[0] as any[];
console.log(`\nSessions to delete (${rows.length}):`);
for (const r of rows) {
  console.log(`  id=${r.id} tutor=${r.tutorName} dt=${r.dt} status=${r.status} student=${r.studentFirstName} notes=${r.feedbackFromTutor ? 'YES' : 'none'}`);
}

const withNotes = rows.filter(r => r.feedbackFromTutor);
if (withNotes.length > 0) {
  console.log(`\n⚠️  ${withNotes.length} sessions have notes — will be lost!`);
  for (const r of withNotes) console.log(`  id=${r.id} ${r.dt} ${r.tutorName}`);
}

if (rows.length === 0) { console.log("Nothing to delete."); process.exit(0); }

const ids = rows.map(r => r.id);
await db.execute(sql`DELETE FROM sessions WHERE id IN (${sql.raw(ids.join(","))})`);
console.log(`\n✅ Deleted ${rows.length} sessions`);

process.exit(0);
