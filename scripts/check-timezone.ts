import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Check users table for timezone info
const [cols] = await conn.execute(`DESCRIBE users`);
const colNames = (cols as any[]).map((c: any) => c.Field);
console.log('Users columns with timezone:', colNames.filter(c => c.toLowerCase().includes('time') || c.toLowerCase().includes('zone') || c.toLowerCase().includes('location')));

const [rows] = await conn.execute(`
  SELECT id, email, role, timezone, country, createdAt
  FROM users 
  WHERE email IN ('nate.srinivasan@gmail.com', 'mercyraniyedidi@gmail.com')
`);
console.log('\nUser data:', JSON.stringify(rows, null, 2));

await conn.end();
