import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const email = process.argv[2];
if (!email) { console.error("Usage: sync-legacy-notes-parent.ts <email>"); process.exit(1); }

const db = await getDb();

const parent = ((await db.execute(sql`SELECT id FROM users WHERE email = ${email}`)) as any)[0][0];
if (!parent) { console.error("Parent not found:", email); process.exit(1); }
const parentId = parent.id;
console.log(`Parent ID: ${parentId} (${email})\n`);

// Get ALL legacy sessions with notes — LEFT JOIN tutors so we don't drop unmatched tutor IDs
const legacySessions = ((await db.execute(sql`
  SELECT ls.id as legacyId, ls.session_date, ls.session_time, ls.timezone, ls.tutor_id,
    ls.notes, lt.email as tutorEmail,
    CONCAT(COALESCE(lt.first_name,'unknown'), ' ', COALESCE(lt.last_name,'')) as tutorName,
    UNIX_TIMESTAMP(CONCAT(ls.session_date, ' ', ls.session_time)) * 1000 as sessionMs
  FROM legacy_staging.sessions ls
  LEFT JOIN legacy_staging.tutors lt ON lt.id = ls.tutor_id
  WHERE ls.parent_email = ${email}
    AND ls.notes IS NOT NULL AND ls.notes != ''
  ORDER BY ls.session_date DESC
`)) as any)[0] as any[];

console.log(`Found ${legacySessions.length} legacy sessions with notes\n`);

let matched = 0;
let alreadyHasNotes = 0;
let notFound = 0;
const notFoundList: any[] = [];

for (const leg of legacySessions) {
  const dateStr = String(leg.session_date).split('T')[0].split(' ')[0];

  // Legacy session_time is in local time (EDT = UTC-4). Convert to UTC ms range.
  // Try exact time match first (±30 min), then fall back to 2-day window.
  const legacyMs = Number(leg.sessionMs); // local time as if UTC (from UNIX_TIMESTAMP)
  // EDT offset: 4 hours = 14400000ms, EST: 5 hours = 18000000ms
  // Try both offsets since sessions span across DST boundary
  const edtMs = legacyMs + 4 * 3600000;
  const estMs = legacyMs + 5 * 3600000;
  const tolerance = 30 * 60 * 1000; // 30 min

  const windowStart = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  const nextDate = new Date(`${dateStr}T00:00:00.000Z`);
  nextDate.setDate(nextDate.getDate() + 2);
  const windowEnd = nextDate.getTime() - 1;

  let newSession: any = null;

  // Try exact time match with tutor email
  if (leg.tutorEmail) {
    const tutorRow = ((await db.execute(sql`SELECT id FROM users WHERE email = ${leg.tutorEmail}`)) as any)[0][0];
    if (tutorRow) {
      // Try EDT then EST
      for (const utcMs of [edtMs, estMs]) {
        newSession = ((await db.execute(sql`
          SELECT id, feedbackFromTutor FROM sessions
          WHERE parentId = ${parentId} AND tutorId = ${tutorRow.id}
            AND scheduledAt >= ${utcMs - tolerance} AND scheduledAt <= ${utcMs + tolerance}
            AND status != 'cancelled'
          ORDER BY ABS(scheduledAt - ${utcMs}) LIMIT 1
        `)) as any)[0][0];
        if (newSession) break;
      }
      // Fallback: any time that day with this tutor
      if (!newSession) {
        newSession = ((await db.execute(sql`
          SELECT id, feedbackFromTutor FROM sessions
          WHERE parentId = ${parentId} AND tutorId = ${tutorRow.id}
            AND scheduledAt >= ${windowStart} AND scheduledAt <= ${windowEnd}
            AND status != 'cancelled'
          ORDER BY scheduledAt LIMIT 1
        `)) as any)[0][0];
      }
    }
  }

  // Fallback: match by time across all tutors for this parent
  if (!newSession) {
    for (const utcMs of [edtMs, estMs]) {
      const candidates = ((await db.execute(sql`
        SELECT id, tutorId, feedbackFromTutor FROM sessions
        WHERE parentId = ${parentId}
          AND scheduledAt >= ${utcMs - tolerance} AND scheduledAt <= ${utcMs + tolerance}
          AND status != 'cancelled'
        ORDER BY ABS(scheduledAt - ${utcMs})
      `)) as any)[0] as any[];
      if (candidates.length === 1) { newSession = candidates[0]; break; }
      if (candidates.length > 1) {
        notFound++;
        notFoundList.push({ date: dateStr, tutor: leg.tutorName, reason: `${candidates.length} sessions at same time, ambiguous` });
        newSession = null;
        break;
      }
    }
    if (!newSession && notFoundList[notFoundList.length - 1]?.date !== dateStr) {
      // Last fallback: 2-day window, single session
      const candidates = ((await db.execute(sql`
        SELECT id, tutorId, feedbackFromTutor FROM sessions
        WHERE parentId = ${parentId}
          AND scheduledAt >= ${windowStart} AND scheduledAt <= ${windowEnd}
          AND status != 'cancelled'
        ORDER BY scheduledAt
      `)) as any)[0] as any[];
      if (candidates.length === 1) {
        newSession = candidates[0];
      } else if (candidates.length > 1) {
        notFound++;
        notFoundList.push({ date: dateStr, tutor: leg.tutorName, reason: `${candidates.length} sessions in window, ambiguous` });
        continue;
      }
    }
  }

  if (!newSession) {
    notFound++;
    notFoundList.push({ date: dateStr, tutor: leg.tutorName, reason: 'no matching session in new platform' });
    continue;
  }

  if (newSession.feedbackFromTutor) {
    alreadyHasNotes++;
    continue;
  }

  await db.execute(sql`UPDATE sessions SET feedbackFromTutor = ${leg.notes} WHERE id = ${newSession.id}`);
  matched++;
  console.log(`✅ id=${newSession.id} ${dateStr} ${leg.tutorName} — notes copied`);
}

console.log(`\n═══════════════════════════════════════`);
console.log(`✅ Notes copied       : ${matched}`);
console.log(`⏭️  Already had notes  : ${alreadyHasNotes}`);
console.log(`❌ Not matched        : ${notFound}`);
if (notFoundList.length > 0) {
  console.log(`\nUnmatched:`);
  for (const r of notFoundList) console.log(`  ${r.date} ${r.tutor} — ${r.reason}`);
}

process.exit(0);
