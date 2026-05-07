import "dotenv/config";
import mysql from "mysql2/promise";
const conn = await mysql.createConnection({
  host: "tutor-marketplace-mysql.c1gyyeezlnjc.us-east-2.rds.amazonaws.com",
  port: 3306, user: "admin", password: "Edkonnect$444", database: "tutor_marketplace",
});

// Move subs 128+129 (Rajveer) from id=185 → id=99
const [r1] = await conn.execute(
  "UPDATE subscriptions SET parentId=99 WHERE id IN (128, 129)"
) as any[];
console.log(`Moved Rajveer subs to parentId=99: affected=${(r1 as any).affectedRows}`);

// Move all sessions from parentId=185 → parentId=99
const [r2] = await conn.execute(
  "UPDATE sessions SET parentId=99 WHERE parentId=185"
) as any[];
console.log(`Moved Rajveer sessions to parentId=99: affected=${(r2 as any).affectedRows}`);

// Deactivate the duplicate simerpreet account (id=185)
const [r3] = await conn.execute(
  "UPDATE users SET role='parent', email='simerpreet.kaur.merged@fmr.com' WHERE id=185"
) as any[];
console.log(`Disabled duplicate account id=185: affected=${(r3 as any).affectedRows}`);

// Verify all subs under jsingh now
const [subs] = await conn.execute(`
  SELECT s.id, s.studentFirstName, s.studentLastName, c.title, s.status, t.firstName, t.lastName
  FROM subscriptions s
  LEFT JOIN courses c ON c.id=s.courseId
  LEFT JOIN users t ON t.id=s.preferredTutorId
  WHERE s.parentId=99 ORDER BY s.studentFirstName, s.id
`) as any[];
console.log("\nAll subs under jsingh247365 (parentId=99):");
for (const r of subs as any[]) {
  console.log(`  sub=${r.id} "${r.studentFirstName} ${r.studentLastName}" | ${r.title} | ${r.status} | tutor=${r.firstName} ${r.lastName}`);
}

// Session summary
const [sessions] = await conn.execute(
  "SELECT status, COUNT(*) as cnt FROM sessions WHERE parentId=99 GROUP BY status"
) as any[];
console.log("\nSessions:", (sessions as any[]).map((r: any) => `${r.status}:${r.cnt}`).join(", "));

await conn.end();
