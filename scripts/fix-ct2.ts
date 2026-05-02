import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

const missing = [
  { tutorId: 76, courseId: 150 },
  { tutorId: 57, courseId: 226 },
  { tutorId: 57, courseId: 154 },
  { tutorId: 59, courseId: 115 },
  { tutorId: 3,  courseId: 299 },
  { tutorId: 43, courseId: 293 },
  { tutorId: 61, courseId: 299 },
  { tutorId: 56, courseId: 4   },
  { tutorId: 52, courseId: 95  },
];

let inserted = 0;
for (const m of missing) {
  const [exists] = await conn.execute(`SELECT 1 FROM course_tutors WHERE tutorId=? AND courseId=?`, [m.tutorId, m.courseId]);
  if ((exists as any[]).length > 0) { console.log(`  SKIP: tutorId=${m.tutorId} courseId=${m.courseId}`); continue; }
  await conn.execute(`INSERT INTO course_tutors (tutorId, courseId, isPrimary, createdAt) VALUES (?, ?, 0, NOW())`, [m.tutorId, m.courseId]);
  console.log(`  Inserted: tutorId=${m.tutorId} courseId=${m.courseId}`);
  inserted++;
}
console.log(`Done. Inserted ${inserted} course_tutors entries.`);
await conn.end();
