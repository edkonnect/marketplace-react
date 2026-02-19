/**
 * Email Preview Generator
 * Generates HTML files for previewing email templates in a browser
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getWelcomeEmail, getBookingConfirmationEmail, getEnrollmentConfirmationEmail } from './email-templates';

const OUTPUT_DIR = join(process.cwd(), 'email-previews');

// Create output directory
try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

// Generate Welcome Email - Parent
const welcomeParentHtml = getWelcomeEmail({
  userName: 'Sarah Mitchell',
  userRole: 'parent',
  dashboardUrl: 'https://edkonnect.academy/dashboard',
});
writeFileSync(join(OUTPUT_DIR, 'welcome-parent.html'), welcomeParentHtml);
console.log('✓ Generated: welcome-parent.html');

// Generate Welcome Email - Tutor
const welcomeTutorHtml = getWelcomeEmail({
  userName: 'Dr. Emily Chen',
  userRole: 'tutor',
  dashboardUrl: 'https://edkonnect.academy/dashboard',
});
writeFileSync(join(OUTPUT_DIR, 'welcome-tutor.html'), welcomeTutorHtml);
console.log('✓ Generated: welcome-tutor.html');

// Generate Booking Confirmation - Parent
const bookingParentHtml = getBookingConfirmationEmail({
  userName: 'Sarah Mitchell',
  userRole: 'parent',
  courseName: 'AP Calculus AB',
  tutorName: 'Dr. Emily Chen',
  sessionDate: 'Monday, January 15, 2026',
  sessionTime: '3:00 PM',
  sessionDuration: '60 minutes',
  sessionPrice: '$75.00',
  dashboardUrl: 'https://edkonnect.academy/dashboard',
  messagesUrl: 'https://edkonnect.academy/messages',
});
writeFileSync(join(OUTPUT_DIR, 'booking-parent.html'), bookingParentHtml);
console.log('✓ Generated: booking-parent.html');

// Generate Booking Confirmation - Tutor
const bookingTutorHtml = getBookingConfirmationEmail({
  userName: 'Dr. Emily Chen',
  userRole: 'tutor',
  courseName: 'AP Calculus AB',
  studentName: 'Sarah Mitchell',
  sessionDate: 'Monday, January 15, 2026',
  sessionTime: '3:00 PM',
  sessionDuration: '60 minutes',
  sessionPrice: '$75.00',
  dashboardUrl: 'https://edkonnect.academy/dashboard',
  messagesUrl: 'https://edkonnect.academy/messages',
});
writeFileSync(join(OUTPUT_DIR, 'booking-tutor.html'), bookingTutorHtml);
console.log('✓ Generated: booking-tutor.html');

// Generate Enrollment Confirmation - Single Tutor
const enrollmentSingleHtml = getEnrollmentConfirmationEmail({
  userName: 'Sarah Mitchell',
  courseName: 'SAT Prep Course',
  tutorName: 'Dr. Michael Brown',
  studentName: 'Alex Mitchell',
  coursePrice: '$299.00',
  dashboardUrl: 'https://edkonnect.academy/dashboard',
  courseDetailUrl: 'https://edkonnect.academy/courses/123',
});
writeFileSync(join(OUTPUT_DIR, 'enrollment-single.html'), enrollmentSingleHtml);
console.log('✓ Generated: enrollment-single.html');

// Generate Enrollment Confirmation - Multiple Tutors
const enrollmentMultipleHtml = getEnrollmentConfirmationEmail({
  userName: 'Sarah Mitchell',
  courseName: 'Advanced Mathematics Program',
  tutorName: 'Dr. John Smith',
  studentName: 'Alex Mitchell',
  coursePrice: '$499.00',
  dashboardUrl: 'https://edkonnect.academy/dashboard',
  courseDetailUrl: 'https://edkonnect.academy/courses/456',
});
writeFileSync(join(OUTPUT_DIR, 'enrollment-multiple.html'), enrollmentMultipleHtml);
console.log('✓ Generated: enrollment-multiple.html');

console.log('\n✅ All email previews generated successfully!');
console.log(`📁 Output directory: ${OUTPUT_DIR}`);
console.log('\nTo view the emails, open the HTML files in your browser.');
