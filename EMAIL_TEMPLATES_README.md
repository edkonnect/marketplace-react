# Email Templates Documentation

## Overview

EdKonnect Academy uses professional, responsive HTML email templates for transactional emails. All templates feature consistent branding with the EdKonnect Academy logo, blue color scheme (#3b82f6), and Inter font family.

## Available Templates

### 1. Welcome Email
**Trigger:** When a user selects their role (parent or tutor) for the first time  
**Recipients:** New users  
**Purpose:** Welcome new users and guide them through platform features

**Variants:**
- **Parent Version:** Highlights browsing tutors, exploring courses, scheduling sessions, tracking progress, and messaging
- **Tutor Version:** Highlights creating courses, setting availability, connecting with parents, managing bookings, and tracking earnings

**Key Features:**
- Personalized greeting with user's name
- Role-specific feature list
- "Go to Dashboard" call-to-action button
- Getting started tip in highlighted box
- Support information

### 2. Booking Confirmation Email
**Trigger:** When a tutoring session is scheduled  
**Recipients:** Both parent and tutor  
**Purpose:** Confirm session details and provide preparation guidance

**Content Includes:**
- Course name
- Tutor/student name (depending on recipient)
- Session date and time
- Duration
- Price
- "View in Dashboard" call-to-action button
- Link to messaging platform
- Session preparation tips
- Reminder to arrive on time

### 3. Enrollment Confirmation Email
**Trigger:** When a parent successfully enrolls in a course (Stripe payment completed)  
**Recipients:** Parent who enrolled  
**Purpose:** Confirm enrollment and guide next steps

**Content Includes:**
- Course name
- Tutor name(s) - supports multiple tutors
- Course price
- Payment confirmation
- "What's Next" section with action items
- "View Course Details" call-to-action button
- Link to dashboard
- Thank you message

## Email Service Configuration

### Environment Variables

To enable email sending, configure these environment variables:

```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_HOST=smtp.gmail.com  # Optional, defaults to Gmail
EMAIL_PORT=587             # Optional, defaults to 587
```

### Gmail Setup

1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to Google Account Settings → Security
   - Select "2-Step Verification" → "App passwords"
   - Generate a new app password for "Mail"
3. Use the generated password as `EMAIL_PASSWORD`

### Development Mode

When email credentials are not configured, the email service will:
- Log email details to console instead of sending
- Return `true` in development environment to allow flow continuation
- Show recipient, subject, and HTML length in logs

## Testing

### Unit Tests

Run the email template tests:

```bash
pnpm test email-templates.test.ts
```

Tests cover:
- Template generation for all variants
- Proper HTML structure
- Content inclusion
- Branding consistency
- Responsive design elements

### Visual Preview

Generate HTML preview files to view emails in a browser:

```bash
pnpm exec tsx server/preview-emails.ts
```

This creates preview files in `/email-previews/`:
- `welcome-parent.html`
- `welcome-tutor.html`
- `booking-parent.html`
- `booking-tutor.html`
- `enrollment-single.html`
- `enrollment-multiple.html`

Open these files in a browser to see how the emails will look.

## Technical Implementation

### Files

- **`server/email-templates.ts`** - HTML email template generators
- **`server/email-service.ts`** - Nodemailer-based email sending service
- **`server/email-helpers.ts`** - High-level functions for sending specific email types
- **`server/routers.ts`** - Email triggers integrated into API routes
- **`server/stripeWebhook.ts`** - Enrollment email trigger on payment success

### Email Triggers

#### Welcome Email
```typescript
// Triggered in: server/routers.ts - auth.updateRole mutation
sendWelcomeEmail({
  userEmail: ctx.user.email,
  userName: ctx.user.name,
  userRole: input.role,
});
```

#### Booking Confirmation
```typescript
// Triggered in: server/routers.ts - session.create mutation
// Sends to both parent and tutor
sendBookingConfirmation({
  userEmail: parent.email,
  userName: parent.name,
  userRole: 'parent',
  courseName: course.title,
  tutorName: tutor.name,
  sessionDate: formatEmailDate(sessionDate),
  sessionTime: formatEmailTime(sessionDate),
  sessionDuration: `${session.duration} minutes`,
  sessionPrice: formatEmailPrice(parseInt(course.price) * 100),
});
```

#### Enrollment Confirmation
```typescript
// Triggered in: server/stripeWebhook.ts - checkout.session.completed event
sendEnrollmentConfirmation({
  userEmail: user.email,
  userName: user.name,
  courseName: course.title,
  tutorName: tutor.name,
  studentName: `${studentFirstName} ${studentLastName}`,
  coursePrice: formatEmailPrice(session.amount_total || 0),
  courseId: course.id,
});
```

## Design Features

### Responsive Design
- Mobile-optimized layout
- Adjusts padding and font sizes for screens under 600px
- Uses table-based layout for maximum email client compatibility

### Email Client Compatibility
- Works across Gmail, Outlook, Apple Mail, and other major clients
- Uses inline styles for maximum compatibility
- Includes CSS reset for consistent rendering
- Table-based layout instead of modern CSS Grid/Flexbox

### Branding Elements
- EdKonnect Academy logo with graduation cap emoji (🎓)
- Blue gradient header (#3b82f6 to #2563eb)
- Consistent button styling with hover effects
- Professional footer with links and copyright
- Highlight boxes for important information

### Accessibility
- Semantic HTML structure
- Proper heading hierarchy
- Alt text for images (when used)
- High contrast text colors
- Preheader text for email preview

## Customization

### Updating Branding

To update the branding across all templates, modify the base template in `server/email-templates.ts`:

```typescript
export function getEmailBase(content: string, props: EmailBaseProps = {}): string {
  // Update colors, logo, footer text, etc.
}
```

### Adding New Templates

1. Create template function in `server/email-templates.ts`
2. Add helper function in `server/email-helpers.ts`
3. Add trigger in appropriate router or webhook
4. Add tests in `server/email-templates.test.ts`
5. Add preview generation in `server/preview-emails.ts`

## Best Practices

1. **Always use async/await with try-catch** when sending emails
2. **Don't block user flows** - send emails asynchronously with `.catch()` error handling
3. **Log errors** but don't fail the main operation if email sending fails
4. **Test in development** using preview files before deploying
5. **Use formatters** - `formatEmailDate()`, `formatEmailTime()`, `formatEmailPrice()` for consistent formatting
6. **Include unsubscribe links** if sending marketing emails (not required for transactional)
7. **Monitor email delivery** in production using email service logs

## Troubleshooting

### Emails Not Sending

1. Check environment variables are set correctly
2. Verify Gmail app password is valid
3. Check console logs for error messages
4. Ensure 2FA is enabled on Google account
5. Try generating a new app password

### Emails in Spam

1. Add SPF, DKIM, and DMARC records to your domain
2. Use a professional email service (SendGrid, AWS SES, etc.) in production
3. Avoid spam trigger words in subject lines
4. Include unsubscribe link for bulk emails

### Styling Issues

1. Test in multiple email clients
2. Use inline styles instead of CSS classes
3. Avoid modern CSS features (Grid, Flexbox)
4. Use table-based layouts
5. Test with Email on Acid or Litmus

## Future Enhancements

Potential improvements for the email system:

1. **Email Templates in Database** - Allow admins to edit templates via UI
2. **Email Scheduling** - Queue emails for optimal delivery times
3. **Email Analytics** - Track open rates, click rates, and conversions
4. **A/B Testing** - Test different email variants
5. **Localization** - Support multiple languages
6. **Rich Media** - Add images, videos, and interactive elements
7. **Email Preferences** - Allow users to customize notification settings
8. **Batch Sending** - Send digest emails for multiple notifications
9. **Professional Email Service** - Integrate SendGrid, Mailgun, or AWS SES
10. **Email Verification** - Verify email addresses before sending

## Support

For questions or issues with email templates:
1. Check this documentation
2. Review console logs for error messages
3. Test with preview files
4. Verify environment configuration
5. Contact the development team

---

**Last Updated:** January 10, 2026  
**Version:** 1.0  
**Maintained by:** EdKonnect Academy Development Team
