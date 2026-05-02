import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_URL = process.env.DATABASE_URL!;
const match = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
const [, user, rawPass, host, port, database] = match!;
const password = decodeURIComponent(rawPass);
const conn = await mysql.createConnection({ host, user, password, database, port: Number(port||3306), ssl:{rejectUnauthorized:false} });

// Check courseId=null sessions for arun
const [r] = await conn.execute(`SELECT s.id, s.courseId, s.parentId, s.tutorId, s.scheduledAt, s.acuityAppointmentId, s.studentFirstName FROM sessions s WHERE s.parentId=6 AND s.tutorId=3 AND s.courseId IS NULL AND s.status="scheduled" LIMIT 5`);
console.log('Null courseId sessions:', JSON.stringify(r, null, 2));

// Check what courses exist for tutorId=3
const [courses] = await conn.execute(`SELECT ct.courseId, c.title FROM course_tutors ct JOIN courses c ON c.id = ct.courseId WHERE ct.tutorId = 3`);
console.log('Tutor 3 courses:', JSON.stringify(courses));

await conn.end();
