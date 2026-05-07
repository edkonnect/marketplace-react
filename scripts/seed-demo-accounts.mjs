/**
 * Demo account seeder for walkthrough video recording.
 * Creates one demo parent + one demo tutor with realistic dummy data.
 *
 * Run with:
 *   node scripts/seed-demo-accounts.mjs
 *
 * To clean up afterward:
 *   node scripts/seed-demo-accounts.mjs --cleanup
 */

import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "mysql://tutor_user:Strong$123Pass@localhost:3306/tutor_marketplace";

const DEMO_PARENT_EMAIL = "demo.parent@edkonnect.com";
const DEMO_TUTOR_EMAIL = "demo.tutor@edkonnect.com";
const DEMO_PASSWORD = "Demo@1234";

// Fake but realistic-looking Zoom meeting ID for the demo tutor
const DEMO_ZOOM_MEETING_ID = "856 4834 6210".replace(/ /g, "");

// Rich dummy transcripts — one per session type (SAT Math / Chemistry)
const TRANSCRIPTS = {
  satMath: `Alex Rivera: Good morning Emma! Ready to tackle some SAT Math today?
Emma Mitchell: Hi Alex! Yes, I did review the quadratic equations chapter like you asked.
Alex Rivera: Fantastic. Let's start with a warm-up. Can you solve x squared minus 5x plus 6 equals zero by factoring?
Emma Mitchell: Sure. I need two numbers that multiply to 6 and add to negative 5... that's negative 2 and negative 3. So x minus 2 times x minus 3 equals zero. x is 2 or 3.
Alex Rivera: Perfect, that's exactly right. Now let's ramp it up — what about 2x squared plus 7x minus 15 equals zero?
Emma Mitchell: Hmm, that's a bit harder because the leading coefficient isn't 1. I need to multiply 2 by negative 15 which is negative 30, and find two numbers that give me negative 30 and add to 7.
Alex Rivera: Good thinking. Keep going.
Emma Mitchell: That would be 10 and negative 3. So I rewrite it as 2x squared plus 10x minus 3x minus 15, then factor by grouping... 2x times x plus 5, minus 3 times x plus 5... so x plus 5 times 2x minus 3. That gives x equals negative 5 or x equals 1.5.
Alex Rivera: Excellent work Emma. That's the AC method and you nailed it on the first try. Now, the SAT loves to test quadratics in word problem form. Let me read you one.
Alex Rivera: A ball is thrown upward from a height of 6 feet. Its height h in feet at time t in seconds is given by h equals negative 16t squared plus 32t plus 6. When does the ball hit the ground?
Emma Mitchell: I need to set h to zero. Negative 16t squared plus 32t plus 6 equals zero. I can divide everything by negative 2 to simplify... 8t squared minus 16t minus 3 equals zero.
Alex Rivera: Good simplification. Use the quadratic formula now.
Emma Mitchell: t equals 16 plus or minus the square root of 256 plus 96, all over 16. That's 16 plus or minus root 352 over 16. Root 352 is about 18.76... so t is roughly 34.76 over 16 which is about 2.17 seconds.
Alex Rivera: Exactly right. And we discard the negative solution because time can't be negative. Great reasoning Emma.
Emma Mitchell: I always forget to mention that part, I'll remember it on the actual test.
Alex Rivera: Let's move to data analysis. The SAT Reading section sometimes has a graph — what's the mean of this data set: 12, 15, 15, 18, 20, 22, 22, 22, 25, 29?
Emma Mitchell: Let me add them up... 12 plus 15 is 27, plus 15 is 42, plus 18 is 60, plus 20 is 80, plus 22 is 102, plus 22 is 124, plus 22 is 146, plus 25 is 171, plus 29 is 200. Divided by 10 that's 20.
Alex Rivera: Correct. What's the mode?
Emma Mitchell: 22, it appears three times.
Alex Rivera: And the median?
Emma Mitchell: There are 10 numbers so I average the 5th and 6th values. The 5th is 20 and the 6th is 22. The median is 21.
Alex Rivera: Perfect. You're really getting confident with these. Let's do two more word problems for time practice — I'll set the timer for 4 minutes total, 2 minutes each. Ready?
Emma Mitchell: Ready!
Alex Rivera: Great work today Emma. For homework please complete practice set pages 45 through 52 from the blue book, focusing on the word problems. Next session we'll tackle systems of equations and I think you'll find them very manageable after today.
Emma Mitchell: Thank you Alex, this was really helpful!
Alex Rivera: You're doing great. See you Thursday!`,

  chemistry: `Alex Rivera: Good afternoon Liam! How are you feeling about chemistry today?
Liam Mitchell: Pretty good! I looked at the periodic table again last night.
Alex Rivera: Excellent. Let's test that. Without looking, can you tell me what element has atomic number 8?
Liam Mitchell: Oxygen!
Alex Rivera: Nice. And atomic number 17?
Liam Mitchell: Chlorine?
Alex Rivera: Exactly right. You're getting these down. Now let me ask you something a bit deeper. What's the difference between atomic number and atomic mass?
Liam Mitchell: Atomic number is the number of protons in the nucleus, and that's what makes the element what it is. Atomic mass is... the total weight of protons and neutrons?
Alex Rivera: Perfect definition. And why does atomic mass sometimes have a decimal like chlorine's 35.45?
Liam Mitchell: Because there are different isotopes? Like some chlorine atoms have more neutrons than others?
Alex Rivera: Exactly! You just independently derived the concept of isotopes. Well done. So chlorine-35 has 18 neutrons and chlorine-37 has 20 neutrons, and the 35.45 is a weighted average based on how common each isotope is in nature.
Liam Mitchell: Oh that makes total sense. I was wondering why it wasn't a whole number.
Alex Rivera: That's a great scientific instinct — always question the decimals. Now let's move to electron configuration. Where do electrons live?
Liam Mitchell: In shells around the nucleus?
Alex Rivera: That's the simplified version, which is fine for now. The shells are also called energy levels. The first shell holds 2 electrons, the second holds 8, the third holds 8 for the elements we'll see on most tests. So sodium has atomic number 11 — how are its 11 electrons arranged?
Liam Mitchell: 2 in the first shell, 8 in the second, and 1 left over in the third?
Alex Rivera: Perfect. That lone electron in the outer shell is why sodium is so reactive — it really wants to give that electron away. Now, when sodium gives that electron to chlorine, what do we get?
Liam Mitchell: Sodium chloride? Like table salt?
Alex Rivera: Exactly! And because sodium gives an electron and becomes positively charged, and chlorine gains one and becomes negatively charged, they attract each other. That's an ionic bond.
Liam Mitchell: So opposite charges attract, like magnets.
Alex Rivera: Great analogy. Now let's practice balancing a chemical equation. Hydrogen plus oxygen makes water. Can you balance it?
Liam Mitchell: H2 plus O2 makes H2O... but the oxygens don't balance. There are 2 on the left and 1 on the right.
Alex Rivera: Right, so what do you do?
Liam Mitchell: Put a 2 in front of the water... 2H2O. Now I have 4 hydrogens on the right so I need 2H2 on the left. So 2H2 plus O2 makes 2H2O.
Alex Rivera: Excellent! That's perfectly balanced. 4 hydrogens and 2 oxygens on each side. Let's do one more — methane combustion. CH4 plus O2 makes CO2 plus H2O.
Liam Mitchell: Okay... carbon is already 1 on each side. Hydrogen — I have 4 on the left and 2 in water on the right. So I need 2H2O. Now I have 2 oxygens from 2H2O and 2 from CO2, that's 4 total on the right. So I need 2O2 on the left.
Alex Rivera: Let's check: CH4 plus 2O2 makes CO2 plus 2H2O. Carbon: 1 and 1. Hydrogen: 4 and 4. Oxygen: 4 and 4. You got it!
Liam Mitchell: That was actually kind of fun when you do it step by step.
Alex Rivera: That's the key — systematic approach. For homework, try the mole conversion worksheet, 20 problems. We'll do limiting reagents next time, which builds directly on everything we did today.
Liam Mitchell: Got it, thanks Alex!`,
};

const CLEANUP = process.argv.includes("--cleanup");

// ── helpers ──────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID();
}

function ms(date) {
  return date.getTime();
}

/** Return a date N days from now */
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/** Return a date N days ago */
function daysAgo(n) {
  return daysFromNow(-n);
}

/** Build a scheduledAt timestamp for a session: Nhours from a base date */
function sessionAt(baseDate, hour = 10) {
  const d = new Date(baseDate);
  d.setHours(hour, 0, 0, 0);
  return ms(d);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("✓ Connected to database");

  if (CLEANUP) {
    await cleanup(conn);
    await conn.end();
    return;
  }

  // ── 1. Hash password ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = new Date();

  // ── 2. Fetch two real courses to attach sessions/subscriptions to ─────────
  const [courseRows] = await conn.query(
    "SELECT id, title, subject FROM courses WHERE isActive = 1 LIMIT 2"
  );
  if (courseRows.length < 2) {
    console.error("❌ Need at least 2 active courses in the database. Aborting.");
    await conn.end();
    process.exit(1);
  }
  const course1 = courseRows[0]; // e.g. SAT Math
  const course2 = courseRows[1]; // e.g. Chemistry

  console.log(`  Using courses: "${course1.title}" and "${course2.title}"`);

  // ── 3. Create demo TUTOR ──────────────────────────────────────────────────
  const tutorOpenId = uuid();
  const tutorReferralCode = crypto.randomBytes(6).toString("hex");

  // Check if already exists
  const [existingTutor] = await conn.query(
    "SELECT id FROM users WHERE email = ?",
    [DEMO_TUTOR_EMAIL]
  );
  let tutorId;
  if (existingTutor.length > 0) {
    tutorId = existingTutor[0].id;
    console.log(`  Demo tutor already exists (id=${tutorId}), reusing.`);
  } else {
    const [tutorRes] = await conn.query(
      `INSERT INTO users
        (openId, email, passwordHash, firstName, lastName, name, role, userType,
         emailVerified, accountSetupComplete, timezone, referralCode, createdAt, updatedAt, lastSignedIn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tutorOpenId,
        DEMO_TUTOR_EMAIL,
        passwordHash,
        "Alex",
        "Rivera",
        "Alex Rivera",
        "tutor",
        "tutor",
        true,  // emailVerified
        true,  // accountSetupComplete
        "America/New_York",
        tutorReferralCode,
        now,
        now,
        now,
      ]
    );
    tutorId = tutorRes.insertId;
    console.log(`✓ Created demo tutor: id=${tutorId}`);

    // Tutor profile
    await conn.query(
      `INSERT INTO tutor_profiles
        (userId, bio, qualifications, subjects, gradeLevels, hourlyRate, yearsOfExperience,
         isActive, approvalStatus, rating, totalReviews, businessTimezone, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tutorId,
        "I'm a passionate educator with 6 years of experience helping students excel in Math and Science. My goal is to make complex concepts approachable and fun.",
        "M.Sc. Mathematics, Columbia University · B.Sc. Physics, NYU · Certified SAT/ACT Prep Instructor",
        JSON.stringify(["Mathematics", "SAT Math", "Chemistry", "Physics"]),
        JSON.stringify(["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"]),
        "55.00",
        6,
        true,
        "approved",
        "4.90",
        12,
        "America/New_York",
        now,
        now,
      ]
    );

    // Tutor availability (Mon–Fri, 9 AM – 6 PM)
    const days = [1, 2, 3, 4, 5]; // Monday to Friday
    for (const day of days) {
      await conn.query(
        `INSERT INTO tutor_availability (tutorId, dayOfWeek, startTime, endTime, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tutorId, day, "09:00", "18:00", true, now, now]
      );
    }

    // Assign tutor to both courses
    for (const course of [course1, course2]) {
      // Check if already assigned
      const [existing] = await conn.query(
        "SELECT id FROM course_tutors WHERE courseId = ? AND tutorId = ?",
        [course.id, tutorId]
      );
      if (existing.length === 0) {
        await conn.query(
          `INSERT INTO course_tutors (courseId, tutorId, isPrimary, createdAt) VALUES (?, ?, ?, ?)`,
          [course.id, tutorId, false, now]
        );
      }
    }

    console.log("✓ Tutor profile, availability, and course assignments created");
  }

  // ── 4. Create demo PARENT ─────────────────────────────────────────────────
  const parentOpenId = uuid();
  const parentReferralCode = crypto.randomBytes(6).toString("hex");

  const [existingParent] = await conn.query(
    "SELECT id FROM users WHERE email = ?",
    [DEMO_PARENT_EMAIL]
  );
  let parentId;
  if (existingParent.length > 0) {
    parentId = existingParent[0].id;
    console.log(`  Demo parent already exists (id=${parentId}), reusing.`);
  } else {
    const [parentRes] = await conn.query(
      `INSERT INTO users
        (openId, email, passwordHash, firstName, lastName, name, role, userType,
         emailVerified, accountSetupComplete, timezone, phoneNumber, referralCode, createdAt, updatedAt, lastSignedIn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parentOpenId,
        DEMO_PARENT_EMAIL,
        passwordHash,
        "Sarah",
        "Mitchell",
        "Sarah Mitchell",
        "parent",
        "parent",
        true,
        true,
        "America/New_York",
        "+1-555-867-5309",
        parentReferralCode,
        now,
        now,
        now,
      ]
    );
    parentId = parentRes.insertId;
    console.log(`✓ Created demo parent: id=${parentId}`);

    // Parent profile with two children
    await conn.query(
      `INSERT INTO parent_profiles
        (userId, childrenInfo, preferredContactMethod, bestTimeToContact, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        parentId,
        JSON.stringify([
          { name: "Emma Mitchell", age: 15, grade: "Grade 10" },
          { name: "Liam Mitchell", age: 13, grade: "Grade 8" },
        ]),
        "email",
        "Evenings after 6 PM",
        now,
        now,
      ]
    );
    console.log("✓ Parent profile created");
  }

  // ── 5. Create subscriptions ───────────────────────────────────────────────
  const [existingSubs] = await conn.query(
    "SELECT id FROM subscriptions WHERE parentId = ?",
    [parentId]
  );

  let sub1Id, sub2Id;

  if (existingSubs.length >= 2) {
    sub1Id = existingSubs[0].id;
    sub2Id = existingSubs[1].id;
    console.log("  Subscriptions already exist, reusing.");
  } else {
    const subStart = daysAgo(30);

    const [sub1] = await conn.query(
      `INSERT INTO subscriptions
        (parentId, courseId, preferredTutorId, studentFirstName, studentLastName, studentGrade,
         status, startDate, sessionsCompleted, paymentStatus, paymentPlan, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parentId, course1.id, tutorId,
        "Emma", "Mitchell", "Grade 10",
        "active", subStart, 8,
        "paid", "monthly",
        now, now,
      ]
    );
    sub1Id = sub1.insertId;

    const [sub2] = await conn.query(
      `INSERT INTO subscriptions
        (parentId, courseId, preferredTutorId, studentFirstName, studentLastName, studentGrade,
         status, startDate, sessionsCompleted, paymentStatus, paymentPlan, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parentId, course2.id, tutorId,
        "Liam", "Mitchell", "Grade 8",
        "active", subStart, 5,
        "paid", "monthly",
        now, now,
      ]
    );
    sub2Id = sub2.insertId;

    console.log("✓ Created 2 subscriptions");
  }

  // ── 6. Create sessions ────────────────────────────────────────────────────
  const [existingSessions] = await conn.query(
    "SELECT id FROM sessions WHERE parentId = ?",
    [parentId]
  );

  if (existingSessions.length > 0) {
    console.log(`  Sessions already exist (${existingSessions.length}), skipping.`);
  } else {
    // Past completed sessions (last 4 weeks)
    const completedSessionsData = [
      { daysBack: 28, subId: sub1Id, hour: 10, student: "Emma", grade: "Grade 10" },
      { daysBack: 21, subId: sub2Id, hour: 14, student: "Liam",  grade: "Grade 8" },
      { daysBack: 14, subId: sub1Id, hour: 10, student: "Emma", grade: "Grade 10" },
      { daysBack: 14, subId: sub2Id, hour: 14, student: "Liam",  grade: "Grade 8" },
      { daysBack: 7,  subId: sub1Id, hour: 10, student: "Emma", grade: "Grade 10" },
      { daysBack: 7,  subId: sub2Id, hour: 14, student: "Liam",  grade: "Grade 8" },
      { daysBack: 3,  subId: sub1Id, hour: 10, student: "Emma", grade: "Grade 10" },
      { daysBack: 2,  subId: sub2Id, hour: 14, student: "Liam",  grade: "Grade 8" },
    ];

    const completedIds = [];
    for (const s of completedSessionsData) {
      const scheduledAt = sessionAt(daysAgo(s.daysBack), s.hour);
      const [res] = await conn.query(
        `INSERT INTO sessions
          (subscriptionId, tutorId, parentId, courseId, scheduledAt, duration, status,
           studentFirstName, studentGrade, meetingPlatform, meetingUrl, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.subId, tutorId, parentId,
          s.subId === sub1Id ? course1.id : course2.id,
          scheduledAt, 60, "completed",
          s.student, s.grade,
          "Zoom", "https://zoom.us/j/demo123456",
          now, now,
        ]
      );
      completedIds.push({ id: res.insertId, subId: s.subId, student: s.student });
    }

    // Upcoming sessions (next 3 weeks)
    const upcomingSessionsData = [
      { daysAhead: 3,  subId: sub1Id, hour: 10, student: "Emma", grade: "Grade 10" },
      { daysAhead: 5,  subId: sub2Id, hour: 14, student: "Liam",  grade: "Grade 8" },
      { daysAhead: 10, subId: sub1Id, hour: 10, student: "Emma", grade: "Grade 10" },
      { daysAhead: 12, subId: sub2Id, hour: 14, student: "Liam",  grade: "Grade 8" },
      { daysAhead: 17, subId: sub1Id, hour: 10, student: "Emma", grade: "Grade 10" },
    ];

    for (const s of upcomingSessionsData) {
      const scheduledAt = sessionAt(daysFromNow(s.daysAhead), s.hour);
      await conn.query(
        `INSERT INTO sessions
          (subscriptionId, tutorId, parentId, courseId, scheduledAt, duration, status,
           studentFirstName, studentGrade, meetingPlatform, meetingUrl, hostMeetingUrl, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.subId, tutorId, parentId,
          s.subId === sub1Id ? course1.id : course2.id,
          scheduledAt, 60, "scheduled",
          s.student, s.grade,
          "Zoom",
          "https://zoom.us/j/demo123456?pwd=demopass",
          "https://zoom.us/s/demo123456?zak=demohost",
          now, now,
        ]
      );
    }

    console.log(`✓ Created ${completedSessionsData.length} completed + ${upcomingSessionsData.length} upcoming sessions`);

    // ── 7. Session notes for completed sessions ──────────────────────────────
    const noteTemplates = [
      {
        progressSummary: "Emma worked through quadratic equations and showed strong improvement in factoring. She solved 8 out of 10 practice problems correctly.",
        homework: "Complete SAT Math practice set pages 45–52. Focus on word problems involving quadratics.",
        challenges: "Emma struggles slightly with complex number operations — we'll revisit next session.",
        nextSteps: "Next session: introduce systems of equations. Emma is ready to move forward.",
        topicsCovered: JSON.stringify(["Quadratic Equations", "Factoring", "SAT Math Strategy"]),
      },
      {
        progressSummary: "Liam covered the periodic table and atomic structure. He shows great curiosity and asks excellent questions.",
        homework: "Review atomic number vs. atomic mass. Watch the Khan Academy video on electron configuration.",
        challenges: "Balancing chemical equations is still tricky — needs more practice with coefficients.",
        nextSteps: "Next session: chemical bonding and ionic vs. covalent bonds.",
        topicsCovered: JSON.stringify(["Periodic Table", "Atomic Structure", "Electron Configuration"]),
      },
      {
        progressSummary: "Emma practiced reading comprehension and data analysis questions. Her timing improved significantly — now averaging 1:15 per question.",
        homework: "Complete 2 full reading passages from the College Board blue book (pg. 100–115).",
        challenges: "Inference questions are still a weak spot — needs to practice reading between the lines.",
        nextSteps: "Work on evidence-based reading strategies. Emma will take a full section timed test next session.",
        topicsCovered: JSON.stringify(["Reading Comprehension", "Data Analysis", "SAT Reading Strategy"]),
      },
      {
        progressSummary: "Liam made great progress on stoichiometry. We completed 12 mole conversion problems together and he is now grasping the concept well.",
        homework: "Practice problems: Mole conversions worksheet (20 problems). Aim for 80% accuracy.",
        challenges: "Converting between grams and moles takes extra time — suggest using a reference card.",
        nextSteps: "Introduction to limiting reagents and percent yield next session.",
        topicsCovered: JSON.stringify(["Stoichiometry", "Mole Conversions", "Dimensional Analysis"]),
      },
    ];

    // Add notes for the first 4 completed sessions
    for (let i = 0; i < Math.min(4, completedIds.length); i++) {
      const s = completedIds[i];
      const note = noteTemplates[i % noteTemplates.length];
      await conn.query(
        `INSERT INTO session_notes
          (sessionId, tutorId, parentId, progressSummary, homework, challenges, nextSteps,
           topicsCovered, parentNotified, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, tutorId, parentId,
          note.progressSummary, note.homework, note.challenges, note.nextSteps,
          note.topicsCovered, true,
          now, now,
        ]
      );
    }
    console.log("✓ Created session notes");
  }

  // ── 8. Create a conversation + messages ───────────────────────────────────
  const [existingConvs] = await conn.query(
    "SELECT id FROM conversations WHERE parentId = ? AND tutorId = ?",
    [parentId, tutorId]
  );

  if (existingConvs.length > 0) {
    console.log("  Conversation already exists, skipping.");
  } else {
    const dedupeKey = `parent_tutor_${parentId}_${tutorId}`;
    const [convRes] = await conn.query(
      `INSERT INTO conversations
        (parentId, tutorId, conversationType, dedupeKey, lastMessageAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [parentId, tutorId, "parent_tutor", dedupeKey, ms(daysAgo(1)), now, now]
    );
    const convId = convRes.insertId;

    const msgData = [
      { sender: parentId, content: "Hi Alex! Just wanted to check in — Emma said she really enjoyed yesterday's SAT Math session. 😊", daysBack: 5 },
      { sender: tutorId,  content: "That's wonderful to hear! Emma is making excellent progress. She really nailed the quadratic equations yesterday. I'm very proud of her effort.", daysBack: 5 },
      { sender: parentId, content: "Great! Is there anything specific we should have her practice before the next session?", daysBack: 4 },
      { sender: tutorId,  content: "Yes! I've left detailed notes in the portal under her session. In short — focus on the word problems in pages 45–52 of the SAT prep book. She's almost ready for a full timed practice test!", daysBack: 4 },
      { sender: parentId, content: "Perfect, I'll make sure she gets to that this weekend. Also, is there a session next Thursday at 10 AM still?", daysBack: 1 },
      { sender: tutorId,  content: "Yes, Thursday 10 AM is confirmed! I'll send a Zoom link reminder the night before. See you then! 📅", daysBack: 1 },
    ];

    for (const m of msgData) {
      const sentAt = ms(daysAgo(m.daysBack));
      await conn.query(
        `INSERT INTO messages (conversationId, senderId, content, isRead, sentAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [convId, m.sender, m.content, true, sentAt, now]
      );
    }
    console.log("✓ Created conversation with 6 messages");
  }

  // ── 9. Set Zoom meeting ID on tutor profile + seed zoom_meeting_recordings ─
  const demoJoinUrl = `https://us05web.zoom.us/j/${DEMO_ZOOM_MEETING_ID}?pwd=demopass`;
  const demoHostUrl = `https://us05web.zoom.us/s/${DEMO_ZOOM_MEETING_ID}?zak=demohost`;

  await conn.query(
    `UPDATE tutor_profiles SET zoomMeetingId=?, zoomJoinUrl=?, zoomHostUrl=? WHERE userId=?`,
    [DEMO_ZOOM_MEETING_ID, demoJoinUrl, demoHostUrl, tutorId]
  );

  // Update all demo sessions to use this meeting URL so "Fetch Transcript" button works
  await conn.query(
    `UPDATE sessions SET meetingUrl=?, hostMeetingUrl=? WHERE parentId=? OR tutorId=?`,
    [demoJoinUrl, demoHostUrl, parentId, tutorId]
  );

  // Fetch completed session IDs so we can insert recording rows
  const [completedRows] = await conn.query(
    `SELECT id, scheduledAt, courseId FROM sessions
     WHERE parentId=? AND status='completed' ORDER BY scheduledAt ASC`,
    [parentId]
  );

  for (const session of completedRows) {
    const recordingUuid = `DEMO-${session.id}-${DEMO_ZOOM_MEETING_ID}`;

    // Skip if already inserted
    const [existing] = await conn.query(
      "SELECT id FROM zoom_meeting_recordings WHERE id=?", [recordingUuid]
    );
    if (existing.length > 0) continue;

    const isSatMath = session.courseId === course1.id;
    const transcriptText = isSatMath ? TRANSCRIPTS.satMath : TRANSCRIPTS.chemistry;
    const recordedAt = new Date(session.scheduledAt);

    await conn.query(
      `INSERT INTO zoom_meeting_recordings
        (id, meetingId, sessionId, topic, transcriptText, durationMinutes,
         recordedAt, processedAt, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordingUuid,
        DEMO_ZOOM_MEETING_ID,
        session.id,
        isSatMath ? "SAT Math – Alex Rivera" : "Chemistry Fundamentals – Alex Rivera",
        transcriptText,
        60,
        recordedAt,
        now,
        "completed",
        now,
        now,
      ]
    );
  }
  console.log(`✓ Set tutor Zoom meeting ID and inserted ${completedRows.length} recording rows`);

  // Also backfill transcript text into the existing session_notes rows
  await conn.query(
    `UPDATE session_notes sn
     JOIN sessions s ON s.id = sn.sessionId
     JOIN zoom_meeting_recordings zmr ON zmr.sessionId = s.id
     SET sn.transcript = zmr.transcriptText
     WHERE sn.tutorId = ? AND sn.transcript IS NULL`,
    [tutorId]
  );
  console.log("✓ Backfilled transcript text into session notes");

  // ── 10. Create a payout request for the tutor ────────────────────────────
  const [existingPayouts] = await conn.query(
    "SELECT id FROM tutorPayoutRequests WHERE tutorId = ?",
    [tutorId]
  );

  if (existingPayouts.length === 0) {
    await conn.query(
      `INSERT INTO tutorPayoutRequests
        (tutorId, subscriptionId, sessionsCompleted, ratePerSession, totalAmount, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tutorId, sub1Id, 8, "45.00", "360.00", "pending", now, now]
    );
    console.log("✓ Created tutor payout request");
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  await conn.end();

  console.log("\n" + "═".repeat(55));
  console.log("  DEMO ACCOUNTS READY");
  console.log("═".repeat(55));
  console.log("\n  🎓 DEMO TUTOR");
  console.log(`  Email    : ${DEMO_TUTOR_EMAIL}`);
  console.log(`  Password : ${DEMO_PASSWORD}`);
  console.log(`  Name     : Alex Rivera`);
  console.log(`  Courses  : ${course1.title}, ${course2.title}`);
  console.log("\n  👨‍👩‍👧‍👦 DEMO PARENT");
  console.log(`  Email    : ${DEMO_PARENT_EMAIL}`);
  console.log(`  Password : ${DEMO_PASSWORD}`);
  console.log(`  Name     : Sarah Mitchell`);
  console.log(`  Children : Emma (Grade 10), Liam (Grade 8)`);
  console.log("\n  ✓ Sessions    : 8 completed + 5 upcoming");
  console.log("  ✓ Notes       : 4 session notes with feedback");
  console.log("  ✓ Transcripts : 8 Zoom recording rows with full dialogue");
  console.log("  ✓ Messages    : Active conversation thread");
  console.log("  ✓ Payout      : 1 pending payout request");
  console.log(`\n  Tutor Zoom meeting ID : ${DEMO_ZOOM_MEETING_ID}`);
  console.log("\n" + "═".repeat(55));
  console.log("\n  To clean up: node scripts/seed-demo-accounts.mjs --cleanup\n");
}

// ── cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(conn) {
  console.log("Cleaning up demo accounts...");

  const [[tutor]] = await conn.query("SELECT id FROM users WHERE email = ?", [DEMO_TUTOR_EMAIL]);
  const [[parent]] = await conn.query("SELECT id FROM users WHERE email = ?", [DEMO_PARENT_EMAIL]);

  if (parent) {
    // Delete sessions & notes (cascade handles sub-records)
    await conn.query("DELETE FROM sessions WHERE parentId = ?", [parent.id]);
    await conn.query("DELETE FROM conversations WHERE parentId = ?", [parent.id]);
    await conn.query("DELETE FROM subscriptions WHERE parentId = ?", [parent.id]);
    await conn.query("DELETE FROM parent_profiles WHERE userId = ?", [parent.id]);
    await conn.query("DELETE FROM users WHERE id = ?", [parent.id]);
    console.log("✓ Deleted demo parent");
  }

  if (tutor) {
    await conn.query("DELETE FROM zoom_meeting_recordings WHERE meetingId = ?", [DEMO_ZOOM_MEETING_ID]);
    await conn.query("DELETE FROM tutorPayoutRequests WHERE tutorId = ?", [tutor.id]);
    await conn.query("DELETE FROM tutor_availability WHERE tutorId = ?", [tutor.id]);
    await conn.query("DELETE FROM course_tutors WHERE tutorId = ?", [tutor.id]);
    await conn.query("DELETE FROM tutor_profiles WHERE userId = ?", [tutor.id]);
    await conn.query("DELETE FROM users WHERE id = ?", [tutor.id]);
    console.log("✓ Deleted demo tutor");
  }

  console.log("✓ Cleanup complete");
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
