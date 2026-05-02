/**
 * One-time script: fetch and store Stripe customer IDs for migrated parents
 *
 * 63 parents were migrated from legacy DB without their Stripe customer IDs.
 * The invoice display on ParentPayments page works automatically once
 * users.stripeCustomerId is populated — this script does that population.
 *
 * Run on EC2:
 *   pnpm tsx scripts/fetch-stripe-customer-ids.ts
 */

import "dotenv/config";
import { getDb, updateUserStripeCustomerId } from "../server/db";
import { users } from "../drizzle/schema";
import { sql, isNull } from "drizzle-orm";
import { getStripe } from "../server/stripe";

async function main() {
  console.log("=== Fetch Stripe Customer IDs for Migrated Parents ===\n");

  const db = await getDb();
  if (!db) { console.error("Database not available"); process.exit(1); }

  const stripe = getStripe();

  // Get all parents where stripeCustomerId is not yet set
  const parents = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(sql`${users.role} = 'parent' AND ${users.stripeCustomerId} IS NULL`);

  console.log(`Found ${parents.length} migrated parents without stripeCustomerId\n`);

  let found = 0;
  let notFound = 0;
  const notFoundList: string[] = [];

  // Print which Stripe mode we're using
  const keyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 12) ?? "unknown";
  console.log(`Stripe key prefix: ${keyPrefix} (should be sk_live_... for production)\n`);

  for (const parent of parents) {
    try {
      // Search Stripe by email
      const result = await stripe.customers.list({ email: parent.email, limit: 5 });

      if (result.data.length === 0) {
        console.log(`  ${parent.email}: not found in Stripe`);
        notFound++;
        notFoundList.push(parent.email);
        continue;
      }

      // Use first non-deleted customer
      const customer = result.data.find(c => !c.deleted);
      if (!customer) {
        console.log(`  ${parent.email}: only deleted customers found in Stripe`);
        notFound++;
        notFoundList.push(parent.email);
        continue;
      }

      await updateUserStripeCustomerId(parent.id, customer.id);
      console.log(`  ${parent.email}: set stripeCustomerId = ${customer.id}`);
      found++;
    } catch (err: any) {
      console.error(`  ${parent.email}: error — ${err?.message}`);
      notFound++;
      notFoundList.push(parent.email);
    }
  }

  console.log("\n========================================");
  console.log("=== Summary ===");
  console.log(`Found & updated: ${found}`);
  console.log(`Not in Stripe:   ${notFound}`);

  if (notFoundList.length > 0) {
    console.log("\n=== Parents NOT found in Stripe ===");
    for (const email of notFoundList) {
      console.log(`  - ${email}`);
    }
  }

  process.exit(0);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
