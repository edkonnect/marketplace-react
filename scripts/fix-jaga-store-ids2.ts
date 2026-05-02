import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// id=38702 is at 2026-04-22T00:30Z = Apr 21 19:30 EDT → acuityId=1674010011
// id=38703 is at 2026-04-24T00:30Z = Apr 23 19:30 EDT → acuityId=1673893908
// id=38704 is at 2026-04-25T15:30Z = Apr 25 11:30 EDT → acuityId=1674865509 (already set)

await db.execute(sql`UPDATE sessions SET acuityAppointmentId = '1674010011' WHERE id = 38702`);
console.log("✅ id=38702 → acuityId=1674010011");

await db.execute(sql`UPDATE sessions SET acuityAppointmentId = '1673893908' WHERE id = 38703`);
console.log("✅ id=38703 → acuityId=1673893908");

process.exit(0);
