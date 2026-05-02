import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Convert UTC ms to EDT date string (UTC-4)
function toEDT(ms: number) {
  const d = new Date(ms - 4 * 3600000); // subtract 4h for EDT
  return `Apr ${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} EDT`;
}

async function checkStudentApril(parentEmail: string, studentFirstLike: string, tutorFirstLike: string | null, label: string) {
  const parent = ((await db.execute(sql`SELECT id FROM users WHERE email = ${parentEmail}`)) as any)[0][0];
  if (!parent) { console.log(`❌ ${label}: parent not found`); return; }

  // April 20-30 window in UTC (EDT Apr 20 = UTC Apr 20 04:00, EDT Apr 30 = UTC May 1 04:00)
  const start = new Date("2026-04-20T04:00:00Z").getTime();
  const end   = new Date("2026-05-01T04:00:00Z").getTime();

  let tutorFilter = tutorFirstLike
    ? sql`AND u.firstName LIKE ${`${tutorFirstLike}%`}`
    : sql``;

  const rows = ((await db.execute(sql`
    SELECT s.id, s.scheduledAt, s.status, s.studentFirstName,
      c.title as course, u.firstName as tutorFirst, u.lastName as tutorLast,
      s.feedbackFromTutor
    FROM sessions s
    JOIN courses c ON c.id = s.courseId
    JOIN users u ON u.id = s.tutorId
    WHERE s.parentId = ${parent.id}
      AND s.scheduledAt >= ${start}
      AND s.scheduledAt <= ${end}
      AND s.studentFirstName LIKE ${`${studentFirstLike}%`}
    ORDER BY s.scheduledAt
  `)) as any)[0] as any[];

  // Count past sessions with/without notes
  const pastRows = ((await db.execute(sql`
    SELECT COUNT(*) as total,
      SUM(CASE WHEN feedbackFromTutor IS NOT NULL AND feedbackFromTutor != '' THEN 1 ELSE 0 END) as withNotes
    FROM sessions
    WHERE parentId = ${parent.id}
      AND studentFirstName LIKE ${`${studentFirstLike}%`}
      AND status IN ('completed','no_show')
  `)) as any)[0][0];

  console.log(`\n${label}`);
  if (rows.length === 0) {
    console.log(`  ❌ NO APRIL SESSIONS FOUND`);
  } else {
    for (const r of rows) {
      const edt = toEDT(Number(r.scheduledAt));
      const noteFlag = r.feedbackFromTutor ? '📝' : '  ';
      console.log(`  ${noteFlag} ${edt} | ${r.status.padEnd(10)} | ${r.course.slice(0,30).padEnd(30)} | ${r.tutorFirst} ${r.tutorLast}`);
    }
  }
  const notesGap = Number(pastRows.total) - Number(pastRows.withNotes);
  if (notesGap > 0) {
    console.log(`  ⚠️  Notes: ${pastRows.withNotes}/${pastRows.total} past sessions have notes (${notesGap} missing)`);
  } else {
    console.log(`  ✅ Notes: ${pastRows.withNotes}/${pastRows.total} all covered`);
  }
}

console.log("═══════════════════════════════════════════════════════════");
console.log("MR. MUSTAQ");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("nirmal.adlin.usa@gmail.com", "Neola", "Mustaq", "Neolla Rini Nirmal (Mustaq — SAT Math)");
await checkStudentApril("nirmal.adlin.usa@gmail.com", "Nichelle", "Mustaq", "Nichelle Riji Nirmal (Mustaq — SAT Math)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("DR. MERCY");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("nirmal.adlin.usa@gmail.com", "Neola", "Mercy", "Neolla Rini Nirmal (Mercy — SAT English)");
await checkStudentApril("nirmal.adlin.usa@gmail.com", "Nichelle", "Mercy", "Nichelle Riji Nirmal (Mercy — SAT English)");
await checkStudentApril("veena.uskids@gmail.com", "Sravani", "Mercy", "Sravani Tadaka (Mercy — SAT English)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("MS. MAYA");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("ashok.sree@gmail.com", "Amudhan", "Maya", "Amudhan Ashok (Maya — SAT Math)");
await checkStudentApril("ssggkk@gmail.com", "Arun", "Maya", "Arun Kumaresan (Maya — SAT Math)");
await checkStudentApril("munidinesh@gmail.com", "Anvika", "Maya", "Anvika Dinesh (Maya — SAT Math)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("MS. SHRITI");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("raviraju.kalidindi@gmail.com", "Saketh", "Shriti", "Saketh (Shriti — HS English)");
await checkStudentApril("krithika1412@gmail.com", "Sana", "Shriti", "Sana Bharath (Shriti — HS English)");
await checkStudentApril("param_palani@yahoo.com", "Dhruv", "Shriti", "Dhruv Parram (Shriti — SAT English)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("MS. DOLON");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("deepa.pondicherry@gmail.com", "Aaria", "Dolon", "Aaria (Dolon — MS Math)");
await checkStudentApril("shankarmeera@gmail.com", "Sachchit", "Dolon", "Sachchit (Dolon — AP CS)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("MR. RAMESH");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("sejunet23@gmail.com", "Netra", "Ramesh", "Netra (Ramesh — MS Math)");
await checkStudentApril("jeelanimanikindi@gmail.com", "Numa", "Ramesh", "Numa (Ramesh — SAT Math)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("MS. ANITA");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("sari12j@gmail.com", "Siddhi", "Anitt", "Siddhiksha (Anita — MS Math)");
await checkStudentApril("lnsgeetha@gmail.com", "Naumik", "Anitt", "Naumika (Anita — SAT Math)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("MR. SRIILALIT");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("deepsforever@gmail.com", "Sravya", "Sriilalit", "Sravya (Sriilalit — AP Calculus)");
await checkStudentApril("ssggkk@gmail.com", "Arun", "Sriilalit", "Arun (Sriilalit — HSPT Math)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("MS. NALINI");
console.log("═══════════════════════════════════════════════════════════");
await checkStudentApril("deepa.pondicherry@gmail.com", "Aaria", "Nalini", "Aaria (Nalini — MS English)");
await checkStudentApril("ssggkk@gmail.com", "Arun", "Nalini", "Arun (Nalini — SAT English)");

console.log("\n═══════════════════════════════════════════════════════════");
console.log("MS. APOORVA (NOT MIGRATED)");
console.log("═══════════════════════════════════════════════════════════");
console.log("  Tansuhri Vijay, Jophiel, Adithi Bose — parents not in platform yet");

// Also check Siddhiksha Apr 1 stuck as scheduled
console.log("\n═══════════════════════════════════════════════════════════");
console.log("SPECIAL: Siddhiksha Apr 1 status check");
console.log("═══════════════════════════════════════════════════════════");
const sari = ((await db.execute(sql`SELECT id FROM users WHERE email = 'sari12j@gmail.com'`)) as any)[0][0];
const apr1rows = ((await db.execute(sql`
  SELECT s.id, s.scheduledAt, s.status, c.title as course, u.firstName as tutorFirst
  FROM sessions s JOIN courses c ON c.id=s.courseId JOIN users u ON u.id=s.tutorId
  WHERE s.parentId = ${sari.id}
    AND s.scheduledAt >= ${new Date("2026-04-01T00:00:00Z").getTime()}
    AND s.scheduledAt <  ${new Date("2026-04-03T00:00:00Z").getTime()}
  ORDER BY s.scheduledAt
`)) as any)[0] as any[];
for (const r of apr1rows) {
  const edt = toEDT(Number(r.scheduledAt));
  console.log(`  id=${r.id} ${edt} status=${r.status} ${r.course} — ${r.tutorFirst}`);
}

process.exit(0);
