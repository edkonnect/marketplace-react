import "dotenv/config";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

// Fetch the 3 specific sessions for jeelani: Apr 20 (13611648), Apr 26 (12804136), Apr 27 (13611648)
for (const calId of [13611648, 12804136]) {
  const url = `https://acuityscheduling.com/api/v1/appointments?calendarID=${calId}&minDate=2026-04-20&maxDate=2026-04-28&max=50`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
  const data = await res.json() as any[];
  for (const a of data) {
    const emails = (a.email || "").toLowerCase().split(/[,;]/).map((e: string) => e.trim());
    if (emails.some((e: string) => ["jeelanimanikindi@gmail.com","hafsa.numu@gmail.com"].includes(e)) && !a.canceled) {
      console.log(`id=${a.id} cal=${calId} ${a.datetime}`);
    }
  }
}
process.exit(0);
