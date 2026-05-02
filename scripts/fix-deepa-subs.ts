import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Check exact studentFirstName/LastName on all Deepa's subscriptions
const r = await db.execute(sql`
  SELECT id, courseId, studentFirstName, studentLastName, startDate
  FROM subscriptions
  WHERE parentId = 88
  ORDER BY id
`);
const rows = (r as any)[0] as any[];
console.log("Current subscriptions:");
for (const row of rows) {
  console.log(`  id=${row.id} student="${row.studentFirstName}" "${row.studentLastName}" startDate=${row.startDate}`);
}

// Fix sub 414: align studentLastName to match other Ishika subs (99, 100)
// and fix startDate (epoch = null/zero)
const ishikaSub = rows.find(r => r.id === 99); // SAT English Ishika - has correct name
console.log(`\nIshika reference: firstName="${ishikaSub?.studentFirstName}" lastName="${ishikaSub?.studentLastName}"`);

// Fix studentLastName on sub 414 to match subs 99/100
await db.execute(sql`
  UPDATE subscriptions
  SET studentLastName = ${ishikaSub?.studentLastName ?? null},
      startDate = '2025-09-01'
  WHERE id = 414
`);
console.log("✅ Fixed sub 414: studentLastName aligned + startDate set to 2025-09-01");

process.exit(0);
