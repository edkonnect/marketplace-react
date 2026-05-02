import "dotenv/config";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

// All calendar IDs from the sync script
const CALENDAR_TO_EMAIL: Record<number, string> = {
  12585605: "sriilalit@gmail.com",
  12804136: "rameshbalan1729@gmail.com",
  13611648: "nalinisuresh1729@gmail.com",
  12748025: "maya.balan1729@gmail.com",
  13254826: "mercyrani.t@gmail.com",
  13479018: "anittajoy222@gmail.com",
  13697223: "kaavyasreevenkat@gmail.com",
  14026397: "kaavyasreevenkat@gmail.com",
};

const targetEmail = "jagapathirajup@gmail.com";
const today = new Date();
const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000);
const minDate = today.toISOString().split("T")[0];
const maxDateStr = maxDate.toISOString().split("T")[0];

for (const [calId, email] of Object.entries(CALENDAR_TO_EMAIL)) {
  const url = `https://acuityscheduling.com/api/v1/appointments?minDate=${minDate}&maxDate=${maxDateStr}&max=500&calendarID=${calId}`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
  const data = await res.json() as any[];
  const matched = data.filter((a: any) => {
    const emails = (a.email || "").toLowerCase().split(/[,;]/).map((e: string) => e.trim());
    return emails.includes(targetEmail) && !a.canceled;
  });
  if (matched.length > 0) {
    console.log(`calendarID=${calId} (${email}): ${matched.length} upcoming`);
    for (const a of matched) console.log(`  ${a.datetime} type=${a.type} ${a.firstName} ${a.lastName}`);
  }
}
process.exit(0);
