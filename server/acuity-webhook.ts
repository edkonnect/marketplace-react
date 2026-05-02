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
  9344460:  3,  // Mr. Ashwin Siva (Arunn)
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
  57218677: null, // Middle School Computer Science (no platform mapping)
  71128100: 116,  // High School English (IG/IB)
  71128121: 274,  // High School Math (IG/IB)
  71128144: 154,  // High School Chemistry (IG/IB)
  71128157: 162,  // High School Biology (IG/IB)
  71128190: 157,  // High School Physics (IG/IB)
  71128249: 124,  // Middle School Science (IG/IB)
  71128291: 4,    // Middle School Math (IG/IB)
  71170467: 114,  // Middle School English (IG/IB)
  71170563: 220,  // Middle School Chemistry (IG/IB)
  71556848: 33,   // AP Calculus
  76604953: 12,   // Computer Programming - Python
  84052873: 201,   // AP Computer Science
  84510036: 22,   // Computer Programming - Java
  88415090: 29,   // AP Language
  37431356: null,   // AP Course - Private Session
  54015900: 51,   // High School Computer Science
  28978757: 154,  // Chemistry - Private Session
  35389384: 162,  // Biology - Private Session
  27314322: 115,  // Elementary School English (CBSE/ICSE/IG/IB/State)
  24510098: 115,  // Elementary School English - Private Session (US)
  14691452: 4,    // Elementary School Math - Private Session (US)
  26804440: 4,    // Elementary School Mathematics (CBSE/ICSE/IG/IB/State)
  55339864: 276,  // Spoken English - Private Sessions
  34108709: 25,   // On-Demand English Private Tutoring
  63049663: 179,  // High School Hindi 
  74079295: 176,  // Middle School Hindi
  27561406: 251,  // A Level Math - Private Session
  30219038: 252,  // A Level English - Private Session
  31263147: 42,  // IELTS/TOEFL - Private Session
  14792692: 25,   // PSAT/SAT/ACT English - Private Session
  19034374: 1,    // PSAT/SAT/ACT Math - Private Session
  87525059: 68,   // AP - Statistics
  38756951: 116,  // High School English - Private Session (US)
  14691576: 274,  // High School Math - Private Session (US)
  26804614: 150,  // High School Mathematics - Private Session (CBSE/ICSE/IG/IB/State)
  27314289: 141,  // Middle School English - Private Session (CBSE/ICSE/IG/IB/State)
  38757538: 114,  // Middle School English - Private Session (US)
  14474827: 4,    // Middle School Math - Private Session (US)
  33654551: 124,  // Middle School Science - Private Session (CBSE/ICSE/IB/IG/State)
  40643350: 1,    // SAT Trial Lesson (isTrial=true)
  55339838: null, // Trial Lesson - Edkonnect Academy (isTrial only, no courseId)
  31198809: null, // Additional half hour class — skip
  78945546: null, // Parent-Tutor conference — skip
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

  // Look up parentId (must be one of our 63 migrated parents, id 81–143)
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
      .where(sql`LOWER(${users.email}) = ${emailCandidate} AND ${users.id} BETWEEN 81 AND 143`)
      .limit(1);
    if (parentRows.length > 0) {
      parentId = parentRows[0].id;
      break;
    }
  }

  if (parentId === null) {
    console.log(`[Acuity] No migrated parent found for email(s) ${apt.email}, skipping`);
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
