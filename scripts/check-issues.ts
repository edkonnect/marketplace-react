import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

async function checkParent(email: string) {
  const parent = ((await db.execute(sql`SELECT id, firstName, lastName FROM users WHERE email = ${email}`)) as any)[0][0];
  if (!parent) return null;
  return parent;
}

async function getScheduled(parentId: number, studentName?: string) {
  const rows = ((await db.execute(sql`
    SELECT s.id, s.scheduledAt, s.status, s.studentFirstName, s.studentLastName,
      c.title as course, u.firstName as tutorFirst, u.lastName as tutorLast
    FROM sessions s
    JOIN courses c ON c.id = s.courseId
    JOIN users u ON u.id = s.tutorId
    WHERE s.parentId = ${parentId} AND s.status = 'scheduled'
    ORDER BY s.scheduledAt
  `)) as any)[0] as any[];
  return rows;
}

async function getNotesStats(parentId: number, studentName?: string) {
  // Count sessions with and without notes
  const rows = ((await db.execute(sql`
    SELECT s.status, COUNT(*) as cnt,
      SUM(CASE WHEN s.feedbackFromTutor IS NOT NULL AND s.feedbackFromTutor != '' THEN 1 ELSE 0 END) as withNotes
    FROM sessions s
    WHERE s.parentId = ${parentId} AND s.status IN ('completed', 'no_show')
    GROUP BY s.status
  `)) as any)[0] as any[];
  return rows;
}

// Check all parents mentioned in the issues
const parentEmails = [
  { email: "nirmal.adlin.usa@gmail.com", students: ["Neolla", "Nichelle"] },
  { email: "deepa.pondicherry@gmail.com", students: ["Aaria"] },
  { email: "shankarmeera@gmail.com", students: ["Sachchit"] },
  { email: "sejunet23@gmail.com", students: ["Netra"] },
  { email: "jeelanimanikindi@gmail.com", students: ["Numa"] },
  { email: "ashok.sree@gmail.com", students: ["Amudhan"] },
  { email: "sari12j@gmail.com", students: ["Siddhiksha"] },
  { email: "lnsgeetha@gmail.com", students: ["Naumika"] },
  { email: "raviraju.kalidindi@gmail.com", students: ["Saketh"] },
  { email: "krithika1412@gmail.com", students: ["Sana"] },
  { email: "param_palani@yahoo.com", students: ["Dhruv"] },
  { email: "deepsforever@gmail.com", students: ["Sravya"] },
  { email: "ssggkk@gmail.com", students: ["Arun"] },
  { email: "munidinesh@gmail.com", students: ["Anvika"] },
  { email: "veena.uskids@gmail.com", students: ["Sravani"] },
];

console.log("=== UPCOMING SESSION COUNTS ===\n");
for (const { email, students } of parentEmails) {
  const parent = await checkParent(email);
  if (!parent) { console.log(`❌ ${email}: NOT FOUND`); continue; }
  const scheduled = await getScheduled(parent.id);
  const notes = await getNotesStats(parent.id);
  const withNotes = notes.reduce((s: number, r: any) => s + Number(r.withNotes), 0);
  const totalPast = notes.reduce((s: number, r: any) => s + Number(r.cnt), 0);
  console.log(`${email} (${students.join(", ")})`);
  console.log(`  Scheduled: ${scheduled.length} | Past: ${totalPast} | With notes: ${withNotes}/${totalPast}`);
  // Show upcoming in April
  const aprilSessions = scheduled.filter((s: any) => {
    const d = new Date(Number(s.scheduledAt));
    return d >= new Date("2026-04-20") && d < new Date("2026-05-01");
  });
  if (aprilSessions.length > 0) {
    for (const s of aprilSessions) {
      const d = new Date(Number(s.scheduledAt));
      console.log(`  Apr ${d.getUTCDate()} ${d.toISOString().slice(11,16)}UTC ${s.course.slice(0,30)} — ${s.tutorFirst} ${s.tutorLast} (${s.studentFirstName})`);
    }
  } else {
    console.log(`  ⚠️  NO APRIL SESSIONS`);
  }
  console.log();
}
process.exit(0);
