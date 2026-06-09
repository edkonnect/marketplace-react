import express from "express";
import { z } from "zod";
import { authSchema, authenticateRequest, clearAuthCookies, clearSuperUserCookie, hashPassword, setSuperUserCookie, setAuthCookies, verifyPassword, verifyRefreshToken, verifySuperUserCookie } from "../services/authService";
import * as db from "../../db";
import { REFRESH_TOKEN_COOKIE } from "@shared/const";
import { sendVerificationEmail, sendCouponRewardEmail, sendAdminNewUserNotification } from "../../emails/email-helpers";

export const authRouter = express.Router();

authRouter.post("/signup", async (req, res) => {
  const parsed = authSchema.signup.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return res.status(400).json({ error: firstError });
  }
  const { email, password, firstName, lastName, role, timezone } = parsed.data;
  const refCode = typeof req.body.refCode === "string" ? req.body.refCode.trim().toUpperCase() : null;

  const existing = await db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }

  // Validate referral code if provided
  let referrer = null;
  if (refCode) {
    referrer = await db.getUserByReferralCode(refCode);
    if (!referrer) {
      return res.status(400).json({ error: "Invalid referral code." });
    }
    // Prevent self-referral
    if (referrer.email.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({ error: "You cannot refer yourself." });
    }
  }

  const passwordHash = await (await import("../services/authService")).hashPassword(password);
  const user = await db.createAuthUser({
    email,
    passwordHash,
    firstName,
    lastName,
    role,
    userType: role,
  });

  if (!user) {
    return res.status(500).json({ error: "Failed to create user" });
  }

  // Generate unique referral code for new user
  try {
    const newRefCode = await db.generateUniqueReferralCode();
    await db.setUserReferralCode(user.id, newRefCode);
  } catch (err) {
    console.error("[Auth] Failed to generate referral code:", err);
  }

  // Link referral if code was provided, then issue coupon to referred user immediately
  if (refCode && referrer) {
    try {
      await db.setUserReferredBy(user.id, refCode);
      await db.updateReferralSignedUp(email, user.id);

      // Issue coupon to referred user right away (amounts are 0; resolved at enrollment based on course price)
      const referral = await db.getReferralByReferredUserId(user.id);
      if (referral) {
        const coupon = await db.createCoupon({
          userId: user.id,
          sourceReferralId: referral.id,
        });
        if (coupon) {
          const userName = `${user.firstName} ${user.lastName}`.trim();
          await sendCouponRewardEmail({
            userEmail: user.email || email,
            userName,
            couponCode: coupon.code,
            reason: "referred",
          }).catch(err => console.error("[Auth] Failed to send coupon email to referred user:", err));
        }
      }
    } catch (err) {
      console.error("[Auth] Failed to link referral:", err);
    }
  }

  try {
    const token = await db.createEmailVerificationToken(user.id);
    if (token) {
      await sendVerificationEmail({
        userEmail: user.email || email,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        verificationUrl: `${process.env.VITE_FRONTEND_FORGE_API_URL || "http://localhost:3000"}/api/auth/verify-email?token=${token.token}`,
        expiresAt: token.expiresAt,
      });
    }
  } catch (err) {
    console.error("[Auth] Failed to send verification email:", err);
  }

  // Save timezone to users table so it's returned by getUserById
  if (timezone) {
    try { await db.updateUserTimezone(user.id, timezone); } catch {}
  }

  // Create a basic profile matching the selected role
  try {
    if (role === "parent") {
      await db.createParentProfile({
        userId: user.id,
        childrenInfo: null,
        preferences: null,
      });
    } else if (role === "tutor") {
      await db.createTutorProfile({
        userId: user.id,
        bio: "",
        qualifications: "",
        subjects: JSON.stringify([]),
        gradeLevels: JSON.stringify([]),
        hourlyRate: "0",
        yearsOfExperience: 0,
        approvalStatus: "pending",
        isActive: false,
      });
    }
  } catch (profileErr) {
    console.error("[Auth] Failed to create initial profile:", profileErr);
    // continue; profile can be completed later
  }

  // Notify admin of new signup (fire-and-forget, only for parent/tutor roles)
  if (role === 'parent' || role === 'tutor') {
    sendAdminNewUserNotification({
      userName: `${user.firstName} ${user.lastName}`.trim(),
      userEmail: user.email || email,
      role,
      timezone: timezone || undefined,
    }).catch(err => console.error("[Auth] Failed to send admin new user notification:", err));
  }

  const { passwordHash: _pw, ...safeUser } = user as any;
  res.status(201).json({ user: safeUser, message: "Verification email sent. Please confirm to activate your account." });
});

authRouter.post("/login", async (req, res) => {
  const parsed = authSchema.login.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid credentials" });
  }
  const { email, password } = parsed.data;

  const user = await db.getUserByEmail(email);
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!user.emailVerified) {
    return res.status(403).json({ error: "Please verify your email before logging in." });
  }

  const previousLastSignedIn = await db.updateUserLastSignedIn(user.id);

  await setAuthCookies(req, res, {
    sub: user.id,
    email: user.email || "",
    role: user.role as "parent" | "tutor" | "admin" | "coordinator",
  });

  const { passwordHash: _pw2, ...safeUser } = user as any;
  res.json({ user: safeUser, previousLastSignedIn: previousLastSignedIn ? previousLastSignedIn.toISOString() : null });
});

authRouter.post("/temp-login", async (req, res) => {
  let caller: Awaited<ReturnType<typeof authenticateRequest>>;
  try {
    caller = await authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (caller.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }

  const user = await db.getUserByEmail(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "No account found with that email" });
  }
  if (user.role !== "parent" && user.role !== "tutor") {
    return res.status(403).json({ error: "This account is not a parent or tutor account" });
  }

  await setAuthCookies(req, res, {
    sub: user.id,
    email: user.email || "",
    role: user.role as "parent" | "tutor",
  });

  const { passwordHash: _pw, ...safeUser } = user as any;
  return res.json({ success: true, user: safeUser, role: user.role });
});

authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (refreshToken) {
    await db.revokeRefreshToken(refreshToken);
  }
  await clearAuthCookies(req, res);
  res.json({ success: true });
});

authRouter.post("/refresh-token", async (req, res) => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!token) return res.status(401).json({ error: "Missing refresh token" });

  const stored = await db.findValidRefreshToken(token);
  if (!stored) {
    await clearAuthCookies(req, res);
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  try {
    const payload = await verifyRefreshToken(token);
    if (stored.userId !== payload.sub) {
      await clearAuthCookies(req, res);
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    // rotate: revoke old, issue new
    await db.revokeRefreshToken(token);
    await setAuthCookies(req, res, {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });
    res.json({ ok: true });
  } catch (error) {
    await clearAuthCookies(req, res);
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

authRouter.get("/verify-email", async (req, res) => {
  const token = req.query.token as string | undefined;
  if (!token) return res.status(400).json({ error: "Missing token" });

  const user = await db.consumeEmailVerificationToken(token);
  if (!user) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  res.format({
    json: () => res.json({ success: true, message: "Email verified. Please sign in to continue." }),
    html: () =>
      res.send(`
        <!doctype html>
        <html>
        <head><meta charset="utf-8"><title>Email verified</title></head>
        <body style="font-family: system-ui; max-width: 480px; margin: 40px auto; text-align: center;">
          <h1>✅ Email verified</h1>
          <p>Your account is now active. Please sign in to continue.</p>
          <a href="/login">Go to sign in</a>
          <script>setTimeout(() => { window.location.href = "/login"; }, 1200);</script>
        </body>
        </html>
      `),
    default: () => res.json({ success: true, message: "Email verified. Please sign in to continue." }),
  });
});

/**
 * Universal email link redirector.
 * - If the user already has a valid refresh token cookie, redirect straight to target.
 * - Otherwise, send them to login with a next param so they land on the target after login.
 *
 * Example: /api/auth/email-redirect?target=/parent/dashboard
 */
authRouter.get("/email-redirect", async (req, res) => {
  const target = (req.query.target as string) || "/dashboard";
  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (refreshToken) {
    try {
      await verifyRefreshToken(refreshToken);
      return res.redirect(target);
    } catch {
      // fall through to login redirect
    }
  }

  const loginUrl = `/login?next=${encodeURIComponent(target)}`;
  return res.redirect(loginUrl);
});

/**
 * Password setup endpoint for newly approved tutors
 * Validates the setup token and sets the user's password
 */
authRouter.post("/setup-password", async (req, res) => {
  const schema = z.object({
    token: z.string(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  });

  const parseResult = schema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: parseResult.error.issues[0]?.message || "Invalid input"
    });
  }

  const { token, password } = parseResult.data;

  // Validate token
  const tokenRecord = await db.validatePasswordSetupToken(token);
  if (!tokenRecord) {
    return res.status(400).json({
      error: "Invalid or expired setup link. Please request a new one."
    });
  }

  // Hash new password
  const authService = await import("../services/authService");
  const passwordHash = await authService.hashPassword(password);

  // Consume token and update user password
  const user = await db.consumePasswordSetupToken(token, passwordHash);
  if (!user) {
    return res.status(500).json({
      error: "Failed to set up your account. Please try again."
    });
  }

  // Auto-login the user by creating session
  await setAuthCookies(req, res, {
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

/**
 * Resend password setup link for approved tutors who haven't completed setup
 */
/**
 * Request a password reset email
 */
authRouter.post("/forgot-password", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const { email } = parsed.data;

  // Always return success to avoid leaking whether email exists
  const user = await db.getUserByEmail(email);
  if (!user || !user.emailVerified) {
    return res.json({ success: true, message: "If an account exists for this email, a reset link has been sent." });
  }

  const token = await db.createPasswordResetToken(user.id);
  if (!token) {
    return res.status(500).json({ error: "Failed to generate reset link. Please try again." });
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const resetUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  try {
    const { sendPasswordResetEmail } = await import("../../emails/email-helpers");
    await sendPasswordResetEmail({
      userEmail: user.email,
      userName: user.name || user.firstName || "there",
      resetUrl,
      expiresAt,
    });
  } catch (err) {
    console.error("[ForgotPassword] Failed to send email:", err);
    return res.status(500).json({ error: "Failed to send reset email. Please try again." });
  }

  res.json({ success: true, message: "If an account exists for this email, a reset link has been sent." });
});

/**
 * Reset password using token from email
 */
authRouter.post("/reset-password", async (req, res) => {
  const schema = z.object({
    token: z.string(),
    password: z.string().min(8, "Password must be at least 8 characters"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
  }

  const { token, password } = parsed.data;

  const tokenRecord = await db.validatePasswordResetToken(token);
  if (!tokenRecord) {
    return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
  }

  const authService = await import("../services/authService");
  const passwordHash = await authService.hashPassword(password);

  const user = await db.consumePasswordResetToken(token, passwordHash);
  if (!user) {
    return res.status(500).json({ error: "Failed to reset password. Please try again." });
  }

  res.json({ success: true, message: "Password reset successfully. You can now sign in." });
});

authRouter.post("/resend-setup-link", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
  });

  const parseResult = schema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Valid email is required"
    });
  }

  const { email } = parseResult.data;
  const genericOk = { success: true, message: "If an account exists for this email, we've sent the appropriate link." };

  // Find user by email
  const user = await db.getUserByEmail(email);
  if (!user) {
    return res.json(genericOk);
  }

  // Parent/coordinator: resend email verification link
  if (user.role === 'parent' || user.role === 'coordinator') {
    if (user.emailVerified) {
      return res.json({ success: true, message: "Your email is already verified. Please use the login page." });
    }
    try {
      const token = await db.createEmailVerificationToken(user.id);
      if (token) {
        const verificationUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token.token}`;
        await sendVerificationEmail({
          userEmail: user.email,
          userName: user.name || user.email,
          verificationUrl,
          expiresAt: token.expiresAt,
        });
        console.log('[ResendSetupLink] Verification email sent to:', user.email);
      }
    } catch (error) {
      console.error('[ResendSetupLink] Failed to send verification email:', error);
      return res.status(500).json({ error: "Failed to send verification email. Please try again later." });
    }
    return res.json(genericOk);
  }

  // Tutor: resend password setup link (only if approved and setup not complete)
  if (user.accountSetupComplete) {
    return res.json({ success: true, message: "Your account is already set up. Please use the login page." });
  }

  const tutorProfile = await db.getTutorProfileByUserId(user.id);
  if (!tutorProfile || tutorProfile.approvalStatus !== 'approved') {
    return res.json(genericOk);
  }

  const setupToken = await db.createPasswordSetupToken(user.id);
  if (!setupToken) {
    return res.status(500).json({ error: "Failed to generate setup link. Please try again later." });
  }

  const setupUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000'}/setup-password?token=${setupToken}`;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  try {
    const { sendPasswordSetupEmail } = await import('../../emails/email-helpers');
    const emailSent = await sendPasswordSetupEmail({
      tutorEmail: user.email,
      tutorName: user.name || 'Tutor',
      setupUrl,
      expiresAt,
    });
    if (!emailSent) {
      console.error('[ResendSetupLink] Email service returned false for:', user.email);
      return res.status(500).json({ error: "Failed to send setup link. Please try again later." });
    }
    console.log('[ResendSetupLink] Password setup email sent to:', user.email);
  } catch (error) {
    console.error('[ResendSetupLink] Failed to send email:', error);
    return res.status(500).json({ error: "Failed to send setup link. Please try again later." });
  }

  res.json(genericOk);
});

// Per-admin brute-force protection: 5 failed attempts locks out for 15 minutes
const superUnlockAttempts = new Map<number, { failures: number; lockedUntil: number }>();
const SU_MAX_FAILURES = 5;
const SU_LOCKOUT_MS   = 15 * 60 * 1000;

authRouter.post("/super-unlock", async (req, res) => {
  let user: Awaited<ReturnType<typeof authenticateRequest>>;
  try {
    user = await authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  // Brute-force protection
  const now = Date.now();
  const attempts = superUnlockAttempts.get(user.id);
  if (attempts && attempts.lockedUntil > now) {
    const remainingMin = Math.ceil((attempts.lockedUntil - now) / 60000);
    return res.status(429).json({ error: `Too many failed attempts. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.` });
  }

  const schema = z.object({ password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Password is required" });
  }

  const hash = await db.getSuperUserPasswordHash(user.id);
  if (!hash) {
    return res.status(403).json({ error: "Super-user password not set. Please set it in Settings → Security." });
  }

  const valid = await verifyPassword(parsed.data.password, hash);
  if (!valid) {
    const current = superUnlockAttempts.get(user.id) ?? { failures: 0, lockedUntil: 0 };
    current.failures += 1;
    if (current.failures >= SU_MAX_FAILURES) {
      current.lockedUntil = now + SU_LOCKOUT_MS;
      current.failures = 0;
    }
    superUnlockAttempts.set(user.id, current);
    return res.status(401).json({ error: "Incorrect super-user password" });
  }

  // Success — clear any previous failure count
  superUnlockAttempts.delete(user.id);
  await setSuperUserCookie(req, res, user.id);
  return res.json({ success: true });
});

authRouter.post("/super-lock", async (req, res) => {
  let user: Awaited<ReturnType<typeof authenticateRequest>>;
  try {
    user = await authenticateRequest(req);
  } catch {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  await clearSuperUserCookie(req, res);
  return res.json({ success: true });
});

authRouter.get("/super-verify", async (req, res) => {
  let user: Awaited<ReturnType<typeof authenticateRequest>>;
  try {
    user = await authenticateRequest(req);
  } catch {
    return res.json({ verified: false });
  }
  try {
    const suPayload = await verifySuperUserCookie(req);
    const verified = Number(suPayload.sub) === user.id;
    return res.json({ verified });
  } catch {
    return res.json({ verified: false });
  }
});
