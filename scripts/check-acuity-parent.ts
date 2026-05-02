import "dotenv/config";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const email = process.argv[2];
const targetEmail = email.toLowerCase();
const calendarIds = [12804136, 13611648, 12748025]; // Ramesh, Nalini

async function fetchCal(calId: number) {
  const url = `https://acuityscheduling.com/api/v1/appointments?minDate=2026-04-19&maxDate=2026-12-31&max=500&calendarID=${calId}`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
  const data = await res.json() as any[];
  return data.filter((a: any) => {
    const apptEmails = (a.email || "").toLowerCase().split(/[,;]/).map((e: string) => e.trim());
    return apptEmails.includes(targetEmail);
  });
}

let all: any[] = [];
for (const calId of calendarIds) {
  const appts = await fetchCal(calId);
  console.log(`calendarID=${calId}: ${appts.length} matched`);
  for (const a of appts) console.log(`  ${a.datetime} canceled=${a.canceled} type=${a.type}`);
  all = [...all, ...appts];
}
const notCancelled = all.filter((a: any) => !a.canceled);
console.log(`\nTotal not cancelled: ${notCancelled.length}`);

process.exit(0);
