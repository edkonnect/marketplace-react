/**
 * Email Helper Functions
 * High-level functions for sending specific types of emails
 */

import { emailService } from './email-service';
import { formatInTimeZone } from 'date-fns-tz';
import { COMMON_TIMEZONES } from '../../shared/timezone-utils';
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
  getTutorApplicationReceivedEmail,
  getPasswordResetEmail,
  getReferralInviteEmail,
  getReferralWelcomeEmail,
  getCouponRewardEmail,
  getAdminNewUserNotificationEmail,
  getTrialRequestAdminEmail,
  getTrialRequestConfirmationEmail,
  getPaymentReminderEmail,
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
    subject: 'Welcome to EdKonnect Academy! ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Å“',
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
  sessionPrice?: string;
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
  sessionsPerWeek?: number;
  totalSessions?: number | null;
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
  const { tutorEmail, tutorName, courseName, studentName, parentName, sessionsPerWeek, totalSessions } = params;

  const dashboardUrl = emailRedirect("/tutor/dashboard");

  const html = getTutorEnrollmentNotificationEmail({
    tutorName,
    courseName,
    studentName,
    parentName,
    sessionsPerWeek,
    totalSessions,
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
    subject: 'ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° Your Tutor Application is Approved - EdKonnect Academy',
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
    subject: 'ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Â° Set Up Your Tutor Account - EdKonnect Academy',
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
    subject: 'ÃƒÂ°Ã…Â¸Ã…Â½Ã¢â‚¬Å“ Set Up Your Coordinator Account - EdKonnect Academy',
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
    subject: `ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Session No-Show Notification - ${courseName}`,
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
    subject: 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ We received your tutor application - EdKonnect Academy',
    html,
  });
}

export async function sendPasswordResetEmail(params: {
  userEmail: string;
  userName: string;
  resetUrl: string;
  expiresAt: Date;
}): Promise<boolean> {
  const html = getPasswordResetEmail({
    userName: params.userName,
    resetUrl: params.resetUrl,
    expiresAt: params.expiresAt,
  });
  return await emailService.sendEmail({
    to: params.userEmail,
    subject: 'Reset your EdKonnect Academy password',
    html,
  });
}

// ============ Referral Emails ============

export async function sendReferralInviteEmail(params: {
  invitedEmail: string;
  referrerName: string;
  signupUrl: string;
}): Promise<boolean> {
  const html = getReferralInviteEmail({
    invitedEmail: params.invitedEmail,
    referrerName: params.referrerName,
    signupUrl: params.signupUrl,
  });
  return await emailService.sendEmail({
    to: params.invitedEmail,
    subject: `${params.referrerName} invited you to EdKonnect Academy`,
    html,
  });
}

export async function sendReferralWelcomeEmail(params: {
  userEmail: string;
  userName: string;
  referrerName: string;
}): Promise<boolean> {
  const html = getReferralWelcomeEmail({
    userName: params.userName,
    referrerName: params.referrerName,
  });
  return await emailService.sendEmail({
    to: params.userEmail,
    subject: 'Welcome to EdKonnect Academy ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â your reward is waiting!',
    html,
  });
}

export async function sendCouponRewardEmail(params: {
  userEmail: string;
  userName: string;
  couponCode: string;
  reason: 'referrer' | 'referred';
  friendName?: string;
}): Promise<boolean> {
  const html = getCouponRewardEmail({
    userName: params.userName,
    couponCode: params.couponCode,
    reason: params.reason,
    friendName: params.friendName,
  });
  return await emailService.sendEmail({
    to: params.userEmail,
    subject: `Your referral discount coupon ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${params.couponCode}`,
    html,
  });
}

export async function sendTrialRequestAdminEmail(params: {
  parentName: string;
  email: string;
  phone?: string;
  childName: string;
  childGrade: string;
  courseName: string;
  preferredTime?: string;
  message?: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'giteshsagvekar07@gmail.com';
  const html = getTrialRequestAdminEmail(params);
  await emailService.sendEmail({
    to: adminEmail,
    subject: `Trial Lesson Request: ${params.childName} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${params.courseName}`,
    html,
  });
}

export async function sendTrialRequestConfirmationEmail(params: {
  parentName: string;
  email: string;
  childName: string;
  courseName: string;
}): Promise<void> {
  const html = getTrialRequestConfirmationEmail(params);
  await emailService.sendEmail({
    to: params.email,
    subject: `Your Trial Lesson Request ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â ${params.courseName}`,
    html,
  });
}

export async function sendAdminNewUserNotification(params: {
  userName: string;
  userEmail: string;
  role: 'parent' | 'tutor';
  timezone?: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'giteshsagvekar07@gmail.com';
  const roleLabel = params.role === 'tutor' ? 'Tutor' : 'Parent';
  const html = getAdminNewUserNotificationEmail({
    ...params,
    signupTime: new Date(),
  });
  await emailService.sendEmail({
    to: adminEmail,
    subject: `New ${roleLabel} Registered: ${params.userName}`,
    html,
  });
}

export async function sendPaymentReminderEmail(params: {
  parentEmail: string;
  parentName: string;
  studentName: string;
  courseTitle: string;
  amountDue: string;
}): Promise<boolean> {
  const dashboardUrl = emailRedirect('/parent/dashboard');
  const html = getPaymentReminderEmail({
    parentName: params.parentName,
    studentName: params.studentName,
    courseTitle: params.courseTitle,
    amountDue: params.amountDue,
    dashboardUrl,
  });
  return await emailService.sendEmail({
    to: params.parentEmail,
    subject: `Payment Required: ${params.studentName}'s enrollment in ${params.courseTitle}`,
    html,
  });
}

export async function sendLeadAdminEmail(params: {
  name: string;
  parentName: string;
  email: string;
  phone: string;
  message?: string;
  bestAvailability?: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? 'giteshsagvekar07@gmail.com';
  const html = `
    <h2>New Lead from Website Contact Form</h2>
    <p><strong>Name:</strong> ${params.name}</p>
    <p><strong>Parent Name:</strong> ${params.parentName}</p>
    <p><strong>Email:</strong> ${params.email}</p>
    <p><strong>Phone:</strong> ${params.phone}</p>
    <p><strong>Message:</strong> ${params.message || '-'}</p>
    <p><strong>Best availability:</strong> ${params.bestAvailability || '-'}</p>
  `;
  await emailService.sendEmail({
    to: adminEmail,
    subject: `New Lead: ${params.name}`,
    html,
  });
}

export async function sendLeadConfirmationEmail(params: {
  parentName: string;
  email: string;
  name: string;
}): Promise<void> {
  const html = `
    <p>Thank you for contacting EdKonnect Academy regarding ${params.name}. One of our academic team members will contact you within 1-2 business days to learn more about your student's study needs. In the meantime, please take a moment to explore all of the courses listed in our course areas.</p>
    <p>We are the only tutoring firm that provides flexible and individualized one-on-one tutoring to K3-12 kids at an affordable price. If you have any urgent needs, please call <a href="tel:5084448714">508-444-8714</a> or contact <a href="mailto:admin@edkonnect-academy.com">admin@edkonnect-academy.com</a>.</p>
    <p>Best,<br>
    Team EdKonnect<br>
    <a href="https://edkonnect-academy.com">https://edkonnect-academy.com</a><br>
    <a href="tel:5084448714">508-444-8714</a></p>
  `;
  await emailService.sendEmail({
    to: params.email,
    subject: `We received your request - EdKonnect Academy`,
    html,
  });
}
