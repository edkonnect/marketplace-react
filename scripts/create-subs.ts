import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// The 19 missing subscriptions (excluding arun.s null courseId ones which can't be fixed)
// Format: [parentId, courseId, studentFirstName, studentLastName]
// Need to get student names from existing sessions for each parent

const missingCombos = [
  { parentId: 100, tutorId: 76, courseId: 150, parentEmail: 'jyothi.rani@live.in' },
  { parentId: 124, tutorId: 57, courseId: 226, parentEmail: 'rkumarbin@gmail.com' },
  { parentId: 124, tutorId: 70, courseId: 150, parentEmail: 'rkumarbin@gmail.com' },
  { parentId: 107, tutorId: 57, courseId: 154, parentEmail: 'mail.rd.in@gmail.com' },
  { parentId: 83,  tutorId: 52, courseId: 150, parentEmail: 'apakapawan007@yahoo.co.in' },
  { parentId: 107, tutorId: 69, courseId: 141, parentEmail: 'mail.rd.in@gmail.com' },
  { parentId: 135, tutorId: 59, courseId: 115, parentEmail: 'surapureddy.raj@gmail.com' },
  { parentId: 97,  tutorId: 52, courseId: 33,  parentEmail: 'jagapathirajup@gmail.com' },
  { parentId: 86,  tutorId: 3,  courseId: 299, parentEmail: 'b.jean9109@gmail.com' },
  { parentId: 85,  tutorId: 24, courseId: 116, parentEmail: 'ashok.sree@gmail.com' },
  { parentId: 119, tutorId: 69, courseId: 141, parentEmail: 'pgayathiri@gmail.com' },
  { parentId: 98,  tutorId: 43, courseId: 293, parentEmail: 'jaideep.pinglikar@gmail.com' },
  { parentId: 139, tutorId: 24, courseId: 141, parentEmail: 'tejarajivreddy@gmail.com' },
  { parentId: 126, tutorId: 24, courseId: 114, parentEmail: 'rohiniperhar@gmail.com' },
  { parentId: 130, tutorId: 56, courseId: 4,   parentEmail: 'sejunet23@gmail.com' },
  { parentId: 94,  tutorId: 59, courseId: 114, parentEmail: 'gullaswathi@gmail.com' },
  { parentId: 141, tutorId: 61, courseId: 299, parentEmail: 'umamagashwari@gmail.com' },
  { parentId: 120, tutorId: 59, courseId: 115, parentEmail: 'raju8raghav@gmail.com' },
  { parentId: 60,  tutorId: 52, courseId: 95,  parentEmail: 'ssggkk@gmail.com' },
];

// Get student names for each parent from their existing sessions or subscriptions
for (const combo of missingCombos) {
  const [nameRows] = await conn.execute(`
    SELECT studentFirstName, studentLastName FROM sessions
    WHERE parentId = ? AND studentFirstName IS NOT NULL AND studentFirstName != ''
    LIMIT 1
  `, [combo.parentId]);
  const name = (nameRows as any[])[0];
  (combo as any).studentFirstName = name?.studentFirstName || null;
  (combo as any).studentLastName = name?.studentLastName || null;
}

console.log('Creating subscriptions...');
let created = 0;
for (const combo of missingCombos) {
  // Check if already exists (in case of partial run)
  const [exists] = await conn.execute(`
    SELECT 1 FROM subscriptions sub
    JOIN course_tutors ct ON ct.courseId = sub.courseId
    WHERE sub.parentId = ? AND ct.tutorId = ? AND sub.courseId = ? AND sub.status = 'active'
    LIMIT 1
  `, [combo.parentId, combo.tutorId, combo.courseId]);
  
  if ((exists as any[]).length > 0) {
    console.log(`  SKIP (already active): parentId=${combo.parentId} courseId=${combo.courseId}`);
    continue;
  }

  const now = new Date().toISOString().slice(0, 10);
  const [result] = await conn.execute(`
    INSERT INTO subscriptions (parentId, courseId, studentFirstName, studentLastName, status, startDate, paymentStatus, isMigrated, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'active', ?, 'paid', 1, NOW(), NOW())
  `, [combo.parentId, combo.courseId, (combo as any).studentFirstName, (combo as any).studentLastName, now]);
  
  console.log(`  Created: parentId=${combo.parentId} (${combo.parentEmail}) courseId=${combo.courseId} student=${(combo as any).studentFirstName} ${(combo as any).studentLastName} → id=${(result as any).insertId}`);
  created++;
}

console.log(`\nDone. Created ${created} subscriptions.`);
await conn.end();
