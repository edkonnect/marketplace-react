import 'dotenv/config';
import { getDb } from '../server/db.js';
import { sql } from 'drizzle-orm';

const db = await getDb();
if (!db) { process.exit(1); }

const rows = ((await db.execute(sql`
  SELECT s.id, s.scheduledAt, s.status, s.acuityAppointmentId
  FROM sessions s
  JOIN users u ON u.id = s.parentId
  WHERE (u.email = 'swathibhat224@gmail.com' OR u.email = 'payaswini.holla05@gmail.com')
    AND s.scheduledAt BETWEEN 1776600000000 AND 1776750000000
  ORDER BY s.scheduledAt
`)) as any)[0] as any[];

console.log('Sessions around Apr 20 2026:');
rows.forEach((r: any) => console.log(` id=${r.id} status=${r.status} ts=${new Date(r.scheduledAt).toISOString()} acuityId=${r.acuityAppointmentId}`));

const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;
const creds = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString('base64');

for (const email of ['swathibhat224@gmail.com', 'payaswini.holla05@gmail.com']) {
  const res = await fetch(
    `https://acuityscheduling.com/api/v1/appointments?email=${encodeURIComponent(email)}&minDate=2026-04-19&maxDate=2026-04-22&max=10`,
    { headers: { Authorization: `Basic ${creds}` } }
  );
  const appts = await res.json() as any[];
  console.log(`\nAcuity for ${email}: ${appts.length} appointments`);
  appts.forEach((a: any) => console.log(`  id=${a.id} datetime=${a.datetime} canceled=${a.canceled} type=${a.type}`));
}

process.exit(0);
