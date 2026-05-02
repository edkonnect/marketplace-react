import "dotenv/config";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const url = `https://acuityscheduling.com/api/v1/appointments/1673893908`;
const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
const a = await res.json() as any;
console.log(`id=${a.id} datetime=${a.datetime} UTC=${new Date(a.datetime).toISOString()} canceled=${a.canceled} ${a.firstName} ${a.lastName} email=${a.email}`);
process.exit(0);
