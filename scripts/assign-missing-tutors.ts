import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection({
  host: "tutor-marketplace-mysql.c1gyyeezlnjc.us-east-2.rds.amazonaws.com",
  port: 3306, user: "admin", password: "Edkonnect$444", database: "tutor_marketplace",
});

// Tutor IDs
// 24 = Apoorva Sisodia
// 47 = Maya Balan
// 59 = Nalini Sharma
// 23 = Shriti Sharma
// 30 = Dr. Mercy Rani Yedidi
// 3  = Arunn Sivaan
// 52 = Sriilalit Narayana Chintalapati
// 76 = Naushad Avadia

const fixes: Array<{ subId: number; tutorId: number; label: string }> = [
  // Abhinav Sai Kotni — IB DP Chemistry (sub 447) — Maya Balan (most sessions for parent 181)
  { subId: 447, tutorId: 47, label: "Abhinav / IB DP Chemistry → Maya Balan" },
  // Amudhan Ashok — High School English (sub 426) — Apoorva Sisodia (29 sessions, most recent 2026-06-03)
  { subId: 426, tutorId: 24, label: "Amudhan / High School English → Apoorva Sisodia" },
  // Anwita Bunga — Middle School English (sub 432) — Nalini Sharma (19 sessions)
  { subId: 432, tutorId: 59, label: "Anwita / Middle School English → Nalini Sharma" },
  // Arjun Aravind — SSAT Upper Level Math (sub 444) — Dr. Mercy Rani Yedidi (27 sessions, most)
  { subId: 444, tutorId: 30, label: "Arjun / SSAT Upper Level Math → Dr. Mercy Rani Yedidi" },
  // Arun Kumareasan — HSPT Math (sub 435) — Sriilalit Chintalapati (handles HS Math upcoming)
  { subId: 435, tutorId: 52, label: "Arun / HSPT Math → Sriilalit Chintalapati" },
  // Cooper Jean — High School Mathematics (sub 425) — Arunn Sivaan (8 upcoming sessions)
  { subId: 425, tutorId: 3, label: "Cooper / High School Mathematics → Arunn Sivaan" },
  // DIYA ONAT — CBSE Grade 11 Mathematics (sub 133) — Maya Balan (230 sessions)
  { subId: 133, tutorId: 47, label: "DIYA / CBSE Grade 11 Mathematics → Maya Balan" },
  // Kabir Singh Sawhney — Middle School English (sub 430) — Apoorva Sisodia (33 sessions)
  { subId: 430, tutorId: 24, label: "Kabir / Middle School English → Apoorva Sisodia" },
  // Kapish Purohit — CBSE Grade 11 Mathematics (sub 421) — Sriilalit (20 sessions, most recent 2026-08-19)
  { subId: 421, tutorId: 52, label: "Kapish / CBSE Grade 11 Mathematics → Sriilalit Chintalapati" },
];

console.log("Assigning tutors to subscriptions with no tutor:\n");
for (const fix of fixes) {
  const [r] = await conn.execute(
    "UPDATE subscriptions SET preferredTutorId=? WHERE id=? AND (preferredTutorId IS NULL OR preferredTutorId=0)",
    [fix.tutorId, fix.subId]
  ) as any[];
  console.log(`  ${(r as any).affectedRows > 0 ? "✓" : "SKIP"} ${fix.label}`);
}

// Verify all
console.log("\nVerification:");
const subIds = fixes.map(f => f.subId);
const [verify] = await conn.execute(`
  SELECT s.id, s.studentFirstName, s.studentLastName, c.title, s.status, t.firstName, t.lastName, t.email as tutorEmail
  FROM subscriptions s
  LEFT JOIN courses c ON c.id=s.courseId
  LEFT JOIN users t ON t.id=s.preferredTutorId
  WHERE s.id IN (${subIds.join(",")})
  ORDER BY s.id
`) as any[];
for (const r of verify as any[]) {
  const tutor = r.tutorEmail ? `${r.firstName} ${r.lastName} <${r.tutorEmail}>` : "(still none)";
  console.log(`  sub=${r.id} "${r.studentFirstName} ${r.studentLastName}" | ${r.title} | ${tutor}`);
}

await conn.end();
