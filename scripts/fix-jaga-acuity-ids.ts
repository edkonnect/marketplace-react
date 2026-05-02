import "dotenv/config";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

// Fetch Sriilalit's calendar (12585605) for the 3 missing dates
const url = `https://acuityscheduling.com/api/v1/appointments?calendarID=12585605&minDate=2026-04-21&maxDate=2026-04-26&max=50`;
const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
const data = await res.json() as any[];
console.log(`Found ${data.length} appointments:`);
for (const a of data) {
  console.log(`  id=${a.id} ${a.datetime} canceled=${a.canceled} ${a.firstName} ${a.lastName}`);
}
process.exit(0);
