import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

const [rows] = await conn.execute(`
  SELECT id, email, role, timezone
  FROM users 
  WHERE email IN ('nate.srinivasan@gmail.com', 'mercyraniyedidi@gmail.com')
`);
console.log(JSON.stringify(rows, null, 2));

// Also check tutor_profiles for any timezone info
const [tp] = await conn.execute(`
  SELECT tp.userId, tp.timezone, u.email
  FROM tutor_profiles tp
  JOIN users u ON u.id = tp.userId
  WHERE u.email IN ('nate.srinivasan@gmail.com', 'mercyraniyedidi@gmail.com')
`);
console.log('tutor_profiles:', JSON.stringify(tp, null, 2));

await conn.end();
