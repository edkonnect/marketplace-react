import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Check mail.rd.in sessions with Dolon to see acuity IDs
const [dolonSessions] = await conn.execute(`
  SELECT s.id, s.scheduledAt, s.acuityAppointmentId, s.studentFirstName, s.studentLastName
  FROM sessions s
  WHERE s.parentId = 107 AND s.tutorId = 57 AND s.status = 'scheduled'
    AND s.scheduledAt > UNIX_TIMESTAMP()*1000
  ORDER BY s.scheduledAt
  LIMIT 5
`);
console.log('mail.rd.in + sivasankare sessions:', JSON.stringify(dolonSessions, null, 2));

// Check mail.rd.in + dolon sessions (tutorId for dolon)
const [tutorDolon] = await conn.execute(`SELECT id FROM users WHERE email = 'dolon.mukherjee.2011@gmail.com'`);
console.log('Dolon tutorId:', JSON.stringify(tutorDolon));

const [dolonSessions2] = await conn.execute(`
  SELECT s.id, s.scheduledAt, s.acuityAppointmentId, s.studentFirstName, s.studentLastName
  FROM sessions s
  WHERE s.parentId = 107 AND s.status = 'scheduled'
    AND s.scheduledAt > UNIX_TIMESTAMP()*1000
  ORDER BY s.scheduledAt
  LIMIT 10
`);
console.log('All mail.rd.in upcoming:', JSON.stringify(dolonSessions2, null, 2));

await conn.end();
