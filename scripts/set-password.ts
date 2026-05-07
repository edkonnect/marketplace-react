import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) { console.error("Usage: pnpm tsx scripts/set-password.ts <email> <password>"); process.exit(1); }

const db = await getDb();
if (!db) { console.error("DB not available"); process.exit(1); }

const hash = await bcrypt.hash(password, 10);
const result = await db.execute(sql`UPDATE users SET passwordHash = ${hash} WHERE email = ${email}`);
const affected = (result as any)[0]?.affectedRows ?? 0;
if (affected === 0) { console.error(`User not found: ${email}`); process.exit(1); }
console.log(`✅ Password set for ${email}`);
process.exit(0);
