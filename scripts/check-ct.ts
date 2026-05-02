import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Check which combos still have no active sub and why
const still11 = [
  { parentId: 100, tutorId: 76, courseId: 150 },
  { parentId: 124, tutorId: 57, courseId: 226 },
  { parentId: 107, tutorId: 57, courseId: 154 },
  { parentId: 135, tutorId: 59, courseId: 115 },
  { parentId: 86,  tutorId: 3,  courseId: 299 },
  { parentId: 98,  tutorId: 43, courseId: 293 },
  { parentId: 141, tutorId: 61, courseId: 299 },
  { parentId: 130, tutorId: 56, courseId: 4   },
  { parentId: 60,  tutorId: 52, courseId: 95  },
  { parentId: 120, tutorId: 59, courseId: 115 },
];

for (const c of still11) {
  // Check if subscription was created
  const [subs] = await conn.execute(`SELECT id, status FROM subscriptions WHERE parentId=? AND courseId=?`, [c.parentId, c.courseId]);
  // Check if course_tutors has the entry
  const [ct] = await conn.execute(`SELECT * FROM course_tutors WHERE tutorId=? AND courseId=?`, [c.tutorId, c.courseId]);
  console.log(`parentId=${c.parentId} tutorId=${c.tutorId} courseId=${c.courseId}: sub=${JSON.stringify(subs)} course_tutors=${JSON.stringify(ct)}`);
}

await conn.end();
