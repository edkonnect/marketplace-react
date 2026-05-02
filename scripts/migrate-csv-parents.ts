/**
 * Bulk migration script: 63 parents + subscriptions from CSV data
 *
 * Run on EC2:
 *   pnpm tsx scripts/migrate-csv-parents.ts
 *
 * Safe to re-run — skips existing emails.
 * Skips subscriptions where courseId or tutorId cannot be resolved.
 */

import "dotenv/config";
import { getDb } from "../server/db";
import { users, parentProfiles, subscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

// ── Course name → ID mapping ──────────────────────────────────────────────────

function resolveCourseId(courseName: string, grade: string): number | null {
  const gradeNum = parseInt(grade.replace(/\D/g, "")) || 0;
  const name = courseName.trim().toLowerCase();

  // Direct mappings
  const direct: Record<string, number> = {
    "digital sat english": 25,
    "digital sat math": 1,
    "computer programming - python": 12,
    "computer programming - java": 22,
    "basic java programming": 22,
    "ap calculus": 33,
    "ap chemistry": 82,
    "ap statistics": 68,
    "sat/act - english reading and writing": 25,
    "sat/act - math test prep": 1,
    "sat foundation - english": 25,
    "advanced english - reading and writing": 276,
    "spoken english and grammar": 276,
    "high school ib math": 222,
    "high school english - cbse/icse/ib/state": 144,
    "middle school math-cbse/icse/ib/state": 4,
    "middle school science - cbse/icse/ib/state": 124,
    "middle school biology - cbse/icse/ib/state": 221,
    "middle school chemistry - cbse/icse/ib/state": 220,
    "middle school physics-cbse/icse/ib/state": 219,
    "high school computers science - cbse/icse/ig/ib/state": 51,
    "elementary school english - cbse/icse/ib/state": 115,
    "act english": 75,
    "act math": 92,
    "english - reading and writing (middle school level)": 114,
    "english - reading and writing (high school level)": 116,
    "english - reading and writing (elementary level)": 115,
    "math - middle school level": 4,
    "math - high school level": 274,
    "psat/ nmsqt": 76,
    "psat": 78,
    "ap language": 29,
    "ap calculus bc": 67,
    "ap calculus ab": 33,
  };

  if (direct[name] !== undefined) return direct[name];

  // Grade-based mappings
  if (name.includes("high school math - cbse")) {
    if (gradeNum === 8) return 119;
    if (gradeNum === 9) return 120;
    if (gradeNum === 10) return 122;
    if (gradeNum === 11) return 150;
    if (gradeNum === 12) return 151;
    return 150; // fallback
  }

  if (name.includes("high school physics - cbse")) {
    if (gradeNum === 9) return 153;
    if (gradeNum === 10) return 157;
    if (gradeNum === 11) return 163;
    if (gradeNum === 12) return 166;
    return 163;
  }

  if (name.includes("high school chemistry - cbse")) {
    if (gradeNum === 8) return 123;
    if (gradeNum === 9) return 154;
    if (gradeNum === 10) return 159;
    if (gradeNum === 11) return 164;
    return 164;
  }

  if (name.includes("high school biology - cbse")) {
    if (gradeNum === 9) return 155;
    if (gradeNum === 10) return 162;
    if (gradeNum === 11) return 165;
    return 165;
  }

  if (name.includes("high school hindi")) {
    if (gradeNum === 6) return 174;
    if (gradeNum === 9) return 177;
    if (gradeNum === 11) return 179;
    return 177;
  }

  if (name.includes("middle school english - cbse")) {
    if (gradeNum === 3) return 136;
    if (gradeNum === 6) return 139;
    if (gradeNum === 7) return 140;
    if (gradeNum === 8) return 141;
    return 139;
  }

  // Skip these — no course ID available
  if (name.includes("as probability") || name.includes("as pure math")) return null;
  if (name.includes("summer course - middle")) return null;
  if (name.includes("middle school computer science")) return null;
  if (name.includes("math - elementary level")) return null;

  return null;
}

// ── Parents data ──────────────────────────────────────────────────────────────

interface ParentRow {
  name: string;
  email: string;
  phone: string;
  timezone: string;
}

const PARENTS: ParentRow[] = [
  { name: "Ganesh Babu", email: "abishan.ganeshbabu@gmail.com", phone: "9809392097", timezone: "America/New_York" },
  { name: "Anoop", email: "amazedsaint@gmail.com", phone: "(610) 241-2673", timezone: "America/New_York" },
  { name: "Pawan", email: "apakapawan007@yahoo.co.in", phone: "8699006501", timezone: "Asia/Kolkata" },
  { name: "Asha", email: "ash.latha1@gmail.com", phone: "+13025626459", timezone: "America/New_York" },
  { name: "Ashok", email: "ashok.sree@gmail.com", phone: "8042748666", timezone: "America/New_York" },
  { name: "B Jean", email: "b.jean9109@gmail.com", phone: "16036613152", timezone: "America/New_York" },
  { name: "Ramprakash", email: "bhavika.ramprakash@gmail.com", phone: "5714649321", timezone: "America/New_York" },
  { name: "Deepa Pondicherry", email: "deepa.pondicherry@gmail.com", phone: "+17325896030", timezone: "America/New_York" },
  { name: "Deepa G", email: "deepsforever@gmail.com", phone: "2083898785", timezone: "America/New_York" },
  { name: "Dency", email: "dencygr8@gmail.com", phone: "4802950565", timezone: "America/Phoenix" },
  { name: "Dhaval Nanavati", email: "dhruval2@yahoo.com", phone: "(571) 294-6520", timezone: "America/New_York" },
  { name: "Durga Devi", email: "durgadevi.ramesh@gmail.com", phone: "(909) 210-2349", timezone: "America/New_York" },
  { name: "Swathi", email: "gswathi858@gmail.com", phone: "4844253651", timezone: "America/New_York" },
  { name: "Swathi", email: "gullaswathi@gmail.com", phone: "+14253057848", timezone: "America/Los_Angeles" },
  { name: "Indraraj Chatterjee", email: "indrarajchatterjee77@gmail.com", phone: "+19048267467", timezone: "America/New_York" },
  { name: "Swetha Kamireddy", email: "itsme.swethu@gmail.com", phone: "+12034180511", timezone: "America/Los_Angeles" },
  { name: "Raju", email: "jagapathirajup@gmail.com", phone: "(860) 970-8218", timezone: "America/Chicago" },
  { name: "Jaideep", email: "jaideep.pinglikar@gmail.com", phone: "5617892777", timezone: "America/New_York" },
  { name: "Simerpreet Kaur", email: "jsingh247365@gmail.com", phone: "(201) 281-2314", timezone: "America/New_York" },
  { name: "Jyothi Bonla", email: "jyothi.rani@live.in", phone: "9885335963", timezone: "Asia/Kolkata" },
  { name: "Krishna", email: "k99.ram@gmail.com", phone: "7323977202", timezone: "America/New_York" },
  { name: "Kalyan Kankanampati", email: "kalyani.kankanampati@gmail.com", phone: "(510) 737-1216", timezone: "America/Los_Angeles" },
  { name: "Kavitha", email: "kavitharajiv94@gmail.com", phone: "+919611484969", timezone: "America/New_York" },
  { name: "Sana Bharath", email: "krithika1412@gmail.com", phone: "8579283816", timezone: "America/New_York" },
  { name: "Varsha K", email: "krithikar06@gmail.com", phone: "6314286071", timezone: "America/New_York" },
  { name: "Ms. Geetha", email: "lnsgeetha@gmail.com", phone: "+19732949478", timezone: "America/New_York" },
  { name: "Rajat das", email: "mail.rd.in@gmail.com", phone: "9717193963", timezone: "Asia/Kolkata" },
  { name: "Maruthi Sundaramoorthy", email: "maruthi.sundaramoorthy@gmail.com", phone: "(623) 760-5344", timezone: "America/Phoenix" },
  { name: "Prabu", email: "minfantprabu@gmail.com", phone: "(737) 224-3442", timezone: "America/Chicago" },
  { name: "Minu", email: "mrinalini.sureshkumar@gmail.com", phone: "2013517195", timezone: "America/New_York" },
  { name: "Mr. Dinesh", email: "munidinesh@gmail.com", phone: "+4915752247528", timezone: "America/New_York" },
  { name: "Tina", email: "nami.patel@icloud.com", phone: "+13153956566", timezone: "America/New_York" },
  { name: "Meenakshi", email: "nanditkoul2023@gmail.com", phone: "+18572690725", timezone: "America/New_York" },
  { name: "Vijay Narayanan", email: "narayanan.vijay@gmail.com", phone: "9043042529", timezone: "America/New_York" },
  { name: "Natesan Srinivasan", email: "nate.srinivasan@gmail.com", phone: "+919840346272", timezone: "Asia/Kolkata" },
  { name: "Adlin", email: "nirmal.adlin.usa@gmail.com", phone: "(571) 233-9280", timezone: "America/New_York" },
  { name: "Saravanan", email: "nithdeepsai@gmail.com", phone: "5083639793", timezone: "America/New_York" },
  { name: "Param", email: "param_palani@yahoo.com", phone: "2017060229", timezone: "America/New_York" },
  { name: "Gayathri", email: "pgayathiri@gmail.com", phone: "98412 53707", timezone: "Asia/Kolkata" },
  { name: "Raghav", email: "raju8raghav@gmail.com", phone: "+18325991002", timezone: "America/Chicago" },
  { name: "Raju", email: "raviraju.kalidindi@gmail.com", phone: "7132316028", timezone: "America/Chicago" },
  { name: "Renjin Mepparambil", email: "rejincm@gmail.com", phone: "+19165590722", timezone: "America/New_York" },
  { name: "Rajkumar", email: "rjkumr@gmail.com", phone: "+12019170527", timezone: "America/Chicago" },
  { name: "Rajendra Kumar", email: "rkumarbin@gmail.com", phone: "8825159159", timezone: "Asia/Kolkata" },
  { name: "Violenta Da Cunha", email: "rodriguescenna@gmail.com", phone: "0044794430", timezone: "America/New_York" },
  { name: "Rohini Perhar", email: "rohiniperhar@gmail.com", phone: "5085237022", timezone: "America/New_York" },
  { name: "Rupak Das", email: "rrupak@yahoo.com", phone: "5083353823", timezone: "America/New_York" },
  { name: "Usha", email: "sasanakotiusha@gmail.com", phone: "(618) 373-9964", timezone: "America/Chicago" },
  { name: "Sathish Kumar", email: "sathishkumarprannesh@gmail.com", phone: "6026392732", timezone: "America/Phoenix" },
  { name: "Sejal", email: "sejunet23@gmail.com", phone: "5084393229", timezone: "America/New_York" },
  { name: "Samyukthaa", email: "senthil.keel@gmail.com", phone: "4804980528", timezone: "America/New_York" },
  { name: "Nagharajan", email: "seyyonvn@gmail.com", phone: "2017072566", timezone: "America/New_York" },
  { name: "Soumya Kini", email: "soumyakini@gmail.com", phone: "7032613534", timezone: "America/New_York" },
  { name: "Srilakshmi", email: "srilakshmi.chennu@gmail.com", phone: "+16104258996", timezone: "America/New_York" },
  { name: "Raj", email: "surapureddy.raj@gmail.com", phone: "+15732635577", timezone: "America/Chicago" },
  { name: "Raju Penmatcha", email: "suri.rajup@gmail.com", phone: "+12017422888", timezone: "America/New_York" },
  { name: "Swarna Nagappan", email: "sw2881984@yahoo.co.in", phone: "98430 52724", timezone: "Asia/Kolkata" },
  { name: "Swathi", email: "swathibhat224@gmail.com", phone: "(302) 766-5737", timezone: "America/New_York" },
  { name: "Teja reddy", email: "tejarajivreddy@gmail.com", phone: "9945908189", timezone: "America/New_York" },
  { name: "Thangam", email: "thangam.reach@gmail.com", phone: "(949) 331-9023", timezone: "America/New_York" },
  { name: "Uma Magashwari", email: "umamagashwari@gmail.com", phone: "8606906228", timezone: "America/Chicago" },
  { name: "Purna Tadaka", email: "veena.uskids@gmail.com", phone: "+15089041668", timezone: "America/New_York" },
  { name: "Vidya Ramachandran", email: "vidyakar5@gmail.com", phone: "6024210893", timezone: "America/New_York" },
];

// ── Subscriptions data ────────────────────────────────────────────────────────

interface SubRow {
  parentEmail: string;
  studentName: string;
  grade: string;
  courseName: string;
  startDate: string | null;
  tutorId: number | null;
}

const SUBSCRIPTIONS: SubRow[] = [
  { parentEmail: "abishan.ganeshbabu@gmail.com", studentName: "Abishan Ganesh Babu", grade: "GR10", courseName: "Digital SAT English", startDate: "2025-10-01", tutorId: 24 },
  { parentEmail: "abishan.ganeshbabu@gmail.com", studentName: "Abishan Ganesh Babu", grade: "GR10", courseName: "Digital SAT Math", startDate: null, tutorId: 51 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Chinmayi Anoop", grade: "GR8", courseName: "Computer programming - Python", startDate: null, tutorId: 50 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Chinmayi Anoop", grade: "GR8", courseName: "English - Reading and Writing (Middle School Level)", startDate: null, tutorId: 24 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Chinmayi Anoop", grade: "GR8", courseName: "Math - Middle School Level", startDate: "2024-09-09", tutorId: 47 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Jahnavi Anoop", grade: "GR9", courseName: "Computer Programming - Java", startDate: null, tutorId: 50 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Jahnavi Anoop", grade: "GR9", courseName: "Computer programming - Python", startDate: null, tutorId: 50 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Jahnavi Anoop", grade: "GR9", courseName: "Digital SAT English", startDate: null, tutorId: 23 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Jahnavi Anoop", grade: "GR9", courseName: "Digital SAT Math", startDate: null, tutorId: 47 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Jahnavi Anoop", grade: "GR9", courseName: "English - Reading and Writing (High School Level)", startDate: "2024-12-07", tutorId: 23 },
  { parentEmail: "amazedsaint@gmail.com", studentName: "Jahnavi Anoop", grade: "GR9", courseName: "Math - High School Level", startDate: "2024-12-07", tutorId: 47 },
  { parentEmail: "apakapawan007@yahoo.co.in", studentName: "Kapish Purohit", grade: "GR12", courseName: "High School Physics - CBSE/ICSE/IB/State", startDate: "2025-12-01", tutorId: 52 },
  { parentEmail: "ash.latha1@gmail.com", studentName: "Sankeerth Reddy Malasandram", grade: "GR10", courseName: "Digital SAT English", startDate: "2026-02-15", tutorId: 24 },
  { parentEmail: "ash.latha1@gmail.com", studentName: "Sankeerth Reddy Malasandram", grade: "GR10", courseName: "Digital SAT Math", startDate: "2026-02-15", tutorId: 61 },
  { parentEmail: "ashok.sree@gmail.com", studentName: "Amudhan Ashok", grade: "GR6", courseName: "English - Reading and Writing (Middle School Level)", startDate: "2025-07-02", tutorId: 24 },
  { parentEmail: "b.jean9109@gmail.com", studentName: "Cooper Jean", grade: "GR6", courseName: "English - Reading and Writing (Middle School Level)", startDate: null, tutorId: 24 },
  { parentEmail: "b.jean9109@gmail.com", studentName: "Cooper Jean", grade: "GR6", courseName: "Math - Middle School Level", startDate: null, tutorId: null },
  { parentEmail: "bhavika.ramprakash@gmail.com", studentName: "Bhavika Ramprakash", grade: "GR11", courseName: "AP Calculus", startDate: "2025-12-01", tutorId: 52 },
  { parentEmail: "bhavika.ramprakash@gmail.com", studentName: "Bhavika Ramprakash", grade: "GR11", courseName: "AP Chemistry", startDate: "2025-12-01", tutorId: null },
  { parentEmail: "deepa.pondicherry@gmail.com", studentName: "Aaria Pondicherry", grade: "GR7", courseName: "English - Reading and Writing (Middle School Level)", startDate: "2025-09-16", tutorId: 23 },
  { parentEmail: "deepa.pondicherry@gmail.com", studentName: "Aaria Pondicherry", grade: "GR7", courseName: "Math - Middle School Level", startDate: "2025-09-10", tutorId: 50 },
  { parentEmail: "deepa.pondicherry@gmail.com", studentName: "Ishika Pondicherry", grade: "GR10", courseName: "Digital SAT English", startDate: "2023-06-27", tutorId: 23 },
  { parentEmail: "deepa.pondicherry@gmail.com", studentName: "Ishika Pondicherry", grade: "GR10", courseName: "Digital SAT Math", startDate: "2023-06-28", tutorId: 47 },
  { parentEmail: "deepsforever@gmail.com", studentName: "Ananya Gurajala", grade: "GR4", courseName: "English - Reading and Writing (Elementary Level)", startDate: "2023-09-18", tutorId: 24 },
  { parentEmail: "deepsforever@gmail.com", studentName: "Ananya Gurajala", grade: "GR4", courseName: "Math - Elementary Level", startDate: "2023-09-18", tutorId: 47 },
  { parentEmail: "deepsforever@gmail.com", studentName: "Sravya Gurajala", grade: "GR10", courseName: "AP Calculus", startDate: null, tutorId: 52 },
  { parentEmail: "deepsforever@gmail.com", studentName: "Sravya Gurajala", grade: "GR10", courseName: "Digital SAT English", startDate: null, tutorId: 23 },
  { parentEmail: "deepsforever@gmail.com", studentName: "Sravya Gurajala", grade: "GR10", courseName: "Digital SAT Math", startDate: null, tutorId: 47 },
  { parentEmail: "deepsforever@gmail.com", studentName: "Sravya Gurajala", grade: "GR10", courseName: "Math - High School Level", startDate: "2023-09-07", tutorId: 47 },
  { parentEmail: "dencygr8@gmail.com", studentName: "Ethan Joseph Jimmy", grade: "GR9", courseName: "Digital SAT English", startDate: "2025-08-18", tutorId: 30 },
  { parentEmail: "dencygr8@gmail.com", studentName: "Ethan Joseph Jimmy", grade: "GR9", courseName: "Digital SAT Math", startDate: "2026-01-04", tutorId: 54 },
  { parentEmail: "dhruval2@yahoo.com", studentName: "Shaival Nanavati", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-08-03", tutorId: 24 },
  { parentEmail: "dhruval2@yahoo.com", studentName: "Shaival Nanavati", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-08-03", tutorId: 47 },
  { parentEmail: "durgadevi.ramesh@gmail.com", studentName: "Tarun Ramesh", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-08-04", tutorId: 23 },
  { parentEmail: "durgadevi.ramesh@gmail.com", studentName: "Tarun Ramesh", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-08-03", tutorId: 47 },
  { parentEmail: "gswathi858@gmail.com", studentName: "Vishnu Gandla", grade: "GR10", courseName: "Digital SAT English", startDate: "2025-12-01", tutorId: 23 },
  { parentEmail: "gswathi858@gmail.com", studentName: "Vishnu Gandla", grade: "GR10", courseName: "Digital SAT Math", startDate: "2025-12-01", tutorId: 47 },
  { parentEmail: "indrarajchatterjee77@gmail.com", studentName: "Ethan Chatterjee", grade: "GR9", courseName: "Digital SAT English", startDate: "2025-11-03", tutorId: 24 },
  { parentEmail: "indrarajchatterjee77@gmail.com", studentName: "Ethan Chatterjee", grade: "GR9", courseName: "Digital SAT Math", startDate: "2025-11-03", tutorId: 47 },
  { parentEmail: "itsme.swethu@gmail.com", studentName: "Vedya Sree", grade: "GR6", courseName: "English - Reading and Writing (Middle School Level)", startDate: null, tutorId: 24 },
  { parentEmail: "itsme.swethu@gmail.com", studentName: "Vedya Sree", grade: "GR6", courseName: "Math - Middle School Level", startDate: "2024-06-01", tutorId: 47 },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Hasini Pericharla", grade: "GR9", courseName: "Basic Java Programming", startDate: null, tutorId: null },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Hasini Pericharla", grade: "GR9", courseName: "Digital SAT Math", startDate: null, tutorId: 47 },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Hasini Pericharla", grade: "GR9", courseName: "Math - High School Level", startDate: null, tutorId: 47 },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Hasini Pericharla", grade: "GR9", courseName: "SAT/ACT - English Reading and Writing", startDate: "2021-07-13", tutorId: null },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Hasini Pericharla", grade: "GR9", courseName: "SAT/ACT - Math Test Prep", startDate: null, tutorId: 47 },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Raju", grade: "Aden", courseName: "Advanced English - Reading and Writing", startDate: "2021-07-28", tutorId: 23 },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Srihitha Pericharla", grade: "GR7", courseName: "Basic Java Programming", startDate: null, tutorId: null },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Srihitha Pericharla", grade: "GR7", courseName: "Digital SAT Math", startDate: null, tutorId: 47 },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Srihitha Pericharla", grade: "GR7", courseName: "English - Reading and Writing (Middle School Level)", startDate: null, tutorId: 23 },
  { parentEmail: "jagapathirajup@gmail.com", studentName: "Srihitha Pericharla", grade: "GR7", courseName: "Math - Middle School Level", startDate: "2021-07-08", tutorId: null },
  { parentEmail: "jaideep.pinglikar@gmail.com", studentName: "Vivaan Jaideep", grade: "GR8", courseName: "Math - Middle School Level", startDate: "2025-01-01", tutorId: null },
  { parentEmail: "jsingh247365@gmail.com", studentName: "Jaskeerat Singh", grade: "GR10", courseName: "AP Statistics", startDate: null, tutorId: 52 },
  { parentEmail: "jsingh247365@gmail.com", studentName: "Jaskeerat Singh", grade: "GR10", courseName: "Digital SAT English", startDate: null, tutorId: 30 },
  { parentEmail: "jsingh247365@gmail.com", studentName: "Jaskeerat Singh", grade: "GR10", courseName: "Digital SAT Math", startDate: null, tutorId: 70 },
  { parentEmail: "jsingh247365@gmail.com", studentName: "Jaskeerat Singh", grade: "GR10", courseName: "Math - High School Level", startDate: "2023-11-12", tutorId: 47 },
  { parentEmail: "jsingh247365@gmail.com", studentName: "Rajveer Singh", grade: "GR7", courseName: "English - Reading and Writing (Middle School Level)", startDate: "2024-09-01", tutorId: 24 },
  { parentEmail: "jsingh247365@gmail.com", studentName: "Rajveer Singh", grade: "GR7", courseName: "Math - Middle School Level", startDate: "2024-09-01", tutorId: 70 },
  { parentEmail: "jyothi.rani@live.in", studentName: "Aarohi B", grade: "GR7", courseName: "Middle School Math-CBSE/ICSE/IB/State", startDate: "2025-05-21", tutorId: 76 },
  { parentEmail: "k99.ram@gmail.com", studentName: "Nikhil kalidindi", grade: "GR9", courseName: "English - Reading and Writing (High School Level)", startDate: "2026-01-29", tutorId: 23 },
  { parentEmail: "kalyani.kankanampati@gmail.com", studentName: "Aneesh Kankanampati", grade: "GR6", courseName: "Math - Middle School Level", startDate: "2024-12-15", tutorId: null },
  { parentEmail: "kavitharajiv94@gmail.com", studentName: "Diya Onat", grade: "GR11", courseName: "HIGH SCHOOL IB MATH", startDate: null, tutorId: 47 },
  { parentEmail: "kavitharajiv94@gmail.com", studentName: "Diya Onat", grade: "GR11", courseName: "High School Math - CBSE/ICSE/IB/State", startDate: "2022-10-19", tutorId: 47 },
  { parentEmail: "kavitharajiv94@gmail.com", studentName: "Diya Onat", grade: "GR11", courseName: "High School Physics - CBSE/ICSE/IB/State", startDate: null, tutorId: 52 },
  { parentEmail: "krithika1412@gmail.com", studentName: "Sana Bharath", grade: "GR8", courseName: "Digital SAT English", startDate: null, tutorId: 23 },
  { parentEmail: "krithika1412@gmail.com", studentName: "Sana Bharath", grade: "GR8", courseName: "English - Reading and Writing (High School Level)", startDate: "2025-03-01", tutorId: null },
  { parentEmail: "krithika1412@gmail.com", studentName: "Sana Bharath", grade: "GR8", courseName: "Math - High School Level", startDate: null, tutorId: 47 },
  { parentEmail: "krithikar06@gmail.com", studentName: "Darshika Karthikeyan", grade: "GR9", courseName: "Math - High School Level", startDate: "2026-02-15", tutorId: 47 },
  { parentEmail: "krithikar06@gmail.com", studentName: "Varsha Karthikeyan", grade: "GR10", courseName: "AP Calculus", startDate: null, tutorId: 54 },
  { parentEmail: "krithikar06@gmail.com", studentName: "Varsha Karthikeyan", grade: "GR10", courseName: "Digital SAT English", startDate: "2025-12-01", tutorId: 23 },
  { parentEmail: "krithikar06@gmail.com", studentName: "Varsha Karthikeyan", grade: "GR10", courseName: "Digital SAT Math", startDate: "2025-12-01", tutorId: 47 },
  { parentEmail: "lnsgeetha@gmail.com", studentName: "Naumikaa Vijayanand", grade: "GR11", courseName: "Digital SAT English", startDate: "2026-01-01", tutorId: 24 },
  { parentEmail: "lnsgeetha@gmail.com", studentName: "Naumikaa Vijayanand", grade: "GR11", courseName: "Digital SAT Math", startDate: "2026-01-01", tutorId: 51 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Arko Das", grade: "GR6", courseName: "High School Hindi-(CBSE/ICSE/IG/IB/State)", startDate: null, tutorId: 71 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Arko Das", grade: "GR6", courseName: "High School Math - CBSE/ICSE/IB/State", startDate: null, tutorId: null },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Arko Das", grade: "GR6", courseName: "Middle School Computer Science (CBSE/ICSE/IG/IB)", startDate: "2024-07-19", tutorId: 50 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Arko Das", grade: "GR6", courseName: "Middle School English - CBSE/ICSE/IB/State", startDate: null, tutorId: 69 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Arko Das", grade: "GR6", courseName: "Middle School Science - CBSE/ICSE/IB/State", startDate: null, tutorId: 57 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "High School Chemistry - CBSE/ICSE/IB/STATE", startDate: null, tutorId: 52 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "High School Computers Science - CBSE/ICSE/IG/IB/STATE", startDate: null, tutorId: 50 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "High School Hindi-(CBSE/ICSE/IG/IB/State)", startDate: null, tutorId: 71 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "High School Math - CBSE/ICSE/IB/State", startDate: null, tutorId: 52 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "High School Physics - CBSE/ICSE/IB/State", startDate: null, tutorId: 52 },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "Middle School Biology - CBSE/ICSE/IB/STATE", startDate: "2023-07-21", tutorId: null },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "Middle School Chemistry - CBSE/ICSE/IB/STATE", startDate: "2023-07-25", tutorId: null },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "Middle School Math-CBSE/ICSE/IB/State", startDate: null, tutorId: null },
  { parentEmail: "mail.rd.in@gmail.com", studentName: "Ujjaini Das", grade: "GR9", courseName: "Middle School Physics-CBSE/ICSE/IB/State", startDate: "2023-07-20", tutorId: null },
  { parentEmail: "maruthi.sundaramoorthy@gmail.com", studentName: "Dhanyasree Ravichandran", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-10-20", tutorId: 30 },
  { parentEmail: "maruthi.sundaramoorthy@gmail.com", studentName: "Dhanyasree Ravichandran", grade: "GR11", courseName: "Digital SAT Math", startDate: null, tutorId: 47 },
  { parentEmail: "minfantprabu@gmail.com", studentName: "Jophiel Infant Prabu", grade: "GR10", courseName: "Digital SAT English", startDate: "2025-11-05", tutorId: 24 },
  { parentEmail: "minfantprabu@gmail.com", studentName: "Jophiel Infant Prabu", grade: "GR10", courseName: "Digital SAT Math", startDate: "2025-11-06", tutorId: 61 },
  { parentEmail: "mrinalini.sureshkumar@gmail.com", studentName: "Mrinalini Suresh Kumar", grade: "GR10", courseName: "Digital SAT English", startDate: "2026-01-01", tutorId: 23 },
  { parentEmail: "mrinalini.sureshkumar@gmail.com", studentName: "Mrinalini Suresh Kumar", grade: "GR10", courseName: "Digital SAT Math", startDate: "2026-01-01", tutorId: 47 },
  { parentEmail: "munidinesh@gmail.com", studentName: "Anvika Dinesh", grade: "GR11", courseName: "Digital SAT English", startDate: "2026-01-10", tutorId: 23 },
  { parentEmail: "munidinesh@gmail.com", studentName: "Anvika Dinesh", grade: "GR11", courseName: "Digital SAT Math", startDate: "2026-01-03", tutorId: 47 },
  { parentEmail: "nami.patel@icloud.com", studentName: "Nami Patel", grade: "GR11", courseName: "Digital SAT English", startDate: "2026-02-10", tutorId: 30 },
  { parentEmail: "nami.patel@icloud.com", studentName: "Nami Patel", grade: "GR11", courseName: "Digital SAT Math", startDate: "2026-02-10", tutorId: 51 },
  { parentEmail: "nanditkoul2023@gmail.com", studentName: "Nandit Koul", grade: "GR11", courseName: "Digital SAT English", startDate: "2026-01-01", tutorId: 23 },
  { parentEmail: "narayanan.vijay@gmail.com", studentName: "Tanushri Vijay", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-10-01", tutorId: 24 },
  { parentEmail: "narayanan.vijay@gmail.com", studentName: "Tanushri Vijay", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-10-01", tutorId: 47 },
  { parentEmail: "nate.srinivasan@gmail.com", studentName: "Madhubala Srinivasan", grade: "GR12", courseName: "Digital SAT English", startDate: "2026-02-10", tutorId: 30 },
  { parentEmail: "nate.srinivasan@gmail.com", studentName: "Madhubala Srinivasan", grade: "GR12", courseName: "Digital SAT Math", startDate: "2026-02-10", tutorId: 61 },
  { parentEmail: "nate.srinivasan@gmail.com", studentName: "Santhosh Srinivasan", grade: "GR12", courseName: "Digital SAT English", startDate: "2026-02-10", tutorId: 30 },
  { parentEmail: "nate.srinivasan@gmail.com", studentName: "Santhosh Srinivasan", grade: "GR12", courseName: "Digital SAT Math", startDate: "2026-02-10", tutorId: 61 },
  { parentEmail: "nirmal.adlin.usa@gmail.com", studentName: "Neola Rini Nirmal", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-12-01", tutorId: 30 },
  { parentEmail: "nirmal.adlin.usa@gmail.com", studentName: "Neola Rini Nirmal", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-12-01", tutorId: 61 },
  { parentEmail: "nirmal.adlin.usa@gmail.com", studentName: "Nichelle Riji Nirmal", grade: "GR10", courseName: "Digital SAT English", startDate: "2025-12-01", tutorId: 30 },
  { parentEmail: "nirmal.adlin.usa@gmail.com", studentName: "Nichelle Riji Nirmal", grade: "GR10", courseName: "Digital SAT Math", startDate: "2025-12-01", tutorId: 61 },
  { parentEmail: "nithdeepsai@gmail.com", studentName: "Nithilan Sai Saravanan", grade: "GR10", courseName: "Digital SAT English", startDate: "2026-02-10", tutorId: 24 },
  { parentEmail: "nithdeepsai@gmail.com", studentName: "Nithilan Sai Saravanan", grade: "GR10", courseName: "Digital SAT Math", startDate: "2026-02-01", tutorId: 61 },
  { parentEmail: "param_palani@yahoo.com", studentName: "Dhruv Parram", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-07-28", tutorId: 23 },
  { parentEmail: "param_palani@yahoo.com", studentName: "Dhruv Parram", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-07-28", tutorId: 47 },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Lakshana P", grade: "GR10", courseName: "High School Biology - CBSE/ICSE/IB/State", startDate: "2023-09-25", tutorId: null },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Lakshana P", grade: "GR10", courseName: "High School Chemistry - CBSE/ICSE/IB/STATE", startDate: "2023-09-25", tutorId: null },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Lakshana P", grade: "GR10", courseName: "High School Computers Science - CBSE/ICSE/IG/IB/STATE", startDate: null, tutorId: 50 },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Lakshana P", grade: "GR10", courseName: "High School English - CBSE/ICSE/IB/State", startDate: null, tutorId: 69 },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Lakshana P", grade: "GR10", courseName: "High School Math - CBSE/ICSE/IB/State", startDate: null, tutorId: null },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Lakshana P", grade: "GR10", courseName: "High School Physics - CBSE/ICSE/IB/State", startDate: "2023-09-25", tutorId: null },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Samyutha P", grade: "GR3", courseName: "Elementary School English - CBSE/ICSE/IB/State", startDate: "2024-01-24", tutorId: null },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Samyutha P", grade: "GR3", courseName: "Middle School English - CBSE/ICSE/IB/State", startDate: null, tutorId: 69 },
  { parentEmail: "pgayathiri@gmail.com", studentName: "Samyutha P", grade: "GR3", courseName: "Spoken English and Grammar", startDate: null, tutorId: null },
  { parentEmail: "raju8raghav@gmail.com", studentName: "Shanvi Sai Kalindindi", grade: "GR4", courseName: "English - Reading and Writing (Elementary Level)", startDate: "2026-02-01", tutorId: null },
  { parentEmail: "raviraju.kalidindi@gmail.com", studentName: "Hitesh Kalidindi", grade: "GR5", courseName: "English - Reading and Writing (Middle School Level)", startDate: "2026-01-01", tutorId: null },
  { parentEmail: "raviraju.kalidindi@gmail.com", studentName: "Saketh Kalidindi", grade: "GR9", courseName: "English - Reading and Writing (High School Level)", startDate: "2025-10-13", tutorId: 30 },
  { parentEmail: "rejincm@gmail.com", studentName: "Anjita Mepparambil", grade: "GR10", courseName: "Digital SAT English", startDate: null, tutorId: 24 },
  { parentEmail: "rejincm@gmail.com", studentName: "Anjita Mepparambil", grade: "GR10", courseName: "SAT Foundation - English", startDate: "2024-02-01", tutorId: 24 },
  { parentEmail: "rjkumr@gmail.com", studentName: "Akhil Rajkumar", grade: "GR10", courseName: "Digital SAT English", startDate: "2025-11-06", tutorId: 24 },
  { parentEmail: "rjkumr@gmail.com", studentName: "Akhil Rajkumar", grade: "GR10", courseName: "Digital SAT Math", startDate: "2025-11-06", tutorId: 61 },
  { parentEmail: "rkumarbin@gmail.com", studentName: "Sanchay Kumar", grade: "GR9", courseName: "High School Chemistry - CBSE/ICSE/IB/STATE", startDate: null, tutorId: null },
  { parentEmail: "rkumarbin@gmail.com", studentName: "Sanchay Kumar", grade: "GR9", courseName: "High School Hindi-(CBSE/ICSE/IG/IB/State)", startDate: "2024-11-01", tutorId: 71 },
  { parentEmail: "rkumarbin@gmail.com", studentName: "Sanchay Kumar", grade: "GR9", courseName: "High School Math - CBSE/ICSE/IB/State", startDate: null, tutorId: 66 },
  { parentEmail: "rkumarbin@gmail.com", studentName: "Sanchay Kumar", grade: "GR9", courseName: "High School Physics - CBSE/ICSE/IB/State", startDate: null, tutorId: 66 },
  { parentEmail: "rodriguescenna@gmail.com", studentName: "Ariana da Cunha", grade: "GR6", courseName: "English - Reading and Writing (Middle School Level)", startDate: "2025-11-30", tutorId: null },
  { parentEmail: "rodriguescenna@gmail.com", studentName: "Ian devices da Cunha", grade: "GR6", courseName: "English - Reading and Writing (Middle School Level)", startDate: "2025-11-30", tutorId: null },
  { parentEmail: "rohiniperhar@gmail.com", studentName: "Kabir Singh Sawhney", grade: "GR7", courseName: "Summer Course - Middle School", startDate: "2025-06-23", tutorId: 24 },
  { parentEmail: "rrupak@yahoo.com", studentName: "Trinika Das", grade: "GR8", courseName: "English - Reading and Writing (Middle School Level)", startDate: "2025-09-13", tutorId: 30 },
  { parentEmail: "sasanakotiusha@gmail.com", studentName: "Karthikeya", grade: "GR10", courseName: "ACT English", startDate: "2025-08-25", tutorId: 24 },
  { parentEmail: "sasanakotiusha@gmail.com", studentName: "Karthikeya", grade: "GR10", courseName: "ACT Math", startDate: "2025-08-25", tutorId: 61 },
  { parentEmail: "sathishkumarprannesh@gmail.com", studentName: "Prannesh Sathish Kumar", grade: "GR11", courseName: "AP Calculus", startDate: null, tutorId: 61 },
  { parentEmail: "sathishkumarprannesh@gmail.com", studentName: "Prannesh Sathish Kumar", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-09-17", tutorId: 61 },
  { parentEmail: "sejunet23@gmail.com", studentName: "Netra Desai", grade: "GR6", courseName: "English - Reading and Writing (Middle School Level)", startDate: "2026-02-01", tutorId: null },
  { parentEmail: "sejunet23@gmail.com", studentName: "Netra Desai", grade: "GR6", courseName: "Math - Middle School Level", startDate: "2026-02-01", tutorId: 51 },
  { parentEmail: "senthil.keel@gmail.com", studentName: "Samyukthaa Senthilkumar", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-11-01", tutorId: 30 },
  { parentEmail: "senthil.keel@gmail.com", studentName: "Samyukthaa Senthilkumar", grade: "GR11", courseName: "Digital SAT Math", startDate: null, tutorId: 51 },
  { parentEmail: "seyyonvn@gmail.com", studentName: "Seyyon Nagharajan", grade: "GR7", courseName: "Math - Middle School Level", startDate: "2024-10-01", tutorId: 52 },
  { parentEmail: "soumyakini@gmail.com", studentName: "Yash Kini", grade: "GR10", courseName: "Digital SAT English", startDate: "2026-01-01", tutorId: 23 },
  { parentEmail: "soumyakini@gmail.com", studentName: "Yash Kini", grade: "GR10", courseName: "Digital SAT Math", startDate: "2026-01-01", tutorId: 47 },
  { parentEmail: "srilakshmi.chennu@gmail.com", studentName: "Dyuthi Kondaveeti", grade: "GR9", courseName: "Math - High School Level", startDate: "2026-03-01", tutorId: 47 },
  { parentEmail: "surapureddy.raj@gmail.com", studentName: "Krithi Surapureddy", grade: "GR5", courseName: "English - Reading and Writing (Elementary Level)", startDate: "2025-09-20", tutorId: null },
  { parentEmail: "suri.rajup@gmail.com", studentName: "Riyansh Penmatcha", grade: "GR9", courseName: "Digital SAT English", startDate: "2026-01-01", tutorId: 23 },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Lakshmi Nagappan", grade: "GR8", courseName: "High School Math - CBSE/ICSE/IB/State", startDate: null, tutorId: 76 },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Lakshmi Nagappan", grade: "GR8", courseName: "Middle School Chemistry - CBSE/ICSE/IB/STATE", startDate: "2023-08-14", tutorId: null },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Lakshmi Nagappan", grade: "GR8", courseName: "Middle School English - CBSE/ICSE/IB/State", startDate: null, tutorId: 24 },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Lakshmi Nagappan", grade: "GR8", courseName: "Middle School Math-CBSE/ICSE/IB/State", startDate: "2023-08-14", tutorId: null },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Lakshmi Nagappan", grade: "GR8", courseName: "Middle School Physics-CBSE/ICSE/IB/State", startDate: "2023-08-14", tutorId: null },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Nachammai Nagappan", grade: "GR11", courseName: "AS Probability and Statistics", startDate: null, tutorId: 47 },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Nachammai Nagappan", grade: "GR11", courseName: "AS Pure Mathematics", startDate: null, tutorId: 47 },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Nachammai Nagappan", grade: "GR11", courseName: "High School Biology - CBSE/ICSE/IB/State", startDate: null, tutorId: null },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Nachammai Nagappan", grade: "GR11", courseName: "High School Chemistry - CBSE/ICSE/IB/STATE", startDate: null, tutorId: 52 },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Nachammai Nagappan", grade: "GR11", courseName: "High School Math - CBSE/ICSE/IB/State", startDate: null, tutorId: 52 },
  { parentEmail: "sw2881984@yahoo.co.in", studentName: "Nachammai Nagappan", grade: "GR11", courseName: "High School Physics - CBSE/ICSE/IB/State", startDate: "2023-08-02", tutorId: 47 },
  { parentEmail: "swathibhat224@gmail.com", studentName: "Payaswini Holla", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-09-01", tutorId: 23 },
  { parentEmail: "swathibhat224@gmail.com", studentName: "Payaswini Holla", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-09-01", tutorId: 47 },
  { parentEmail: "tejarajivreddy@gmail.com", studentName: "Aryan Reddy", grade: "GR6", courseName: "Middle School English - CBSE/ICSE/IB/State", startDate: "2024-02-05", tutorId: null },
  { parentEmail: "thangam.reach@gmail.com", studentName: "Prathikha Vaiyapuri", grade: "GR11", courseName: "Digital SAT English", startDate: "2024-03-26", tutorId: 23 },
  { parentEmail: "thangam.reach@gmail.com", studentName: "Prathikha Vaiyapuri", grade: "GR11", courseName: "Digital SAT Math", startDate: "2024-03-26", tutorId: 70 },
  { parentEmail: "thangam.reach@gmail.com", studentName: "Smita Vaiyapuri", grade: "GR4", courseName: "Digital SAT English", startDate: null, tutorId: 30 },
  { parentEmail: "thangam.reach@gmail.com", studentName: "Smita Vaiyapuri", grade: "GR4", courseName: "English - Reading and Writing (Elementary Level)", startDate: "2024-10-01", tutorId: 24 },
  { parentEmail: "umamagashwari@gmail.com", studentName: "Kiruthik Pranav", grade: "GR9", courseName: "SAT/ACT - English Reading and Writing", startDate: "2022-08-22", tutorId: 23 },
  { parentEmail: "umamagashwari@gmail.com", studentName: "Kiruthik Pranav", grade: "GR9", courseName: "SAT/ACT - Math Test Prep", startDate: "2022-08-15", tutorId: 47 },
  { parentEmail: "umamagashwari@gmail.com", studentName: "Pranav Kiruthik", grade: "GR9", courseName: "SAT/ACT - English Reading and Writing", startDate: "2022-08-21", tutorId: 23 },
  { parentEmail: "umamagashwari@gmail.com", studentName: "Vishal Raswanth", grade: "GR6", courseName: "English - Reading and Writing (High School Level)", startDate: null, tutorId: 24 },
  { parentEmail: "umamagashwari@gmail.com", studentName: "Vishal Raswanth", grade: "GR6", courseName: "Math - Middle School Level", startDate: "2022-08-15", tutorId: null },
  { parentEmail: "veena.uskids@gmail.com", studentName: "Sravani Tadaka", grade: "GR10", courseName: "Digital SAT English", startDate: "2025-09-19", tutorId: 30 },
  { parentEmail: "veena.uskids@gmail.com", studentName: "Sravani Tadaka", grade: "GR10", courseName: "Digital SAT Math", startDate: "2025-09-25", tutorId: 61 },
  { parentEmail: "veena.uskids@gmail.com", studentName: "Sruthi Tadaka", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-07-05", tutorId: 24 },
  { parentEmail: "veena.uskids@gmail.com", studentName: "Sruthi Tadaka", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-06-28", tutorId: 47 },
  { parentEmail: "vidyakar5@gmail.com", studentName: "Aparna Venkitasubramanian", grade: "GR11", courseName: "ACT English", startDate: null, tutorId: 30 },
  { parentEmail: "vidyakar5@gmail.com", studentName: "Aparna Venkitasubramanian", grade: "GR11", courseName: "ACT Math", startDate: null, tutorId: 47 },
  { parentEmail: "vidyakar5@gmail.com", studentName: "Aparna Venkitasubramanian", grade: "GR11", courseName: "Digital SAT English", startDate: "2025-10-20", tutorId: 30 },
  { parentEmail: "vidyakar5@gmail.com", studentName: "Aparna Venkitasubramanian", grade: "GR11", courseName: "Digital SAT Math", startDate: "2025-10-20", tutorId: 47 },
  // gullaswathi@gmail.com — not in subscriptions CSV, parent only
  // jaideep.pinglikar@gmail.com — Vivaan Jaideep Math Middle School, no tutorId
  { parentEmail: "jaideep.pinglikar@gmail.com", studentName: "Vivaan Jaideep", grade: "GR8", courseName: "Math - Middle School Level", startDate: "2025-01-01", tutorId: null },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function parseGrade(grade: string): string {
  return grade.replace(/^GR/i, "").trim();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("DB not available");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash("Admin@123", 10);

  let parentsInserted = 0;
  let parentsSkipped = 0;
  let subsInserted = 0;
  let subsSkipped = 0;

  const skippedSubs: string[] = [];

  // Build email → parentId map
  const parentIdMap: Record<string, number> = {};

  // ── Insert parents ──────────────────────────────────────────────────────────
  for (const p of PARENTS) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, p.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⚠️  Skipping existing parent: ${p.email} (id=${existing[0].id})`);
      parentIdMap[p.email] = existing[0].id;
      parentsSkipped++;
      continue;
    }

    const nameParts = splitName(p.name);

    const [result] = await db.insert(users).values({
      openId: randomUUID(),
      email: p.email,
      passwordHash,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      name: p.name,
      role: "parent",
      userType: "parent",
      phoneNumber: p.phone || null,
      timezone: p.timezone,
      emailVerified: true,
      accountSetupComplete: true,
    } as any);

    const parentId = (result as any).insertId as number;
    parentIdMap[p.email] = parentId;

    // Collect unique students for this parent
    const studentSet = new Map<string, { firstName: string; lastName: string; grade: string }>();
    for (const s of SUBSCRIPTIONS.filter(s => s.parentEmail === p.email)) {
      const { firstName, lastName } = splitName(s.studentName);
      const key = `${firstName}-${lastName}`;
      if (!studentSet.has(key)) {
        studentSet.set(key, { firstName, lastName, grade: parseGrade(s.grade) });
      }
    }

    await db.insert(parentProfiles).values({
      userId: parentId,
      childrenInfo: JSON.stringify(Array.from(studentSet.values())),
      preferredContactMethod: "email",
      timezone: p.timezone,
    } as any);

    console.log(`✅ Parent inserted: ${p.email} (id=${parentId})`);
    parentsInserted++;
  }

  // ── Insert subscriptions ────────────────────────────────────────────────────
  for (const s of SUBSCRIPTIONS) {
    const parentId = parentIdMap[s.parentEmail];
    if (!parentId) {
      skippedSubs.push(`NO_PARENT | ${s.parentEmail} | ${s.studentName} | ${s.courseName}`);
      subsSkipped++;
      continue;
    }

    const courseId = resolveCourseId(s.courseName, s.grade);
    if (!courseId) {
      skippedSubs.push(`NO_COURSE_ID | ${s.parentEmail} | ${s.studentName} | ${s.courseName}`);
      subsSkipped++;
      continue;
    }

    const tutorId = s.tutorId ?? 3; // fallback to Arunn Sivaan (id=3) if no tutor assigned

    const { firstName, lastName } = splitName(s.studentName);
    const grade = parseGrade(s.grade);

    try {
      await db.insert(subscriptions).values({
        parentId,
        courseId,
        preferredTutorId: tutorId,
        studentFirstName: firstName,
        studentLastName: lastName,
        studentGrade: grade,
        status: "active",
        startDate: s.startDate ? new Date(s.startDate) : new Date(),
        paymentStatus: "paid",
      } as any);
      subsInserted++;
    } catch (err: any) {
      console.error(`❌ Error inserting subscription: ${s.parentEmail} | ${s.studentName} | ${s.courseName}`, err.message);
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log("🎉 Migration complete!");
  console.log(`   Parents inserted : ${parentsInserted}`);
  console.log(`   Parents skipped  : ${parentsSkipped} (already exist)`);
  console.log(`   Subs inserted    : ${subsInserted}`);
  console.log(`   Subs skipped     : ${subsSkipped}`);
  console.log("\n⚠️  Skipped subscriptions:");
  skippedSubs.forEach(s => console.log("  ", s));
  console.log("═══════════════════════════════════════");

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
