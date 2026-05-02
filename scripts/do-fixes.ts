import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Check tutorId for null-name sessions 31226+
const [nullSessions] = await conn.execute(`
  SELECT s.id, s.tutorId, s.parentId, u_t.email as tutorEmail
  FROM sessions s
  JOIN users u_t ON u_t.id = s.tutorId
  WHERE s.id IN (31226, 31214, 31202, 31190, 31178, 31166, 31154)
`);
console.log('Null name session tutors:', JSON.stringify(nullSessions));

// FIX 1: Update student names for mail.rd.in + dolon sessions (tutorId=50, student=Ujjaini Das)
const [r1] = await conn.execute(`
  UPDATE sessions SET studentFirstName = 'Ujjaini', studentLastName = 'Das'
  WHERE id IN (31226, 31214, 31202, 31190, 31178, 31166, 31154)
    AND tutorId = 50
`);
console.log('Fixed mail.rd.in+dolon names:', (r1 as any).affectedRows);

// Also for arun.s sessions (ids 139,140,145,146) - parent is edkonnect admin, skip student name for now
// These are test sessions, skip

// FIX 2: Create missing subscriptions
// Need to find the subscriptionPlanId (or check if it's needed)
const [planRows] = await conn.execute(`DESCRIBE subscriptions`);
const planCols = (planRows as any[]).map(c => c.Field);
console.log('Subscriptions columns:', planCols.join(', '));

await conn.end();
