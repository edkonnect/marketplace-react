/**
 * Offline evaluation script for the FAQ chatbot.
 *
 * Usage:
 *   npx tsx server/scripts/test-chatbot.ts
 *
 * Loads server/faq-eval.json, runs each query through searchFaq(), and prints
 * a detailed accuracy report. Exit code is 0 when accuracy >= PASS_THRESHOLD.
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { searchFaq } from "../faq-search.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PASS_THRESHOLD = 0.85; // 85% accuracy required to pass

// ---------------------------------------------------------------------------
// Load eval data
// ---------------------------------------------------------------------------

interface EvalCase {
  query: string;
  expectedIntent: string;
}

const evalPath = path.join(__dirname, "..", "faq-eval.json");
const evalCases: EvalCase[] = JSON.parse(fs.readFileSync(evalPath, "utf-8"));

// ---------------------------------------------------------------------------
// Run evaluation
// ---------------------------------------------------------------------------

interface EvalResult {
  query: string;
  expectedIntent: string;
  actualIntent: string | undefined;
  matched: boolean;
  score: number | undefined;
  pass: boolean;
}

const results: EvalResult[] = [];

for (const { query, expectedIntent } of evalCases) {
  const result = searchFaq(query);
  const pass = result.matched && result.intent === expectedIntent;

  results.push({
    query,
    expectedIntent,
    actualIntent: result.intent,
    matched: result.matched,
    score: result._score,
    pass,
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
const accuracy = passed / results.length;

console.log("\n=== FAQ Chatbot Evaluation Report ===\n");
console.log(`Total cases : ${results.length}`);
console.log(`Passed      : ${passed}`);
console.log(`Failed      : ${failed}`);
console.log(`Accuracy    : ${(accuracy * 100).toFixed(1)}%`);
console.log(`Threshold   : ${(PASS_THRESHOLD * 100).toFixed(0)}%`);
console.log(`Status      : ${accuracy >= PASS_THRESHOLD ? "✅ PASS" : "❌ FAIL"}\n`);

if (failed > 0) {
  console.log("--- Failed cases ---\n");
  for (const r of results.filter((r) => !r.pass)) {
    console.log(`  Query    : "${r.query}"`);
    console.log(`  Expected : ${r.expectedIntent}`);
    console.log(`  Got      : ${r.actualIntent ?? "(no match)"} | matched=${r.matched} | score=${r.score ?? "N/A"}`);
    console.log();
  }
}

process.exit(accuracy >= PASS_THRESHOLD ? 0 : 1);
