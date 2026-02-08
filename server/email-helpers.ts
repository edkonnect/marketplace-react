/**
 * Email Helper Functions
 * High-level functions for sending specific types of emails
 */

import { emailService } from './email-service';
import { 
  getWelcomeEmail, 
  getBookingConfirmationEmail,
  getEnrollmentConfirmationEmail,
  getTutorApprovalEmail,
  getEmailVerificationEmail
} from './email-templates';

const BASE_URL = process.env.VITE_FRONTEND_FORGE_API_URL || 'http://localhost:3000';

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
  
  const dashboardUrl = `${BASE_URL}/dashboard`;
  
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
  } = params;
  
  const dashboardUrl = `${BASE_URL}/dashboard`;
  const messagesUrl = `${BASE_URL}/messages`;
  
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
  });
  
  return await emailService.sendEmail({
    to: userEmail,
    subject: `Session Confirmed: ${courseName} on ${sessionDate}`,
    html,
  });
}

interface SendEnrollmentConfirmationParams {
  userEmail: string;
  userName: string;
  courseName: string;
  tutorNames: string[];
  coursePrice: string;
  courseId: number;
}

/**
 * Send enrollment confirmation email
 */
export async function sendEnrollmentConfirmation(params: SendEnrollmentConfirmationParams): Promise<boolean> {
  const {
    userEmail,
    userName,
    courseName,
    tutorNames,
    coursePrice,
    courseId,
  } = params;
  
  const dashboardUrl = `${BASE_URL}/dashboard`;
  const courseDetailUrl = `${BASE_URL}/courses/${courseId}`;
  
  const html = getEnrollmentConfirmationEmail({
    userName,
    courseName,
    tutorNames,
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
 * Format date for email display
 */
export function formatEmailDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for email display
 */
export function formatEmailTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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
  
  const dashboardUrl = `${BASE_URL}/tutor/dashboard`;
  
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
