/**
 * One-time import of upcoming Acuity appointments into tutor_marketplace.sessions
 *
 * Strategy:
 * 1. For each of the 63 migrated parents, search Acuity clients by our DB email
 * 2. Acuity may store multiple emails joined with ", " or "; " — we match by CONTAINS
 * 3. Use the Acuity client's firstName to fetch appointments by name
 * 4. Filter to upcoming only, upsert into sessions
 * 5. Print summary of parents/students with no upcoming sessions
 *
 * Run on EC2:
 *   pnpm tsx scripts/import-acuity-sessions.ts
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, subscriptions } from "../drizzle/schema";
import { sql } from "drizzle-orm";
import { upsertAcuityAppointment } from "../server/acuity-webhook";

const ACUITY_USER_ID = process.env.ACUITY_USER_ID!;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY!;

if (!ACUITY_USER_ID || !ACUITY_API_KEY) {
  console.error("Missing ACUITY_USER_ID or ACUITY_API_KEY env vars");
  process.exit(1);
}

function authHeader(): string {
  return "Basic " + Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");
}

type AcuityAppointment = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  datetime: string;
  duration: string;
  calendarID: number;
  appointmentTypeID: number;
  location: string;
  canceled: boolean;
};

type AcuityClient = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

// Search Acuity clients whose email field contains our DB email
async function findAcuityClient(dbEmail: string): Promise<AcuityClient | null> {
  const url = `https://acuityscheduling.com/api/v1/clients?search=${encodeURIComponent(dbEmail)}`;
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) return null;

  const clients: AcuityClient[] = await res.json() as AcuityClient[];
  if (clients.length === 0) return null;

  // Find the client whose email field contains our DB email (case-insensitive)
  const match = clients.find(c =>
    c.email.toLowerCase().split(/[,;]/).map(e => e.trim()).includes(dbEmail.toLowerCase())
  );
  return match ?? clients[0];
}

// Get exact Acuity firstName/lastName by searching clients with just the first word
// Acuity's search API only matches on a single word/email token — full names return 0 results
async function resolveAcuityName(
  firstName: string,
  lastName: string
): Promise<{ firstName: string; lastName: string }> {
  const fullName = `${firstName} ${lastName}`.trim();
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  // Strip spaces for condensed-name comparison (e.g. "Satishkumar" vs "Sathish Kumar")
  const compact = (s: string) => s.toLowerCase().replace(/\s+/g, "");

  // Search by just the first word of firstName (Acuity single-token search)
  const searchWord = firstName.split(" ")[0];
  const url = `https://acuityscheduling.com/api/v1/clients?search=${encodeURIComponent(searchWord)}`;
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) return { firstName, lastName };

  const clients: AcuityClient[] = await res.json() as AcuityClient[];
  if (clients.length === 0) return { firstName, lastName };

  // 1. Exact full name match
  let match = clients.find(c =>
    normalize(`${c.firstName} ${c.lastName}`) === normalize(fullName)
  );

  // 2. All words of DB name appear somewhere in Acuity full name (handles split differences)
  if (!match) {
    const dbWords = normalize(fullName).split(" ").filter(w => w.length > 2);
    match = clients.find(c => {
      const acuityFull = normalize(`${c.firstName} ${c.lastName}`);
      return dbWords.every(w => acuityFull.includes(w));
    });
  }

  // 3. Acuity full name words all appear in DB full name (reverse check)
  if (!match) {
    match = clients.find(c => {
      const acuityWords = normalize(`${c.firstName} ${c.lastName}`).split(" ").filter(w => w.length > 2);
      const dbFull = normalize(fullName);
      return acuityWords.every(w => dbFull.includes(w));
    });
  }

  // 4. Condensed match — compare names with all spaces removed (handles "Satishkumar" vs "Sathish Kumar")
  if (!match) {
    const dbCompact = compact(fullName);
    match = clients.find(c =>
      compact(`${c.firstName} ${c.lastName}`) === dbCompact
    );
  }

  // 5. Partial condensed match — Acuity lastName compacted contains DB lastName compacted or vice versa
  if (!match) {
    const dbLastCompact = compact(lastName);
    match = clients.find(c => {
      const acuityLastCompact = compact(c.lastName);
      return (
        compact(c.firstName).startsWith(compact(searchWord)) &&
        (acuityLastCompact.includes(dbLastCompact) || dbLastCompact.includes(acuityLastCompact))
      );
    });
  }

  // 6. First word startsWith fallback
  const fallback = !match
    ? clients.find(c => c.firstName.toLowerCase().startsWith(searchWord.toLowerCase()))
    : null;

  const resolved = match
    ? { firstName: match.firstName, lastName: match.lastName }
    : fallback
      ? { firstName: fallback.firstName, lastName: fallback.lastName }
      : { firstName, lastName };

  if (resolved.firstName !== firstName || resolved.lastName !== lastName) {
    console.log(`    [Name resolved] DB: "${firstName} ${lastName}" → Acuity: "${resolved.firstName} ${resolved.lastName}"`);
  }
  return resolved;
}

// Fetch upcoming appointments by student name, resolving exact Acuity name first
async function fetchAppointmentsByName(
  firstName: string,
  lastName: string
): Promise<AcuityAppointment[]> {
  // Resolve exact name as stored in Acuity (may differ from our DB)
  const acuityName = await resolveAcuityName(firstName, lastName);
  console.log(`    [Fetch] Searching Acuity for: firstName="${acuityName.firstName}" lastName="${acuityName.lastName}"`);

  const url = `https://acuityscheduling.com/api/v1/appointments?firstName=${encodeURIComponent(acuityName.firstName)}&lastName=${encodeURIComponent(acuityName.lastName)}&max=200`;
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) return [];

  const all: AcuityAppointment[] = await res.json() as AcuityAppointment[];
  const nowMs = Date.now();
  return all.filter(apt => !apt.canceled && new Date(apt.datetime).getTime() >= nowMs);
}

async function main() {
  console.log("=== Acuity Session Import ===\n");

  const db = await getDb();
  if (!db) { console.error("Database not available"); process.exit(1); }

  // Get all 63 migrated parents
  const parents = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(sql`${users.id} BETWEEN 81 AND 143 AND ${users.role} = 'parent'`);

  console.log(`Found ${parents.length} migrated parents\n`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const seenAppointmentIds = new Set<number>();

  // Track which parents/students have no upcoming sessions at end
  const noSessionsReport: { email: string; students: string[] }[] = [];

  for (const parent of parents) {
    console.log(`\nProcessing ${parent.email}...`);

    // Step 1: Find this parent's Acuity client record
    const acuityClient = await findAcuityClient(parent.email);
    if (!acuityClient) {
      console.log(`  Not found in Acuity clients`);
      noSessionsReport.push({ email: parent.email, students: ["(not in Acuity)"] });
      continue;
    }

    // Step 2: Get all unique students for this parent from subscriptions
    const studentRows = await db
      .selectDistinct({
        firstName: subscriptions.studentFirstName,
        lastName: subscriptions.studentLastName,
      })
      .from(subscriptions)
      .where(sql`${subscriptions.parentId} = ${parent.id}
        AND ${subscriptions.studentFirstName} IS NOT NULL`);

    if (studentRows.length === 0) {
      console.log(`  No students found in subscriptions`);
      continue;
    }

    let parentImported = 0;
    const studentsWithNoSessions: string[] = [];

    for (const student of studentRows) {
      if (!student.firstName) continue;
      const fullName = `${student.firstName} ${student.lastName ?? ""}`.trim();

      const appointments = await fetchAppointmentsByName(
        student.firstName,
        student.lastName ?? ""
      );

      if (appointments.length === 0) {
        console.log(`  ${fullName}: no upcoming appointments`);
        studentsWithNoSessions.push(fullName);
        continue;
      }

      let studentImported = 0;
      for (const apt of appointments) {
        if (seenAppointmentIds.has(apt.id)) continue;
        seenAppointmentIds.add(apt.id);

        try {
          await upsertAcuityAppointment(apt);
          studentImported++;
          parentImported++;
          totalImported++;
        } catch (err: any) {
          const msg = err?.message ?? "";
          if (msg.includes("Skipping") || msg.includes("No migrated parent")) {
            totalSkipped++;
          } else {
            console.error(`  Error importing apt ${apt.id}:`, msg);
            totalErrors++;
          }
        }
      }
      console.log(`  ${fullName}: ${appointments.length} upcoming → ${studentImported} imported`);
    }

    if (studentsWithNoSessions.length > 0) {
      noSessionsReport.push({ email: parent.email, students: studentsWithNoSessions });
    }
  }

  // Final summary
  console.log("\n========================================");
  console.log("=== Import Summary ===");
  console.log(`Imported/updated:  ${totalImported}`);
  console.log(`Skipped:           ${totalSkipped}`);
  console.log(`Errors:            ${totalErrors}`);

  if (noSessionsReport.length > 0) {
    console.log("\n=== Parents/Students with NO Upcoming Sessions ===");
    for (const row of noSessionsReport) {
      console.log(`\n  ${row.email}`);
      for (const s of row.students) {
        console.log(`    - ${s}`);
      }
    }
  } else {
    console.log("\nAll parents have upcoming sessions imported!");
  }

  process.exit(0);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
