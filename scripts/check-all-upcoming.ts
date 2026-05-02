import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

const db = await getDb();

const emails = [
  "deepa.pondicherry@gmail.com",
  "ssggkk@gmail.com",
  "munidinesh@gmail.com",
  "lnsgeetha@gmail.com",
  "sari12j@gmail.com",
  "shankarmeera@gmail.com",
  "jeelanimanikindi@gmail.com",
  "sejunet23@gmail.com",
  "deepsforever@gmail.com",
  "jagapathirajup@gmail.com",
  "nirmal.adlin.usa@gmail.com",
  "veena.uskids@gmail.com",
  "raviraju.kalidindi@gmail.com",
  "krithika1412@gmail.com",
  "ashok.sree@gmail.com",
  "param_palani@yahoo.com",
];

console.log("Parent Email                        | Scheduled");
console.log("------------------------------------|----------");
for (const email of emails) {
  const parent = ((await db.execute(sql`SELECT id FROM users WHERE email = ${email}`)) as any)[0][0];
  if (!parent) { console.log(`${email.padEnd(36)} | NOT FOUND`); continue; }
  const row = ((await db.execute(sql`SELECT COUNT(*) as cnt FROM sessions WHERE parentId = ${parent.id} AND status = 'scheduled'`)) as any)[0][0];
  console.log(`${email.padEnd(36)} | ${row.cnt}`);
}
process.exit(0);
