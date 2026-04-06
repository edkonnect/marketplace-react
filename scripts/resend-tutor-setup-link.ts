/**
 * One-off script: Resend account setup link to a tutor by email
 *
 * Run on EC2:
 *   TUTOR_EMAIL=tutor@example.com pnpm tsx scripts/resend-tutor-setup-link.ts
 */

import "dotenv/config";
import * as db from "../server/db";

async function main() {
  const tutorEmail = process.env.TUTOR_EMAIL;
  if (!tutorEmail) {
    console.error("Usage: TUTOR_EMAIL=giteshsagvekar07@gmail.com pnpm tsx scripts/resend-tutor-setup-link.ts");
    process.exit(1);
  }

  console.log(`Looking up user: ${tutorEmail}`);
  const user = await db.getUserByEmail(tutorEmail);
  if (!user) {
    console.error("No user found with that email.");
    process.exit(1);
  }

  console.log(`Found user: ${user.name} (id=${user.id}, role=${user.role})`);

  if (user.accountSetupComplete) {
    console.error("Account setup is already complete for this user. They can log in normally.");
    process.exit(1);
  }

  const tutorProfile = await db.getTutorProfileByUserId(user.id);
  if (!tutorProfile) {
    console.error("No tutor profile found for this user.");
    process.exit(1);
  }

  console.log(`Tutor profile approval status: ${tutorProfile.approvalStatus}`);
  if (tutorProfile.approvalStatus !== 'approved') {
    console.error("Tutor profile is not approved. Cannot send setup link.");
    process.exit(1);
  }

  const setupToken = await db.createPasswordSetupToken(user.id);
  if (!setupToken) {
    console.error("Failed to create setup token.");
    process.exit(1);
  }

  const baseUrl = process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000';
  const setupUrl = `${baseUrl}/setup-password?token=${setupToken}`;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  console.log(`\nSetup URL (valid 48h): ${setupUrl}\n`);

  const { sendPasswordSetupEmail } = await import("../server/email-helpers");
  const { emailService } = await import("../server/email-service");
  await emailService.ready();
  const emailSent = await sendPasswordSetupEmail({
    tutorEmail: user.email,
    tutorName: user.name || 'Tutor',
    setupUrl,
    expiresAt,
  });

  if (emailSent) {
    console.log(`Setup link email sent successfully to ${user.email}`);
  } else {
    console.error("Email service failed to send. Check EMAIL_USER/EMAIL_PASSWORD env vars.");
    console.log(`You can manually send this URL to the tutor: ${setupUrl}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
