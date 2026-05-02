import 'dotenv/config';
import { getDb } from '../server/db.js';
import { sql } from 'drizzle-orm';

const db = await getDb();
if (!db) { process.exit(1); }

const creds = Buffer.from(`${process.env.ACUITY_USER_ID}:${process.env.ACUITY_API_KEY}`).toString('base64');
const res = await fetch(
  `https://acuityscheduling.com/api/v1/appointments?phone=3027665737&minDate=2026-04-20&maxDate=2026-08-22&max=50`,
  { headers: { Authorization: `Basic ${creds}` } }
);
const appts = await res.json() as any[];
console.log(`Total upcoming: ${appts.length}`);
appts.forEach((a: any) => console.log(`  id=${a.id} ${a.datetime} canceled=${a.canceled}`));

// Check which ones are missing from DB
const ids = appts.filter((a: any) => !a.canceled).map((a: any) => a.id);
console.log(`\nNon-cancelled acuity ids: ${ids.join(',')}`);

if (ids.length > 0) {
  const existing = ((await db.execute(sql`
    SELECT acuityAppointmentId FROM sessions WHERE acuityAppointmentId IN (${sql.raw(ids.map((id: any) => `'${id}'`).join(','))})
  `)) as any)[0] as any[];
  const existingIds = new Set(existing.map((r: any) => String(r.acuityAppointmentId)));
  const missing = ids.filter((id: any) => !existingIds.has(String(id)));
  console.log(`Missing from DB: ${missing.join(',') || 'none'}`);
}

process.exit(0);
