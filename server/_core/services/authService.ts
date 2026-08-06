import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_EXPIRY_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_EXPIRY_MS,
  SUPER_USER_TOKEN_COOKIE,
  SUPER_USER_TOKEN_EXPIRY_MS,
} from "@shared/const";
import { ENV } from "../env";
import { getCookieOptions } from "../cookies";
import * as db from "../../db";

const authSchema = {
  signup: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    role: z.enum(["parent", "tutor"]).default("parent"),
    timezone: z.string().optional(),
    interestType: z.enum(["sat_test_prep", "k12_math", "k12_english", "advanced_placement", "coding", "computer_science", "other"]).optional(),
    targetScoreRange: z.string().optional(),
    plannedTestMonth: z.string().optional(),
    courseType: z.enum(["regular", "accelerated"]).optional(),
  }),
  login: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
  }),
};

type JwtPayload = {
  sub: number;
  email: string;
  role: "parent" | "tutor" | "admin" | "coordinator";
};

const accessSecret = new TextEncoder().encode(ENV.cookieSecret);
const refreshSecret = new TextEncoder().encode(ENV.refreshSecret || ENV.cookieSecret);
const suSecret = new TextEncoder().encode(process.env.JWT_SU_SECRET ?? `su_${ENV.cookieSecret}`);

async function signJwt(payload: JwtPayload, expiresInMs: number, secret: Uint8Array) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload, sub: String(payload.sub) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(expiresInMs / 1000))
    .sign(secret);
}

export async function hashPassword(password: string) {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function setAuthCookies(req: Request, res: Response, payload: JwtPayload) {
  const accessToken = await signJwt(payload, ACCESS_TOKEN_EXPIRY_MS, accessSecret);
  const refreshToken = await signJwt(payload, REFRESH_TOKEN_EXPIRY_MS, refreshSecret);

  // store refresh hash
  await db.storeRefreshToken(payload.sub, refreshToken, new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS));

  const accessOptions = getCookieOptions(req, "/");
  const refreshOptions = getCookieOptions(req, "/api/auth/refresh-token");

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...accessOptions, maxAge: ACCESS_TOKEN_EXPIRY_MS });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, { ...refreshOptions, maxAge: REFRESH_TOKEN_EXPIRY_MS });
}

export async function clearAuthCookies(req: Request, res: Response) {
  const accessOptions = getCookieOptions(req, "/");
  const refreshOptions = getCookieOptions(req, "/api/auth/refresh-token");
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...accessOptions, maxAge: 0 });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...refreshOptions, maxAge: 0 });
}

export async function authenticateRequest(req: Request) {
  const token = (req as any).cookies?.[ACCESS_TOKEN_COOKIE];
  if (!token) throw new Error("Missing access token");

  try {
    const { payload } = await jwtVerify(token, accessSecret);
    const data = payload as unknown as JwtPayload;
    const user = await db.getUserById(data.sub);
    if (!user) throw new Error("User not found");
    return user;
  } catch (err) {
    throw err;
  }
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, refreshSecret);
  return payload as unknown as JwtPayload & { exp: number };
}

export async function setSuperUserCookie(req: Request, res: Response, userId: number) {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ type: "su" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(SUPER_USER_TOKEN_EXPIRY_MS / 1000))
    .sign(suSecret);
  const options = getCookieOptions(req, "/");
  res.cookie(SUPER_USER_TOKEN_COOKIE, token, { ...options, maxAge: SUPER_USER_TOKEN_EXPIRY_MS });
}

export async function verifySuperUserCookie(req: Request) {
  const token = (req as any).cookies?.[SUPER_USER_TOKEN_COOKIE];
  if (!token) throw new Error("Missing super-user token");
  const { payload } = await jwtVerify(token, suSecret);
  if ((payload as any).type !== "su") throw new Error("Invalid super-user token type");
  return payload;
}

export async function clearSuperUserCookie(req: Request, res: Response) {
  const options = getCookieOptions(req, "/");
  res.clearCookie(SUPER_USER_TOKEN_COOKIE, { ...options, maxAge: 0 });
}

export { authSchema };
