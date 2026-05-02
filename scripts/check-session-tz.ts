import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Find the session - April 23 2026, SAT English, Madhubala Srinivasan
const [sessions] = await conn.execute(`
  SELECT s.id, s.scheduledAt, s.status, s.tutorId, s.parentId,
         u_t.email as tutorEmail, u_t.timezone as tutorTimezone,
         u_p.email as parentEmail, u_p.timezone as parentTimezone,
         tp.timezone as tutorProfileTimezone
  FROM sessions s
  JOIN users u_t ON u_t.id = s.tutorId
  JOIN users u_p ON u_p.id = s.parentId
  LEFT JOIN tutor_profiles tp ON tp.userId = s.tutorId
  WHERE s.studentFirstName = 'Madhubala'
    AND s.status = 'completed'
    AND s.scheduledAt > UNIX_TIMESTAMP(NOW() - INTERVAL 7 DAY) * 1000
  ORDER BY s.scheduledAt DESC
  LIMIT 5
`);

for (const s of sessions as any[]) {
  const ms = Number(s.scheduledAt);
  const utc = new Date(ms).toISOString();
  // IST = UTC+5:30
  const istMs = ms + (5.5 * 60 * 60 * 1000);
  const istTime = new Date(istMs).toISOString().replace('T',' ').slice(0,19) + ' IST';
  // EST = UTC-5
  const estMs = ms - (5 * 60 * 60 * 1000);
  const estTime = new Date(estMs).toISOString().replace('T',' ').slice(0,19) + ' EST';
  console.log(`id=${s.id} scheduledAt=${ms}`);
  console.log(`  UTC: ${utc}`);
  console.log(`  IST: ${istTime}`);
  console.log(`  EST: ${estTime}`);
  console.log(`  tutor: ${s.tutorEmail} tz=${s.tutorTimezone} profileTz=${s.tutorProfileTimezone}`);
  console.log(`  parent: ${s.parentEmail} tz=${s.parentTimezone}`);
}

await conn.end();
