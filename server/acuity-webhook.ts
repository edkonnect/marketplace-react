/**
 * Acuity Scheduling Webhook Handler
 *
 * Receives real-time appointment events from Acuity:
 *   - appointment.scheduled  -> INSERT new session
 *   - appointment.canceled   -> UPDATE status = 'cancelled'
 *   - appointment.rescheduled / appointment.changed -> UPDATE scheduledAt + meetingUrl
 *
 * Signature verification: base64 HMAC-SHA256 of raw body using ACUITY_API_KEY,
 * compared against the x-acuity-signature header.
 *
 * Route is registered BEFORE express.json() so raw body is available.
 */

import type { Request, Response } from "express";
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "./db";
import { sessions, subscriptions, users } from "../drizzle/schema";

const ACUITY_USER_ID = process.env.ACUITY_USER_ID!;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY!;

// ── Calendar ID -> Platform Tutor ID ──────────────────────────────────────────

const CALENDAR_TUTOR_MAP: Record<number, number> = {
  9518516:  50, // Ms. Dolon
  9344460:  55, // Mr. Brian Olsen
  13134669: 54,  // Mr. Bichu S Kumar
  12924725: 75,  // Mr. Gerard
  7992988:  72, // Mr. Gopi
  10639379: 53, // Mr. Kalyan
  6631240:  61, // Mr. Mustaq
  8838338:  76, // Mr. Naushad
  7722765:  66, // Mr. Prasenjith
  13611648: 56,  // Mr. Ramesh
  8111305:  3,  // Mr. Shreyas Lenkala -> Arunn
  12765565: 3,  // Mr. Surya Tiwari -> Arunn
  8509330:  3,  // Mr. Wajendra T -> Arunn
  8397933:  3,  // Ms. Aditi Tambe -> Arunn
  9584519:  69, // Ms. Aishwarya
  12748025: 51, // Ms. Anita Dominic
  7203343:  24, // Ms. Apoorva / Mercy Rani (Apoorva primary)
  11328467: 3,  // Ms. Lavanya -> Arunn
  5824683:  47, // Ms. Maya
  9886816:  30, // Ms. Mercy Rani
  12804136: 59, // Ms. Nalini Sharma
  4000884:  3,  // Ms. Sheela -> Arunn
  4056973:  23, // Ms. Shriti
  7129143:  3,  // Ms. Shriya B -> Arunn
  8255661:  3,  // Ms. Shweta -> Arunn
  7137621:  57, // Ms. Sivasankaree
  13204478: 3,  // Ms. Vasudha -> Arunn
  11083164: 71, // Ms. Vinayabala
  13821319: 3,  // SriAditya -> Arunn
  12585605: 52, // Sriilalit Narayana
  13222214: 3,  // Ms. Jisha Mani -> Arunn
  13518317: 3,  // Manisha Ubale -> Arunn
  13801030: 70,  // Mr. Goury Shankar
  12986707: 58,  // Ms. Shafia
};

// ── Appointment Type ID -> Platform Course ID ─────────────────────────────────
// null = skip (unmapped or generic type)

const APPOINTMENT_TYPE_COURSE_MAP: Record<number, number | null> = {
  // Computer Science / Programming
  57218677: 51,   // Middle School Computer Science → IB Computer Science
  54015900: 51,   // High School Computer Science → IB Computer Science
  61243720: 51,   // High School Computer Science - Free trial → IB Computer Science
  76604953: 21,   // Computer Programming - Python → Python Level 1
  84510036: 22,   // Computer Programming - Java → Java Programming for Beginners
  84052873: 69,   // AP Computer Science → AP Computer Science A

  // Math — Elementary (no matching course)
  14691452: null, // Elementary School Math - Private (US)
  14793473: null, // Elementary School Math - Free Trial
  26804440: null, // Elementary School Mathematics - CBSE/ICSE
  38753649: null, // Elementary School Mathematics - Free Trial CBSE
  38754939: null, // Elementary School Math - Free Trial (GCSE)
  38754970: null, // Elementary School Math - Private (GCSE)
  49843342: null, // Elementary School Math - Private (AUS)
  25031851: null, // Elementary School Math - Summer Course
  19017079: null, // Elementary School Math - Group Session

  // Math — Middle School
  71128291: 293,  // Middle School Math - Private (IG/IB) → Middle School Math Grade 7
  14474827: 293,  // Middle School Math - Private Session (US) → Middle School Math Grade 7

  // Math — High School
  71128121: 299,  // High School Math - Private (IG/IB) → High School Mathematics
  26804614: 299,  // High School Mathematics - Private (CBSE/ICSE/IG/IB/State) → High School Mathematics
  14691576: 299,  // High School Math - Private Session (US) → High School Mathematics

  // Math — AP / A Level
  71556848: 33,   // AP Calculus - Private Session → AP CALCULUS AB
  87502622: 33,   // AP Calculus - Free Trial → AP CALCULUS AB
  27561406: 251,  // A Level Math - Private Session → A Level Mathematics
  27561385: 251,  // A Level Math - Free Trial → A Level Mathematics

  // Math — Other
  59210772: null, // JEE - Mathematics

  // English — Elementary
  16723795: 115,  // Elementary School English - Free Trial (US) → Elementary level English
  16723876: 115,  // Elementary School English - Group Session (US) → Elementary level English
  24510098: 115,  // Elementary School English - Private (US) → Elementary level English
  27314309: 115,  // Elementary School English - Free Trial (CBSE/ICSE/IG/IB/State) → Elementary level English
  27314322: 115,  // Elementary School English - Private (CBSE/ICSE/IG/IB/State) → Elementary level English
  38755753: 115,  // Elementary School English - Free Trial (UK) → Elementary level English
  38755818: 115,  // Elementary School English - Private (UK) → Elementary level English
  49843317: 115,  // Elementary School English - Private (AUS) → Elementary level English
  31251347: 115,  // Elementary School English - Summer Course → Elementary level English

  // English — Middle School
  71170467: 114,  // Middle School English - Private (IG/IB) → Middle School English
  38757538: 114,  // Middle School English - Private Session (US) → Middle School English
  27314289: 114,  // Middle School English - Private Session (CBSE/ICSE/IG/IB/State) → Middle School English

  // English — High School
  71128100: 116,  // High School English - Private (IG/IB) → High School English
  38756951: 116,  // High School English - Private Session (US) → High School English

  // English — A Level
  30219038: 252,  // A Level English - Private Session → A Level English
  30219026: 252,  // A Level English - Free Trial → A Level English

  // English — AP / Test Prep
  88415090: 29,   // AP Language → AP Language
  34108709: 276,  // On-Demand English Private Tutoring → Spoken English
  55339864: 276,  // Spoken English - Private Sessions → Spoken English
  62762521: 276,  // Spoken English - Free Trial → Spoken English

  // SAT / ACT
  55339838: 25,   // Trial Lesson - Edkonnect Academy → SAT English
  40643350: 25,   // SAT Trial Lesson → SAT English
  19034374: 1,    // PSAT/SAT/ACT Math - Private Session → SAT Math
  14701559: 1,    // PSAT/SAT/ACT Math - Free Trial Session → SAT Math
  14792692: 25,   // PSAT/SAT/ACT English - Private Session → SAT English
  15690898: 25,   // PSAT/SAT/ACT English - Free Trial Session → SAT English

  // Business English / Spoken / IELTS / PTE
  25157139: 63,   // Business English - Private Session → Business English
  25157101: 63,   // Business English - Free Trial → Business English
  44199566: 63,   // Business/Technical Writing - Free Trial → Business English
  44199912: 63,   // Business/Technical Writing - Private → Business English
  48657229: 63,   // Business English - Private 30min → Business English
  37280049: 63,   // Business English - Private 2hr → Business English
  32458048: 63,   // Business English - Group Session → Business English
  80404280: 43,   // PTE Academics → Pearson Test of English- PTE Academic
  31263147: 41,   // IELTS/TOEFL - Private Session → IELTS General
  31263177: 41,   // IELTS/TOEFL - Free Trial → IELTS General

  // Science — High School Physics
  71128190: 84,   // High School Physics - Private (IG/IB) → AP Physics 1
  46157449: 84,   // High School Science - Private (GCSE) → AP Physics 1
  46157379: 84,   // High School Science - Free Trial (GCSE) → AP Physics 1
  56889632: null, // NEET - Physics (Free Trial)

  // Science — High School Biology
  71128157: 227,  // High School Biology - Private (IG/IB) → IB DP Biology
  35389384: 227,  // Biology - Private (CBSE/ICSE/IB/IG/State) → IB DP Biology
  35389295: 227,  // Biology - Free Trial (CBSE/ICSE/IB/IG/State) → IB DP Biology
  35389450: 227,  // Biology - Free Trial (US) → IB DP Biology
  35389891: 227,  // Biology - Private (US) → IB DP Biology
  48083214: 227,  // High School Biology - Private (GCSE) → IB DP Biology

  // Science — High School Chemistry
  71128144: 226,  // High School Chemistry - Private (IG/IB) → IB DP Chemistry
  28978757: 226,  // Chemistry - Private (CBSE/ICSE/IG/IB/State) → IB DP Chemistry
  28978734: 226,  // Chemistry - Free Trial (CBSE/ICSE/IG/IB/State) → IB DP Chemistry
  31913387: 226,  // Chemistry - Private (US) → IB DP Chemistry
  31913430: 226,  // Chemistry - Free Trial (US) → IB DP Chemistry
  40922081: 226,  // Chemistry Foundation Course → IB DP Chemistry

  // Science — Middle School
  71128249: 228,  // Middle School Science - Private (IG/IB) → IB DP ESS
  71170563: 226,  // Middle School Chemistry - Private (IG/IB) → IB DP Chemistry
  33654551: 228,  // Middle School Science - Private Session (CBSE/ICSE/IB/IG/State) → IB DP ESS

  // Hindi
  63049663: 255,  // High School Hindi → IB MYP 1 Hindi
  74079295: 255,  // Middle School Hindi → IB MYP 1 Hindi

  // Form courses (Malaysia/Singapore)
  39842697: 254,  // Form 6 - Free Trial → Form 6 Course
  39842708: 254,  // Form 6 - Private Sessions → Form 6 Course
  52027965: 253,  // Form 4 - Free Trial → Form 4 Course
  52027983: 253,  // Form 4 - Private Sessions → Form 4 Course

  // German
  46627128: 58,   // German A1 - Free Trial → German Language Course
  46627181: 58,   // German A1 - Private Session → German Language Course
  54274277: 58,   // German - Private Session → German Language Course
  54274313: 58,   // German - Free Trial → German Language Course

  // MBA / CAT / GRE / Other
  41024493: 118,  // MBA - PI → MBA - PI
  38819183: null, // CAT/XAT Prep - Private
  38819198: null, // CAT/XAT Prep - Free Trial
  40310481: null, // GRE/GMAT - Private
  40310452: null, // GRE/GMAT - Free Trial

  // AP / College (US) — too generic or no matching course
  37431356: null, // AP Course - Private (generic)
  37431358: null, // AP Course - Free Trial (generic)
  43468047: null, // College Courses - Private
  34033973: null, // College Counselling
  38087738: null, // College Courses - Free Trial
  35257646: null, // Summer Course - Basic Java

  // Board Exam Crash Course
  39814134: null, // Board Exam Crash Course - Free Trial
  39814142: null, // Board Exam Crash Course - Private 90min
  40615548: null, // Board Exam Crash Course - Private 60min
  40615562: null, // Board Exam Crash Course - Private 120min

  // Misc — skip
  31198809: null, // Additional half hour class
  78945546: null, // Parent-Tutor conference
  72851734: null, // High School Social Science
  72851975: null, // High School Social Science - Free Trial
  74022709: null, // Spanish - Free Trial
  74023161: null, // Middle School Spanish
};

// Types that are trial sessions
const TRIAL_APPOINTMENT_TYPES = new Set([40643350, 55339838]);

// ── Acuity API helpers ────────────────────────────────────────────────────────

function acuityAuthHeader(): string {
  return "Basic " + Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");
}

async function fetchAppointment(id: number): Promise<AcuityAppointment | null> {
  try {
    const res = await fetch(`https://acuityscheduling.com/api/v1/appointments/${id}`, {
      headers: { Authorization: acuityAuthHeader() },
    });
    if (!res.ok) return null;
    return res.json() as Promise<AcuityAppointment>;
  } catch {
    return null;
  }
}

// ── Signature verification ────────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", ACUITY_API_KEY)
    .update(rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AcuityAppointment = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  datetime: string;
  duration: string;
  calendarID: number;
  appointmentTypeID: number;
  location: string;
  canceled: boolean;
};

type AcuityWebhookBody = {
  action: string;
  id: number;
};

// ── Core upsert logic (shared by import script and webhook) ───────────────────

export async function upsertAcuityAppointment(apt: AcuityAppointment): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Acuity] Database not available");
    return;
  }

  const courseId = APPOINTMENT_TYPE_COURSE_MAP[apt.appointmentTypeID];
  // undefined means unknown type (not in map); null means explicitly skipped
  if (courseId === undefined || courseId === null) {
    // For trial types with no courseId, still try to insert if it's a known trial
    if (!TRIAL_APPOINTMENT_TYPES.has(apt.appointmentTypeID)) {
      console.log(`[Acuity] Skipping unmapped appointment type ${apt.appointmentTypeID}`);
      return;
    }
  }

  const tutorId = CALENDAR_TUTOR_MAP[apt.calendarID] ?? 3;
  const isTrial = TRIAL_APPOINTMENT_TYPES.has(apt.appointmentTypeID);
  const scheduledAt = new Date(apt.datetime).getTime();
  const duration = parseInt(apt.duration, 10) || 60;

  // Extract Zoom URL from location field
  const meetingUrlMatch = apt.location?.match(/URL:\s*(https?:\/\/[^\s]+)/);
  const meetingUrl = meetingUrlMatch ? meetingUrlMatch[1] : null;

  // Acuity may store multiple emails joined with ", " or "; " — split and try each
  const emailCandidates = apt.email
    .split(/[,;]/)
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0);

  let parentId: number | null = null;
  for (const emailCandidate of emailCandidates) {
    const parentRows = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${emailCandidate} AND ${users.role} = 'parent'`)
      .limit(1);
    if (parentRows.length > 0) {
      parentId = parentRows[0].id;
      break;
    }
  }

  if (parentId === null) {
    console.log(`[Acuity] No platform parent found for email(s) ${apt.email}, skipping`);
    return;
  }

  // Look up subscriptionId
  let subscriptionId: number | null = null;
  if (courseId !== null && courseId !== undefined) {
    const subRows = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        sql`${subscriptions.parentId} = ${parentId}
          AND ${subscriptions.courseId} = ${courseId}
          AND LOWER(${subscriptions.studentFirstName}) = LOWER(${apt.firstName})`
      )
      .limit(1);
    subscriptionId = subRows[0]?.id ?? null;
  }

  await db
    .insert(sessions)
    .values({
      parentId,
      tutorId,
      courseId: courseId ?? undefined,
      scheduledAt,
      duration,
      status: "scheduled",
      studentFirstName: apt.firstName,
      studentLastName: apt.lastName,
      meetingUrl,
      meetingPlatform: "Zoom",
      isTrial,
      subscriptionId: subscriptionId ?? undefined,
      acuityAppointmentId: String(apt.id),
    })
    .onDuplicateKeyUpdate({
      set: {
        scheduledAt,
        meetingUrl,
        tutorId,
        courseId: courseId ?? undefined,
        subscriptionId: subscriptionId ?? undefined,
        updatedAt: new Date(),
      },
    });

  console.log(`[Acuity] Upserted session for appointment ${apt.id} (${apt.email} / ${apt.firstName})`);
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function handleAcuityWebhook(req: Request, res: Response) {
  const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);
  const sig = req.headers["x-acuity-signature"] as string | undefined;

  if (!sig || !verifySignature(rawBody, sig)) {
    console.error("[Acuity Webhook] Invalid or missing signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Respond immediately so Acuity doesn't retry
  res.status(200).json({ received: true });

  let body: AcuityWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.error("[Acuity Webhook] Failed to parse body");
    return;
  }

  const { action, id } = body;
  console.log(`[Acuity Webhook] Received action=${action} id=${id}`);

  if (action === "canceled") {
    const db = await getDb();
    if (!db) return;
    await db
      .update(sessions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(sessions.acuityAppointmentId, String(id)));
    console.log(`[Acuity Webhook] Marked session cancelled for appointment ${id}`);
    return;
  }

  if (action === "scheduled" || action === "rescheduled" || action === "changed") {
    const apt = await fetchAppointment(id);
    if (!apt) {
      console.error(`[Acuity Webhook] Could not fetch appointment ${id}`);
      return;
    }
    if (apt.canceled) {
      console.log(`[Acuity Webhook] Appointment ${id} is canceled, skipping upsert`);
      return;
    }
    await upsertAcuityAppointment(apt);
    return;
  }

  console.log(`[Acuity Webhook] Unhandled action: ${action}`);
}
