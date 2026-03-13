/**
 * Email Helper Functions
 * High-level functions for sending specific types of emails
 */

import { emailService } from './email-service';
import { formatInTimeZone } from 'date-fns-tz';
import { COMMON_TIMEZONES } from '../shared/timezone-utils';
import {
  getWelcomeEmail,
  getBookingConfirmationEmail,
  getEnrollmentConfirmationEmail,
  getTutorEnrollmentNotificationEmail,
  getTutorApprovalEmail,
  getPasswordSetupEmail,
  getCoordinatorPasswordSetupEmail,
  getEmailVerificationEmail,
  getNoShowNotificationEmail,
  getTutorApplicationReceivedEmail
} from './email-templates';

const BASE_URL = process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000';

const emailRedirect = (target: string) =>
  `${BASE_URL}/api/auth/email-redirect?target=${encodeURIComponent(target)}`;

interface SendWelcomeEmailParams {
  userEmail: string;
  userName: string;
  userRole: 'parent' | 'tutor';
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<boolean> {
  const { userEmail, userName, userRole } = params;
  
  const targetDashboard =
    userRole === "tutor" ? "/tutor/dashboard" :
    userRole === "parent" ? "/parent/dashboard" :
    "/dashboard";
  const dashboardUrl = emailRedirect(targetDashboard);
  
  const html = getWelcomeEmail({
    userName,
    userRole,
    dashboardUrl,
  });
  
  return await emailService.sendEmail({
    to: userEmail,
    subject: 'Welcome to EdKonnect Academy! 🎓',
    html,
  });
}

interface SendVerificationEmailParams {
  userEmail: string;
  userName: string;
  verificationUrl: string;
  expiresAt: Date;
}

export async function sendVerificationEmail(params: SendVerificationEmailParams): Promise<boolean> {
  const { userEmail, userName, verificationUrl, expiresAt } = params;
  
  const html = getEmailVerificationEmail({
    userName,
    verificationUrl,
    expiresAt,
  });
  
  return await emailService.sendEmail({
    to: userEmail,
    subject: 'Verify your email to activate your account',
    html,
  });
}

interface SendBookingConfirmationParams {
  userEmail: string;
  userName: string;
  userRole: 'parent' | 'tutor';
  courseName: string;
  tutorName?: string;
  studentName?: string;
  sessionDate: string;
  sessionTime: string;
  sessionDuration: string;
  sessionPrice: string;
  additionalSessions?: { date: string; time: string }[];
}

/**
 * Send booking confirmation email
 */
export async function sendBookingConfirmation(params: SendBookingConfirmationParams): Promise<boolean> {
  const {
    userEmail,
    userName,
    userRole,
    courseName,
    tutorName,
    studentName,
    sessionDate,
    sessionTime,
    sessionDuration,
    sessionPrice,
    additionalSessions,
  } = params;

  const dashboardUrl = emailRedirect("/dashboard");
  const messagesUrl = emailRedirect("/messages");

  const html = getBookingConfirmationEmail({
    userName,
    userRole,
    courseName,
    tutorName,
    studentName,
    sessionDate,
    sessionTime,
    sessionDuration,
    sessionPrice,
    dashboardUrl,
    messagesUrl,
    additionalSessions,
  });

  const totalSessions = additionalSessions && additionalSessions.length > 0 ? 1 + additionalSessions.length : 1;
  const subject = totalSessions > 1
    ? `${totalSessions} Sessions Confirmed: ${courseName} starting ${sessionDate}`
    : `Session Confirmed: ${courseName} on ${sessionDate}`;

  return await emailService.sendEmail({
    to: userEmail,
    subject,
    html,
  });
}

interface SendEnrollmentConfirmationParams {
  userEmail: string;
  userName: string;
  courseName: string;
  tutorName: string;
  studentName?: string;
  coursePrice: string;
  courseId: number;
}

interface SendTutorEnrollmentNotificationParams {
  tutorEmail: string;
  tutorName: string;
  courseName: string;
  studentName?: string;
  parentName?: string;
  coursePrice: string;
}

/**
 * Send enrollment confirmation email
 */
export async function sendEnrollmentConfirmation(params: SendEnrollmentConfirmationParams): Promise<boolean> {
  const {
    userEmail,
    userName,
    courseName,
    tutorName,
    studentName,
    coursePrice,
    courseId,
  } = params;
  
  const dashboardUrl = emailRedirect("/dashboard");
  const courseDetailUrl = emailRedirect(`/courses/${courseId}`);
  
  const html = getEnrollmentConfirmationEmail({
    userName,
    courseName,
    tutorName,
    studentName,
    coursePrice,
    dashboardUrl,
    courseDetailUrl,
  });
  
  return await emailService.sendEmail({
    to: userEmail,
    subject: `Enrollment Confirmed: ${courseName}`,
    html,
  });
}

/**
 * Send notification to preferred tutor about a new enrollment
 */
export async function sendTutorEnrollmentNotification(params: SendTutorEnrollmentNotificationParams): Promise<boolean> {
  const { tutorEmail, tutorName, courseName, studentName, parentName, coursePrice } = params;

  const dashboardUrl = emailRedirect("/tutor/dashboard");

  const html = getTutorEnrollmentNotificationEmail({
    tutorName,
    courseName,
    studentName,
    parentName,
    coursePrice,
    dashboardUrl,
  });

  return await emailService.sendEmail({
    to: tutorEmail,
    subject: `New Enrollment: ${courseName}`,
    html,
  });
}

/**
 * Format date for email display
 * @param date - The date to format
 * @param timezone - Optional timezone (e.g., 'America/New_York'). If not provided, uses local system time.
 */
export function formatEmailDate(date: Date, timezone?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  // Only add timeZone if provided, otherwise use local time
  if (timezone) {
    options.timeZone = timezone;
  }

  return date.toLocaleDateString('en-US', options);
}

/**
 * Format time for email display
 * @param date - The date to format
 * @param timezone - Optional timezone (e.g., 'America/New_York'). If not provided, uses local system time.
 */
export function formatEmailTime(date: Date, timezone?: string): string {
  if (timezone) {
    const time = formatInTimeZone(date, timezone, 'h:mm a');
    const tz = COMMON_TIMEZONES.find(t => t.value === timezone);
    const abbr = tz ? (tz.label.match(/\(([^)]+)\)$/)?.[1] ?? '') : '';
    return abbr ? `${time} ${abbr}` : formatInTimeZone(date, timezone, 'h:mm a zzz');
  }
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Format price for email display
 */
export function formatEmailPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface SendTutorApprovalEmailParams {
  tutorEmail: string;
  tutorName: string;
}

/**
 * Send tutor approval confirmation email
 */
export async function sendTutorApprovalEmail(params: SendTutorApprovalEmailParams): Promise<boolean> {
  const { tutorEmail, tutorName } = params;

  const dashboardUrl = emailRedirect("/tutor/dashboard");

  const html = getTutorApprovalEmail({
    tutorName,
    dashboardUrl,
  });

  return await emailService.sendEmail({
    to: tutorEmail,
    subject: '🎉 Your Tutor Application is Approved - EdKonnect Academy',
    html,
  });
}

interface SendPasswordSetupEmailParams {
  tutorEmail: string;
  tutorName: string;
  setupUrl: string;
  expiresAt: Date;
}

/**
 * Send password setup email to newly approved tutor
 */
export async function sendPasswordSetupEmail(params: SendPasswordSetupEmailParams): Promise<boolean> {
  const { tutorEmail, tutorName, setupUrl, expiresAt } = params;

  const html = getPasswordSetupEmail({
    tutorName,
    setupUrl,
    expiresAt,
  });

  return await emailService.sendEmail({
    to: tutorEmail,
    subject: '🎉 Set Up Your Tutor Account - EdKonnect Academy',
    html,
  });
}

interface SendCoordinatorPasswordSetupEmailParams {
  coordinatorEmail: string;
  coordinatorName: string;
  setupUrl: string;
  expiresAt: Date;
}

/**
 * Send password setup email to newly created coordinator
 */
export async function sendCoordinatorPasswordSetupEmail(params: SendCoordinatorPasswordSetupEmailParams): Promise<boolean> {
  const { coordinatorEmail, coordinatorName, setupUrl, expiresAt } = params;

  const html = getCoordinatorPasswordSetupEmail({
    coordinatorName,
    setupUrl,
    expiresAt,
  });

  return await emailService.sendEmail({
    to: coordinatorEmail,
    subject: '🎓 Set Up Your Coordinator Account - EdKonnect Academy',
    html,
  });
}

interface SendNoShowNotificationParams {
  parentEmail: string;
  parentName: string;
  studentName: string;
  courseName: string;
  tutorName: string;
  sessionDate: string;
  sessionTime: string;
  tutorNotes?: string;
}

/**
 * Send no-show notification email to parent
 */
export async function sendNoShowNotification(params: SendNoShowNotificationParams): Promise<boolean> {
  const { parentEmail, parentName, studentName, courseName, tutorName, sessionDate, sessionTime, tutorNotes } = params;

  const dashboardUrl = emailRedirect("/parent/dashboard");

  const html = getNoShowNotificationEmail({
    parentName,
    studentName,
    courseName,
    tutorName,
    sessionDate,
    sessionTime,
    tutorNotes,
    dashboardUrl,
  });

  return await emailService.sendEmail({
    to: parentEmail,
    subject: `⚠️ Session No-Show Notification - ${courseName}`,
    html,
  });
}

export async function sendTutorApplicationReceivedEmail(params: {
  tutorName: string;
  tutorEmail: string;
  subjects: string[];
}): Promise<boolean> {
  const html = getTutorApplicationReceivedEmail(params);
  return await emailService.sendEmail({
    to: params.tutorEmail,
    subject: '✅ We received your tutor application - EdKonnect Academy',
    html,
  });
}
