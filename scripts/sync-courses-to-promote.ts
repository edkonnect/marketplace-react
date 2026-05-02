/**
 * Migration script: Sync US region courses from tutor marketplace → promote app products table
 *
 * Source:      tutor_marketplace.courses  (region = 'us', isActive = 1)
 * Destination: tutoring_referral.products
 *
 * Mapping:
 *   courses.title       → products.name
 *   courses.description → products.description
 *   courses.price       → products.price
 *   courses.subject     → products.category
 *   courses.isActive    → products.active
 *   currency            → 'USD' (hardcoded)
 *
 * Run:
 *   pnpm tsx scripts/sync-courses-to-promote.ts
 *
 * Safe to re-run — matches on name+category, updates existing, inserts new.
 */

import mysql from "mysql2/promise";

// ── Config ────────────────────────────────────────────────────────────────────

const SOURCE_DB = {
  host: "tutor-marketplace-mysql.c1gyyeezlnjc.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "Edkonnect$444",
  database: "tutor_marketplace",
  ssl: { rejectUnauthorized: false },
};

const DEST_DB = {
  host: "tutoring-referral-db.c9aq6e2akc6s.ap-south-1.rds.amazonaws.com",
  user: "admin",
  password: "Eswar8081",
  database: "tutoring_referral",
  ssl: { rejectUnauthorized: false },
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to source DB (tutor marketplace)...");
  const source = await mysql.createConnection(SOURCE_DB);

  console.log("Connecting to destination DB (promote app)...");
  const dest = await mysql.createConnection(DEST_DB);

  // Fetch US region active courses from source
  const [courses] = await source.execute<any[]>(
    `SELECT title, description, price, subject, isActive
     FROM courses
     WHERE region = 'us' AND isActive = 1`
  );

  console.log(`Found ${courses.length} US active courses to sync.`);

  let inserted = 0;
  let updated = 0;

  for (const course of courses) {
    // Check if product already exists (match on name + category)
    const [existing] = await dest.execute<any[]>(
      `SELECT id FROM products WHERE name = ? AND category = ?`,
      [course.title, course.subject]
    );

    if (existing.length > 0) {
      // Update existing
      await dest.execute(
        `UPDATE products SET description = ?, price = ?, active = ?, updatedAt = NOW()
         WHERE name = ? AND category = ?`,
        [course.description, course.price, course.isActive, course.title, course.subject]
      );
      updated++;
      console.log(`  Updated: ${course.title}`);
    } else {
      // Insert new
      await dest.execute(
        `INSERT INTO products (name, description, price, category, active, currency, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'USD', NOW(), NOW())`,
        [course.title, course.description, course.price, course.subject, course.isActive]
      );
      inserted++;
      console.log(`  Inserted: ${course.title}`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Updated: ${updated}`);

  await source.end();
  await dest.end();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
