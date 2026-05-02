import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Rule: users.timezone is the source of truth.
// If users.timezone is NULL but profile has a value, copy profile → users.
// Then copy users.timezone → profile for all tutors/parents.

// Step 1: Fix tutors where users.timezone is NULL but tutor_profiles.timezone has a value
const [r1] = await conn.execute(`
  UPDATE users u
  JOIN tutor_profiles tp ON tp.userId = u.id
  SET u.timezone = tp.timezone
  WHERE u.role = 'tutor' AND u.timezone IS NULL AND tp.timezone IS NOT NULL
`);
console.log(`Tutors: copied profile→users where users was NULL: ${(r1 as any).affectedRows}`);

// Step 2: Now sync users.timezone → tutor_profiles.timezone for all tutors where they differ
const [r2] = await conn.execute(`
  UPDATE tutor_profiles tp
  JOIN users u ON u.id = tp.userId
  SET tp.timezone = u.timezone
  WHERE u.role = 'tutor' AND u.timezone IS NOT NULL AND (tp.timezone IS NULL OR tp.timezone != u.timezone)
`);
console.log(`Tutors: synced users→profile: ${(r2 as any).affectedRows}`);

// Step 3: Fix parents where users.timezone is NULL but parent_profiles.timezone has a value
const [r3] = await conn.execute(`
  UPDATE users u
  JOIN parent_profiles pp ON pp.userId = u.id
  SET u.timezone = pp.timezone
  WHERE u.role = 'parent' AND u.timezone IS NULL AND pp.timezone IS NOT NULL
`);
console.log(`Parents: copied profile→users where users was NULL: ${(r3 as any).affectedRows}`);

// Step 4: Sync users.timezone → parent_profiles.timezone for all parents where they differ
const [r4] = await conn.execute(`
  UPDATE parent_profiles pp
  JOIN users u ON u.id = pp.userId
  SET pp.timezone = u.timezone
  WHERE u.role = 'parent' AND u.timezone IS NOT NULL AND (pp.timezone IS NULL OR pp.timezone != u.timezone)
`);
console.log(`Parents: synced users→profile: ${(r4 as any).affectedRows}`);

// Verify
const [tutorMismatches] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM users u JOIN tutor_profiles tp ON tp.userId = u.id
  WHERE u.role = 'tutor' AND u.timezone IS NOT NULL AND tp.timezone != u.timezone
`);
const [parentMismatches] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM users u JOIN parent_profiles pp ON pp.userId = u.id
  WHERE u.role = 'parent' AND u.timezone IS NOT NULL AND pp.timezone != u.timezone
`);
console.log(`\nRemaining mismatches — tutors: ${(tutorMismatches as any[])[0].cnt}, parents: ${(parentMismatches as any[])[0].cnt}`);

await conn.end();
