import nodemailer from "nodemailer";
import ical, { ICalCalendar } from "ical-generator";
import * as db from "./db";
// Email configuration using built-in notification system
// Note: This uses console logging for development. In production, configure SMTP settings.
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASSWORD || "",
  },
});

export interface BookingConfirmationData {
  parentEmail: string;
  parentName: string;
  studentName: string;
  courseName: string;
  tutorName: string;
  tutorEmail?: string;
  sessionDate: Date;
  sessionDuration: number; // in minutes
  sessionNotes?: string;
  managementToken?: string; // Token for email-based booking management
}

/**
 * Generate calendar invite (.ics file) for the booking
 */
export function generateCalendarInvite(data: BookingConfirmationData): string {
  const calendar: ICalCalendar = ical({ name: "EdKonnect Session" });

  const endDate = new Date(data.sessionDate);
  endDate.setMinutes(endDate.getMinutes() + data.sessionDuration);

  calendar.createEvent({
    start: data.sessionDate,
    end: endDate,
    summary: `${data.courseName} - Tutoring Session`,
    description: `Tutoring session for ${data.studentName} with ${data.tutorName}.\n\nCourse: ${data.courseName}\n${data.sessionNotes ? `Notes: ${data.sessionNotes}` : ""}`,
    location: "Online",
    organizer: {
      name: "EdKonnect Academy",
      email: "noreply@edkonnect.com",
    },
    attendees: [
      {
        name: data.parentName,
        email: data.parentEmail,
        rsvp: true,
      },
      ...(data.tutorEmail
        ? [
            {
              name: data.tutorName,
              email: data.tutorEmail,
              rsvp: true,
            },
          ]
        : []),
    ],
  });

  return calendar.toString();
}

/**
 * Send booking confirmation email to parent
 */
/**
 * Send booking confirmation email to tutor
 */
export async function sendTutorBookingNotification(
  data: BookingConfirmationData
): Promise<boolean> {
  if (!data.tutorEmail) {
    console.warn('[Email Service] Tutor email not provided, skipping tutor notification');
    return false;
  }

  try {
    const settings = await db.getEmailSettings();
    const primaryColor = settings?.primaryColor || '#667eea';
    const accentColor = settings?.accentColor || '#764ba2';
    const companyName = settings?.companyName || 'EdKonnect Academy';
    const footerText = settings?.footerText || 'This is an automated message from EdKonnect Academy.';
    const supportEmail = settings?.supportEmail || 'support@edkonnect.com';
    const logoUrl = settings?.logoUrl;

    const calendarInvite = generateCalendarInvite(data);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e0e0e0;
      border-top: none;
    }
    .session-details {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #666;
    }
    .detail-value {
      color: #333;
    }
    .button {
      display: inline-block;
      background: ${primaryColor};
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;">` : ''}
    <h1>📚 New Session Booked</h1>
  </div>
  <div class="content">
    <p>Hi ${data.tutorName},</p>
    <p>A new tutoring session has been booked with you. Here are the details:</p>
    
    <div class="session-details">
      <div class="detail-row">
        <span class="detail-label">Student:</span>
        <span class="detail-value">${data.studentName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Parent:</span>
        <span class="detail-value">${data.parentName} (${data.parentEmail})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Course:</span>
        <span class="detail-value">${data.courseName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date & Time:</span>
        <span class="detail-value">${data.sessionDate.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value">${data.sessionDuration} minutes</span>
      </div>
      ${
        data.sessionNotes
          ? `
      <div class="detail-row">
        <span class="detail-label">Notes:</span>
        <span class="detail-value">${data.sessionNotes}</span>
      </div>
      `
          : ''
      }
    </div>

    <p><strong>📅 Calendar Invite:</strong> A calendar invite (.ics file) is attached to this email. Add it to your calendar so you don't miss the session.</p>

    <center>
      <a href="https://edkonnect.com/tutor/dashboard" class="button">View Dashboard</a>
    </center>

    <p>Please prepare any materials needed for this session and reach out to the parent if you have any questions.</p>
    
    <p>Best regards,<br>
    <strong>${companyName} Team</strong></p>
  </div>
  <div class="footer">
    <p>${footerText}<br>
    Questions? Contact us at <a href="mailto:${supportEmail}" style="color: ${accentColor};">${supportEmail}</a></p>
  </div>
</body>
</html>
    `;

    const emailText = `
New Session Booked

Hi ${data.tutorName},

A new tutoring session has been booked with you:

Student: ${data.studentName}
Parent: ${data.parentName} (${data.parentEmail})
Course: ${data.courseName}
Date & Time: ${data.sessionDate.toLocaleString()}
Duration: ${data.sessionDuration} minutes
${data.sessionNotes ? `Notes: ${data.sessionNotes}` : ''}

A calendar invite is attached to this email.

View your dashboard: https://edkonnect.com/tutor/dashboard

Best regards,
EdKonnect Academy Team
    `;

    await transporter.sendMail({
      from: `"${companyName}" <noreply@edkonnect.com>`,
      to: data.tutorEmail,
      subject: `New Session: ${data.courseName} on ${data.sessionDate.toLocaleDateString()}`,
      text: emailText,
      html: emailHtml,
      icalEvent: {
        filename: 'session-invite.ics',
        method: 'REQUEST',
        content: calendarInvite,
      },
    });

    console.log(`[Email Service] Sent tutor notification to ${data.tutorEmail}`);
    return true;
  } catch (error) {
    console.error('[Email Service] Failed to send tutor notification:', error);
    return false;
  }
}

/**
 * Send booking confirmation email to parent
 */
export async function sendBookingConfirmationEmail(
  data: BookingConfirmationData
): Promise<boolean> {
  try {
    // Fetch email settings from database
    const settings = await db.getEmailSettings();
    const primaryColor = settings?.primaryColor || "#667eea";
    const accentColor = settings?.accentColor || "#764ba2";
    const companyName = settings?.companyName || "EdKonnect Academy";
    const footerText = settings?.footerText || "This is an automated message from EdKonnect Academy.";
    const supportEmail = settings?.supportEmail || "support@edkonnect.com";
    const logoUrl = settings?.logoUrl;

    const calendarInvite = generateCalendarInvite(data);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      background: #ffffff;
      padding: 30px;
      border: 1px solid #e0e0e0;
      border-top: none;
    }
    .session-details {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #666;
    }
    .detail-value {
      color: #333;
    }
    .button {
      display: inline-block;
      background: ${primaryColor};
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;">` : ""}
    <h1>🎓 Session Confirmed!</h1>
  </div>
  <div class="content">
    <p>Hi ${data.parentName},</p>
    <p>Great news! Your tutoring session has been successfully booked. Here are the details:</p>
    
    <div class="session-details">
      <div class="detail-row">
        <span class="detail-label">Student:</span>
        <span class="detail-value">${data.studentName}</span>
      </div>
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
        <span class="detail-value">${data.sessionDate.toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Duration:</span>
        <span class="detail-value">${data.sessionDuration} minutes</span>
      </div>
      ${
        data.sessionNotes
          ? `
      <div class="detail-row">
        <span class="detail-label">Notes:</span>
        <span class="detail-value">${data.sessionNotes}</span>
      </div>
      `
          : ""
      }
    </div>

    <p><strong>📅 Calendar Invite:</strong> A calendar invite (.ics file) is attached to this email. Click on it to add this session to your calendar.</p>

    ${data.managementToken ? `
    <p><strong>Need to make changes?</strong> You can reschedule or cancel this session directly:</p>
    <center>
      <a href="${process.env.VITE_FRONTEND_FORGE_API_URL?.replace('/api', '')}/manage-booking/${data.managementToken}" class="button">Manage Booking</a>
    </center>
    <p style="text-align: center; margin-top: 10px;"><small>Or view your <a href="https://edkonnect.com/parent/dashboard" style="color: ${accentColor};">dashboard</a></small></p>
    ` : `
    <p>If you need to reschedule or cancel this session, please log in to your dashboard or contact us directly.</p>
    <center>
      <a href="https://edkonnect.com/parent/dashboard" class="button">View Dashboard</a>
    </center>
    `}

    <p>We're excited to help ${data.studentName} succeed!</p>
    
    <p>Best regards,<br>
    <strong>${companyName} Team</strong></p>
  </div>
  <div class="footer">
    <p>${footerText}<br>
    Questions? Contact us at <a href="mailto:${supportEmail}" style="color: ${accentColor};">${supportEmail}</a></p>
  </div>
</body>
</html>
    `;

    const emailText = `
Session Confirmed!

Hi ${data.parentName},

Your tutoring session has been successfully booked:

Student: ${data.studentName}
Course: ${data.courseName}
Tutor: ${data.tutorName}
Date & Time: ${data.sessionDate.toLocaleString()}
Duration: ${data.sessionDuration} minutes
${data.sessionNotes ? `Notes: ${data.sessionNotes}` : ""}

A calendar invite is attached to this email.

View your dashboard: https://edkonnect.com/parent/dashboard

Best regards,
EdKonnect Academy Team
    `;

    await transporter.sendMail({
      from: `"${companyName}" <noreply@edkonnect.com>`,
      to: data.parentEmail,
      subject: `Session Confirmed: ${data.courseName} on ${data.sessionDate.toLocaleDateString()}`,
      text: emailText,
      html: emailHtml,
      icalEvent: {
        filename: "session-invite.ics",
        method: "REQUEST",
        content: calendarInvite,
      },
    });

    return true;
  } catch (error) {
    console.error("[Email Service] Failed to send booking confirmation:", error);
    return false;
  }
}
