import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Check course_tutors schema
const [desc] = await conn.execute(`DESCRIBE course_tutors`);
console.log('course_tutors cols:', (desc as any[]).map(c => `${c.Field}(${c.Type})`).join(', '));

// All missing course_tutors entries
const missing = [
  { tutorId: 76, courseId: 150 }, // naushadteaches + CBSE GRADE 11 MATH
  { tutorId: 57, courseId: 226 }, // sivasankare + some course
  { tutorId: 57, courseId: 154 }, // sivasankare + ICSE High School Chem 9
  { tutorId: 59, courseId: 115 }, // nalini.cheena + Elementary English
  { tutorId: 3,  courseId: 299 }, // arunemba + some course
  { tutorId: 43, courseId: 293 }, // seswar8180 + some course
  { tutorId: 61, courseId: 299 }, // mustaqmic + some course
  { tutorId: 56, courseId: 4   }, // ramesh030199 + Middle School Math
  { tutorId: 52, courseId: 95  }, // chintalapati + some course
];

// Get course titles for display
for (const m of missing) {
  const [c] = await conn.execute(`SELECT title FROM courses WHERE id=?`, [m.courseId]);
  const [t] = await conn.execute(`SELECT email FROM users WHERE id=?`, [m.tutorId]);
  console.log(`  tutorId=${m.tutorId} (${(t as any[])[0]?.email}) courseId=${m.courseId} (${(c as any[])[0]?.title})`);
}

console.log('\nInserting course_tutors entries...');
let inserted = 0;
for (const m of missing) {
  // Check if already exists
  const [exists] = await conn.execute(`SELECT 1 FROM course_tutors WHERE tutorId=? AND courseId=?`, [m.tutorId, m.courseId]);
  if ((exists as any[]).length > 0) {
    console.log(`  SKIP: tutorId=${m.tutorId} courseId=${m.courseId} already exists`);
    continue;
  }
  await conn.execute(`INSERT INTO course_tutors (tutorId, courseId, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`, [m.tutorId, m.courseId]);
  console.log(`  Inserted: tutorId=${m.tutorId} courseId=${m.courseId}`);
  inserted++;
}
console.log(`Done. Inserted ${inserted} course_tutors entries.`);

await conn.end();
