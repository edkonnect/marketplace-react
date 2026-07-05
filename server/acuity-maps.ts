/**
 * Acuity → Platform mapping — SINGLE SOURCE OF TRUTH.
 *
 * Both the real-time webhook (server/acuity-webhook.ts) and the polling/manual
 * sync (server/acuity-sync.ts) import these maps and the shared upsert. Do NOT
 * duplicate these maps anywhere else — that is exactly the drift that caused
 * weeks of sessions silently failing to sync.
 *
 * To add a tutor: add their Acuity calendarID → platform tutor user id in
 * CALENDAR_TO_TUTOR. To add a course: add the Acuity appointmentTypeID →
 * platform course id in APPT_TYPE_TO_COURSE. Unmapped calendars/types are
 * surfaced in the Acuity Sync preview so they can be added here.
 */

// ── Calendar ID -> Platform Tutor user id ─────────────────────────────────────
// An unmapped calendar is reported in the preview (not silently dropped).
export const CALENDAR_TO_TUTOR: Record<number, number> = {
  9518516:  50, // Ms. Dolon
  9344460:  55, // Mr. Brian Olsen
  13134669: 54, // Mr. Bichu S Kumar
  12924725: 75, // Mr. Gerard
  7992988:  72, // Mr. Gopi
  10639379: 53, // Mr. Kalyan
  6631240:  61, // Mr. Mustaq
  8838338:  76, // Mr. Naushad
  7722765:  66, // Mr. Prasenjith
  13611648: 56, // Mr. Ramesh
  9584519:  69, // Ms. Aishwarya
  12748025: 51, // Ms. Anita Dominic
  7203343:  24, // Ms. Apoorva
  5824683:  47, // Ms. Maya
  9886816:  30, // Ms. Mercy Rani
  12804136: 59, // Ms. Nalini Sharma
  4056973:  23, // Ms. Shriti
  7137621:  57, // Ms. Sivasankaree
  11083164: 71, // Ms. Vinayabala
  12585605: 52, // Sriilalit Narayana
  13801030: 70, // Mr. Goury Shankar
  12986707: 58, // Ms. Shafia
};

// ── Appointment Type ID -> Platform Course ID ─────────────────────────────────
// undefined (not in map) = unknown type, reported in preview.
// null = known type with no matching course; only synced for trial types.
export const APPT_TYPE_TO_COURSE: Record<number, number | null> = {
  // Physics
  30863827: 163,  // Physics - Private Session (CBSE/ICSE/IG/IB/State) → ICSE High School Physics - Grade 11
  // Computer Science / Programming
  57218677: 51,   // Middle School Computer Science → IB Computer Science
  54015900: 51,   // High School Computer Science → IB Computer Science
  61243720: 51,   // High School Computer Science - Free trial → IB Computer Science
  76604953: 21,   // Computer Programming - Python
  84510036: 22,   // Computer Programming - Java
  84052873: 69,   // AP Computer Science → AP Computer Science A

  // Math — Elementary (no matching course)
  // Math — Elementary
14691452: 297,  // Elementary School Math - Private Session (US) → Elementary Math Grade 3
14793473: 297,  // Elementary School Math - Free Trial Session → Elementary Math Grade 3
26804440: null, 38753649: null, 38754939: null,
38754970: null, 49843342: null, 25031851: null, 19017079: null,
  // Math — Middle School
  71128291: 293,  // Middle School Math - Private (IG/IB) → Middle School Math Grade 7
  14474827: 293,  // Middle School Math - Private (US) → Middle School Math Grade 7
  26804574: 293,  // Middle School Mathematics - Private (CBSE/ICSE) → Middle School Math Grade 7
  52792024: 293, 52792025: 293,

  // Math — High School
  71128121: 299,  // High School Math - Private (IG/IB) → High School Mathematics
  26804614: 299,  // High School Mathematics - Private (CBSE/ICSE/IG/IB/State) → High School Mathematics
  14691576: 299,  // High School Math - Private (US) → High School Mathematics

  // Math — AP / A Level
  71556848: 33,   // AP Calculus - Private → AP CALCULUS AB
  87502622: 33,   // AP Calculus - Free Trial → AP CALCULUS AB
  14891471: 33, 14891472: 33,
  27561406: 251,  // A Level Math - Private → A Level Mathematics
  27561385: 251,  // A Level Math - Free Trial → A Level Mathematics
  87525059: 68,   // AP Statistics

  // Math — Other
  59210772: null, // JEE - Mathematics

  // English — Elementary
  16723795: 115, 16723876: 115, 24510098: 115, 27314309: 115, 27314322: 115,
  38755753: 115, 38755818: 115, 49843317: 115, 31251347: 115,

  // English — Middle School
  71170467: 114,  // Middle School English - Private (IG/IB) → Middle School English
  38757538: 114,  // Middle School English - Private (US) → Middle School English
  27314289: 114,  // Middle School English - Private (CBSE/ICSE/IG/IB/State) → Middle School English

  // English — High School
  71128100: 116,  // High School English - Private (IG/IB) → High School English
  38756951: 116,  // High School English - Private (US) → High School English
  38756927: 116,  // High School English - Free Trial (US) → High School English
  27314258: 116,  // High School English - Private (CBSE/ICSE/IG/IB/State) → High School English

  // English — A Level
  30219038: 252, 30219026: 252,

  // English — AP / Spoken
  88415090: 29,   // AP Language
  34108709: 276, 55339864: 276, 62762521: 276,  // Spoken English

  // SAT / ACT
  55339838: 25,   // Trial Lesson → SAT English
  40643350: 25,   // SAT Trial Lesson → SAT English
  19034374: 1,    // PSAT/SAT/ACT Math - Private → SAT Math
  14701559: 1,    // PSAT/SAT/ACT Math - Free Trial → SAT Math
  14792692: 25,   // PSAT/SAT/ACT English - Private → SAT English
  15690898: 25,   // PSAT/SAT/ACT English - Free Trial → SAT English
  58068542: 25,   // SAT Foundation English → SAT English

  // Business English / IELTS / PTE
  25157139: 63, 25157101: 63, 44199566: 63, 44199912: 63, 48657229: 63,
  37280049: 63, 32458048: 63,
  80404280: 43,   // PTE Academics
  31263147: 41,   // IELTS/TOEFL - Private → IELTS General
  31263177: 41,   // IELTS/TOEFL - Free Trial → IELTS General

  // Science — Physics
  71128190: 84, 46157449: 84, 46157379: 84,
  56889632: null, // NEET - Physics (Free Trial)

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

  // MBA / CAT / GRE / Other (mostly skip)
  41024493: 118,
  38819183: null, 38819198: null, 40310481: null, 40310452: null,

  // AP / College (US) — generic, skip
  37431356: null, 37431358: null, 43468047: null, 34033973: null, 38087738: null, 35257646: null,

  // Board Exam Crash Course — skip
  39814134: null, 39814142: null, 40615548: null, 40615562: null,

  // Misc — skip
  31198809: null, // Additional half hour class
  78945546: null, // Parent-Tutor conference
  72851734: null, 72851975: null, // High School Social Science
  74022709: null, 74023161: null, // Spanish
};

// Trial appointment types — synced even when courseId maps to null.
export const TRIAL_APPOINTMENT_TYPES = new Set<number>([
  40643350, 55339838,
  14701559, 15690898,        // PSAT/SAT/ACT free trials
  61243720,                  // HS CS free trial
  38756927,                  // HS English free trial (US)
]);

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Extract a Zoom join URL from an Acuity `location` field (handles `URL: ...` prefix). */
export function extractZoomUrl(location: string | null | undefined): string | null {
  if (!location) return null;
  // Acuity stores e.g. "URL: https://edkonnect.zoom.us/j/123?pwd=... Meeting ID: ..."
  const prefixed = location.match(/URL:\s*(https?:\/\/[^\s]+)/i);
  if (prefixed) return prefixed[1];
  const direct = location.match(/https:\/\/[^\s]+zoom\.us\/[^\s]+/i);
  return direct ? direct[0] : null;
}

/** Split an Acuity email field (may contain multiple emails joined by , or ;). */
export function splitEmails(email: string | null | undefined): string[] {
  return (email || "")
    .split(/[,;]/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Format a Unix-ms timestamp as a human-readable IST string. */
export function toIst(scheduledAtMs: number): string {
  return (
    new Date(scheduledAtMs).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    }) + " IST"
  );
}
