import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const email = process.argv[2];
if (!email) { console.error("Usage: pnpm tsx scripts/verify-email.ts <email>"); process.exit(1); }

const db = await getDb();
if (!db) { console.error("DB not available"); process.exit(1); }

const result = await db.execute(sql`UPDATE users SET emailVerified = 1, emailVerifiedAt = NOW() WHERE email = ${email}`);
const affected = (result as any)[0]?.affectedRows ?? 0;
if (affected === 0) { console.error(`User not found: ${email}`); process.exit(1); }
console.log(`✅ Email verified for ${email}`);
process.exit(0);
