/**
 * Email Templates for EdKonnect Academy
 * Professional, responsive HTML email templates with consistent branding
 */

interface EmailBaseProps {
  preheaderText?: string;
}

/**
 * Base email layout with EdKonnect Academy branding
 * Responsive design that works across all email clients
 */
export function getEmailBase(content: string, props: EmailBaseProps = {}): string {
  const { preheaderText = '' } = props;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>EdKonnect Academy</title>
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    
    /* Base styles */
    body {
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #374151;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      padding: 32px 24px;
      text-align: center;
    }
    
    .logo {
      color: #ffffff;
      font-size: 28px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    
    .content {
      padding: 40px 24px;
    }
    
    .footer {
      background-color: #f9fafb;
      padding: 32px 24px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-text {
      font-size: 14px;
      color: #6b7280;
      margin: 8px 0;
    }
    
    .footer-links {
      margin: 16px 0;
    }
    
    .footer-link {
      color: #3b82f6;
      text-decoration: none;
      margin: 0 12px;
      font-size: 14px;
    }
    
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #3b82f6;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 16px 0;
    }
    
    .button:hover {
      background-color: #2563eb;
    }
    
    h1 {
      color: #111827;
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    
    h2 {
      color: #111827;
      font-size: 22px;
      font-weight: 600;
      margin: 24px 0 12px 0;
    }
    
    p {
      margin: 0 0 16px 0;
      color: #374151;
    }
    
    .highlight-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 32px 0;
    }
    
    /* Responsive */
    @media only screen and (max-width: 600px) {
      .content {
        padding: 24px 16px !important;
      }
      .header {
        padding: 24px 16px !important;
      }
      .footer {
        padding: 24px 16px !important;
      }
      h1 {
        font-size: 24px !important;
      }
    }
  </style>
</head>
<body>
  ${preheaderText ? `<div style="display: none; max-height: 0; overflow: hidden;">${preheaderText}</div>` : ''}
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="padding: 24px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="email-container">
          <!-- Header -->
          <tr>
            <td class="header">
              <div class="logo">
                🎓 EdKonnect Academy
              </div>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer">
              <p class="footer-text" style="font-weight: 600; color: #111827; margin-bottom: 12px;">EdKonnect Academy</p>
              <p class="footer-text">Connecting parents and tutors for personalized learning</p>
              
              <div class="footer-links">
                <a href="${process.env.VITE_FRONTEND_FORGE_API_URL || 'https://edkonnect.academy'}" class="footer-link">Home</a>
                <a href="${process.env.VITE_FRONTEND_FORGE_API_URL || 'https://edkonnect.academy'}/tutors" class="footer-link">Find Tutors</a>
                <a href="${process.env.VITE_FRONTEND_FORGE_API_URL || 'https://edkonnect.academy'}/courses" class="footer-link">Browse Courses</a>
              </div>
              
              <p class="footer-text" style="margin-top: 24px; font-size: 12px;">
                © ${new Date().getFullYear()} EdKonnect Academy. All rights reserved.
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

interface WelcomeEmailProps {
  userName: string;
  userRole: 'parent' | 'tutor';
  dashboardUrl: string;
}

interface EmailVerificationProps {
  userName: string;
  verificationUrl: string;
  expiresAt: Date;
}

/**
 * Welcome email template for new users
 */
export function getWelcomeEmail(props: WelcomeEmailProps): string {
  const { userName, userRole, dashboardUrl } = props;
  
  const roleSpecificContent = userRole === 'parent' 
    ? `
      <p>As a parent on EdKonnect Academy, you can:</p>
      <ul style="margin: 16px 0; padding-left: 24px;">
        <li style="margin-bottom: 8px;">Browse and connect with qualified tutors</li>
        <li style="margin-bottom: 8px;">Explore courses across multiple subjects and grade levels</li>
        <li style="margin-bottom: 8px;">Schedule one-on-one tutoring sessions</li>
        <li style="margin-bottom: 8px;">Track your child's progress and session history</li>
        <li style="margin-bottom: 8px;">Communicate directly with tutors through our messaging platform</li>
      </ul>
    `
    : `
      <p>As a tutor on EdKonnect Academy, you can:</p>
      <ul style="margin: 16px 0; padding-left: 24px;">
        <li style="margin-bottom: 8px;">Create and manage your tutoring courses</li>
        <li style="margin-bottom: 8px;">Set your availability and hourly rates</li>
        <li style="margin-bottom: 8px;">Connect with parents seeking quality education</li>
        <li style="margin-bottom: 8px;">Manage bookings and track your earnings</li>
        <li style="margin-bottom: 8px;">Build meaningful relationships with students and families</li>
      </ul>
    `;
  
  const content = `
    <h1>Welcome to EdKonnect Academy! 🎓</h1>
    
    <p>Hi ${userName},</p>
    
    <p>We're thrilled to have you join our community of dedicated parents and qualified tutors committed to personalized learning excellence.</p>
    
    ${roleSpecificContent}
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${dashboardUrl}" class="button">Go to Your Dashboard</a>
    </div>
    
    <div class="highlight-box">
      <p style="margin: 0; font-weight: 600; color: #1e40af;">💡 Getting Started Tip</p>
      <p style="margin: 8px 0 0 0;">
        ${userRole === 'parent' 
          ? 'Start by browsing our tutors and courses to find the perfect match for your child\'s learning needs.'
          : 'Complete your profile with your qualifications, subjects, and availability to start connecting with families.'}
      </p>
    </div>
    
    <h2>Need Help?</h2>
    <p>Our support team is here to help you get the most out of EdKonnect Academy. If you have any questions, don't hesitate to reach out.</p>
    
    <p style="margin-top: 32px;">Best regards,<br><strong>The EdKonnect Academy Team</strong></p>
  `;
  
  return getEmailBase(content, {
    preheaderText: `Welcome to EdKonnect Academy, ${userName}! Let's get started.`
  });
}

export function getEmailVerificationEmail(props: EmailVerificationProps): string {
  const { userName, verificationUrl, expiresAt } = props;
  const expiresText = expiresAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const content = `
    <h1>Verify your email ✉️</h1>
    <p>Hi ${userName},</p>
    <p>Thanks for signing up for EdKonnect Academy. Please confirm your email to activate your account.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${verificationUrl}" class="button">Verify Email</a>
    </div>
    <p>This link will expire on <strong>${expiresText}</strong>. If it expires, you can request a new one from the login page.</p>
    <div class="highlight-box">
      <p style="margin:0; font-weight:600;">Why verify?</p>
      <p style="margin:8px 0 0 0;">We verify emails to keep your account secure and ensure you receive important notifications.</p>
    </div>
    <p>If you did not create an account, you can safely ignore this email.</p>
    <p style="margin-top: 32px;">See you inside,<br><strong>The EdKonnect Academy Team</strong></p>
  `;

  return getEmailBase(content, {
    preheaderText: `Confirm your email to activate your EdKonnect Academy account.`,
  });
}

interface BookingConfirmationEmailProps {
  userName: string;
  userRole: 'parent' | 'tutor';
  courseName: string;
  tutorName?: string;
  studentName?: string;
  sessionDate: string;
  sessionTime: string;
  sessionDuration: string;
  sessionPrice: string;
  dashboardUrl: string;
  messagesUrl: string;
}

/**
 * Booking confirmation email template
 */
export function getBookingConfirmationEmail(props: BookingConfirmationEmailProps): string {
  const { 
    userName, 
    userRole, 
    courseName, 
    tutorName,
    studentName,
    sessionDate, 
    sessionTime, 
    sessionDuration,
    sessionPrice,
    dashboardUrl,
    messagesUrl
  } = props;
  
  const isParent = userRole === 'parent';
  const otherPartyName = isParent ? tutorName : studentName;
  
  const content = `
    <h1>Session Confirmed! ✅</h1>
    
    <p>Hi ${userName},</p>
    
    <p>Great news! Your tutoring session has been confirmed. Here are the details:</p>
    
    <div class="highlight-box">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827; width: 140px;">Course:</td>
          <td style="padding: 8px 0; color: #374151;">${courseName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">${isParent ? 'Tutor:' : 'Student:'}</td>
          <td style="padding: 8px 0; color: #374151;">${otherPartyName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">Date:</td>
          <td style="padding: 8px 0; color: #374151;">${sessionDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">Time:</td>
          <td style="padding: 8px 0; color: #374151;">${sessionTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">Duration:</td>
          <td style="padding: 8px 0; color: #374151;">${sessionDuration}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">Price:</td>
          <td style="padding: 8px 0; color: #374151;">${sessionPrice}</td>
        </tr>
      </table>
    </div>
    
    <h2>${isParent ? 'Preparing for the Session' : 'Session Preparation'}</h2>
    <p>${isParent 
      ? 'To help make the most of this tutoring session, consider preparing any questions or topics your child would like to focus on.'
      : 'Please review the student\'s learning goals and prepare materials that will help make this session productive and engaging.'
    }</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${dashboardUrl}" class="button">View in Dashboard</a>
    </div>
    
    <div class="divider"></div>
    
    <h2>Stay Connected</h2>
    <p>Have questions or need to discuss session details? Use our secure messaging platform to communicate with ${isParent ? 'your tutor' : 'the parent'}.</p>
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="${messagesUrl}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">Open Messages →</a>
    </div>
    
    <div class="highlight-box" style="background-color: #fef3c7; border-left-color: #f59e0b;">
      <p style="margin: 0; font-weight: 600; color: #92400e;">⏰ Reminder</p>
      <p style="margin: 8px 0 0 0; color: #92400e;">
        Please arrive on time and be prepared. ${isParent ? 'Your tutor' : 'The parent'} is looking forward to a great session!
      </p>
    </div>
    
    <p style="margin-top: 32px;">Looking forward to a successful session,<br><strong>The EdKonnect Academy Team</strong></p>
  `;
  
  return getEmailBase(content, {
    preheaderText: `Your session for ${courseName} on ${sessionDate} at ${sessionTime} is confirmed!`
  });
}

interface EnrollmentConfirmationEmailProps {
  userName: string;
  courseName: string;
  tutorNames: string[];
  coursePrice: string;
  dashboardUrl: string;
  courseDetailUrl: string;
}

/**
 * Course enrollment confirmation email template
 */
export function getEnrollmentConfirmationEmail(props: EnrollmentConfirmationEmailProps): string {
  const { userName, courseName, tutorNames, coursePrice, dashboardUrl, courseDetailUrl } = props;
  
  const tutorList = tutorNames.length > 1 
    ? tutorNames.slice(0, -1).join(', ') + ' and ' + tutorNames[tutorNames.length - 1]
    : tutorNames[0];
  
  const content = `
    <h1>Enrollment Confirmed! 🎉</h1>
    
    <p>Hi ${userName},</p>
    
    <p>Congratulations! You've successfully enrolled in <strong>${courseName}</strong>. We're excited to support your learning journey.</p>
    
    <div class="highlight-box">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0;">
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827; width: 140px;">Course:</td>
          <td style="padding: 8px 0; color: #374151;">${courseName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">${tutorNames.length > 1 ? 'Tutors:' : 'Tutor:'}</td>
          <td style="padding: 8px 0; color: #374151;">${tutorList}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #111827;">Price:</td>
          <td style="padding: 8px 0; color: #374151;">${coursePrice}</td>
        </tr>
      </table>
    </div>
    
    <h2>What's Next?</h2>
    <p>Now that you're enrolled, you can:</p>
    <ul style="margin: 16px 0; padding-left: 24px;">
      <li style="margin-bottom: 8px;">Schedule your first tutoring session</li>
      <li style="margin-bottom: 8px;">Review course materials and learning objectives</li>
      <li style="margin-bottom: 8px;">Connect with your ${tutorNames.length > 1 ? 'tutors' : 'tutor'} through our messaging platform</li>
      <li style="margin-bottom: 8px;">Track your progress in your dashboard</li>
    </ul>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${courseDetailUrl}" class="button">View Course Details</a>
    </div>
    
    <div class="divider"></div>
    
    <h2>Payment Confirmation</h2>
    <p>Your payment of <strong>${coursePrice}</strong> has been processed successfully. You can view your payment history and receipts in your dashboard.</p>
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="${dashboardUrl}" style="color: #3b82f6; text-decoration: none; font-weight: 600;">Go to Dashboard →</a>
    </div>
    
    <div class="highlight-box" style="background-color: #d1fae5; border-left-color: #10b981;">
      <p style="margin: 0; font-weight: 600; color: #065f46;">💚 Thank You</p>
      <p style="margin: 8px 0 0 0; color: #065f46;">
        Thank you for choosing EdKonnect Academy. We're committed to providing you with an exceptional learning experience.
      </p>
    </div>
    
    <p style="margin-top: 32px;">Happy learning,<br><strong>The EdKonnect Academy Team</strong></p>
  `;
  
  return getEmailBase(content, {
    preheaderText: `You're enrolled in ${courseName}! Let's start learning.`
  });
}

interface TutorApprovalEmailProps {
  tutorName: string;
  dashboardUrl: string;
}

/**
 * Tutor approval confirmation email template
 */
export function getTutorApprovalEmail(props: TutorApprovalEmailProps): string {
  const { tutorName, dashboardUrl } = props;
  
  const content = `
    <h1>🎉 Congratulations! Your Application is Approved</h1>
    
    <p>Hi ${tutorName},</p>
    
    <p>Great news! Your tutor application has been approved by our admin team. You're now officially part of the EdKonnect Academy tutor community.</p>
    
    <div class="highlight-box">
      <p style="margin: 0; font-weight: 600; color: #1e40af;">
        ✓ Your profile is now visible to parents searching for tutors
      </p>
    </div>
    
    <h2>Next Steps:</h2>
    
    <ul style="margin: 16px 0; padding-left: 24px;">
      <li style="margin-bottom: 8px;">Access your tutor dashboard to manage your profile and availability</li>
      <li style="margin-bottom: 8px;">Set your weekly availability so parents can book sessions</li>
      <li style="margin-bottom: 8px;">Review and respond to booking requests from parents</li>
      <li style="margin-bottom: 8px;">Track your upcoming sessions and earnings</li>
    </ul>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${dashboardUrl}" class="button">
        Go to Tutor Dashboard
      </a>
    </div>
    
    <p style="margin-top: 24px;">
      If you have any questions or need assistance getting started, feel free to reach out to our support team.
    </p>
    
    <p style="margin-top: 16px;">
      Welcome aboard!<br>
      <strong>The EdKonnect Academy Team</strong>
    </p>
  `;
  
  return getEmailBase(content, {
    preheaderText: 'Your tutor application has been approved!'
  });
}
