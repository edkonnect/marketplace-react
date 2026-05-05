import { emailService } from "./email-service";
import * as db from "./db";

export async function sendSessionNotesReminders() {
  console.log("[SessionNotesReminder] Starting daily session notes reminder job...");

  try {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const sessions = await db.getAllSessionsWithDetails();

    const missingSessions = sessions.filter(s => {
      const isCompleted = s.status === "completed";
      const noNotes = !s.feedbackFromTutor || s.feedbackFromTutor.trim() === "";
      const isOldEnough = s.scheduledAt < oneDayAgo;
      return isCompleted && noNotes && isOldEnough;
    });

    if (missingSessions.length === 0) {
      console.log("[SessionNotesReminder] No sessions missing notes.");
      return;
    }

    const byTutor = new Map<string, { tutorName: string; tutorEmail: string; sessions: typeof missingSessions }>();
    for (const s of missingSessions) {
      const email = s.tutorEmail;
      const name = s.tutorName || "Tutor";
      if (!email) continue;
      if (s.tutorRole && s.tutorRole !== "tutor") continue;
      if (!byTutor.has(email)) byTutor.set(email, { tutorName: name, tutorEmail: email, sessions: [] });
      byTutor.get(email)!.sessions.push(s);
    }

    console.log(`[SessionNotesReminder] ${missingSessions.length} sessions missing notes across ${byTutor.size} tutor(s)`);

    for (const [tutorEmail, { tutorName, sessions: tutorSessions }] of byTutor) {
      const sessionRows = tutorSessions.map(s => {
        const date = new Date(s.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const student = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ") || "Student";
        const course = s.courseTitle || "—";
        return `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${date}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${student}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">${course}</td></tr>`;
      }).join("");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:'Segoe UI',sans-serif;background:#f5f5f5;"><table style="width:100%;"><tr><td align="center" style="padding:40px 0;"><table style="width:600px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.1);"><tr><td style="padding:32px 40px;background:linear-gradient(135deg,#2563eb,#10b981);text-align:center;"><h1 style="margin:0;color:#fff;font-size:24px;">EdKonnect Academy</h1><p style="margin:10px 0 0;color:#e0f2fe;font-size:16px;">Session Notes Reminder</p></td></tr><tr><td style="padding:32px 40px;"><p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${tutorName},</p><p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">This is a reminder that you have <strong>${tutorSessions.length} session${tutorSessions.length > 1 ? "s" : ""}</strong> with missing notes. Please complete them so parents stay informed.</p><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;"><thead><tr style="background:#f3f4f6;"><th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Date</th><th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Student</th><th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;">Course</th></tr></thead><tbody>${sessionRows}</tbody></table><p style="margin:24px 0 0;font-size:14px;color:#6b7280;">You will receive this reminder daily until all notes are completed.</p></td></tr><tr><td style="padding:0 40px 32px;text-align:center;"><a href="https://edkonnect-academy.com/tutor/sessions" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">Complete Session Notes</a></td></tr><tr><td style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;"><p style="margin:0;font-size:13px;color:#9ca3af;">© ${new Date().getFullYear()} EdKonnect Academy</p><p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">Questions? <a href="mailto:admin@edkonnect.com" style="color:#2563eb;">admin@edkonnect.com</a></p></td></tr></table></td></tr></table></body></html>`;

      const sent = await emailService.sendEmail({
        to: tutorEmail,
        cc: "admin@edkonnect-academy.com",
        subject: `Reminder: ${tutorSessions.length} Session Note${tutorSessions.length > 1 ? "s" : ""} Pending — EdKonnect Academy`,
        html,
      });

      if (sent) console.log(`[SessionNotesReminder] Sent to ${tutorName} (${tutorEmail})`);
      else console.error(`[SessionNotesReminder] Failed to send to ${tutorEmail}`);
    }

    console.log("[SessionNotesReminder] Done.");
  } catch (err: any) {
    console.error("[SessionNotesReminder] Error:", err?.message);
  }
}
