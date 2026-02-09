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
    return res.status(400).json({ error: parsed.error.flatten() });
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
    return res.status(400).json({ error: parsed.error.flatten() });
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
