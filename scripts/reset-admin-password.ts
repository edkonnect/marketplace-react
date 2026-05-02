import "dotenv/config";
import bcrypt from "bcryptjs";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const email = process.argv[2];
const newPassword = process.argv[3] || "Welcome@123";
if (!email) { console.error("Usage: reset-admin-password.ts <email> [password]"); process.exit(1); }

const db = await getDb();
const hash = await bcrypt.hash(newPassword, 10);
await db.execute(sql`UPDATE users SET passwordHash = ${hash} WHERE email = ${email}`);
console.log(`✅ Password reset to "${newPassword}" for ${email}`);
process.exit(0);
