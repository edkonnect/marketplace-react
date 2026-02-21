import express from "express";
import { z } from "zod";
import { authSchema, clearAuthCookies, setAuthCookies, verifyPassword, verifyRefreshToken } from "../services/authService";
import * as db from "../../db";
import { REFRESH_TOKEN_COOKIE } from "@shared/const";
import { sendVerificationEmail } from "../../email-helpers";

export const authRouter = express.Router();

authRouter.post("/signup", async (req, res) => {
  const parsed = authSchema.signup.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Invalid input";
    return res.status(400).json({ error: firstError });
  }
  const { email, password, firstName, lastName, role } = parsed.data;

  const existing = await db.getUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
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

  await setAuthCookies(req, res, {
    sub: user.id,
    email: user.email || "",
    role: user.role as "parent" | "tutor" | "admin",
  });

  const { passwordHash: _pw2, ...safeUser } = user as any;
  res.json({ user: safeUser });
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

  // Find user by email
  const user = await db.getUserByEmail(email);
  if (!user) {
    // Don't reveal if email exists - security best practice
    return res.json({
      success: true,
      message: "If an approved account exists for this email, a setup link has been sent."
    });
  }

  // Check if account setup is already complete
  if (user.accountSetupComplete) {
    return res.json({
      success: true,
      message: "Your account is already set up. Please use the login page."
    });
  }

  // Check if user has approved tutor profile
  const tutorProfile = await db.getTutorProfileByUserId(user.id);
  if (!tutorProfile || tutorProfile.approvalStatus !== 'approved') {
    // Don't reveal profile status - security
    return res.json({
      success: true,
      message: "If an approved account exists for this email, a setup link has been sent."
    });
  }

  // Generate new setup token
  const setupToken = await db.createPasswordSetupToken(user.id);
  if (!setupToken) {
    return res.status(500).json({
      error: "Failed to generate setup link. Please try again later."
    });
  }

  const setupUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000'}/setup-password?token=${setupToken}`;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // Send email
  try {
    const { sendPasswordSetupEmail } = await import('../../email-helpers');
    await sendPasswordSetupEmail({
      tutorEmail: user.email,
      tutorName: user.name || 'Tutor',
      setupUrl,
      expiresAt,
    });
  } catch (error) {
    console.error('[ResendSetupLink] Failed to send email:', error);
    return res.status(500).json({
      error: "Failed to send setup link. Please try again later."
    });
  }

  res.json({
    success: true,
    message: "If an approved account exists for this email, a setup link has been sent."
  });
});
