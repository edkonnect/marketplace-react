// Shared category detection + sheet-order sort map.
// Order matches the xlsx tabs: CBSE, ICSE/ICS, IB, IGCSE, AP, A Level,
// Test Prep, Middle School, Elementary, High School, Computer Science, Languages

export const COURSE_CATEGORIES = [
  "CBSE",
  "ICSE/ICS",
  "IB",
  "IGCSE",
  "AP",
  "A Level",
  "Test Prep",
  "Middle School",
  "Elementary",
  "High School",
  "Computer Science",
  "Languages",
] as const;

export type CourseCategory = (typeof COURSE_CATEGORIES)[number];

// ── Sort order from the xlsx (title lowercased → global position) ──────────
export const COURSE_SORT_ORDER: Record<string, number> = {
  "cbse biology- grade 11": 1,
  "cbse biology- grade 12": 2,
  "cbse board crash course grade 10-chemistry": 3,
  "cbse board crash course-grade 10 mathematics": 4,
  "cbse board crash course-grade 10 physics": 5,
  "cbse board crash course-grade 12 mathematics": 6,
  "cbse board crash course-grade 12 physics": 7,
  "cbse board crash course-grade-10 biology": 8,
  "cbse board crash course-grade-12 biology": 9,
  "cbse board crash course-grade12 chemistry": 10,
  "cbse chemistry-grade-11": 11,
  "cbse chemistry-grade-12": 12,
  "cbse computer science (code 083)": 13,
  "cbse english grade 1": 14,
  "cbse english grade 4": 15,
  "cbse grade 1 hindi": 16,
  "cbse grade 10 english": 17,
  "cbse grade 10 hindi": 18,
  "cbse grade 10 mathematics": 19,
  "cbse grade 10 science": 20,
  "cbse grade 11 - economics": 21,
  "cbse grade 11 - history": 22,
  "cbse grade 11 english": 23,
  "cbse grade 11 geography": 24,
  "cbse grade 11 hindi": 25,
  "cbse grade 11 mathematics": 26,
  "cbse grade 11 physics": 27,
  "cbse grade 11- political science": 28,
  "cbse grade 12 - economics": 29,
  "cbse grade 12 - geography": 30,
  "cbse grade 12 - history": 31,
  "cbse grade 12 - political science": 32,
  "cbse grade 12 english": 33,
  "cbse grade 12 hindi": 34,
  "cbse grade 12 mathematics": 35,
  "cbse grade 12 physics": 36,
  "cbse grade 2 english": 37,
  "cbse grade 2 hindi": 38,
  "cbse grade 3 english": 39,
  "cbse grade 3 hindi": 40,
  "cbse grade 4 hindi": 41,
  "cbse grade 5 english": 42,
  "cbse grade 5 hindi": 43,
  "cbse grade 6 english": 44,
  "cbse grade 6 hindi": 45,
  "cbse grade 7 english": 46,
  "cbse grade 7 hindi": 47,
  "cbse grade 8 english": 48,
  "cbse grade 8 hindi": 49,
  "cbse grade 8 mathematics": 50,
  "cbse grade 8 science": 51,
  "cbse grade 9 english": 52,
  "cbse grade 9 hindi": 53,
  "cbse grade 9 mathematics": 54,
  "cbse grade 9 science": 55,
  "cbse social studies - grade 10": 56,
  "cbse social studies - grade 6": 57,
  "cbse social studies - grade 7": 58,
  "cbse social studies - grade 8": 59,
  "cbse social studies - grade 9": 60,
  "icse ai and robotics (code 66)": 61,
  "icse computer applications (code 86)": 62,
  "icse grade 1 english": 63,
  "icse grade 1 hindi": 64,
  "icse grade 10 biology crash course - 8 weeks": 65,
  "icse grade 10 chemistry crash course - 6 weeks": 66,
  "icse grade 10 hindi": 67,
  "icse grade 10 physics crash course - 6 weeks": 68,
  "icse grade 11 hindi": 69,
  "icse grade 12 biologyy crash course - 8 weeks": 70,
  "icse grade 12 chemistry crash course - 8 weeks": 71,
  "icse grade 12 hindi": 72,
  "icse grade 12 physics crash course - 8 weeks": 73,
  "icse grade 2 english": 74,
  "icse grade 2 hindi": 75,
  "icse grade 3 hindi": 76,
  "icse grade 4 hindi": 77,
  "icse grade 5 hindi": 78,
  "icse grade 6 hindi": 79,
  "icse grade 7 hindi": 80,
  "icse grade 8 hindi": 81,
  "icse grade 9 hindi": 82,
  "icse high school biology - grade 10": 83,
  "icse high school biology - grade 11": 84,
  "icse high school biology - grade 12": 85,
  "icse high school biology - grade 9": 86,
  "icse high school biology- grade 8": 87,
  "icse high school chemistry - grade 10": 88,
  "icse high school chemistry - grade 11": 89,
  "icse high school chemistry - grade 12": 90,
  "icse high school chemistry - grade 8": 91,
  "icse high school chemistry - grade 9": 92,
  "icse high school physics - garde 12": 93,
  "icse high school physics - grade 10": 94,
  "icse high school physics - grade 11": 95,
  "icse high school physics - grade 8": 96,
  "icse high school physics - grade 9": 97,
  "icse middle school biology - grade 6": 98,
  "icse middle school biology - grade 7": 99,
  "icse middle school chemistry - grade 6": 100,
  "icse middle school chemistry - grade 7": 101,
  "icse middle school physics - grade 6": 102,
  "icse middle school physics - grade 7": 103,
  "isc computer science (code 868)": 104,
  "ib computer science": 105,
  "ib dp biology (sl + hl)": 106,
  "ib dp business management (sl + hl)": 107,
  "ib dp chemistry (sl + hl)": 108,
  "ib dp computer science (sl + hl)": 109,
  "ib dp design technology (dt)  (sl + hl)": 110,
  "ib dp economics (sl + hl)": 111,
  "ib dp environmental systems & societies (ess)": 112,
  "ib dp geography (sl + hl)": 113,
  "ib dp global politics (sl + hl)": 114,
  "ib dp history (sl + hl)": 115,
  "ib dp physics (sl + hl)": 116,
  "ib dp psychology (sl + hl)": 117,
  "ib language and literature": 118,
  "ib mathematics aa (sl + hl) curriculum": 119,
  "ib mathematics ai (sl + hl) curriculum": 120,
  "ib myp 1 hindi": 121,
  "igcse computer science (0478)": 122,
  "igcse core biology - year 1": 123,
  "igcse core biology - year 2": 124,
  "igcse core chemistry - year 1": 125,
  "igcse core chemistry - year 2": 126,
  "igcse core math - year 1": 127,
  "igcse core math - year 2": 128,
  "igcse core physics - year 1": 129,
  "igcse core physics - year 2": 130,
  "igcse english as a second language (0510/0511) grade 11": 131,
  "igcse english literature (0475) grade 9 (year-1)": 132,
  "igcse english with literature component": 133,
  "igcse extended biology - year 1": 134,
  "igcse extended biology - year 2": 135,
  "igcse extended chemistry - year 1": 136,
  "igcse extended chemistry - year 2": 137,
  "igcse extended math - year 1": 138,
  "igcse extended math - year 2": 139,
  "igcse extended physics - year 1": 140,
  "igcse extended physics - year 2": 141,
  "igcse first language english (0500) – year 1 grade 11": 142,
  "igcse first language english (0500) grade 10": 143,
  "igcse generic lower secondary english": 144,
  "igcse grade 1 english": 145,
  "igcse grade 1 hindi": 146,
  "igcse grade 10 hindi": 147,
  "igcse grade 11 hindi": 148,
  "igcse grade 12 hindi": 149,
  "igcse grade 2 english": 150,
  "igcse grade 2 hindi": 151,
  "igcse grade 3 english": 152,
  "igcse grade 3 hindi": 153,
  "igcse grade 4 english": 154,
  "igcse grade 4 hindi": 155,
  "igcse grade 5 english": 156,
  "igcse grade 5 hindi": 157,
  "igcse grade 6 hindi": 158,
  "igcse grade 7 hindi": 159,
  "igcse grade 8 hindi": 160,
  "igcse grade 9 first language english (year 1) 0500": 161,
  "igcse grade 9 hindi": 162,
  "igcse lower secondary english": 163,
  "igcse lower secondary english – second language / esl": 164,
  "ap biology": 165,
  "ap calculus ab": 166,
  "ap calculus bc": 167,
  "ap chemistry": 168,
  "ap comparative government and politics": 169,
  "ap computer science a": 170,
  "ap computer science principles": 171,
  "ap environmental science": 172,
  "ap french language and culture": 173,
  "ap german language and culture": 174,
  "ap human geography": 175,
  "ap italian language and culture": 176,
  "ap language": 177,
  "ap macroeconomics": 178,
  "ap microeconomics": 179,
  "ap physics 1": 180,
  "ap physics 2": 181,
  "ap physics c: electricity and magnetism": 182,
  "ap physics c: mechanics": 183,
  "ap psychology": 184,
  "ap spanish language and culture": 185,
  "ap spanish literature and culture": 186,
  "ap statistics": 187,
  "ap united states government and politics": 188,
  "ap world history: modern": 189,
  "a level computer science (9618)": 190,
  "a level english": 191,
  "a level mathematics": 192,
  "hspt math": 193,
  "act english": 194,
  "act english accelerator: 20-session mastery program": 195,
  "act math": 196,
  "act math accelerator: 20-session score boost program": 197,
  "andhra pradesh engineering, agriculture and pharmacy common entrance test-ap eapcet": 198,
  "birla institute of technology and science admission test-bitsat": 199,
  "conversational spanish": 200,
  "duolingo english test-det": 201,
  "gmat quantitative reasoning": 202,
  "gmat verbal reasoning course": 203,
  "gre quantitative reasoning": 204,
  "gre verbal reasoning course": 205,
  "hspt": 206,
  "indian institutes of technology – joint entrance examination - iit-jee": 207,
  "international english language testing system-ielts academic": 208,
  "international english language testing system-ielts general": 209,
  "isee middle level": 210,
  "isee primary": 211,
  "isee upper level english": 212,
  "isee upper level math": 213,
  "law school admission test-lsat": 214,
  "national eligibility cum entrance test -neet": 215,
  "occupational english test-oet": 216,
  "pearson test of english- pte academic": 217,
  "psat/ nmsqt": 218,
  "psat/nmsqt math": 219,
  "sat english": 220,
  "sat english accelarated": 221,
  "sat english foundation course": 222,
  "sat english foundation course - accelerated": 223,
  "sat math": 224,
  "sat math accelerated": 225,
  "sat math foundation course": 226,
  "sat math foundation course - accelerated": 227,
  "spelling bee": 228,
  "ssat english": 229,
  "ssat upper level math": 230,
  "staar test": 231,
  "telangana state engineering, agriculture and pharmacy common entrance test-ts eapcet": 232,
  "the common admission test- cat": 233,
  "the common law admission test (clat)": 234,
  "the common university entrance test -cuet": 235,
  "the karnataka common entrance test (kcet)": 236,
  "toefl": 237,
  "middle school english": 238,
  "middle school english homework help": 239,
  "middle school math - grade 5": 240,
  "middle school math - grade 6": 241,
  "middle school math - grade 7": 242,
  "elementary level english": 243,
  "elementary math - grade 1": 244,
  "elementary math - grade 2": 245,
  "elementary math - grade 3": 246,
  "elementary math - grade 4": 247,
  "elementary math - grade k": 248,
  "high school calculus": 249,
  "high school english": 250,
  "high school english homework help": 251,
  "high school mathematics": 252,
  "high school statistics": 253,
  "ai fundamentals for students": 254,
  "artificial intelligence – advanced": 255,
  "data science basics": 256,
  "game design": 257,
  "java programming for beginners": 258,
  "prompt engineering": 259,
  "python level 1": 260,
  "python programming for beginners": 261,
  "robotics": 262,
  "web design": 263,
  "web development bootcamp": 264,
  "french language course-a1-c2 levels": 265,
  "german language course-a1-c2 levels": 266,
  "spanish for beginners": 267,
  "spanish language course-a1-c2 levels": 268,
};

/** Returns the sheet-based sort position for a course title (9999 = not in sheet). */
export function getCourseSortOrder(title: string): number {
  return COURSE_SORT_ORDER[title.trim().toLowerCase()] ?? 9999;
}

// ── Category detection ────────────────────────────────────────────────────────

const TEST_PREP_KEYWORDS = [
  "GMAT", "IELTS", "TOEFL", "PSAT", "SSAT", "ISEE", "HSPT", "LSAT",
  "DUOLINGO", "STAAR", "CUET", "EAPCET", "BITSAT", "IIT-JEE", "NEET",
  "CLAT", "TOEIC", "COMMON ADMISSION TEST", "COMMON UNIVERSITY ENTRANCE",
];

function isTestPrep(t: string): boolean {
  if (/\bSAT\b/.test(t)) return true;
  if (/\bACT\b/.test(t)) return true;
  if (/\bGRE\b/.test(t)) return true;
  if (/\bOET\b/.test(t)) return true;
  if (/\bPTE\b/.test(t)) return true;
  return TEST_PREP_KEYWORDS.some((kw) => t.includes(kw));
}

export function getCourseCategory(course: {
  title: string;
  subject: string;
  gradeLevel?: string | null;
}): CourseCategory {
  const t = course.title.toUpperCase().trim();
  const s = course.subject ?? "";
  const g = (course.gradeLevel ?? "").toUpperCase();

  if (t.includes("CBSE")) return "CBSE";
  if (t.includes("ICSE") || t.includes(" ISC ") || t.startsWith("ISC ") || t.startsWith("ICS ")) return "ICSE/ICS";
  if (t.includes("A LEVEL") || t.includes("A-LEVEL") || t.includes("AS LEVEL") || t.includes("AS & A LEVEL")) return "A Level";
  if (t.includes("IGCSE") || t.includes("CAMBRIDGE")) return "IGCSE";
  if (/\bIB\b/.test(t) || t.includes("INTERNATIONAL BACCALAUREATE")) return "IB";
  if (s !== "Test Prep" && /^AP /.test(t)) return "AP";
  if (s === "Test Prep" || isTestPrep(t)) return "Test Prep";
  if (s === "Computer Science") return "Computer Science";
  if (["Foreign Language", "Spanish", "Hindi", "French", "German"].includes(s)) return "Languages";
  if (g.includes("MIDDLE SCHOOL")) return "Middle School";
  if (g.includes("ELEMENTARY")) return "Elementary";
  return "High School";
}

// ── Category course groupings (derived from sheet-order ranges) ────────────
// Ranges mirror the xlsx tab boundaries noted above, so each bucket lines up
// exactly with the sheet the course actually lives in.
const CATEGORY_RANGES: Record<CourseCategory, [number, number]> = {
  "CBSE": [1, 60],
  "ICSE/ICS": [61, 104],
  "IB": [105, 121],
  "IGCSE": [122, 164],
  "AP": [165, 189],
  "A Level": [190, 192],
  "Test Prep": [193, 237],
  "Middle School": [238, 242],
  "Elementary": [243, 248],
  "High School": [249, 253],
  "Computer Science": [254, 264],
  "Languages": [265, 268],
};

const ACRONYMS = [
  "SAT", "ACT", "IB", "AP", "CBSE", "ICSE", "ISC", "IGCSE", "GRE", "GMAT",
  "IELTS", "TOEFL", "JEE", "NEET", "CUET", "LSAT", "BITSAT", "CAT", "KCET",
  "STAAR", "PSAT", "SSAT", "ISEE", "HSPT", "OET", "PTE", "DET", "AI", "SL",
  "HL", "DP", "ESS", "DT", "CLAT", "EAPCET", "IIT",
];

/** Title-cases a lowercase sheet title, upper-casing known acronyms. */
export function formatCourseTitle(raw: string): string {
  return raw
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      const clean = word.replace(/[()/,:.-]/g, "").toUpperCase();
      if (ACRONYMS.includes(clean)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const orderedTitles = Object.entries(COURSE_SORT_ORDER)
  .sort((a, b) => a[1] - b[1])
  .map(([title]) => title);

/** Display-ready course titles grouped per nav category, in sheet order. */
export const CATEGORY_COURSE_TITLES: Record<CourseCategory, string[]> = COURSE_CATEGORIES.reduce(
  (acc, cat) => {
    const [start, end] = CATEGORY_RANGES[cat];
    acc[cat] = orderedTitles
      .filter((t) => {
        const order = COURSE_SORT_ORDER[t];
        return order >= start && order <= end;
      })
      .map(formatCourseTitle);
    return acc;
  },
  {} as Record<CourseCategory, string[]>
);

// ── Test Prep sub-groups (nav flyout) ───────────────────────────────────────
// "Other Exams" is a catch-all so every Test Prep course (HSPT, ISEE, LSAT,
// JEE, NEET, CUET, EAPCET, BITSAT, KCET, CAT, CLAT, DET, OET, PTE, SSAT,
// STAAR, Spelling Bee, etc.) is reachable from the flyout instead of only
// the four named exams — this is what a US reviewer was missing.
export const TEST_PREP_GROUPS = ["SAT/ACT", "IELTS", "TOEFL", "GRE/GMAT", "Other Exams"] as const;
export type TestPrepGroup = (typeof TEST_PREP_GROUPS)[number];

export function getTestPrepGroup(title: string): TestPrepGroup {
  const t = title.toUpperCase();
  if (/\bSAT\b|\bACT\b|\bPSAT\b/.test(t)) return "SAT/ACT";
  if (t.includes("IELTS")) return "IELTS";
  if (t.includes("TOEFL")) return "TOEFL";
  if (t.includes("GRE") || t.includes("GMAT")) return "GRE/GMAT";
  return "Other Exams";
}

// FIX: within the "SAT/ACT" flyout group, the sheet lists ACT courses
// (rows 194-197) before SAT courses (rows 220-227), so ACT English was
// showing up first in the menu instead of SAT. This ranks SAT titles
// first, then PSAT, then ACT, while leaving every other group (and the
// underlying sheet order used elsewhere, e.g. search/listing pages)
// untouched.
function testPrepDisplayRank(title: string): number {
  const t = title.toUpperCase();
  if (t.startsWith("SAT")) return 0;
  if (t.startsWith("PSAT")) return 1;
  if (t.startsWith("ACT")) return 2;
  return 3;
}

/** Course titles that fall under a given Test Prep sub-group, for the nav flyout. */
export function getTestPrepGroupTitles(group: TestPrepGroup): string[] {
  const titles = CATEGORY_COURSE_TITLES["Test Prep"].filter((t) => getTestPrepGroup(t) === group);
  if (group === "SAT/ACT") {
    return [...titles].sort((a, b) => testPrepDisplayRank(a) - testPrepDisplayRank(b));
  }
  return titles;
}

// Categories highlighted with a star in the nav (high-demand programs).
export const STARRED_CATEGORIES: CourseCategory[] = ["AP", "Test Prep"];