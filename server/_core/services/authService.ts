import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { z } from "zod";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_EXPIRY_MS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_EXPIRY_MS,
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
    role: z.enum(["parent", "tutor", "admin", "coordinator"]).default("parent"),
    timezone: z.string().optional(),
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

async function signJwt(payload: JwtPayload, expiresInMs: number, secret: Uint8Array) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(payload)
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
    const data = payload as JwtPayload;
    const user = await db.getUserById(data.sub);
    if (!user) throw new Error("User not found");
    return user;
  } catch (err) {
    throw err;
  }
}

export async function verifyRefreshToken(token: string) {
  const { payload } = await jwtVerify(token, refreshSecret);
  return payload as JwtPayload & { exp: number };
}

export { authSchema };
