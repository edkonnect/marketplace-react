/**
 * Free Trial SAT registration (public, no login).
 * Standalone Express router. Saves the submission to its own table,
 * emails it to admin, and sends a confirmation email to the parent.
 * Mounted at /api/free-trial
 */
import { Router } from "express";
import { z } from "zod";
import { emailService } from "../../emails/email-service";
import { RateLimiter } from "../../faq/chatbot-rate-limiter";
import { getDb } from "../../db";
import { freeTrialRequests } from "../../../drizzle/schema";

const ADMIN_EMAIL = "admin@edkonnect-academy.com";

// 5 submissions per IP per 10 minutes
const limiter = new RateLimiter(10 * 60 * 1000, 5);

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// "2026-10-17" -> "Saturday, October 17, 2026" (UTC so the day never shifts)
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

const schema = z.object({
  parentName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional(),
  students: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        grade: z.string().trim().min(1).max(50),
      })
    )
    .min(1)
    .max(10),
  timezone: z.string().trim().min(1).max(100),
  trialDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Honeypot: hidden field, real users leave it empty
  website: z.string().optional(),
});

export const freeTrialRouter = Router();

freeTrialRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Please check the form and try again." });
  }
  const input = parsed.data;

  // Bots fill the honeypot: pretend success, save and send nothing
  if (input.website) return res.json({ success: true });

  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ??
    req.socket?.remoteAddress ??
    "unknown";

  if (!limiter.check(ip)) {
    return res
      .status(429)
      .json({ error: "Too many requests. Please try again in a few minutes." });
  }

  // 1) Save to DB (a failure here is logged but doesn't block the email)
  let saved = false;
  try {
    const db = await getDb();
    if (db) {
      await db.insert(freeTrialRequests).values({
        parentName: input.parentName,
        email: input.email,
        phone: input.phone || null,
        students: JSON.stringify(input.students),
        timezone: input.timezone,
        trialDate: input.trialDate,
      });
      saved = true;
    }
  } catch (error) {
    console.error("[FreeTrial] Failed to save to DB:", error);
  }

  // 2) Email admin
  const cell = "padding:6px 12px;border:1px solid #ddd;";
  const studentRows = input.students
    .map(
      (s, i) =>
        `<tr><td style="${cell}">${i + 1}</td>` +
        `<td style="${cell}">${escapeHtml(s.name)}</td>` +
        `<td style="${cell}">${escapeHtml(s.grade)}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#222;">
      <h2>New Free Trial SAT Registration</h2>
      <p><strong>Parent:</strong> ${escapeHtml(input.parentName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
      <p><strong>Phone:</strong> ${input.phone ? escapeHtml(input.phone) : "-"}</p>
      <p><strong>Time zone:</strong> ${escapeHtml(input.timezone)}</p>
      <p><strong>Course start date:</strong> ${escapeHtml(formatDate(input.trialDate))}</p>
      <table style="border-collapse:collapse;margin-top:8px;">
        <tr>
          <th style="${cell}">#</th>
          <th style="${cell}">Student</th>
          <th style="${cell}">Grade</th>
        </tr>
        ${studentRows}
      </table>
    </div>`;

  await emailService.ready();
  const sent = await emailService.sendEmail({
    to: ADMIN_EMAIL,
    subject: `Free Trial SAT Registration - ${input.parentName}`,
    html,
  });

  // Fail only if BOTH the save and the admin email failed
  if (!sent && !saved) {
    return res
      .status(500)
      .json({ error: "Could not submit your request. Please try again." });
  }

  // 3) Confirmation email to the parent (a failure here never fails the request)
  try {
    const dateLabel = formatDate(input.trialDate);
    const studentList = input.students
      .map((s) => `<li>${escapeHtml(s.name)} (Grade ${escapeHtml(s.grade)})</li>`)
      .join("");

    const parentHtml = `
      <div style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:560px;">
        <h2 style="color:#0b5cc4;">Thank you for registering!</h2>
        <p>Hi ${escapeHtml(input.parentName)},</p>
        <p>Thank you for signing up for a free trial lesson of the SAT with EdKonnect Academy.</p>
        <p>
          <strong>Your requested session time is:</strong><br />
          ${escapeHtml(dateLabel)}<br />
          <span style="color:#555;">Time zone: ${escapeHtml(input.timezone)}</span>
        </p>
        <p><strong>Student(s):</strong></p>
        <ul>${studentList}</ul>
        <p>Our team will contact you shortly with the exact time and joining details.</p>
        <p>If you have any questions, just reply to this email or write to
          <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a>.</p>
        <p>Warm regards,<br />EdKonnect Academy</p>
      </div>`;

    await emailService.sendEmail({
      to: input.email,
      subject: `Your Free SAT Trial Lesson - ${dateLabel}`,
      html: parentHtml,
    });
  } catch (error) {
    console.error("[FreeTrial] Failed to send parent confirmation:", error);
  }

  return res.json({ success: true });
});