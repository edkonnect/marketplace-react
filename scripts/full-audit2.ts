import 'dotenv/config';
import { getDb } from '../server/db.js';
import { sql } from 'drizzle-orm';

const db = await getDb();
if (!db) { process.exit(1); }

const AUTH = Buffer.from(`${process.env.ACUITY_USER_ID}:${process.env.ACUITY_API_KEY}`).toString('base64');

const CALENDAR_TO_EMAIL: Record<number, string> = {
  9518516:"dolon.mukherjee.2011@gmail.com",13134669:"bichuskumar8@gmail.com",12924725:"vgerarrd@gmail.com",
  7992988:"gopisiri4268@gmail.com",10639379:"akalyangupta@gmail.com",6631240:"mustaqmic@gmail.com",
  8838338:"naushadteaches@gmail.com",7722765:"pmudi.bppimt@gmail.com",13611648:"ramesh030199@gmail.com",
  9584519:"aish30george@gmail.com",12748025:"anittadominic123@gmail.com",7203343:"appysisodia@yahoo.com",
  5824683:"maya.math289@gmail.com",9886816:"mercyraniyedidi@gmail.com",12804136:"nalini.cheena@gmail.com",
  4056973:"shritisharma@gmail.com",8255661:"sivasankare.g@gmail.com",7137621:"sivasankare.g@gmail.com",
  13204478:"codegems27@gmail.com",11083164:"vinaybalasisodia@gmail.com",13821319:"seswar8180@gmail.com",
  12585605:"chintalapati.vrs@gmail.com",14074554:"chintalapati.vrs@gmail.com",14244430:"jagapathirajup@gmail.com",
};

// 1. Fetch all upcoming non-cancelled from Acuity
console.log('Fetching Acuity appointments...');
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
console.log(`Acuity upcoming non-cancelled: ${allAppts.length}`);

// 2. Bulk load all DB data
const [parents, tutors, subsRaw, apptTypes, dbSessions] = await Promise.all([
  db.execute(sql`SELECT id, email FROM users WHERE role = 'parent'`).then((r: any) => r[0] as any[]),
  db.execute(sql`SELECT id, email FROM users WHERE role = 'tutor'`).then((r: any) => r[0] as any[]),
  db.execute(sql`SELECT s.id, s.parentId, s.courseId, s.status, ct.tutorId FROM subscriptions s JOIN course_tutors ct ON ct.courseId = s.courseId`).then((r: any) => r[0] as any[]),
  db.execute(sql`SELECT acuityAppointmentTypeId, courseId FROM courses WHERE acuityAppointmentTypeId IS NOT NULL`).then((r: any) => r[0] as any[]),
  db.execute(sql`SELECT id, scheduledAt, status, acuityAppointmentId, studentFirstName, studentLastName FROM sessions WHERE acuityAppointmentId IS NOT NULL`).then((r: any) => r[0] as any[]),
]);

const parentEmailToId: Record<string, number> = {};
for (const p of parents) parentEmailToId[p.email.toLowerCase()] = p.id;
const tutorEmailToId: Record<string, number> = {};
for (const t of tutors) tutorEmailToId[t.email.toLowerCase()] = t.id;
const typeToCoarse: Record<number, number> = {};
for (const t of apptTypes) typeToCoarse[t.acuityAppointmentTypeId] = t.courseId;
const activeSubSet = new Set(subsRaw.filter((s: any) => s.status === 'active').map((s: any) => `${s.parentId}-${s.tutorId}-${s.courseId}`));
const subSet = new Set(subsRaw.map((s: any) => `${s.parentId}-${s.tutorId}-${s.courseId}`));
const dbByAcuityId: Record<string, any> = {};
for (const s of dbSessions) dbByAcuityId[String(s.acuityAppointmentId)] = s;

// 3. Analyse
const missingFromDB: any[] = [];
const rescheduled: any[] = [];
const unknownStudent: any[] = [];
const missingSubscription: any[] = [];

for (const appt of allAppts) {
  const emails = (appt.email || '').split(/[,;]/).map((e: string) => e.toLowerCase().trim()).filter(Boolean);
  const parentId = emails.reduce((f: number|undefined, e: string) => f ?? parentEmailToId[e], undefined as number|undefined);
  const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
  const tutorId = tutorEmail ? tutorEmailToId[tutorEmail.toLowerCase()] : undefined;
  const courseId = typeToCoarse[appt.appointmentTypeID];
  const acuityMs = new Date(appt.datetime).getTime();
  const dbRow = dbByAcuityId[String(appt.id)];

  if (!dbRow) {
    missingFromDB.push({ appt, parentId, tutorId, courseId, tutorEmail });
  } else {
    if (dbRow.scheduledAt !== acuityMs) rescheduled.push({ appt, dbRow });
    if (!dbRow.studentFirstName && !dbRow.studentLastName) unknownStudent.push({ appt, dbRow, parentId, tutorEmail });
  }

  if (parentId && tutorId && courseId) {
    const key = `${parentId}-${tutorId}-${courseId}`;
    if (!activeSubSet.has(key)) missingSubscription.push({ appt, parentId, parentEmail: emails[0], tutorEmail, courseId, hasSub: subSet.has(key) });
  }
}

// 4. Print results
console.log(`\n${'═'.repeat(55)}`);
console.log(`MISSING FROM DB: ${missingFromDB.length}`);
console.log('═'.repeat(55));
for (const m of missingFromDB) {
  console.log(`  acuityId=${m.appt.id} ${m.appt.datetime} parent=${m.parentId??'UNKNOWN'} tutor=${m.tutorEmail??'UNKNOWN'} course=${m.courseId??'UNKNOWN'}`);
  console.log(`    email=${m.appt.email?.slice(0,50)}`);
}

console.log(`\n${'═'.repeat(55)}`);
console.log(`RESCHEDULED (timestamp mismatch): ${rescheduled.length}`);
console.log('═'.repeat(55));
for (const r of rescheduled) {
  console.log(`  acuityId=${r.appt.id} DB_id=${r.dbRow.id} DB_status=${r.dbRow.status}`);
  console.log(`    Acuity: ${r.appt.datetime} | DB: ${new Date(r.dbRow.scheduledAt).toISOString()}`);
}

console.log(`\n${'═'.repeat(55)}`);
console.log(`UNKNOWN STUDENT NAME: ${unknownStudent.length}`);
console.log('═'.repeat(55));
for (const u of unknownStudent) {
  console.log(`  DB_id=${u.dbRow.id} ${u.appt.datetime} acuityName="${u.appt.firstName} ${u.appt.lastName}" parent=${u.parentId} tutor=${u.tutorEmail}`);
}

console.log(`\n${'═'.repeat(55)}`);
console.log(`MISSING/INACTIVE SUBSCRIPTION: ${missingSubscription.length}`);
console.log('═'.repeat(55));
const subsByParent: Record<string, any[]> = {};
for (const m of missingSubscription) {
  if (!subsByParent[m.parentEmail]) subsByParent[m.parentEmail] = [];
  subsByParent[m.parentEmail].push(m);
}
for (const [email, items] of Object.entries(subsByParent)) {
  const s = items[0];
  console.log(`  parent=${email} tutor=${s.tutorEmail} courseId=${s.courseId} sessions=${items.length} hasAnySub=${s.hasSub}`);
}

console.log('\nDone.');
process.exit(0);
