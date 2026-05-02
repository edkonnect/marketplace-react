import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

const [rows] = await conn.execute(`
  SELECT tp.id, tp.userId, tp.timezone, LENGTH(tp.timezone) as tzLen, HEX(tp.timezone) as tzHex
  FROM tutor_profiles tp
  JOIN users u ON u.id = tp.userId
  WHERE u.email = 'mercyraniyedidi@gmail.com'
`);
console.log(JSON.stringify(rows, null, 2));

await conn.end();
