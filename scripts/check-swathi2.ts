import 'dotenv/config';

const ACUITY_USER_ID = process.env.ACUITY_USER_ID;
const ACUITY_API_KEY = process.env.ACUITY_API_KEY;
const creds = Buffer.from(`${ACUITY_USER_ID}:${ACUITY_API_KEY}`).toString('base64');

// Search by both emails with wider date range
for (const email of ['Swathibhat224@gmail.com', 'swathibhat224@gmail.com', 'payaswini.holla05@gmail.com']) {
  const res = await fetch(
    `https://acuityscheduling.com/api/v1/appointments?email=${encodeURIComponent(email)}&minDate=2026-04-19&maxDate=2026-04-22&max=10&canceled=false`,
    { headers: { Authorization: `Basic ${creds}` } }
  );
  const appts = await res.json() as any[];
  if (appts.length > 0) {
    console.log(`\nAcuity for ${email}: ${appts.length} appointments`);
    appts.forEach((a: any) => console.log(`  id=${a.id} datetime=${a.datetime} canceled=${a.canceled} type=${a.type} firstName=${a.firstName} lastName=${a.lastName}`));
  }
}

// Also try searching by phone
const res2 = await fetch(
  `https://acuityscheduling.com/api/v1/appointments?phone=3027665737&minDate=2026-04-19&maxDate=2026-04-22&max=10`,
  { headers: { Authorization: `Basic ${creds}` } }
);
const byPhone = await res2.json() as any[];
console.log(`\nBy phone (302-766-5737): ${byPhone.length}`);
byPhone.forEach((a: any) => console.log(`  id=${a.id} datetime=${a.datetime} canceled=${a.canceled} email=${a.email}`));

process.exit(0);
