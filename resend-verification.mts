import { getUserByEmail, createEmailVerificationToken } from "./server/db.js";
import { sendVerificationEmail } from "./server/email-helpers.js";

const email = "mercyraniyeddi@gmail.com";

const user = await getUserByEmail(email);
if (!user) { console.error("User not found"); process.exit(1); }

const token = await createEmailVerificationToken(user.id);
if (!token) { console.error("Failed to create token"); process.exit(1); }

const url = `${process.env.VITE_FRONTEND_FORGE_API_URL}/api/auth/verify-email?token=${token.token}`;

await sendVerificationEmail({
  userEmail: user.email!,
  userName: `${user.firstName} ${user.lastName}`.trim(),
  verificationUrl: url,
  expiresAt: token.expiresAt,
});

console.log("✅ Verification email sent to", email);
process.exit(0);
