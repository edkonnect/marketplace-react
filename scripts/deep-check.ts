import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

async function checkStudent(parentEmail: string, studentFirst: string, label: string) {
  const parent = ((await db.execute(sql`SELECT id FROM users WHERE email = ${parentEmail}`)) as any)[0][0];
  if (!parent) { console.log(`❌ ${label}: parent ${parentEmail} not found`); return; }
  const parentId = parent.id;

  // Get all sessions for this student (match by studentFirstName partial)
  const sessions = ((await db.execute(sql`
    SELECT s.id, s.scheduledAt, s.status, s.studentFirstName, s.studentLastName,
      s.feedbackFromTutor, c.title as course, u.firstName as tutorFirst, u.lastName as tutorLast
    FROM sessions s
    JOIN courses c ON c.id = s.courseId
    JOIN users u ON u.id = s.tutorId
    WHERE s.parentId = ${parentId}
      AND (s.studentFirstName LIKE ${`${studentFirst}%`} OR s.studentFirstName IS NULL OR s.studentFirstName = '')
    ORDER BY s.scheduledAt DESC
  `)) as any)[0] as any[];

  const scheduled = sessions.filter((s: any) => s.status === 'scheduled');
  const past = sessions.filter((s: any) => ['completed','no_show'].includes(s.status));
  const withNotes = past.filter((s: any) => s.feedbackFromTutor && s.feedbackFromTutor.trim() !== '');

  console.log(`\n── ${label} (${parentEmail}) ──`);
  console.log(`  Scheduled: ${scheduled.length} | Past: ${past.length} | Notes: ${withNotes.length}/${past.length}`);

  // April scheduled
  const aprSched = scheduled.filter((s: any) => {
    const d = new Date(Number(s.scheduledAt));
    return d >= new Date('2026-04-20') && d < new Date('2026-05-01');
  });
  if (aprSched.length > 0) {
    console.log(`  April upcoming:`);
    for (const s of aprSched) {
      const d = new Date(Number(s.scheduledAt));
      console.log(`    Apr ${d.getUTCDate()} ${d.toISOString().slice(11,16)}UTC — ${s.course.slice(0,35)} — ${s.tutorFirst} ${s.tutorLast}`);
    }
  } else {
    console.log(`  ⚠️  NO APRIL SESSIONS SCHEDULED`);
  }

  // May scheduled
  const maySched = scheduled.filter((s: any) => {
    const d = new Date(Number(s.scheduledAt));
    return d >= new Date('2026-05-01') && d < new Date('2026-06-01');
  });
  console.log(`  May sessions: ${maySched.length}`);

  // Notes gap
  if (past.length > 0 && withNotes.length < past.length) {
    const missing = past.length - withNotes.length;
    console.log(`  ⚠️  ${missing} past sessions WITHOUT notes`);
  }
}

// MR. MUSTAQ
await checkStudent("nirmal.adlin.usa@gmail.com", "Neola", "Neolla (Mustaq)");
await checkStudent("nirmal.adlin.usa@gmail.com", "Nichelle", "Nichelle (Mustaq)");

// DR. MERCY
await checkStudent("nirmal.adlin.usa@gmail.com", "Neola", "Neolla (Mercy)");
await checkStudent("nirmal.adlin.usa@gmail.com", "Nichelle", "Nichelle (Mercy)");
await checkStudent("veena.uskids@gmail.com", "Sravani", "Sravani (Mercy)");

// MS. MAYA
await checkStudent("ashok.sree@gmail.com", "Amudhan", "Amudhan (Maya)");
await checkStudent("ssggkk@gmail.com", "Arun", "Arun (Maya)");
await checkStudent("munidinesh@gmail.com", "Anvika", "Anvika (Maya)");

// MS. SHRITI
await checkStudent("raviraju.kalidindi@gmail.com", "Saketh", "Saketh (Shriti)");
await checkStudent("krithika1412@gmail.com", "Sana", "Sana (Shriti)");
await checkStudent("param_palani@yahoo.com", "Dhruv", "Dhruv (Shriti)");

// MS. DOLON
await checkStudent("deepa.pondicherry@gmail.com", "Aaria", "Aaria (Dolon)");
await checkStudent("shankarmeera@gmail.com", "Sachchit", "Sachchit (Dolon)");

// MR. RAMESH
await checkStudent("sejunet23@gmail.com", "Netra", "Netra (Ramesh)");
await checkStudent("jeelanimanikindi@gmail.com", "Numa", "Numa (Ramesh)");

// MS. ANITA
await checkStudent("sari12j@gmail.com", "Siddhi", "Siddhiksha (Anita)");
await checkStudent("lnsgeetha@gmail.com", "Naumik", "Naumika (Anita)");

// MR. SRIILALIT
await checkStudent("deepsforever@gmail.com", "Sravya", "Sravya (Sriilalit)");
await checkStudent("ssggkk@gmail.com", "Arun", "Arun (Sriilalit)");

// MS. NALINI
await checkStudent("deepa.pondicherry@gmail.com", "Aaria", "Aaria (Nalini)");
await checkStudent("ssggkk@gmail.com", "Arun", "Arun (Nalini)");

// MS. APOORVA (not migrated yet)
console.log("\n── Apoorva students — NOT YET MIGRATED ──");
console.log("  Tansuhri Vijay, Jophiel, Adithi Bose — parents not in platform yet");

process.exit(0);
