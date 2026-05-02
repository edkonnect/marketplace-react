import 'dotenv/config';
import { getDb } from '../server/db.js';
import { sql } from 'drizzle-orm';

const db = await getDb();
if (!db) { process.exit(1); }

const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString('base64');

const CALENDAR_TO_EMAIL: Record<number, string> = {
  9518516:  "dolon.mukherjee.2011@gmail.com",
  13134669: "bichuskumar8@gmail.com",
  12924725: "vgerarrd@gmail.com",
  7992988:  "gopisiri4268@gmail.com",
  10639379: "akalyangupta@gmail.com",
  6631240:  "mustaqmic@gmail.com",
  8838338:  "naushadteaches@gmail.com",
  7722765:  "pmudi.bppimt@gmail.com",
  13611648: "ramesh030199@gmail.com",
  9584519:  "aish30george@gmail.com",
  12748025: "anittadominic123@gmail.com",
  7203343:  "appysisodia@yahoo.com",
  5824683:  "maya.math289@gmail.com",
  9886816:  "mercyraniyedidi@gmail.com",
  12804136: "nalini.cheena@gmail.com",
  4056973:  "shritisharma@gmail.com",
  8255661:  "sivasankare.g@gmail.com",
  7137621:  "sivasankare.g@gmail.com",
  13204478: "codegems27@gmail.com",
  11083164: "vinaybalasisodia@gmail.com",
  13821319: "seswar8180@gmail.com",
  12585605: "chintalapati.vrs@gmail.com",
  14074554: "chintalapati.vrs@gmail.com",
  14244430: "jagapathirajup@gmail.com",
};

// Fetch all upcoming non-cancelled appointments from Acuity
console.log('Fetching all Acuity appointments...');
let allAppts: any[] = [];
let page = 1;
const today = new Date().toISOString().slice(0, 10);
while (true) {
  const res = await fetch(
    `https://acuityscheduling.com/api/v1/appointments?minDate=${today}&maxDate=2026-08-22&max=100&page=${page}`,
    { headers: { Authorization: `Basic ${AUTH}` } }
  );
  const batch = await res.json() as any[];
  if (!Array.isArray(batch) || !batch.length) break;
  allAppts.push(...batch.filter((a: any) => !a.canceled));
  if (batch.length < 100) break;
  page++;
}
console.log(`Total upcoming non-cancelled: ${allAppts.length}`);

// Load all parents and tutors from DB
const parents = ((await db.execute(sql`SELECT id, email, firstName, lastName FROM users WHERE role = 'parent'`)) as any)[0] as any[];
const tutors = ((await db.execute(sql`SELECT id, email FROM users WHERE role = 'tutor'`)) as any)[0] as any[];
const parentEmailToId: Record<string, number> = {};
const parentIdToEmail: Record<number, string> = {};
for (const p of parents) {
  parentEmailToId[p.email.toLowerCase()] = p.id;
  parentIdToEmail[p.id] = p.email;
}
const tutorEmailToId: Record<string, number> = {};
for (const t of tutors) tutorEmailToId[t.email.toLowerCase()] = t.id;

// Load all subscriptions
const subs = ((await db.execute(sql`
  SELECT s.id, s.parentId, s.courseId, s.status, ct.tutorId
  FROM subscriptions s
  JOIN course_tutors ct ON ct.courseId = s.courseId
`)) as any)[0] as any[];
const subSet = new Set(subs.map((s: any) => `${s.parentId}-${s.tutorId}-${s.courseId}`));
const activeSubSet = new Set(subs.filter((s: any) => s.status === 'active').map((s: any) => `${s.parentId}-${s.tutorId}-${s.courseId}`));

// Load appointment type → courseId mapping
const apptTypes = ((await db.execute(sql`SELECT acuityAppointmentTypeId, courseId FROM courses WHERE acuityAppointmentTypeId IS NOT NULL`)) as any)[0] as any[];
const typeToCoarse: Record<number, number> = {};
for (const t of apptTypes) typeToCoarse[t.acuityAppointmentTypeId] = t.courseId;

// Issues found
const missingFromDB: any[] = [];
const missingSubscription: any[] = [];
const unknownStudent: any[] = [];
const rescheduled: any[] = [];

for (const appt of allAppts) {
  const emails = (appt.email || '').split(/[,;]/).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
  const parentId = emails.reduce((found: number | undefined, e: string) => found ?? parentEmailToId[e], undefined as number | undefined);
  const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
  const tutorId = tutorEmail ? tutorEmailToId[tutorEmail.toLowerCase()] : undefined;
  const courseId = typeToCoarse[appt.appointmentTypeID];
  const acuityMs = new Date(appt.datetime).getTime();

  // Check if session exists in DB
  const rows = ((await db.execute(sql`SELECT id, scheduledAt, status, studentFirstName, studentLastName FROM sessions WHERE acuityAppointmentId = ${String(appt.id)} LIMIT 1`)) as any)[0] as any[];
  
  if (rows.length === 0) {
    missingFromDB.push({ appt, parentId, tutorId, courseId, tutorEmail });
  } else {
    const row = rows[0];
    // Check rescheduled
    if (row.scheduledAt !== acuityMs) {
      rescheduled.push({ appt, dbId: row.id, dbScheduledAt: row.scheduledAt, dbStatus: row.status });
    }
    // Check unknown student
    if (!row.studentFirstName && !row.studentLastName) {
      unknownStudent.push({ appt, dbId: row.id, parentId: parentId ?? '?', tutorEmail: tutorEmail ?? '?' });
    }
  }

  // Check missing subscription
  if (parentId && tutorId && courseId) {
    const key = `${parentId}-${tutorId}-${courseId}`;
    if (!activeSubSet.has(key)) {
      missingSubscription.push({ appt, parentId, parentEmail: emails[0], tutorEmail, courseId, hasSub: subSet.has(key) });
    }
  }
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`MISSING FROM DB (${missingFromDB.length})`);
console.log('═══════════════════════════════════════════════════');
for (const m of missingFromDB) {
  console.log(`  acuityId=${m.appt.id} ${m.appt.datetime} email=${m.appt.email?.slice(0,40)} tutor=${m.tutorEmail ?? 'UNKNOWN'} course=${m.courseId ?? 'UNKNOWN'} parent=${m.parentId ?? 'UNKNOWN_PARENT'}`);
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`RESCHEDULED (DB timestamp mismatch) (${rescheduled.length})`);
console.log('═══════════════════════════════════════════════════');
for (const r of rescheduled) {
  console.log(`  acuityId=${r.appt.id} DB_id=${r.dbId} DB_status=${r.dbStatus}`);
  console.log(`    Acuity: ${r.appt.datetime}`);
  console.log(`    DB:     ${new Date(r.dbScheduledAt).toISOString()}`);
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`UNKNOWN STUDENT NAME (${unknownStudent.length})`);
console.log('═══════════════════════════════════════════════════');
for (const u of unknownStudent) {
  console.log(`  DB_id=${u.dbId} acuityId=${u.appt.id} ${u.appt.datetime} acuityName=${u.appt.firstName} ${u.appt.lastName} parent=${u.parentId} tutor=${u.tutorEmail}`);
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`MISSING/INACTIVE SUBSCRIPTION (${missingSubscription.length})`);
console.log('═══════════════════════════════════════════════════');
// Group by parent
const subsByParent: Record<string, any[]> = {};
for (const m of missingSubscription) {
  const key = m.parentEmail;
  if (!subsByParent[key]) subsByParent[key] = [];
  subsByParent[key].push(m);
}
for (const [email, items] of Object.entries(subsByParent)) {
  const sample = items[0];
  console.log(`  parent=${email} tutor=${sample.tutorEmail} courseId=${sample.courseId} sessions=${items.length} hasSub=${sample.hasSub}`);
}

console.log('\nDone.');
process.exit(0);
