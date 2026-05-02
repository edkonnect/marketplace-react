import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

const ms = new Date("2026-04-22T00:30:00.000Z").getTime();

// Find the existing session at this time for Sriilalit
const existing = ((await db.execute(sql`
  SELECT s.id, s.parentId, s.status, s.studentFirstName, s.studentLastName, s.acuityAppointmentId,
    u.email as parentEmail
  FROM sessions s
  JOIN users u ON u.id = s.parentId
  WHERE s.tutorId = 52 AND s.scheduledAt = ${ms}
`)) as any)[0][0];

console.log("Existing session at Apr 22 00:30 UTC:", existing);

// The Acuity appointment for Sravya is at 2026-04-21T20:30:00-0400 = 2026-04-22T00:30:00Z
// But there's a unique constraint on (tutorId, scheduledAt)
// This means Sriilalit can only have ONE session at that time
// The Acuity record shows it's Sravya's session (deepsforever@gmail.com)
// So we need to update the existing session's parentId if it's wrong

process.exit(0);
