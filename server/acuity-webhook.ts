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
import { splitEmails } from "./acuity-maps";
import { upsertAcuitySession, type AcuityAppt, type AcuityLookups } from "./acuity-upsert";

const ACUITY_USER_ID = process.env.ACUITY_USER_ID!;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY!;

// Calendar→tutor and appointment-type→course maps now live in ./acuity-maps
// (single source of truth shared with the polling sync). See acuity-maps.ts.

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

  // Build single-appointment lookups (parent email + matching subscription) and
  // delegate to the shared upsert so webhook + polling sync produce identical rows.
  const parentEmailToId: Record<string, number> = {};
  for (const email of splitEmails(apt.email)) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${email} AND ${users.role} = 'parent'`)
      .limit(1);
    if (rows.length > 0) parentEmailToId[email] = rows[0].id;
  }

  const subByParentCourseStudent: Record<string, number> = {};
  const parentId = Object.values(parentEmailToId)[0];
  if (parentId) {
    const subRows = await db
      .select({ id: subscriptions.id, courseId: subscriptions.courseId, studentFirstName: subscriptions.studentFirstName })
      .from(subscriptions)
      .where(sql`${subscriptions.parentId} = ${parentId}`);
    for (const s of subRows) {
      const student = (s.studentFirstName || "").trim().toLowerCase();
      if (!student) continue;
      subByParentCourseStudent[`${parentId}-${s.courseId}-${student}`] = s.id;
    }
  }

  const lookups: AcuityLookups = { parentEmailToId, subByParentCourseStudent };
  const result = await upsertAcuitySession(db, apt as AcuityAppt, lookups);

  if (!result.ok) {
    console.log(`[Acuity] Skipped appointment ${apt.id} — ${result.reason}`);
    return;
  }
  console.log(`[Acuity] ${result.action} session for appointment ${apt.id} (${apt.email} / ${apt.firstName})`);
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
