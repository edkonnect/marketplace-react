import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Safety check: confirm 0 mismatches before dropping
const [tutorCheck] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM users u JOIN tutor_profiles tp ON tp.userId = u.id
  WHERE u.role = 'tutor' AND u.timezone IS NOT NULL AND (tp.timezone IS NULL OR tp.timezone != u.timezone)
`);
const [parentCheck] = await conn.execute(`
  SELECT COUNT(*) as cnt FROM users u JOIN parent_profiles pp ON pp.userId = u.id
  WHERE u.role = 'parent' AND u.timezone IS NOT NULL AND (pp.timezone IS NULL OR pp.timezone != u.timezone)
`);
const tutorDrift = (tutorCheck as any[])[0].cnt;
const parentDrift = (parentCheck as any[])[0].cnt;

if (tutorDrift > 0 || parentDrift > 0) {
  console.error(`ABORT: still ${tutorDrift} tutor and ${parentDrift} parent mismatches. Run sync first.`);
  process.exit(1);
}

console.log('Mismatches: 0. Proceeding with column drop...');
await conn.execute(`ALTER TABLE tutor_profiles DROP COLUMN timezone`);
console.log('Dropped tutor_profiles.timezone');
await conn.execute(`ALTER TABLE parent_profiles DROP COLUMN timezone`);
console.log('Dropped parent_profiles.timezone');

await conn.end();
console.log('Done.');
