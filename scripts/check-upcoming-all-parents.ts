import "dotenv/config";

const ACUITY_USER_ID = "18852823";
const ACUITY_API_KEY = "bc59ae0823601e5a1ce172dab15221c7";
const AUTH = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString("base64");

const PARENT_EMAIL_ALIASES: Record<string, string[]> = {
  "nithdeepsai@gmail.com": ["nithdeepsai@gmail.com", "nithilansai@gmail.com"],
  "nirmal.adlin.usa@gmail.com": ["nirmal.adlin.usa@gmail.com", "neola.rini@gmail.com", "nichelle.riji@gmail.com"],
  "krithika1412@gmail.com": ["krithika1412@gmail.com", "krithikar06@gmail.com", "varshak0211@gmail.com", "sanabiyer@gmail.com"],
  "param_palani@yahoo.com": ["param_palani@yahoo.com", "dhruvparram@gmail.com"],
  "ashok.sree@gmail.com": ["ashok.sree@gmail.com", "ashok.athiappan@gmail.com"],
  "jeelanimanikindi@gmail.com": ["jeelanimanikindi@gmail.com", "hafsa.numu@gmail.com"],
};

const CALENDAR_TO_EMAIL: Record<number, string> = {
  9518516: "dolon.mukherjee.2011@gmail.com", 13134669: "bichuskumar8@gmail.com",
  12924725: "vgerarrd@gmail.com", 7992988: "gopisiri4268@gmail.com",
  10639379: "akalyangupta@gmail.com", 6631240: "mustaqmic@gmail.com",
  8838338: "naushadteaches@gmail.com", 7722765: "pmudi.bppimt@gmail.com",
  13611648: "ramesh030199@gmail.com", 9584519: "aish30george@gmail.com",
  12748025: "anittadominic123@gmail.com", 7203343: "appysisodia@yahoo.com",
  5824683: "maya.math289@gmail.com", 9886816: "mercyraniyedidi@gmail.com",
  12804136: "nalini.cheena@gmail.com", 4056973: "shritisharma@gmail.com",
  8255661: "sivasankare.g@gmail.com", 7137621: "sivasankare.g@gmail.com",
  13204478: "codegems27@gmail.com", 11083164: "vinaybalasisodia@gmail.com",
  13821319: "seswar8180@gmail.com", 12585605: "chintalapati.vrs@gmail.com",
  13801030: "sharved2508@gmail.com", 12986707: "shafirasik757575@gmail.com",
};

const parents = [
  "deepa.pondicherry@gmail.com", "ssggkk@gmail.com", "munidinesh@gmail.com",
  "lnsgeetha@gmail.com", "sari12j@gmail.com", "shankarmeera@gmail.com",
  "jeelanimanikindi@gmail.com", "sejunet23@gmail.com", "deepsforever@gmail.com",
  "jagapathirajup@gmail.com", "nirmal.adlin.usa@gmail.com", "veena.uskids@gmail.com",
  "raviraju.kalidindi@gmail.com", "krithika1412@gmail.com", "ashok.sree@gmail.com",
  "param_palani@yahoo.com",
];

const today = new Date();
const maxDate = new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000);
const minDateStr = today.toISOString().split("T")[0];
const maxDateStr = maxDate.toISOString().split("T")[0];

// Fetch all upcoming from all calendars in one pass
const allAppts: any[] = [];
for (const [calId] of Object.entries(CALENDAR_TO_EMAIL)) {
  const url = `https://acuityscheduling.com/api/v1/appointments?calendarID=${calId}&minDate=${minDateStr}&maxDate=${maxDateStr}&max=500`;
  const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
  if (!res.ok) continue;
  const data = await res.json() as any[];
  if (Array.isArray(data)) allAppts.push(...data.filter((a: any) => !a.canceled));
}

console.log(`Total Acuity upcoming: ${allAppts.length}\n`);

for (const parentEmail of parents) {
  const aliases = new Set<string>(PARENT_EMAIL_ALIASES[parentEmail] ?? [parentEmail]);
  const matched = allAppts.filter((a: any) => {
    const emails = (a.email || "").toLowerCase().split(/[,;]/).map((e: string) => e.trim());
    return emails.some((e: string) => aliases.has(e));
  });
  if (matched.length > 0) {
    console.log(`${parentEmail}: ${matched.length} upcoming in Acuity`);
    for (const a of matched) {
      console.log(`  ${a.datetime} cal=${a.calendarID} type=${a.type}`);
    }
  } else {
    console.log(`${parentEmail}: 0 upcoming`);
  }
}
process.exit(0);
