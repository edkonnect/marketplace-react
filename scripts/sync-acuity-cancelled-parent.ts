/**
 * Sync CANCELLED sessions from Acuity for a SINGLE parent.
 *
 * Usage:
 *   pnpm tsx scripts/sync-acuity-cancelled-parent.ts munidinesh@gmail.com
 *
 * Strategy:
 * - Fetch ONLY cancelled appointments from Acuity (&canceled=true) per calendarID
 * - Filter client-side to match the parent's email(s)
 * - INSERT with status='cancelled' only if no existing session at (tutorId, scheduledAt)
 * - Never modifies existing sessions — purely additive
 * - Safe to re-run (idempotent via INSERT IGNORE)
 *
 * Date range: 2025-04-01 → today
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, subscriptions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

const PARENT_EMAIL = process.argv[2]?.toLowerCase().trim();
if (!PARENT_EMAIL) {
  console.error("Usage: pnpm tsx scripts/sync-acuity-cancelled-parent.ts <parent-email>");
  process.exit(1);
}

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const MIN_DATE = "2025-04-01";
const today = new Date();
const MAX_DATE = today.toISOString().split("T")[0];

// ── Known email aliases ───────────────────────────────────────────────────────
const PARENT_EMAIL_ALIASES: Record<string, string[]> = {
  "nithdeepsai@gmail.com": ["nithdeepsai@gmail.com", "nithilansai@gmail.com"],
  "nirmal.adlin.usa@gmail.com": ["nirmal.adlin.usa@gmail.com", "neola.rini@gmail.com", "nichelle.riji@gmail.com"],
  "krithika1412@gmail.com": ["krithika1412@gmail.com", "krithikar06@gmail.com", "varshak0211@gmail.com", "sanabiyer@gmail.com"],
  "param_palani@yahoo.com": ["param_palani@yahoo.com", "dhruvparram@gmail.com"],
  "ashok.sree@gmail.com": ["ashok.sree@gmail.com", "ashok.athiappan@gmail.com"],
  "jeelanimanikindi@gmail.com": ["jeelanimanikindi@gmail.com", "hafsa.numu@gmail.com"],
};

// ── Acuity calendarID → tutor primary email ───────────────────────────────────
const CALENDAR_TO_EMAIL: Record<number, string> = {
  9518516:  "dolon.mukherjee.2011@gmail.com",
  13134669: "bichuskumar8@gmail.com",
  12924725: "vgerarrd@gmail.com",
  7992988:  "gopisiri4268@gmail.com",
  10639379: "akalyangupta@gmail.com",
  6631240:  "mustaqmic@gmail.com",
  8838338:  "naushadteaches@gmail.com",
  7722765:  "pmudi.bppimt@gmail.com",
  13611648: "ramesh030199@gmail.com",
  9584519:  "aish30george@gmail.com",
  12748025: "anittadominic123@gmail.com",
  7203343:  "appysisodia@yahoo.com",
  5824683:  "maya.math289@gmail.com",
  9886816:  "mercyraniyedidi@gmail.com",
  12804136: "nalini.cheena@gmail.com",
  4056973:  "shritisharma@gmail.com",
  8255661:  "sivasankare.g@gmail.com",
  7137621:  "sivasankare.g@gmail.com",
  13204478: "codegems27@gmail.com",
  11083164: "vinaybalasisodia@gmail.com",
  13821319: "seswar8180@gmail.com",
  12585605: "chintalapati.vrs@gmail.com",
  13801030: "sharved2508@gmail.com",
  12986707: "shafirasik757575@gmail.com",
};

// ── Acuity appointmentTypeID → platform courseId ─────────────────────────────
const APPT_TYPE_TO_COURSE: Record<number, number | null> = {
  // Computer Science / Programming
  57218677: 51, 54015900: 51, 61243720: 51,
  76604953: 21, 84510036: 22, 84052873: 69,

  // Math — Elementary (no matching course)
  14691452: null, 14793473: null, 26804440: null, 38753649: null,
  38754939: null, 38754970: null, 49843342: null, 25031851: null, 19017079: null,

  // Math — Middle School
  71128291: 293, 14474827: 293, 26804574: 293,

  // Math — High School
  71128121: 299, 26804614: 299,
  14691576: 95,

  // Math — AP / A Level
  71556848: 33, 87502622: 33, 87525059: 33,

  // Math — SAT/ACT/PSAT
  19034374: 1,
  14701559: 1,
  14792692: 25,
  15690898: 25,

  // Math — Other
  59210772: null,

  // English — Elementary
  16723795: 115, 16723876: 115, 24510098: 115, 27314309: 115, 27314322: 115,
  38755753: 115, 38755818: 115, 49843317: 115, 31251347: 115,

  // English — Middle School
  71170467: 114, 38757538: 114, 27314289: 114, 38757488: 114,

  // English — High School
  71128100: 116, 38756951: 116, 38756927: 116,

  // English — A Level
  30219038: 252, 30219026: 252,

  // English — AP / Test Prep / Spoken
  88415090: 29,
  34108709: 276, 55339864: 276, 62762521: 276,

  // SAT / ACT
  55339838: 25, 40643350: 25,

  // Business English / IELTS / PTE
  25157139: 63, 25157101: 63, 44199566: 63, 44199912: 63,
  48657229: 63, 37280049: 63, 32458048: 63,
  80404280: 43, 31263147: 41, 31263177: 41,

  // Science — Physics
  71128190: 84, 46157449: 84, 46157379: 84, 56889632: null,

  // Science — Biology
  71128157: 227, 35389384: 227, 35389295: 227, 35389450: 227, 35389891: 227, 48083214: 227,

  // Science — Chemistry
  71128144: 226, 28978757: 226, 28978734: 226, 31913387: 226, 31913430: 226, 40922081: 226,

  // Science — Middle School
  71128249: 228, 71170563: 226, 33654551: 228,

  // Hindi
  63049663: 255, 74079295: 255,

  // Form courses
  39842697: 254, 39842708: 254, 52027965: 253, 52027983: 253,

  // German
  46627128: 58, 46627181: 58, 54274277: 58, 54274313: 58,

  // MBA / CAT / GRE / Other
  41024493: 118,
  38819183: null, 38819198: null, 40310481: null, 40310452: null,

  // AP / College (US)
  37431356: null, 37431358: null, 43468047: null, 34033973: null, 38087738: null, 35257646: null,

  // Board Exam Crash Course
  39814134: null, 39814142: null, 40615548: null, 40615562: null,

  // Misc
  31198809: null, 78945546: null, 72851734: null, 72851975: null, 74022709: null, 74023161: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEmails(raw: string): string[] {
  return (raw || "").split(/[,;]/).map((e) => e.toLowerCase().trim()).filter(Boolean);
}

function extractZoomUrl(location: string): string | null {
  if (!location) return null;
  const match = location.match(/https:\/\/[^\s]+zoom\.us\/j\/[^\s]+/);
  return match ? match[0] : null;
}

// Fetch CANCELLED appointments per calendar using sliding maxDate window.
async function fetchCancelledForParent(acuityEmails: Set<string>, calendarIds: Set<number>): Promise<any[]> {
  const all: any[] = [];

  for (const calId of calendarIds) {
    let calCount = 0;
    let windowMax = MAX_DATE;
    const minMs = new Date(MIN_DATE).getTime();
    const seenIds = new Set<number>();

    process.stdout.write(`  📅 calendarID=${calId}...`);

    while (true) {
      const params = new URLSearchParams({
        calendarID: String(calId),
        minDate: MIN_DATE,
        maxDate: windowMax,
        max: "500",
        canceled: "true",  // ← key difference: fetch cancelled appointments
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      let res: Response;
      try {
        res = await fetch(`${ACUITY_BASE}/appointments?${params}`, {
          headers: { Authorization: `Basic ${AUTH}` },
          signal: controller.signal,
        });
      } catch {
        clearTimeout(timeout);
        process.stdout.write(` timeout\n`);
        break;
      }
      clearTimeout(timeout);
      if (!res.ok) { process.stdout.write(` error ${res.status}\n`); break; }
      const page = await res.json();
      if (!Array.isArray(page) || page.length === 0) break;

      const maxMs = new Date(MAX_DATE + "T23:59:59Z").getTime();
      const forParent = page.filter((a: any) => {
        if (!a.canceled) return false;           // must be cancelled
        if (seenIds.has(a.id)) return false;
        const t = new Date(a.datetime).getTime();
        if (t < minMs || t > maxMs) return false;
        return parseEmails(a.email).some((e) => acuityEmails.has(e));
      });

      let newTotal = 0;
      for (const a of page) {
        if (!seenIds.has(a.id)) { seenIds.add(a.id); newTotal++; }
      }

      all.push(...forParent);
      calCount += forParent.length;

      if (page.length < 500) break;

      const oldestMs = new Date(page[page.length - 1].datetime).getTime();
      if (oldestMs <= minMs) break;
      if (newTotal === 0) break;

      const newMax = new Date(oldestMs - 86400000);
      windowMax = newMax.toISOString().split("T")[0];
    }

    if (calCount > 0) {
      process.stdout.write(` ${calCount} matched\n`);
    } else {
      process.stdout.write(` 0 matched\n`);
    }
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) { console.error("DB not available"); process.exit(1); }

  console.log(`\n🚫 Syncing CANCELLED sessions for: ${PARENT_EMAIL}`);
  console.log(`   Date range: ${MIN_DATE} → ${MAX_DATE}\n`);

  // Load parent
  const parentRows = await db.select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, PARENT_EMAIL));
  if (parentRows.length === 0) {
    console.error(`❌ Parent not found: ${PARENT_EMAIL}`);
    process.exit(1);
  }
  const parentId = parentRows[0].id;
  console.log(`👤 Parent ID: ${parentId}`);

  // Determine all emails this parent uses in Acuity
  const acuityEmails = new Set<string>(
    PARENT_EMAIL_ALIASES[PARENT_EMAIL] ?? [PARENT_EMAIL]
  );
  console.log(`   Acuity emails: ${[...acuityEmails].join(", ")}`);

  // Load all tutors
  const allTutors = await db.select({ id: users.id, email: users.email })
    .from(users).where(eq(users.role, "tutor"));
  const tutorEmailToId: Record<string, number> = {};
  for (const t of allTutors) {
    tutorEmailToId[t.email.toLowerCase()] = t.id;
  }

  // Load parent's subscriptions for subscriptionId linking
  const parentSubs = await db.select({
    id: subscriptions.id,
    courseId: subscriptions.courseId,
    preferredTutorId: subscriptions.preferredTutorId,
    status: subscriptions.status,
    studentFirstName: subscriptions.studentFirstName,
  }).from(subscriptions).where(eq(subscriptions.parentId, parentId));

  const subMap: Record<string, number> = {};
  for (const s of parentSubs) {
    if (!s.preferredTutorId) continue;
    const key = `${parentId}-${s.preferredTutorId}-${s.courseId}`;
    if (!subMap[key] || s.status === "active") subMap[key] = s.id;
  }
  console.log(`   Subscriptions: ${parentSubs.length}\n`);

  // Fetch cancelled appointments for all calendars
  const allCalendarIds = new Set<number>(Object.keys(CALENDAR_TO_EMAIL).map(Number));
  console.log(`📦 Fetching cancelled appointments from Acuity...`);
  const cancelledAppts = await fetchCancelledForParent(acuityEmails, allCalendarIds);
  console.log(`\n✅ ${cancelledAppts.length} cancelled Acuity appointments found for ${PARENT_EMAIL}\n`);

  if (cancelledAppts.length === 0) {
    console.log("No cancelled appointments to sync.");
    process.exit(0);
  }

  let inserted = 0;
  let skipped = 0;
  const unknownTypes = new Set<number>();

  console.log(`⚙️  Processing ${cancelledAppts.length} cancelled appointments...`);

  for (const appt of cancelledAppts) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calendarID];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;

    const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
    if (courseId === undefined) { unknownTypes.add(appt.appointmentTypeID); continue; }
    if (courseId === null) continue;  // skip unmapped course types

    const scheduledAtMs = new Date(appt.datetime).getTime();
    if (isNaN(scheduledAtMs)) continue;

    // Check if session already exists at this (tutorId, scheduledAt)
    const existing = ((await db.execute(sql`
      SELECT id, status FROM sessions
      WHERE tutorId = ${tutorId} AND scheduledAt = ${scheduledAtMs}
      LIMIT 1
    `)) as any)[0][0];

    if (existing) {
      skipped++;
      continue;  // don't overwrite existing completed/no_show/scheduled sessions
    }

    const duration = parseInt(appt.duration, 10) || 60;
    const meetingUrl = extractZoomUrl(appt.location || "");
    const subKey = `${parentId}-${tutorId}-${courseId}`;
    const subKeyAnyTutor = Object.keys(subMap).find(k => k.startsWith(`${parentId}-`) && k.endsWith(`-${courseId}`));
    const subscriptionId = subMap[subKey] ?? (subKeyAnyTutor ? subMap[subKeyAnyTutor] : null);
    const studentFirstName = (appt.firstName || "").trim() || null;
    const studentLastName = (appt.lastName || "").trim() || null;

    await db.execute(sql`
      INSERT IGNORE INTO sessions
        (parentId, tutorId, courseId, subscriptionId, scheduledAt, duration, status, isTrial, isMigrated, studentFirstName, studentLastName, meetingUrl, meetingPlatform)
      VALUES
        (${parentId}, ${tutorId}, ${courseId}, ${subscriptionId}, ${scheduledAtMs}, ${duration}, 'cancelled', 0, 0, ${studentFirstName}, ${studentLastName}, ${meetingUrl}, 'Zoom')
    `);
    inserted++;

    const d = new Date(scheduledAtMs);
    console.log(`  ✅ ${d.toISOString().slice(0, 16)} ${appt.type} — ${studentFirstName ?? ""}`);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`🚫 Cancelled sessions inserted : ${inserted}`);
  console.log(`⏭️  Skipped (already existed)   : ${skipped}`);
  if (unknownTypes.size > 0) {
    console.log(`⚠️  Unknown appointmentTypeIDs  : ${[...unknownTypes].join(", ")}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
