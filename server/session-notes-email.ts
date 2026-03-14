import { getEmailSettings } from "./db";

interface SessionNotesEmailData {
  parentName: string;
  studentName: string;
  tutorName: string;
  courseName: string;
  sessionDate: string;
  sessionTime: string;
  progressSummary: string;
  homework?: string;
  challenges?: string;
  nextSteps?: string;
  notesUrl: string;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
  }>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export async function sendSessionNotesEmail(data: SessionNotesEmailData): Promise<string> {
  const settings = await getEmailSettings();
  
  const companyName = settings?.companyName || "TutorConnect";
  const primaryColor = settings?.primaryColor || "#2563eb";
  const accentColor = settings?.accentColor || "#10b981";
  const logoUrl = settings?.logoUrl || "";
  const supportEmail = settings?.supportEmail || "support@tutorconnect.com";
  const footerText = settings?.footerText || `© ${new Date().getFullYear()} ${companyName}. All rights reserved.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Notes from ${data.tutorName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%);">
              ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-width: 150px; height: auto; margin-bottom: 20px;">` : `<h1 style="margin: 0; color: #ffffff; font-size: 28px;">${companyName}</h1>`}
              <h2 style="margin: 20px 0 0 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                📝 New Session Notes
              </h2>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi ${data.parentName},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                ${data.tutorName} has submitted session notes for your child. Here's a summary of the session:
              </p>
              <!-- Session Details Card -->
              <div style="background-color: #f0f4ff; border-radius: 8px; padding: 20px; margin-bottom: 10px;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #666666; width: 40%;">Student</td>
                    <td style="padding: 6px 0; font-size: 14px; color: #111111; font-weight: 600;">${data.studentName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #666666;">Course</td>
                    <td style="padding: 6px 0; font-size: 14px; color: #111111; font-weight: 600;">${data.courseName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #666666;">Tutor</td>
                    <td style="padding: 6px 0; font-size: 14px; color: #111111; font-weight: 600;">${data.tutorName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #666666;">Date</td>
                    <td style="padding: 6px 0; font-size: 14px; color: #111111; font-weight: 600;">${data.sessionDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 14px; color: #666666;">Time</td>
                    <td style="padding: 6px 0; font-size: 14px; color: #111111; font-weight: 600;">${data.sessionTime}</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Progress Summary -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <div style="background-color: #f8f9fa; border-left: 4px solid ${accentColor}; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: ${primaryColor}; font-size: 18px; font-weight: 600;">
                  📈 Progress Summary
                </h3>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #555555; white-space: pre-wrap;">
                  ${data.progressSummary}
                </p>
              </div>
            </td>
          </tr>

          ${data.homework ? `
          <!-- Homework -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <div style="background-color: #f8f9fa; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #3b82f6; font-size: 18px; font-weight: 600;">
                  📚 Homework Assigned
                </h3>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #555555; white-space: pre-wrap;">
                  ${data.homework}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          ${data.challenges ? `
          <!-- Challenges -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <div style="background-color: #fff7ed; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #f59e0b; font-size: 18px; font-weight: 600;">
                  ⚠️ Challenges & Areas for Improvement
                </h3>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #555555; white-space: pre-wrap;">
                  ${data.challenges}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          ${data.nextSteps ? `
          <!-- Next Steps -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <div style="background-color: #f0fdf4; border-left: 4px solid #8b5cf6; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #8b5cf6; font-size: 18px; font-weight: 600;">
                  🎯 Next Steps & Recommendations
                </h3>
                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #555555; white-space: pre-wrap;">
                  ${data.nextSteps}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          ${data.attachments && data.attachments.length > 0 ? `
          <!-- Attachments -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <div style="background-color: #f8f9fa; border-left: 4px solid ${accentColor}; padding: 20px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 15px 0; color: ${primaryColor}; font-size: 18px; font-weight: 600;">
                  📎 Attached Files (${data.attachments.length})
                </h3>
                ${data.attachments.map(att => `
                  <div style="margin: 8px 0; padding: 12px; background-color: white; border-radius: 6px; border: 1px solid #e0e0e0;">
                    <a href="${att.fileUrl}" style="color: ${primaryColor}; text-decoration: none; font-size: 15px; display: block; font-weight: 500;">
                      📄 ${att.fileName}
                      <span style="color: #666666; font-size: 13px; margin-left: 8px; font-weight: normal;">(${formatFileSize(att.fileSize)})</span>
                    </a>
                  </div>
                `).join('')}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 20px 40px 40px 40px; text-align: center;">
              <a href="${data.notesUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View All Session Notes
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666; text-align: center;">
                ${footerText}
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999; text-align: center;">
                Questions? Contact us at <a href="mailto:${supportEmail}" style="color: ${primaryColor}; text-decoration: none;">${supportEmail}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
