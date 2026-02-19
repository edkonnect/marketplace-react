import { describe, it, expect } from 'vitest';
import { getWelcomeEmail, getBookingConfirmationEmail, getEnrollmentConfirmationEmail } from './email-templates';

describe('Email Templates', () => {
  describe('getWelcomeEmail', () => {
    it('should generate welcome email for parent', () => {
      const html = getWelcomeEmail({
        userName: 'Sarah Mitchell',
        userRole: 'parent',
        dashboardUrl: 'https://edkonnect.academy/dashboard',
      });

      expect(html).toContain('Welcome to EdKonnect Academy!');
      expect(html).toContain('Sarah Mitchell');
      expect(html).toContain('Browse and connect with qualified tutors');
      expect(html).toContain('https://edkonnect.academy/dashboard');
      expect(html).toContain('EdKonnect Academy');
    });

    it('should generate welcome email for tutor', () => {
      const html = getWelcomeEmail({
        userName: 'Dr. John Smith',
        userRole: 'tutor',
        dashboardUrl: 'https://edkonnect.academy/dashboard',
      });

      expect(html).toContain('Welcome to EdKonnect Academy!');
      expect(html).toContain('Dr. John Smith');
      expect(html).toContain('Create and manage your tutoring courses');
      expect(html).toContain('Set your availability and hourly rates');
      expect(html).toContain('https://edkonnect.academy/dashboard');
    });

    it('should include preheader text', () => {
      const html = getWelcomeEmail({
        userName: 'Test User',
        userRole: 'parent',
        dashboardUrl: 'https://edkonnect.academy/dashboard',
      });

      expect(html).toContain('Welcome to EdKonnect Academy, Test User!');
    });

    it('should have proper HTML structure', () => {
      const html = getWelcomeEmail({
        userName: 'Test User',
        userRole: 'parent',
        dashboardUrl: 'https://edkonnect.academy/dashboard',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
      expect(html).toContain('🎓 EdKonnect Academy');
    });
  });

  describe('getBookingConfirmationEmail', () => {
    it('should generate booking confirmation for parent', () => {
      const html = getBookingConfirmationEmail({
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

      expect(html).toContain('Session Confirmed!');
      expect(html).toContain('Sarah Mitchell');
      expect(html).toContain('AP Calculus AB');
      expect(html).toContain('Dr. Emily Chen');
      expect(html).toContain('Monday, January 15, 2026');
      expect(html).toContain('3:00 PM');
      expect(html).toContain('60 minutes');
      expect(html).toContain('$75.00');
      expect(html).toContain('Tutor:');
    });

    it('should generate booking confirmation for tutor', () => {
      const html = getBookingConfirmationEmail({
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

      expect(html).toContain('Session Confirmed!');
      expect(html).toContain('Dr. Emily Chen');
      expect(html).toContain('AP Calculus AB');
      expect(html).toContain('Sarah Mitchell');
      expect(html).toContain('Student:');
      expect(html).toContain('Open Messages');
    });

    it('should include session details table', () => {
      const html = getBookingConfirmationEmail({
        userName: 'Test User',
        userRole: 'parent',
        courseName: 'Test Course',
        tutorName: 'Test Tutor',
        sessionDate: 'Test Date',
        sessionTime: 'Test Time',
        sessionDuration: 'Test Duration',
        sessionPrice: 'Test Price',
        dashboardUrl: 'https://test.com/dashboard',
        messagesUrl: 'https://test.com/messages',
      });

      expect(html).toContain('Course:');
      expect(html).toContain('Date:');
      expect(html).toContain('Time:');
      expect(html).toContain('Duration:');
      expect(html).toContain('Price:');
    });
  });

  describe('getEnrollmentConfirmationEmail', () => {
    it('should generate enrollment confirmation with single tutor', () => {
      const html = getEnrollmentConfirmationEmail({
        userName: 'Sarah Mitchell',
        courseName: 'SAT Prep Course',
        tutorName: 'Dr. Michael Brown',
        studentName: 'Alex Mitchell',
        coursePrice: '$299.00',
        dashboardUrl: 'https://edkonnect.academy/dashboard',
        courseDetailUrl: 'https://edkonnect.academy/courses/123',
      });

      expect(html).toContain('Enrollment Confirmed!');
      expect(html).toContain('Sarah Mitchell');
      expect(html).toContain('SAT Prep Course');
      expect(html).toContain('Dr. Michael Brown');
      expect(html).toContain('$299.00');
      expect(html).toContain('Tutor:');
      expect(html).toContain('Student:');
    });

    it('should generate enrollment confirmation without student when not provided', () => {
      const html = getEnrollmentConfirmationEmail({
        userName: 'Sarah Mitchell',
        courseName: 'Advanced Mathematics',
        tutorName: 'Dr. John Smith',
        coursePrice: '$499.00',
        dashboardUrl: 'https://edkonnect.academy/dashboard',
        courseDetailUrl: 'https://edkonnect.academy/courses/456',
      });

      expect(html).toContain('Enrollment Confirmed!');
      expect(html).toContain('Advanced Mathematics');
      expect(html).toContain('Dr. John Smith');
      expect(html).toContain('$499.00');
      expect(html).not.toContain('Student:');
    });

    it('should include what\'s next section', () => {
      const html = getEnrollmentConfirmationEmail({
        userName: 'Test User',
        courseName: 'Test Course',
        tutorName: 'Test Tutor',
        coursePrice: '$100.00',
        dashboardUrl: 'https://test.com/dashboard',
        courseDetailUrl: 'https://test.com/courses/1',
      });

      expect(html).toContain('What\'s Next?');
      expect(html).toContain('Schedule your first tutoring session');
      expect(html).toContain('Review course materials');
      expect(html).toContain('Track your progress');
    });

    it('should include payment confirmation', () => {
      const html = getEnrollmentConfirmationEmail({
        userName: 'Test User',
        courseName: 'Test Course',
        tutorName: 'Test Tutor',
        coursePrice: '$100.00',
        dashboardUrl: 'https://test.com/dashboard',
        courseDetailUrl: 'https://test.com/courses/1',
      });

      expect(html).toContain('Payment Confirmation');
      expect(html).toContain('Your payment of');
      expect(html).toContain('$100.00');
      expect(html).toContain('has been processed successfully');
    });
  });

  describe('Email branding', () => {
    it('should include EdKonnect Academy branding in all templates', () => {
      const templates = [
        getWelcomeEmail({
          userName: 'Test',
          userRole: 'parent',
          dashboardUrl: 'https://test.com',
        }),
        getBookingConfirmationEmail({
          userName: 'Test',
          userRole: 'parent',
          courseName: 'Test',
          tutorName: 'Test',
          sessionDate: 'Test',
          sessionTime: 'Test',
          sessionDuration: 'Test',
          sessionPrice: 'Test',
          dashboardUrl: 'https://test.com',
          messagesUrl: 'https://test.com',
        }),
        getEnrollmentConfirmationEmail({
          userName: 'Test',
          courseName: 'Test',
          tutorName: 'Test',
          coursePrice: 'Test',
          studentName: 'Test Student',
          dashboardUrl: 'https://test.com',
          courseDetailUrl: 'https://test.com',
        }),
      ];

      templates.forEach(html => {
        expect(html).toContain('🎓 EdKonnect Academy');
        expect(html).toContain('The EdKonnect Academy Team');
        expect(html).toContain('Connecting parents and tutors for personalized learning');
      });
    });

    it('should include footer links in all templates', () => {
      const templates = [
        getWelcomeEmail({
          userName: 'Test',
          userRole: 'parent',
          dashboardUrl: 'https://test.com',
        }),
        getBookingConfirmationEmail({
          userName: 'Test',
          userRole: 'parent',
          courseName: 'Test',
          tutorName: 'Test',
          sessionDate: 'Test',
          sessionTime: 'Test',
          sessionDuration: 'Test',
          sessionPrice: 'Test',
          dashboardUrl: 'https://test.com',
          messagesUrl: 'https://test.com',
        }),
        getEnrollmentConfirmationEmail({
          userName: 'Test',
          courseName: 'Test',
          tutorName: 'Test',
          coursePrice: 'Test',
          dashboardUrl: 'https://test.com',
          courseDetailUrl: 'https://test.com',
        }),
      ];

      templates.forEach(html => {
        expect(html).toContain('Home');
        expect(html).toContain('Find Tutors');
        expect(html).toContain('Browse Courses');
      });
    });
  });
});
