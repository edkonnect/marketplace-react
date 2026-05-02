import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

const newCourseId = 299; // High School Mathematics
const sriilalit = 52;

// Add Sriilalit to course_tutors for High School Mathematics (non-primary, so Maya stays primary for others)
await db.execute(sql`
  INSERT INTO course_tutors (courseId, tutorId, isPrimary)
  VALUES (${newCourseId}, ${sriilalit}, 0)
  ON DUPLICATE KEY UPDATE isPrimary = 0
`);
console.log("✅ Added Sriilalit to course_tutors for High School Mathematics");

// Verify
const ct = await db.execute(sql`
  SELECT ct.id, ct.tutorId, ct.isPrimary, u.name as tutorName
  FROM course_tutors ct
  LEFT JOIN users u ON u.id = ct.tutorId
  WHERE ct.courseId = ${newCourseId}
`);
console.log("course_tutors for High School Mathematics:", (ct as any)[0]);

process.exit(0);
