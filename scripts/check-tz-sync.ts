import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

console.log('=== TUTOR: users.timezone vs tutor_profiles.timezone ===');
const [tutors] = await conn.execute(`
  SELECT u.id, u.email, u.timezone as users_tz, tp.timezone as profile_tz
  FROM users u
  JOIN tutor_profiles tp ON tp.userId = u.id
  WHERE u.role = 'tutor'
  ORDER BY u.email
`);
let tutorMismatch = 0;
for (const r of tutors as any[]) {
  const match = r.users_tz === r.profile_tz;
  if (!match) {
    console.log(`  MISMATCH: ${r.email} | users=${r.users_tz} | profile=${r.profile_tz}`);
    tutorMismatch++;
  }
}
console.log(`  Total tutors: ${(tutors as any[]).length} | Mismatches: ${tutorMismatch} | In sync: ${(tutors as any[]).length - tutorMismatch}`);

console.log('\n=== PARENT: users.timezone vs parent_profiles.timezone ===');
const [parents] = await conn.execute(`
  SELECT u.id, u.email, u.timezone as users_tz, pp.timezone as profile_tz
  FROM users u
  JOIN parent_profiles pp ON pp.userId = u.id
  WHERE u.role = 'parent'
  ORDER BY u.email
`);
let parentMismatch = 0;
for (const r of parents as any[]) {
  const match = r.users_tz === r.profile_tz;
  if (!match) {
    console.log(`  MISMATCH: ${r.email} | users=${r.users_tz} | profile=${r.profile_tz}`);
    parentMismatch++;
  }
}
console.log(`  Total parents: ${(parents as any[]).length} | Mismatches: ${parentMismatch} | In sync: ${(parents as any[]).length - parentMismatch}`);

console.log('\n=== NULL / MISSING timezone values ===');
const [nulls] = await conn.execute(`
  SELECT u.email, u.role, u.timezone as users_tz,
    COALESCE(tp.timezone, pp.timezone) as profile_tz
  FROM users u
  LEFT JOIN tutor_profiles tp ON tp.userId = u.id AND u.role = 'tutor'
  LEFT JOIN parent_profiles pp ON pp.userId = u.id AND u.role = 'parent'
  WHERE u.role IN ('tutor','parent')
    AND (u.timezone IS NULL OR COALESCE(tp.timezone, pp.timezone) IS NULL)
  ORDER BY u.role, u.email
`);
for (const r of nulls as any[]) {
  console.log(`  ${r.role} ${r.email}: users_tz=${r.users_tz} profile_tz=${r.profile_tz}`);
}
if ((nulls as any[]).length === 0) console.log('  None');

await conn.end();
