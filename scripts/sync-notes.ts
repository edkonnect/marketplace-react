/**
 * Sync session notes from legacy_staging to the platform.
 *
 * Usage:
 *   pnpm tsx scripts/sync-notes.ts              # sync all parents, then fix duplicates
 *   pnpm tsx scripts/sync-notes.ts --check      # just print coverage report, no changes
 *
 * What it does:
 *   1. Loads all legacy_staging sessions that have notes
 *   2. For each legacy note, finds the matching platform session using 3-level strategy:
 *        Level 1 — exact tutor + time match (±35 min, tries EDT +4h and EST +5h offsets)
 *        Level 2 — same tutor + same day window (any time, session must have no note yet)
 *        Level 3 — same day window, any tutor, only if parent has exactly 1 session that day
 *   3. Writes the note to feedbackFromTutor (never overwrites existing notes)
 *   4. Fixes duplicates: if the same note ends up on multiple sessions for the same
 *      parent on the same day, keeps the one whose tutor name appears in the note text,
 *      and clears feedbackFromTutor from the rest
 *
 * Tutor matching:
 *   legacy_staging.sessions.tutor_id → legacy_staging.tutors.email → users.email (role=tutor) → users.id
 *
 * Timezone:
 *   legacy_staging stores session_time as local US time (EDT/EST) but MySQL treats it as UTC.
 *   We compensate by trying both +4h (EDT) and +5h (EST) offsets when matching platform scheduledAt.
 */
import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const CHECK_ONLY = process.argv.includes("--check");

const db = await getDb();
if (!db) { console.error("DB not available"); process.exit(1); }

// ── Coverage report ───────────────────────────────────────────────────────────

async function printCoverage() {
  const rows = ((await db!.execute(sql`
    SELECT u.email, u.id as parentId,
      COUNT(s.id) as completed,
      SUM(CASE WHEN s.feedbackFromTutor IS NOT NULL AND s.feedbackFromTutor != '' THEN 1 ELSE 0 END) as has_notes
    FROM sessions s
    JOIN users u ON u.id = s.parentId
    WHERE s.status = 'completed'
    GROUP BY u.id, u.email
    ORDER BY (has_notes / completed) ASC
  `)) as any)[0] as any[];

  console.log(`\n${"Email".padEnd(42)} ${"Done".padStart(6)} ${"Notes".padStart(6)} ${"Coverage".padStart(9)}`);
  console.log("-".repeat(68));
  for (const r of rows) {
    const pct = r.completed > 0 ? Math.round((r.has_notes / r.completed) * 100) : 0;
    const flag = pct < 50 ? " ⚠️" : "";
    console.log(`${String(r.email).padEnd(42)} ${String(r.completed).padStart(6)} ${String(r.has_notes).padStart(6)} ${(pct + "%").padStart(9)}${flag}`);
  }
  const totalDone = rows.reduce((s: number, r: any) => s + Number(r.completed), 0);
  const totalNotes = rows.reduce((s: number, r: any) => s + Number(r.has_notes), 0);
  console.log("-".repeat(68));
  console.log(`${"TOTAL".padEnd(42)} ${String(totalDone).padStart(6)} ${String(totalNotes).padStart(6)} ${(Math.round(totalNotes/totalDone*100)+"%").padStart(9)}\n`);
}

if (CHECK_ONLY) {
  await printCoverage();
  process.exit(0);
}

// ── Load platform parents and tutors ─────────────────────────────────────────

const parentRows = ((await db.execute(sql`SELECT id, LOWER(email) as email FROM users WHERE role = 'parent'`)) as any)[0] as any[];
const parentEmailToId: Record<string, number> = {};
for (const p of parentRows) parentEmailToId[p.email] = p.id;

const tutorRows = ((await db.execute(sql`SELECT id, LOWER(email) as email FROM users WHERE role = 'tutor'`)) as any)[0] as any[];
const tutorEmailToId: Record<string, number> = {};
for (const t of tutorRows) tutorEmailToId[t.email] = t.id;

// ── Load legacy sessions with notes ──────────────────────────────────────────

const legacySessions = ((await db.execute(sql`
  SELECT ls.id as legacyId, ls.session_date, ls.session_time, ls.timezone,
    LOWER(ls.parent_email) as parent_email,
    lt.email as tutor_email,
    ls.notes,
    UNIX_TIMESTAMP(CONCAT(ls.session_date, ' ', ls.session_time)) * 1000 as sessionMs
  FROM legacy_staging.sessions ls
  LEFT JOIN legacy_staging.tutors lt ON lt.id = ls.tutor_id
  WHERE ls.notes IS NOT NULL AND ls.notes != ''
  ORDER BY ls.session_date DESC
`)) as any)[0] as any[];

console.log(`Legacy sessions with notes: ${legacySessions.length}`);

let copied = 0;
let alreadyHasNotes = 0;
let notFound = 0;
let noParent = 0;

for (const leg of legacySessions) {
  const parentId = parentEmailToId[leg.parent_email];
  if (!parentId) { noParent++; continue; }

  const dateStr = String(leg.session_date).split("T")[0].split(" ")[0];
  const legacyMs = Number(leg.sessionMs);

  // UTC offsets: EDT = +4h, EST = +5h
  const edtMs = legacyMs + 4 * 3600000;
  const estMs = legacyMs + 5 * 3600000;
  const tolerance = 35 * 60 * 1000;

  // Day window: same date + next 2 days (handles UTC crossover)
  const windowStart = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  const windowEnd = windowStart + 2 * 24 * 3600000;

  const tutorId = leg.tutor_email ? tutorEmailToId[leg.tutor_email.toLowerCase()] : null;

  let matchedSession: any = null;

  // Level 1: exact tutor + time match
  if (tutorId) {
    for (const utcMs of [edtMs, estMs]) {
      const row = ((await db.execute(sql`
        SELECT id, feedbackFromTutor FROM sessions
        WHERE parentId = ${parentId}
          AND tutorId = ${tutorId}
          AND scheduledAt BETWEEN ${utcMs - tolerance} AND ${utcMs + tolerance}
        ORDER BY ABS(scheduledAt - ${utcMs}) ASC
        LIMIT 1
      `)) as any)[0][0];
      if (row) { matchedSession = row; break; }
    }
  }

  // Level 2: same tutor + same day, no note yet
  if (!matchedSession && tutorId) {
    const row = ((await db.execute(sql`
      SELECT id, feedbackFromTutor FROM sessions
      WHERE parentId = ${parentId}
        AND tutorId = ${tutorId}
        AND scheduledAt BETWEEN ${windowStart} AND ${windowEnd}
        AND (feedbackFromTutor IS NULL OR feedbackFromTutor = '')
      ORDER BY scheduledAt ASC
      LIMIT 1
    `)) as any)[0][0];
    if (row) matchedSession = row;
  }

  // Level 3: same day, any tutor, only if parent has exactly 1 session that day (avoids misattribution)
  if (!matchedSession) {
    const dayRows = ((await db.execute(sql`
      SELECT id, feedbackFromTutor FROM sessions
      WHERE parentId = ${parentId}
        AND scheduledAt BETWEEN ${windowStart} AND ${windowEnd}
        AND (feedbackFromTutor IS NULL OR feedbackFromTutor = '')
    `)) as any)[0] as any[];
    if (dayRows.length === 1) matchedSession = dayRows[0];
  }

  if (!matchedSession) { notFound++; continue; }

  if (matchedSession.feedbackFromTutor && matchedSession.feedbackFromTutor.trim() !== "") {
    alreadyHasNotes++;
    continue;
  }

  await db.execute(sql`UPDATE sessions SET feedbackFromTutor = ${leg.notes} WHERE id = ${matchedSession.id}`);
  copied++;
}

console.log(`\n  ✅ Notes copied      : ${copied}`);
console.log(`  ⏭️  Already had notes : ${alreadyHasNotes}`);
console.log(`  ❌ Not matched       : ${notFound}`);
console.log(`  👻 No parent in DB   : ${noParent}`);

// ── Fix duplicates ────────────────────────────────────────────────────────────
// When level-3 matching was too relaxed, the same note can land on two sessions
// on the same day. Keep the session whose tutor name appears in the note text.
// If no name match, keep the earliest session. Clear the rest.

console.log(`\nChecking for duplicate notes...`);

const dupeGroups = ((await db.execute(sql`
  SELECT s.parentId, DATE(FROM_UNIXTIME(s.scheduledAt/1000)) as day, s.feedbackFromTutor as note,
    GROUP_CONCAT(s.id ORDER BY s.scheduledAt ASC) as session_ids
  FROM sessions s
  WHERE s.feedbackFromTutor IS NOT NULL AND s.feedbackFromTutor != ''
  GROUP BY s.parentId, day, s.feedbackFromTutor
  HAVING COUNT(*) > 1
`)) as any)[0] as any[];

console.log(`  Found ${dupeGroups.length} duplicate note groups`);

const tutorInfoRows = ((await db.execute(sql`
  SELECT u.id, u.firstName, u.lastName FROM users u WHERE u.role = 'tutor'
`)) as any)[0] as any[];
const tutorInfo: Record<number, { firstName: string; lastName: string }> = {};
for (const t of tutorInfoRows) tutorInfo[t.id] = { firstName: t.firstName || "", lastName: t.lastName || "" };

let cleared = 0;

for (const group of dupeGroups) {
  const ids = String(group.session_ids).split(",").map(Number);
  const note: string = (group.note || "").toLowerCase();

  const groupSessions = ((await db.execute(sql`
    SELECT s.id, s.tutorId FROM sessions s
    WHERE s.id IN (${sql.raw(ids.join(","))})
    ORDER BY s.scheduledAt ASC
  `)) as any)[0] as any[];

  // Find session whose tutor name appears in the note
  let correctId: number | null = null;
  for (const s of groupSessions) {
    const info = tutorInfo[s.tutorId];
    if (!info) continue;
    if (info.firstName && note.includes(info.firstName.toLowerCase())) { correctId = s.id; break; }
    if (info.lastName && note.includes(info.lastName.toLowerCase())) { correctId = s.id; break; }
  }
  // Fall back to earliest
  if (!correctId) correctId = groupSessions[0].id;

  for (const s of groupSessions) {
    if (s.id === correctId) continue;
    await db.execute(sql`UPDATE sessions SET feedbackFromTutor = NULL WHERE id = ${s.id}`);
    cleared++;
  }
}

console.log(`  ✅ Wrong duplicates cleared : ${cleared}`);

// ── Final coverage report ─────────────────────────────────────────────────────
console.log(`\n── Coverage after sync ──`);
await printCoverage();

process.exit(0);
