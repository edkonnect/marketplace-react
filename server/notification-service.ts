import * as db from "./db";
import { emailService } from "./emails/email-service";

/**
 * Send session reminder notifications based on user preferences
 * This should be called periodically (e.g., every 5 minutes) by a cron job or scheduler
 */
export async function sendSessionReminders() {
  console.log("[Notification Service] Checking for upcoming sessions...");

  const timings = [
    { minutes: 24 * 60, key: "timing24h", label: "24 hours" },
    { minutes: 60, key: "timing1h", label: "1 hour" },
    { minutes: 15, key: "timing15min", label: "15 minutes" },
  ];

  for (const timing of timings) {
    try {
      const sessions = await db.getUpcomingSessionsForNotifications(timing.minutes);
      
      for (const sessionData of sessions) {
        const { session, parent, tutor, course } = sessionData;
        
        // Get parent's notification preferences
        const prefs = await db.getNotificationPreferences(parent.id);
        
        // Skip if user has disabled this timing
        if (prefs && !prefs[timing.key as keyof typeof prefs]) {
          continue;
        }

        const sessionDate = new Date(Number(session.scheduledAt));
        const message = `Your tutoring session ${course ? `for ${course.title} ` : ""}with ${tutor.name} is scheduled for ${sessionDate.toLocaleString()}.`;

        // Send in-app notification
        if (!prefs || prefs.inAppEnabled) {
          await db.createInAppNotification({
            userId: parent.id,
            title: `Session Reminder - ${timing.label}`,
            message,
            type: "session_reminder",
            relatedId: session.id,
            isRead: false,
          });

          await db.createNotificationLog({
            userId: parent.id,
            sessionId: session.id,
            channel: "in_app",
            timing: timing.key.replace("timing", ""),
            status: "sent",
            message,
          });
        }

        // Send email notification
        if (!prefs || prefs.emailEnabled) {
          try {
            await emailService.sendEmail({
              to: parent.email!,
              subject: `Session Reminder - ${timing.label}`,
              html: generateReminderEmail({
                parentName: parent.name || "Parent",
                tutorName: tutor.name || "Your tutor",
                courseName: course?.title || "Tutoring session",
                sessionDate: sessionDate.toLocaleString(),
                timing: timing.label,
              }),
            });

            await db.createNotificationLog({
              userId: parent.id,
              sessionId: session.id,
              channel: "email",
              timing: timing.key.replace("timing", ""),
              status: "sent",
              message,
            });
          } catch (error) {
            console.error("[Notification Service] Failed to send email:", error);
            await db.createNotificationLog({
              userId: parent.id,
              sessionId: session.id,
              channel: "email",
              timing: timing.key.replace("timing", ""),
              status: "failed",
              message: `Failed to send: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        // SMS notifications (placeholder - would need Twilio integration)
        if (prefs && prefs.smsEnabled) {
          console.log("[Notification Service] SMS not implemented yet");
          await db.createNotificationLog({
            userId: parent.id,
            sessionId: session.id,
            channel: "sms",
            timing: timing.key.replace("timing", ""),
            status: "pending",
            message: "SMS integration not implemented",
          });
        }
      }

      console.log(`[Notification Service] Processed ${sessions.length} sessions for ${timing.label} reminders`);
    } catch (error) {
      console.error(`[Notification Service] Error processing ${timing.label} reminders:`, error);
    }
  }
}

function generateReminderEmail(data: {
  parentName: string;
  tutorName: string;
  courseName: string;
  sessionDate: string;
  timing: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .session-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; color: #6b7280; }
        .detail-value { color: #111827; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Session Reminder</h1>
          <p>${data.timing} until your session</p>
        </div>
        <div class="content">
          <p>Hi ${data.parentName},</p>
          <p>This is a friendly reminder about your upcoming tutoring session.</p>
          
          <div class="session-details">
            <div class="detail-row">
              <span class="detail-label">Course:</span>
              <span class="detail-value">${data.courseName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Tutor:</span>
              <span class="detail-value">${data.tutorName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date & Time:</span>
              <span class="detail-value">${data.sessionDate}</span>
            </div>
          </div>

          <p>Please make sure you're ready for the session. If you need to reschedule or cancel, please do so as soon as possible.</p>
          
          <div class="footer">
            <p>You're receiving this email because you have session reminders enabled.</p>
            <p>To change your notification preferences, visit your dashboard settings.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
