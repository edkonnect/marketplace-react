import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const ACUITY_BASE = "https://acuityscheduling.com/api/v1";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const PARENT_EMAIL_ALIASES: Record<string, string[]> = {
  "nithdeepsai@gmail.com": ["nithdeepsai@gmail.com", "nithilansai@gmail.com"],
  "nirmal.adlin.usa@gmail.com": ["nirmal.adlin.usa@gmail.com", "neola.rini@gmail.com", "nichelle.riji@gmail.com"],
  "krithika1412@gmail.com": ["krithika1412@gmail.com", "krithikar06@gmail.com", "varshak0211@gmail.com", "sanabiyer@gmail.com"],
  "param_palani@yahoo.com": ["param_palani@yahoo.com", "dhruvparram@gmail.com"],
  "ashok.sree@gmail.com": ["ashok.sree@gmail.com", "ashok.athiappan@gmail.com"],
  "jeelanimanikindi@gmail.com": ["jeelanimanikindi@gmail.com", "hafsa.numu@gmail.com"],
};

const CALENDAR_TO_EMAIL: Record<number, string> = {
  9518516: "dolon.mukherjee.2011@gmail.com", 13134669: "bichuskumar8@gmail.com",
  12924725: "vgerarrd@gmail.com", 7992988: "gopisiri4268@gmail.com",
  10639379: "akalyangupta@gmail.com", 6631240: "mustaqmic@gmail.com",
  8838338: "naushadteaches@gmail.com", 7722765: "pmudi.bppimt@gmail.com",
  13611648: "ramesh030199@gmail.com", 9584519: "aish30george@gmail.com",
  12748025: "anittadominic123@gmail.com", 7203343: "appysisodia@yahoo.com",
  5824683: "maya.math289@gmail.com", 9886816: "mercyraniyedidi@gmail.com",
  12804136: "nalini.cheena@gmail.com", 4056973: "shritisharma@gmail.com",
  8255661: "sivasankare.g@gmail.com", 7137621: "sivasankare.g@gmail.com",
  13204478: "codegems27@gmail.com", 11083164: "vinaybalasisodia@gmail.com",
  13821319: "seswar8180@gmail.com", 12585605: "chintalapati.vrs@gmail.com",
  13801030: "sharved2508@gmail.com", 12986707: "shafirasik757575@gmail.com",
};

const APPT_TYPE_TO_COURSE: Record<number, number | null> = {
  57218677: 51, 54015900: 51, 61243720: 51, 76604953: 21, 84510036: 22, 84052873: 69,
  14691452: null, 14793473: null, 26804440: null, 38753649: null, 38754939: null,
  38754970: null, 49843342: null, 25031851: null, 19017079: null,
  71128291: 293, 14474827: 293, 26804574: 293,
  71128121: 299, 26804614: 299, 14691576: 95,
  71556848: 33, 87502622: 33, 87525059: 33,
  19034374: 1, 14701559: 1, 14792692: 25, 15690898: 25, 59210772: null,
  16723795: 115, 16723876: 115, 24510098: 115, 27314309: 115, 27314322: 115,
  38755753: 115, 38755818: 115, 49843317: 115, 31251347: 115,
  71170467: 114, 38757538: 114, 27314289: 114, 38757488: 114,
  71128100: 116, 38756951: 116, 38756927: 116,
  30219038: 252, 30219026: 252, 88415090: 29,
  34108709: 276, 55339864: 276, 62762521: 276,
  55339838: 25, 40643350: 25,
  25157139: 63, 25157101: 63, 44199566: 63, 44199912: 63,
  48657229: 63, 37280049: 63, 32458048: 63,
  80404280: 43, 31263147: 41, 31263177: 41,
  71128190: 84, 46157449: 84, 46157379: 84, 56889632: null,
  71128157: 227, 35389384: 227, 35389295: 227, 35389450: 227, 35389891: 227, 48083214: 227,
  71128144: 226, 28978757: 226, 28978734: 226, 31913387: 226, 31913430: 226, 40922081: 226,
  71128249: 228, 71170563: 226, 33654551: 228,
  63049663: 255, 74079295: 255,
  39842697: 254, 39842708: 254, 52027965: 253, 52027983: 253,
  46627128: 58, 46627181: 58, 54274277: 58, 54274313: 58,
  41024493: 118,
  38819183: null, 38819198: null, 40310481: null, 40310452: null,
  37431356: null, 37431358: null, 43468047: null, 34033973: null, 38087738: null, 35257646: null,
  39814134: null, 39814142: null, 40615548: null, 40615562: null,
  31198809: null, 78945546: null, 72851734: null, 72851975: null, 74022709: null, 74023161: null,
};

const parents = [
  "nirmal.adlin.usa@gmail.com", "veena.uskids@gmail.com", "raviraju.kalidindi@gmail.com",
  "krithika1412@gmail.com", "ashok.sree@gmail.com", "param_palani@yahoo.com",
  "deepa.pondicherry@gmail.com", "ssggkk@gmail.com", "munidinesh@gmail.com",
  "lnsgeetha@gmail.com", "sari12j@gmail.com", "shankarmeera@gmail.com",
  "jeelanimanikindi@gmail.com", "sejunet23@gmail.com", "deepsforever@gmail.com",
  "jagapathirajup@gmail.com",
];

const today = new Date();
const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000);
const minStr = today.toISOString().split("T")[0];
const maxStr = maxDate.toISOString().split("T")[0];
const minMs = today.getTime();
const maxMs = maxDate.getTime();

const db = await getDb();
const allTutors = ((await db.execute(sql`SELECT id, email FROM users WHERE role = 'tutor'`)) as any)[0] as any[];
const tutorEmailToId: Record<string, number> = {};
for (const t of allTutors) tutorEmailToId[t.email.toLowerCase()] = t.id;

// Fetch per-calendar to avoid 1000 limit
console.log("Fetching Acuity per calendar...");
const acuityByParent: Record<string, any[]> = {};
for (const p of parents) acuityByParent[p] = [];

for (const [calIdStr, tutorEmail] of Object.entries(CALENDAR_TO_EMAIL)) {
  const calId = Number(calIdStr);
  // Paginate if needed
  let windowMax = maxStr;
  const seenIds = new Set<number>();
  while (true) {
    const url = `${ACUITY_BASE}/appointments?calendarID=${calId}&minDate=${minStr}&maxDate=${windowMax}&max=500`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
    if (!res.ok) break;
    const page = await res.json() as any[];
    if (!Array.isArray(page) || page.length === 0) break;
    for (const appt of page) {
      if (appt.canceled || seenIds.has(appt.id)) continue;
      seenIds.add(appt.id);
      const t = new Date(appt.datetime).getTime();
      if (t < minMs || t > maxMs) continue;
      const apptEmails = (appt.email || "").toLowerCase().split(/[,;]/).map((e: string) => e.trim());
      for (const parentEmail of parents) {
        const aliases = PARENT_EMAIL_ALIASES[parentEmail] ?? [parentEmail];
        if (aliases.some(a => apptEmails.includes(a))) {
          acuityByParent[parentEmail].push({ ...appt, calId });
          break;
        }
      }
    }
    if (page.length < 500) break;
    const oldestMs = new Date(page[page.length-1].datetime).getTime();
    if (oldestMs <= minMs) break;
    windowMax = new Date(oldestMs - 86400000).toISOString().split("T")[0];
  }
}

console.log("Done fetching Acuity.\n");

let totalInserted = 0;
let totalFixed = 0;

for (const parentEmail of parents) {
  const parentRow = ((await db.execute(sql`SELECT id FROM users WHERE email = ${parentEmail}`)) as any)[0][0];
  if (!parentRow) { console.log(`❌ ${parentEmail}: NOT FOUND`); continue; }
  const parentId = parentRow.id;

  const parentSubs = ((await db.execute(sql`SELECT id, courseId, preferredTutorId, status FROM subscriptions WHERE parentId = ${parentId}`)) as any)[0] as any[];
  const subMap: Record<string, number> = {};
  for (const s of parentSubs) {
    if (!s.preferredTutorId) continue;
    const key = `${parentId}-${s.preferredTutorId}-${s.courseId}`;
    if (!subMap[key] || s.status === "active") subMap[key] = s.id;
  }

  const acuityAppts = acuityByParent[parentEmail];

  // Build Acuity valid set: tutorId:scheduledAtMs
  const acuityKeys = new Set<string>();
  const acuityIdMap = new Map<string, any>(); // key → appt
  for (const appt of acuityAppts) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calId];
    if (!tutorEmail) continue;
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    if (!tutorId) continue;
    const ms = new Date(appt.datetime).getTime();
    if (isNaN(ms)) continue;
    const key = `${tutorId}:${ms}`;
    acuityKeys.add(key);
    acuityIdMap.set(key, appt);
  }

  // Get all DB scheduled sessions for this parent in window
  const dbSessions = ((await db.execute(sql`
    SELECT s.id, s.tutorId, s.scheduledAt, s.studentFirstName, s.studentLastName,
      s.acuityAppointmentId, s.courseId, s.subscriptionId
    FROM sessions s
    WHERE s.parentId = ${parentId} AND s.status = 'scheduled'
      AND s.scheduledAt >= ${minMs} AND s.scheduledAt <= ${maxMs}
    ORDER BY s.scheduledAt
  `)) as any)[0] as any[];

  const dbKeys = new Set<string>();
  for (const s of dbSessions) dbKeys.add(`${s.tutorId}:${Number(s.scheduledAt)}`);

  // Find missing in DB (in Acuity but not in DB)
  const missing: any[] = [];
  for (const [key, appt] of acuityIdMap) {
    if (!dbKeys.has(key)) missing.push({ key, appt });
  }

  // Find sessions in DB with no student name — fix them
  const noName = dbSessions.filter((s: any) => !s.studentFirstName);

  let inserted = 0;
  let fixed = 0;

  // Insert missing sessions
  for (const { key, appt } of missing) {
    const tutorEmail = CALENDAR_TO_EMAIL[appt.calId];
    const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
    const courseId = APPT_TYPE_TO_COURSE[appt.appointmentTypeID];
    if (courseId === undefined || courseId === null) continue;
    const ms = new Date(appt.datetime).getTime();
    const subKey = `${parentId}-${tutorId}-${courseId}`;
    const subKeyAny = Object.keys(subMap).find(k => k.startsWith(`${parentId}-`) && k.endsWith(`-${courseId}`));
    const subscriptionId = subMap[subKey] ?? (subKeyAny ? subMap[subKeyAny] : null);
    const firstName = (appt.firstName || "").trim() || null;
    const lastName = (appt.lastName || "").trim() || null;
    const duration = parseInt(appt.duration, 10) || 60;
    await db.execute(sql`
      INSERT IGNORE INTO sessions (parentId, tutorId, courseId, subscriptionId, scheduledAt, duration, status, isTrial, isMigrated, studentFirstName, studentLastName, meetingPlatform, acuityAppointmentId)
      VALUES (${parentId}, ${tutorId}, ${courseId}, ${subscriptionId}, ${ms}, ${duration}, 'scheduled', 0, 0, ${firstName}, ${lastName}, 'Zoom', ${String(appt.id)})
    `);
    inserted++;
    totalInserted++;
    const edt = new Date(ms - 4*3600000);
    console.log(`  ✅ INSERT ${parentEmail}: ${edt.toISOString().slice(0,16)} EDT — ${appt.type.slice(0,30)} (${firstName})`);
  }

  // Fix missing student names
  for (const s of noName) {
    const key = `${s.tutorId}:${Number(s.scheduledAt)}`;
    const appt = acuityIdMap.get(key);
    if (appt) {
      const firstName = (appt.firstName || "").trim() || null;
      const lastName = (appt.lastName || "").trim() || null;
      if (firstName) {
        await db.execute(sql`UPDATE sessions SET studentFirstName = ${firstName}, studentLastName = ${lastName} WHERE id = ${s.id}`);
        fixed++;
        totalFixed++;
        console.log(`  🔧 FIXED name ${parentEmail}: id=${s.id} → ${firstName} ${lastName}`);
      }
    }
  }

  // Final count
  const dbCount = ((await db.execute(sql`SELECT COUNT(*) as cnt FROM sessions WHERE parentId = ${parentId} AND status = 'scheduled' AND scheduledAt >= ${minMs} AND scheduledAt <= ${maxMs}`)) as any)[0][0].cnt;
  const acuityCount = acuityKeys.size;
  const status = dbCount == acuityCount ? "✅" : "⚠️ ";
  console.log(`${status} ${parentEmail}: Acuity=${acuityCount} DB=${dbCount} inserted=${inserted} fixed=${fixed}`);
}

console.log(`\n═══════════════════════════════════`);
console.log(`Total inserted: ${totalInserted} | Total names fixed: ${totalFixed}`);
process.exit(0);
