/**
 * Free Trial SAT registration (public, no login).
 * Standalone Express router. Emails the submission to admin.
 * Mounted at /api/free-trial
 */
import { Router } from "express";
import { z } from "zod";
import { emailService } from "../../emails/email-service";
import { RateLimiter } from "../../faq/chatbot-rate-limiter";

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

  // Bots fill the honeypot: pretend success, send nothing
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
      <p><strong>Preferred trial date:</strong> ${escapeHtml(input.trialDate)}</p>
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

  if (!sent) {
    return res
      .status(500)
      .json({ error: "Could not submit your request. Please try again." });
  }

  return res.json({ success: true });
});