import nodemailer from "nodemailer";
import * as db from "../db";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "noreply@edkonnect.com",
    pass: "", // Configure in production
  },
});

export interface CancellationConfirmationData {
  parentEmail: string;
  parentName: string;
  studentName: string;
  courseName: string;
  tutorName: string;
  sessionDate: Date;
  sessionDuration: number;
}

/**
 * Send cancellation confirmation email to parent
 */
export async function sendCancellationConfirmationEmail(
  data: CancellationConfirmationData
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
    .alert {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-width: 150px; max-height: 60px; margin-bottom: 15px;">` : ""}
    <h1>❌ Session Cancelled</h1>
  </div>
  <div class="content">
    <p>Hi ${data.parentName},</p>
    <p>This email confirms that your tutoring session has been cancelled as requested.</p>
    
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
        <span class="detail-label">Original Date & Time:</span>
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
    </div>

    <div class="alert">
      <p style="margin: 0;"><strong>⚠️ Important:</strong> This cancellation has been processed. If you need to book a new session, please visit your dashboard.</p>
    </div>

    <center>
      <a href="https://edkonnect.com/parent/dashboard" class="button">Go to Dashboard</a>
    </center>

    <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
    
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
Session Cancelled

Hi ${data.parentName},

Your tutoring session has been cancelled as requested:

Student: ${data.studentName}
Course: ${data.courseName}
Tutor: ${data.tutorName}
Original Date & Time: ${data.sessionDate.toLocaleString()}
Duration: ${data.sessionDuration} minutes

If you need to book a new session, please visit your dashboard: https://edkonnect.com/parent/dashboard

Best regards,
${companyName} Team
    `;

    await transporter.sendMail({
      from: `"${companyName}" <noreply@edkonnect.com>`,
      to: data.parentEmail,
      subject: `Session Cancelled: ${data.courseName} on ${data.sessionDate.toLocaleDateString()}`,
      text: emailText,
      html: emailHtml,
    });

    return true;
  } catch (error) {
    console.error("[Email Service] Failed to send cancellation confirmation:", error);
    return false;
  }
}
