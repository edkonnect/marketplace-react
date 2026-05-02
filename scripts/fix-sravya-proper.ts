import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

// Check what's at Apr 22 00:30 UTC (= Sravya 8:30 PM EDT)
const ms_sravya = new Date("2026-04-22T00:30:00.000Z").getTime();
// Check what's at Apr 21 23:30 UTC (= Srihitha 7:30 PM EDT)
const ms_srihitha = new Date("2026-04-21T23:30:00.000Z").getTime();

const at0030 = ((await db.execute(sql`
  SELECT s.id, s.parentId, s.studentFirstName, s.acuityAppointmentId, u.email as parentEmail
  FROM sessions s JOIN users u ON u.id = s.parentId
  WHERE s.tutorId = 52 AND s.scheduledAt = ${ms_sravya}
`)) as any)[0][0];

const at2330 = ((await db.execute(sql`
  SELECT s.id, s.parentId, s.studentFirstName, s.acuityAppointmentId, u.email as parentEmail
  FROM sessions s JOIN users u ON u.id = s.parentId
  WHERE s.tutorId = 52 AND s.scheduledAt = ${ms_srihitha}
`)) as any)[0][0];

console.log("Apr 22 00:30 UTC (Sravya 8:30 PM EDT):", at0030);
console.log("Apr 21 23:30 UTC (Srihitha 7:30 PM EDT):", at2330);
process.exit(0);
