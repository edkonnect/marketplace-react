import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
if (!match) { console.error('Bad URL:', DB_URL); process.exit(1); }
const [, user, rawPass, host, port, database] = match;
const password = decodeURIComponent(rawPass);

const conn = await mysql.createConnection({
  host, user, password, database,
  port: Number(port || 3306),
  ssl: { rejectUnauthorized: false }
});

console.log('=== NULL STUDENT NAMES (upcoming scheduled) ===');
const [nullNames] = await conn.execute(`
  SELECT s.id, s.scheduledAt, s.studentFirstName, s.studentLastName,
         u_t.email as tutorEmail, u_p.email as parentEmail
  FROM sessions s
  JOIN users u_t ON u_t.id = s.tutorId
  JOIN users u_p ON u_p.id = s.parentId
  WHERE s.status = 'scheduled' 
    AND s.scheduledAt > UNIX_TIMESTAMP()*1000
    AND (s.studentFirstName IS NULL OR s.studentFirstName = '')
  ORDER BY tutorEmail, parentEmail
`);
for (const r of nullNames as any[]) {
  console.log(`  id=${r.id} parent=${r.parentEmail} tutor=${r.tutorEmail} date=${new Date(Number(r.scheduledAt)).toISOString().slice(0,10)}`);
}
console.log(`Total: ${(nullNames as any[]).length}`);

console.log('\n=== MISSING ACTIVE SUBSCRIPTIONS (upcoming sessions) ===');
const [missingSubs] = await conn.execute(`
  SELECT DISTINCT 
    s.parentId, s.tutorId, s.courseId,
    u_p.email as parentEmail, u_t.email as tutorEmail,
    c.name as courseName,
    COUNT(*) as sessionCount
  FROM sessions s
  JOIN users u_p ON u_p.id = s.parentId
  JOIN users u_t ON u_t.id = s.tutorId
  JOIN courses c ON c.id = s.courseId
  WHERE s.status = 'scheduled'
    AND s.scheduledAt > UNIX_TIMESTAMP()*1000
    AND NOT EXISTS (
      SELECT 1 FROM subscriptions sub
      JOIN course_tutors ct ON ct.courseId = sub.courseId
      WHERE sub.parentId = s.parentId 
        AND ct.tutorId = s.tutorId
        AND sub.courseId = s.courseId
        AND sub.status = 'active'
    )
  GROUP BY s.parentId, s.tutorId, s.courseId
  ORDER BY sessionCount DESC
`);
for (const r of missingSubs as any[]) {
  console.log(`  parentId=${r.parentId} (${r.parentEmail}) tutorId=${r.tutorId} (${r.tutorEmail}) courseId=${r.courseId} (${r.courseName}) sessions=${r.sessionCount}`);
}
console.log(`Total: ${(missingSubs as any[]).length}`);

await conn.end();
