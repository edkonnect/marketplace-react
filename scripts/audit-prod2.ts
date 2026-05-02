import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
if (!match) { console.error('Bad URL'); process.exit(1); }
const [, user, rawPass, host, port, database] = match;
const password = decodeURIComponent(rawPass);

const conn = await mysql.createConnection({
  host, user, password, database,
  port: Number(port || 3306),
  ssl: { rejectUnauthorized: false }
});

// Check courses table columns first
const [cols] = await conn.execute(`DESCRIBE courses`);
const colNames = (cols as any[]).map(c => c.Field);
console.log('Courses columns:', colNames.join(', '));

const hasTitle = colNames.includes('title');
const nameCol = hasTitle ? 'c.title' : colNames.find(c => ['subject','courseName','name'].includes(c)) ? 'c.subject' : '"(course)"';

console.log('\n=== MISSING ACTIVE SUBSCRIPTIONS (upcoming sessions) ===');
const [missingSubs] = await conn.execute(`
  SELECT DISTINCT 
    s.parentId, s.tutorId, s.courseId,
    u_p.email as parentEmail, u_t.email as tutorEmail,
    COUNT(*) as sessionCount
  FROM sessions s
  JOIN users u_p ON u_p.id = s.parentId
  JOIN users u_t ON u_t.id = s.tutorId
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
  console.log(`  parentId=${r.parentId} (${r.parentEmail}) tutorId=${r.tutorId} (${r.tutorEmail}) courseId=${r.courseId} sessions=${r.sessionCount}`);
}
console.log(`Total missing subs: ${(missingSubs as any[]).length}`);

// Also check if any inactive subscriptions exist for these
console.log('\n=== EXISTING (non-active) SUBS for above combos ===');
for (const r of missingSubs as any[]) {
  const [subs] = await conn.execute(`
    SELECT sub.id, sub.status, sub.startDate, sub.endDate
    FROM subscriptions sub
    JOIN course_tutors ct ON ct.courseId = sub.courseId
    WHERE sub.parentId = ${r.parentId}
      AND ct.tutorId = ${r.tutorId}
      AND sub.courseId = ${r.courseId}
  `);
  if ((subs as any[]).length > 0) {
    console.log(`  parent=${r.parentEmail} tutor=${r.tutorEmail} courseId=${r.courseId}: ${JSON.stringify(subs)}`);
  }
}

await conn.end();
