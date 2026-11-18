import { emailService } from "./email-service";
import { getTrialWelcomeEmail } from "./email-templates";

const SITE_URL = process.env.PUBLIC_APP_URL ?? "https://edkonnect-academy.com";
export const ADMIN_CONTACT_EMAIL = "admin@edkonnect-academy.com";
export const TRIAL_WELCOME_MAX_CHARS = 600;

export function getTutorProfileUrl(tutorId: number) {
  return `${SITE_URL}/tutor/${tutorId}`;
}
const SIGNUP_URL = `${SITE_URL}/signup`;
const LOGIN_URL = `${SITE_URL}/login`;

type WelcomeParams = {
  parentName: string;
  tutorName: string;
  studentName: string;
  tutorId: number;
  hasIntroVideo: boolean;
  customText?: string | null;
};

/** Replaces {parent} and {student} in the tutor's own text. */
export function applyWelcomePlaceholders(text: string, parentName: string, studentName: string) {
  return text.replace(/\{parent\}/gi, parentName).replace(/\{student\}/gi, studentName);
}

/** The text saved in the Messages page. */
export function buildTrialWelcomeText(p: WelcomeParams) {
  const profileLine = p.hasIntroVideo
    ? "You can read my profile and watch my introduction video here:"
    : "You can read my profile here:";
  const custom = p.customText?.trim();

  if (custom) {
    return [
      `Hi ${p.parentName},`,
      ``,
      applyWelcomePlaceholders(custom, p.parentName, p.studentName),
      ``,
      `${profileLine} ${getTutorProfileUrl(p.tutorId)}`,
      ``,
      `Please sign up or sign in:`,
      `Sign up: ${SIGNUP_URL}`,
      `Sign in: ${LOGIN_URL}`,
      ``,
      `If you have trouble signing in, or are not interested, contact ${ADMIN_CONTACT_EMAIL}.`,
      ``,
      p.tutorName,
    ].join("\n");
  }

  // Default text (used when the tutor has not written their own)
  return [
    `Hi ${p.parentName},`,
    ``,
    `I'm ${p.tutorName}, and I've been assigned as the tutor for ${p.studentName}'s trial lesson. I'm looking forward to teaching ${p.studentName}!`,
    ``,
    `${profileLine} ${getTutorProfileUrl(p.tutorId)}`,
    ``,
    `Please sign up or sign in to your EdKonnect account to get access to all the files and other features on the website:`,
    `Sign up: ${SIGNUP_URL}`,
    `Sign in: ${LOGIN_URL}`,
    ``,
    `If you have any trouble signing in, or if you are not interested in the trial lesson, please contact the admin at ${ADMIN_CONTACT_EMAIL} and they will help you or cancel your session.`,
    ``,
    `Looking forward to meeting you!`,
    p.tutorName,
  ].join("\n");
}

/** The email, sent from the same admin address as all other emails. */
export async function sendTrialWelcomeEmail(
  p: WelcomeParams & { parentEmail: string }
): Promise<boolean> {
  const custom = p.customText?.trim();
  const html = getTrialWelcomeEmail({
    parentName: p.parentName,
    tutorName: p.tutorName,
    studentName: p.studentName,
    profileUrl: getTutorProfileUrl(p.tutorId),
    hasIntroVideo: p.hasIntroVideo,
    customText: custom ? applyWelcomePlaceholders(custom, p.parentName, p.studentName) : null,
    signupUrl: SIGNUP_URL,
    loginUrl: LOGIN_URL,
    adminEmail: ADMIN_CONTACT_EMAIL,
  });
    return await emailService.sendEmail({
    to: p.parentEmail,
    bcc: ADMIN_CONTACT_EMAIL,
    subject: `Welcome from your EdKonnect tutor, ${p.tutorName}`,
    html,
  });
}