import "dotenv/config";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const url = `https://acuityscheduling.com/api/v1/appointments/1609590566`;
const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
const a = await res.json() as any;
console.log(`id=${a.id}`);
console.log(`datetime=${a.datetime}`);
console.log(`timezone=${a.timezone}`);
console.log(`email=${a.email}`);
console.log(`firstName=${a.firstName} lastName=${a.lastName}`);
console.log(`canceled=${a.canceled}`);
console.log(`duration=${a.duration}`);
// Convert to UTC
const utc = new Date(a.datetime).toISOString();
console.log(`UTC: ${utc}`);
process.exit(0);
