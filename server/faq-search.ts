import Fuse from "fuse.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FaqItem {
  id: number;
  category: string;
  intent: string;
  question: string;
  keywords: string[];
  answer: string;
}

interface UnansweredLog {
  question: string;
  timestamp: string;
  url?: string;
}

export interface SearchResult {
  answer: string;
  matched: boolean;
  category?: string;
  intent?: string;
  /** Populated when confidence is low — up to 3 related questions the user can choose from */
  suggestions?: string[];
  /** Internal — matched FAQ id for logging (not sent to client) */
  _matchedId?: number;
  /** Internal — fuse score for logging (not sent to client) */
  _score?: number;
}

// ---------------------------------------------------------------------------
// Load FAQ data
// ---------------------------------------------------------------------------

const faqDataPath = path.join(__dirname, "faq-data.json");
const unansweredLogPath = path.join(__dirname, "unanswered-questions.json");

const faqData: FaqItem[] = JSON.parse(fs.readFileSync(faqDataPath, "utf-8"));

// ---------------------------------------------------------------------------
// Intent detection table
//
// Maps each intent → the signal keywords that strongly indicate that intent.
// These are checked BEFORE fuzzy search so we can scope the Fuse index.
// Order matters: more specific patterns must come before broader ones.
// ---------------------------------------------------------------------------

const INTENT_SIGNALS: Array<{ intent: string; signals: string[] }> = [
  // Session-management intents — most-specific first; reschedule beats schedule via longer phrases
  { intent: "reschedule_session",  signals: [
    "reschedule session", "reschedule class", "reschedule booking", "reschedule my session",
    "reschedule a session", "rescheduling", "re-schedule", "move session", "move my session",
    "move my class", "move class to", "change date of", "change time of", "postpone session",
    "postpone my session", "postpone my", "shift session", "shift my class", "shift my session",
    "change the date", "change the time", "change date of my class", "change the date of my class",
    "to a different day", "to a different time", "to next week",
  ] },
  { intent: "cancel_session",      signals: [
    "cancel session", "cancel class", "cancel booking", "cancel my", "delete session",
    "delete booking", "delete my booking", "stop session", "remove a booking", "remove booking",
    "stop my class", "dont want the session", "don't want the session",
  ] },
  { intent: "join_session",        signals: [
    "join session", "join class", "join my class", "join zoom", "zoom link", "my zoom link",
    "where is my zoom", "class link", "meeting link", "enter class", "start class",
    "get the zoom link", "zoom link for my class", "find the link to join", "click to start",
    "start my session", "access my class",
  ] },
  { intent: "schedule_session",    signals: [
    "schedule session", "schedule a session", "book session", "book a session", "book class",
    "book appointment", "schedule class", "arrange session", "set up session", "pick time slot",
    "pick a time slot", "time slot with my tutor", "book my first appointment",
    "arrange a session", "set up a class",
  ] },
  { intent: "view_sessions",       signals: [
    "upcoming session", "see session", "past session", "session history", "completed session",
    "future session", "future classes", "my future classes", "all my sessions", "all my classes",
    "upcoming classes", "session list", "show me sessions", "see my sessions",
  ] },
  { intent: "session_notes",       signals: [
    "session notes", "progress notes", "class notes", "progress summary", "tutor notes",
    "session summary", "download notes", "session report", "access progress notes",
    "what was covered", "summary of what was covered", "notes from my last class",
    "find the tutor notes",
  ] },
  { intent: "tutor_no_show",       signals: [
    "no show", "tutor no show", "tutor didn't show", "tutor did not show", "tutor absent",
    "didn't appear", "missed session", "missed class", "was absent", "tutor missed",
    "never showed up", "tutor never showed", "never showed",
  ] },
  // Enrollment / booking — enroll signals before create_account to outscore "sign up"
  { intent: "enroll_course",       signals: [
    "enroll", "enrol", "enrollment", "register for course", "sign up for course",
    "sign up for a course", "join course", "enroll in a course", "enroll for course",
    "register for a course", "join a course", "join a math", "join a class",
  ] },
  { intent: "trial_lesson",        signals: [
    "trial lesson", "free trial", "trial class", "book trial", "test session",
    "try a class", "try before committing", "try a lesson", "book a trial",
  ] },
  { intent: "recurring_session",   signals: [
    "recurring", "repeat session", "weekly session", "regular class", "ongoing session",
    "every week", "class every week", "sessions automatically", "weekly classes",
    "book regularly",
  ] },
  { intent: "book_tutor",          signals: [
    "book tutor", "hire tutor", "hire a tutor", "get a tutor", "start tutoring", "book a tutor",
    "get tutoring", "tutoring for my kid", "tutor for my child", "find tutoring",
    "tutor for physics", "tutor for math",
  ] },
  { intent: "choose_tutor",        signals: [
    "choose tutor", "select tutor", "pick tutor", "preferred tutor", "which tutor",
    "pick which tutor", "select my preferred tutor", "choose which tutor",
  ] },
  // Payments
  { intent: "installment_payment", signals: [
    "installment", "split payment", "two payments", "pay in two", "payment plan",
    "pay in two parts", "course in two parts", "in two parts", "in installments",
  ] },
  { intent: "pay_later",           signals: [
    "pay later", "defer payment", "pay after", "pay after the course", "dont want to pay now",
    "don't want to pay now", "defer my payment",
  ] },
  { intent: "payment_history",     signals: [
    "payment history", "billing history", "receipts", "invoices", "transactions",
    "past invoices", "see past invoices", "billing receipts",
  ] },
  { intent: "refund_policy",       signals: [
    "refund", "money back", "get refund", "cancellation refund",
    "refund policy", "cancellation policy",
    "will i get a refund", "get my money back", "if i cancel will i get",
    "refund if i cancel", "refund if the class",
  ] },
  { intent: "payment_methods",     signals: [
    "how to pay", "payment method", "credit card", "pay for course",
    "cards accepted", "what cards", "card accepted", "how is payment processed",
    "payment processed",
  ] },
  { intent: "payment_security",    signals: [
    "payment security", "secure payment", "card safety", "safe to pay", "stripe",
    "payment information safe", "information safe", "is my payment", "card details",
    "safe to enter", "protect my payment", "store my credit card", "store my card",
  ] },
  // Account
  { intent: "reset_password",      signals: [
    "forgot password", "reset password", "reset my password", "lost password",
    "change password", "password recovery", "cannot login", "lost access to my account",
    "lost access", "change my password",
  ] },
  { intent: "account_setup_link",  signals: [
    "setup link", "setup email", "resend link", "didn't receive email", "no email",
    "account setup", "never received my setup", "setup email didnt arrive",
    "resend the account setup", "resend account setup",
  ] },
  { intent: "login",               signals: [
    "log in", "login", "sign in", "how to login", "how to sign in", "login as parent",
    "parent login", "cant login", "can't login", "login to my account",
    "cant login to my account", "sign in to my account", "sign in to",
    "how do parents log in", "how do i sign in",
  ] },
  { intent: "create_account",      signals: [
    "sign up", "create account", "register", "new account", "join the platform",
    "make a new account", "steps to make", "create a new account", "register on",
  ] },
  { intent: "update_profile",      signals: [
    "update profile", "edit profile", "change name", "update email", "timezone",
    "change details", "edit my personal", "update my email", "fix my timezone",
    "change my timezone", "edit personal details",
  ] },
  // Tutor-specific — "register as tutor" before create_account's "register"
  { intent: "become_tutor",        signals: [
    "become tutor", "become a tutor", "apply tutor", "apply to be tutor",
    "register as tutor", "register as a tutor", "register tutor", "tutor registration",
    "join as tutor", "join as a tutor", "apply to join as a tutor", "how do i become",
    "want to be a tutor", "want to register as tutor", "apply to teach",
    "i want to teach", "register to teach", "what do i need to apply",
  ] },
  { intent: "tutor_approval",      signals: [
    "tutor approval", "application review", "application status", "when approved",
    "when will my tutor application", "tutor application approved",
    "tutor application status", "how long does tutor approval", "tutor approval take",
    "submitted my tutor application", "check my tutor application",
  ] },
  { intent: "set_availability",    signals: [
    "set availability", "tutor availability", "block time", "time block", "time off",
    "available times", "add my available hours", "mark myself as unavailable",
    "block some time off", "my tutor schedule", "available hours as a tutor",
  ] },
  { intent: "manage_tutor_sessions", signals: [
    "manage sessions", "tutor sessions", "tutor bookings",
    "upcoming student bookings", "sessions i have as a tutor", "tutor session list",
    "view my tutor session", "my student bookings",
  ] },
  { intent: "tutor_payout",        signals: [
    "tutor payout", "payout request", "payout status", "request payout",
    "how do i request payout", "request a payout", "tutor payment", "tutor salary",
    "earnings", "get paid", "check my tutor earnings", "payout for my sessions",
    "payout was rejected", "tutor earnings",
  ] },
  { intent: "tutor_profile",       signals: [
    "tutor profile", "intro video", "upload video", "hourly rate", "set rate",
    "public profile", "set my hourly rate", "upload my intro video",
    "update my tutor", "add an intro video", "intro video to my tutor",
    "set my hourly", "where do i set my hourly",
  ] },
  // Browse / discover
  { intent: "browse_courses",      signals: [
    "browse courses", "look for courses", "find courses", "search courses", "explore courses",
    "explore course", "see courses", "course listing", "course catalog", "view courses",
    "all courses", "can i see courses", "how can i see course", "available courses",
    "see available courses", "courses offered", "courses for high school",
    "explore the course catalog", "all the courses",
  ] },
  { intent: "find_tutor",          signals: [
    "find tutor", "search tutor", "search for tutors", "browse tutors", "look for tutor",
    "look for a tutor on", "browse available tutors", "search for a tutor",
    "tutor by subject",
  ] },
  { intent: "browse_subjects",     signals: [
    "what subjects", "available subjects", "subjects offered", "grade levels", "what grade",
    "what topics", "topics can i", "tutoring for college", "grade levels do you",
    "what grade levels",
  ] },
  // Messaging
  { intent: "send_message",        signals: [
    "send message", "message tutor", "contact tutor", "message my tutor", "contact my tutor",
    "message coordinator", "talk to tutor", "send a chat message", "chat message to my tutor",
    "talk to my coordinator", "reach out to my tutor", "via message",
  ] },
  { intent: "file_attachment",     signals: [
    "send file", "attach file", "file attachment", "share document", "upload file",
    "send a file in chat", "attach a document", "share a pdf", "share pdf",
    "upload a file in", "send a pdf",
  ] },
  { intent: "search_messages",     signals: [
    "search messages", "find conversation", "search chat", "find an old conversation",
    "old conversation in messages", "look up a past chat", "search for a message",
    "past chat",
  ] },
  // Support / misc
  { intent: "contact_support",     signals: [
    "contact support", "customer service", "need help", "get help", "support email",
    "reach support", "need to reach support", "get help from", "support email address",
    "help from the team",
  ] },
  { intent: "parent_dashboard",    signals: [
    "parent dashboard", "my dashboard", "dashboard features", "navigate my parent account",
    "whats in my dashboard", "parent account dashboard", "features does the parent dashboard",
  ] },
  { intent: "manage_students",     signals: [
    "multiple students", "multiple children", "add student", "add a second student",
    "manage students", "add another child", "two kids", "enroll a second student",
    "second student", "another child to my account",
  ] },
  { intent: "leave_review",        signals: [
    "leave review", "rate tutor", "feedback", "review tutor", "write review",
    "leave a review", "rate my tutor", "write a review", "give my tutor a rating",
    "submit feedback about", "rating for my tutor",
  ] },
  { intent: "view_subscriptions",  signals: [
    "subscriptions", "active enrollments", "my courses", "enrolled courses",
    "view my enrolled courses", "courses i am enrolled in", "current enrollments",
    "active course subscriptions", "show me my enrollments", "my current enrollments",
    "view my enrollments", "courses i have enrolled in",
  ] },
  { intent: "notifications",       signals: [
    "notifications", "notification settings", "email notifications",
    "turn off email notifications", "manage what alerts", "notification preferences",
    "alerts i get", "change my notification",
  ] },
  // Admin
  { intent: "admin_tutor_approval", signals: [
    "admin approve", "approve tutor", "approve application", "admin approve a tutor",
    "review tutor applications", "approve a tutor from", "admin how do i review",
    "admin panel tutor",
  ] },
  { intent: "admin_analytics",     signals: [
    "analytics", "admin stats", "platform statistics", "revenue", "user growth",
    "platform revenue", "admin dashboard stats", "stats and reports", "view platform revenue",
  ] },
  { intent: "admin_payouts",       signals: [
    "admin payout", "approve payout", "approve payout request", "admin approve payout",
    "payout request as an admin", "admins manage payout", "admin reviewing tutor payment",
    "tutor payment requests", "admin payout approvals",
  ] },
];

// ---------------------------------------------------------------------------
// Fuse.js — one global instance used for the initial broad pass,
// plus a factory for scoped per-intent searches.
// ---------------------------------------------------------------------------

// Scoped search (within a detected intent group) can be more lenient —
// the intent gate already did most of the disambiguation work.
const SCOPED_THRESHOLD = 0.70;
// Global fallback search must be strict to prevent cross-topic mismatches.
const GLOBAL_THRESHOLD = 0.50;

function buildFuse(items: FaqItem[], threshold: number): Fuse<FaqItem> {
  return new Fuse(items, {
    keys: [
      { name: "question", weight: 0.65 },
      { name: "keywords", weight: 0.35 },
    ],
    threshold,
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true,
  });
}

// Global Fuse instance across all FAQs (fallback / suggestion generation)
const globalFuse = buildFuse(faqData, GLOBAL_THRESHOLD);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect the most likely intent using weighted scoring across all intents.
 * Each matching signal contributes a score based on signal specificity (longer = more specific).
 * Returns { intent, score, ambiguous } or null if no signals match.
 *
 * Ambiguity is flagged when the top two intents are within AMBIGUITY_MARGIN of each other.
 */
const AMBIGUITY_MARGIN = 0.70; // top-2 score ratio threshold — flag ambiguity only when very close

interface IntentScore {
  intent: string;
  score: number;
}

function detectIntent(normalized: string): string | null {
  const scores = new Map<string, number>();

  for (const { intent, signals } of INTENT_SIGNALS) {
    for (const rawSignal of signals) {
      // Normalize the signal the same way we normalize queries so
      // apostrophes, punctuation etc. don't prevent matching
      const signal = normalize(rawSignal);
      if (normalized.includes(signal)) {
        // Longer signals are more specific — weight by word count
        const specificity = signal.split(" ").length;
        scores.set(intent, (scores.get(intent) ?? 0) + specificity);
      }
    }
  }

  if (scores.size === 0) return null;

  // Sort by descending score
  const ranked: IntentScore[] = Array.from(scores.entries())
    .map(([intent, score]) => ({ intent, score }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];

  // Ambiguity check: if second intent is within AMBIGUITY_MARGIN ratio of top
  if (ranked.length > 1) {
    const second = ranked[1];
    const ratio = second.score / top.score;
    if (ratio >= AMBIGUITY_MARGIN && second.score >= 3) {
      // Genuine ambiguity — return null to let global fuzzy search resolve
      // This prevents wrong answers when two intents score similarly
      return null;
    }
  }

  return top.intent;
}

/**
 * Pull up to `max` related questions from the global fuzzy search,
 * excluding any item that matches the given answer (to avoid repeating it).
 */
function getRelatedQuestions(normalized: string, excludeAnswer?: string, max = 3): string[] {
  const results = globalFuse.search(normalized);
  return results
    .filter((r) => r.score !== undefined && r.score < 0.65 && r.item.answer !== excludeAnswer)
    .slice(0, max)
    .map((r) => r.item.question);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function searchFaq(query: string): SearchResult {
  const normalized = normalize(query);

  if (!normalized) {
    return fallback(normalized);
  }

  // Step 1 — detect intent from signal keywords
  const detectedIntent = detectIntent(normalized);

  // Step 2 — if intent found, search only within that intent group
  if (detectedIntent) {
    const intentItems = faqData.filter((f) => f.intent === detectedIntent);

    if (intentItems.length > 0) {
      const scopedFuse = buildFuse(intentItems, SCOPED_THRESHOLD);
      const scopedResults = scopedFuse.search(normalized);

      if (scopedResults.length > 0 && scopedResults[0].score !== undefined && scopedResults[0].score < SCOPED_THRESHOLD) {
        const best = scopedResults[0];
        return {
          answer: best.item.answer,
          matched: true,
          category: best.item.category,
          intent: best.item.intent,
          _matchedId: best.item.id,
          _score: best.score,
        };
      }

      // Intent was clear but no confident match within it — return the top
      // item from the scoped group directly (intent-based exact resolution)
      if (intentItems.length === 1) {
        return {
          answer: intentItems[0].answer,
          matched: true,
          category: intentItems[0].category,
          intent: intentItems[0].intent,
          _matchedId: intentItems[0].id,
          _score: 0,
        };
      }

      // Multiple items in intent group but no clear winner — offer them as suggestions
      return {
        answer: "",
        matched: false,
        intent: detectedIntent,
        suggestions: intentItems.slice(0, 3).map((f) => f.question),
      };
    }
  }

  // Step 3 — no intent detected: run global fuzzy search
  const globalResults = globalFuse.search(normalized);

  if (globalResults.length > 0 && globalResults[0].score !== undefined && globalResults[0].score < GLOBAL_THRESHOLD) {
    const best = globalResults[0];
    return {
      answer: best.item.answer,
      matched: true,
      category: best.item.category,
      intent: best.item.intent,
      _matchedId: best.item.id,
      _score: best.score,
    };
  }

  // Step 4 — no confident match at all: return suggestions so user can self-correct
  return fallback(normalized);
}

function fallback(normalized: string): SearchResult {
  const suggestions = normalized ? getRelatedQuestions(normalized) : [];
  return {
    answer: "",
    matched: false,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// Unanswered question logging
// ---------------------------------------------------------------------------

export function logUnansweredQuestion(question: string, url?: string): void {
  try {
    let existing: UnansweredLog[] = [];
    if (fs.existsSync(unansweredLogPath)) {
      existing = JSON.parse(fs.readFileSync(unansweredLogPath, "utf-8"));
    }

    existing.push({ question, timestamp: new Date().toISOString(), url });

    // Keep only last 500 entries
    if (existing.length > 500) {
      existing = existing.slice(-500);
    }

    fs.writeFileSync(unansweredLogPath, JSON.stringify(existing, null, 2), "utf-8");
  } catch {
    // Non-critical — don't break the chatbot if logging fails
  }
}

// ---------------------------------------------------------------------------
// Full structured query logging (every query, not just unanswered)
// ---------------------------------------------------------------------------

interface QueryLog {
  question: string;
  matched: boolean;
  matchedFaqId?: number;
  score?: number;
  intent?: string;
  category?: string;
  timestamp: string;
  url?: string;
}

const queryLogPath = path.join(__dirname, "chatbot-query-log.json");

export function logQuery(
  question: string,
  result: SearchResult,
  url?: string
): void {
  try {
    let existing: QueryLog[] = [];
    if (fs.existsSync(queryLogPath)) {
      existing = JSON.parse(fs.readFileSync(queryLogPath, "utf-8"));
    }

    const entry: QueryLog = {
      question,
      matched: result.matched,
      matchedFaqId: result._matchedId,
      score: result._score !== undefined ? Math.round(result._score * 1000) / 1000 : undefined,
      intent: result.intent,
      category: result.category,
      timestamp: new Date().toISOString(),
      url,
    };

    existing.push(entry);

    // Keep only last 2000 entries
    if (existing.length > 2000) {
      existing = existing.slice(-2000);
    }

    fs.writeFileSync(queryLogPath, JSON.stringify(existing, null, 2), "utf-8");
  } catch {
    // Non-critical — don't break the chatbot if logging fails
  }
}
