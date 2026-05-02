import "dotenv/config";
import { getDb } from "../server/db";
import { users, subscriptions } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";

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

// All missing sessions from Acuity analysis — confirmed missing from DB
// Format: { email, datetime (ISO with tz), calId, appointmentTypeId, acuityId, firstName, lastName, duration }
const MISSING = [
  // jeelanimanikindi — Apr 21, 24, 27 (hafsa.numu@gmail.com alias)
  { email: "jeelanimanikindi@gmail.com", dt: "2026-04-21T00:00:00.000Z", calId: 13611648, typeId: 19034374, acuityId: null, firstName: "Numa", lastName: "Johara", dur: 60 },
  { email: "jeelanimanikindi@gmail.com", dt: "2026-04-24T00:00:00.000Z", calId: 13611648, typeId: 19034374, acuityId: null, firstName: "Numa", lastName: "Johara", dur: 60 },
  { email: "jeelanimanikindi@gmail.com", dt: "2026-04-28T00:00:00.000Z", calId: 12804136, typeId: 14792692, acuityId: null, firstName: "Numa", lastName: "Johara", dur: 60 },
];

// Wait — let me compute from Acuity data above more carefully
// jeelani Acuity: Apr 20 (13611648), Apr 26 (12804136), Apr 27 (13611648) — let me check DB

const db = await getDb();

const PARENT_EMAIL_ALIASES: Record<string, string[]> = {
  "jeelanimanikindi@gmail.com": ["jeelanimanikindi@gmail.com", "hafsa.numu@gmail.com"],
};

// All acuity data for jeelani (from script output above):
// cal=13611648: Apr 20, Apr 27, May 4, May 11, May 18, May 25, Jun 1, Jun 8, Jun 15, Jun 22, Jun 29 (PSAT Math)
// cal=12804136: Apr 26, May 3, May 10, May 17, May 24, May 31, Jun 7, Jun 14, Jun 21, Jun 28 (PSAT English)

const acuityUpcoming = [
  { dt: "2026-04-20T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-04-26T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-04-27T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-03T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-04T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-10T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-11T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-17T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-18T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-24T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-25T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-05-31T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-01T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-07T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-08T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-14T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-15T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-21T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-22T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-28T20:00:00-0400", calId: 12804136, typeId: 14792692, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
  { dt: "2026-06-29T20:00:00-0400", calId: 13611648, typeId: 19034374, acuityId: "0", firstName: "Numa", lastName: "Johara Shaik", dur: 60 },
];

// Check parent
const parentRow = ((await db.execute(sql`SELECT id FROM users WHERE email = 'jeelanimanikindi@gmail.com'`)) as any)[0][0];
const parentId = parentRow.id;
console.log(`Parent ID: ${parentId}`);

const allTutors = ((await db.execute(sql`SELECT id, email FROM users WHERE role = 'tutor'`)) as any)[0] as any[];
const tutorEmailToId: Record<string, number> = {};
for (const t of allTutors) tutorEmailToId[t.email.toLowerCase()] = t.id;

const parentSubs = ((await db.execute(sql`SELECT id, courseId, preferredTutorId, status FROM subscriptions WHERE parentId = ${parentId}`)) as any)[0] as any[];
const subMap: Record<string, number> = {};
for (const s of parentSubs) {
  if (!s.preferredTutorId) continue;
  const key = `${parentId}-${s.preferredTutorId}-${s.courseId}`;
  if (!subMap[key] || s.status === "active") subMap[key] = s.id;
}

let inserted = 0, skipped = 0;
for (const appt of acuityUpcoming) {
  const tutorEmail = CALENDAR_TO_EMAIL[appt.calId];
  if (!tutorEmail) continue;
  const tutorId = tutorEmailToId[tutorEmail.toLowerCase()];
  if (!tutorId) continue;
  const courseId = APPT_TYPE_TO_COURSE[appt.typeId];
  if (!courseId) continue;
  const ms = new Date(appt.dt).getTime();

  const existing = ((await db.execute(sql`SELECT id FROM sessions WHERE tutorId = ${tutorId} AND scheduledAt = ${ms} AND parentId = ${parentId}`)) as any)[0][0];
  if (existing) { skipped++; continue; }

  const subKey = `${parentId}-${tutorId}-${courseId}`;
  const subKeyAny = Object.keys(subMap).find(k => k.startsWith(`${parentId}-`) && k.endsWith(`-${courseId}`));
  const subscriptionId = subMap[subKey] ?? (subKeyAny ? subMap[subKeyAny] : null);

  await db.execute(sql`
    INSERT IGNORE INTO sessions (parentId, tutorId, courseId, subscriptionId, scheduledAt, duration, status, isTrial, isMigrated, studentFirstName, studentLastName, meetingPlatform)
    VALUES (${parentId}, ${tutorId}, ${courseId}, ${subscriptionId}, ${ms}, ${appt.dur}, 'scheduled', 0, 0, ${appt.firstName}, ${appt.lastName}, 'Zoom')
  `);
  console.log(`✅ Inserted: ${new Date(ms).toISOString().slice(0,16)} tutorId=${tutorId} courseId=${courseId}`);
  inserted++;
}

console.log(`\nInserted: ${inserted}, Skipped: ${skipped}`);

const total = ((await db.execute(sql`SELECT COUNT(*) as cnt FROM sessions WHERE parentId = ${parentId} AND status = 'scheduled'`)) as any)[0][0];
console.log(`Total scheduled for jeelani: ${total.cnt}`);
process.exit(0);
