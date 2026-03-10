import { searchFaq } from "../faq-search.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface EvalCase {
  query: string;
  expectedIntent: string;
}

interface EvalResult extends EvalCase {
  actualIntent: string | undefined;
  matched: boolean;
  score: number | undefined;
  pass: boolean;
}

const cases: EvalCase[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "faq-synthetic-eval.json"), "utf-8")
);

const results: EvalResult[] = cases.map((c) => {
  const r = searchFaq(c.query);
  const pass = r.matched && r.intent === c.expectedIntent;
  return {
    ...c,
    actualIntent: r.intent,
    matched: r.matched,
    score: r._score,
    pass,
  };
});

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => r.pass === false).length;
const accuracy = ((passed / results.length) * 100).toFixed(1);

console.log("\n=== Synthetic Query Evaluation (" + results.length + " cases) ===\n");
console.log("Total    : " + results.length);
console.log("Passed   : " + passed);
console.log("Failed   : " + failed);
console.log("Accuracy : " + accuracy + "%\n");

if (failed > 0) {
  console.log("--- Failed cases ---\n");
  for (const r of results) {
    if (r.pass) continue;
    console.log('  Query    : "' + r.query + '"');
    console.log("  Expected : " + r.expectedIntent);
    const scoreStr = r.score !== undefined ? r.score.toFixed(3) : "N/A";
    console.log(
      "  Got      : " + (r.actualIntent ?? "(no match)") +
      " | matched=" + r.matched +
      " | score=" + scoreStr
    );
    console.log("");
  }
}

// Group failures by intent for pattern analysis
const failsByIntent = new Map<string, number>();
for (const r of results) {
  if (r.pass) continue;
  failsByIntent.set(r.expectedIntent, (failsByIntent.get(r.expectedIntent) ?? 0) + 1);
}

if (failsByIntent.size > 0) {
  console.log("--- Failures by expected intent ---\n");
  const sorted = Array.from(failsByIntent.entries()).sort((a, b) => b[1] - a[1]);
  for (const [intent, count] of sorted) {
    console.log("  " + intent + ": " + count + " failure(s)");
  }
  console.log("");
}

process.exit(passed / results.length >= 0.85 ? 0 : 1);
