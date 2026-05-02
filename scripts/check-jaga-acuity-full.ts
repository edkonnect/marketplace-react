import "dotenv/config";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const today = new Date();
const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000);
const url = `https://acuityscheduling.com/api/v1/appointments?calendarID=12585605&minDate=${today.toISOString().split('T')[0]}&maxDate=${maxDate.toISOString().split('T')[0]}&max=500`;
const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
const data = await res.json() as any[];

const srihitha = data.filter((a: any) => 
  (a.email || "").toLowerCase().includes("jagapathirajup") && !a.canceled
);
console.log(`Srihitha upcoming in Acuity: ${srihitha.length}`);
for (const a of srihitha) {
  console.log(`  id=${a.id} ${a.datetime} UTC=${new Date(a.datetime).toISOString()} ${a.firstName}`);
}
process.exit(0);
