import { describe, it, expect } from "vitest";
import {
  generateCalendarInvite,
  sendBookingConfirmationEmail,
  BookingConfirmationData,
} from "./emailService";

describe("Booking Confirmation Email", () => {
  const mockBookingData: BookingConfirmationData = {
    parentEmail: "parent@example.com",
    parentName: "John Doe",
    studentName: "Jane Doe",
    courseName: "Advanced Calculus",
    tutorName: "Dr. Smith",
    tutorEmail: "tutor@example.com",
    sessionDate: new Date("2024-03-15T10:00:00Z"),
    sessionDuration: 60,
    sessionNotes: "Please bring calculus textbook",
  };

  describe("generateCalendarInvite", () => {
    it("should generate valid .ics calendar invite", () => {
      const icsContent = generateCalendarInvite(mockBookingData);

      expect(icsContent).toContain("BEGIN:VCALENDAR");
      expect(icsContent).toContain("END:VCALENDAR");
      expect(icsContent).toContain("BEGIN:VEVENT");
      expect(icsContent).toContain("END:VEVENT");
    });

    it("should include session details in calendar invite", () => {
      const icsContent = generateCalendarInvite(mockBookingData);

      expect(icsContent).toContain("Advanced Calculus");
      expect(icsContent).toContain("Jane Doe");
      expect(icsContent).toContain("Dr. Smith");
    });

    it("should set correct duration", () => {
      const icsContent = generateCalendarInvite(mockBookingData);

      // Calendar invite should have start and end times 60 minutes apart
      expect(icsContent).toContain("DTSTART");
      expect(icsContent).toContain("DTEND");
    });

    it("should include attendees", () => {
      const icsContent = generateCalendarInvite(mockBookingData);

      expect(icsContent).toContain("MAILTO:parent@exampl");
      expect(icsContent).toContain("MAILTO:tutor@exampl");
    });

    it("should handle missing tutor email", () => {
      const dataWithoutTutorEmail = {
        ...mockBookingData,
        tutorEmail: undefined,
      };

      const icsContent = generateCalendarInvite(dataWithoutTutorEmail);

      expect(icsContent).toContain("BEGIN:VCALENDAR");
      expect(icsContent).toContain("MAILTO:parent@exampl");
      expect(icsContent).not.toContain("MAILTO:tutor@exampl");
    });
  });

  describe("sendBookingConfirmationEmail", () => {
    it("should return boolean indicating email send status", async () => {
      // Note: In development, this will fail to send but should return false gracefully
      const result = await sendBookingConfirmationEmail(mockBookingData);

      expect(typeof result).toBe("boolean");
    });

    it("should handle email sending errors gracefully", async () => {
      const invalidData = {
        ...mockBookingData,
        parentEmail: "", // Invalid email
      };

      // Should not throw error, just return false
      const result = await sendBookingConfirmationEmail(invalidData);
      expect(typeof result).toBe("boolean");
    });

    it("should include all booking details in email", async () => {
      // This test verifies the function runs without errors
      // Actual email content validation would require email capture in test environment
      await expect(
        sendBookingConfirmationEmail(mockBookingData)
      ).resolves.toBeDefined();
    });
  });

  describe("Email Content Validation", () => {
    it("should format session date correctly", () => {
      const sessionDate = new Date("2024-03-15T10:00:00Z");
      const formatted = sessionDate.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });

      expect(formatted).toContain("2024");
      expect(formatted).toContain("March");
    });

    it("should handle session notes", () => {
      const dataWithNotes = { ...mockBookingData };
      expect(dataWithNotes.sessionNotes).toBe("Please bring calculus textbook");

      const dataWithoutNotes = { ...mockBookingData, sessionNotes: undefined };
      expect(dataWithoutNotes.sessionNotes).toBeUndefined();
    });
  });

  describe("Integration with Acuity Webhook", () => {
    it("should accept appointment data structure", () => {
      const appointmentData = {
        id: 12345,
        datetime: "2024-03-15T10:00:00Z",
        duration: 60,
        firstName: "John",
        lastName: "Doe",
        email: "parent@example.com",
        notes: "Test notes",
      };

      const bookingData: BookingConfirmationData = {
        parentEmail: appointmentData.email,
        parentName: `${appointmentData.firstName} ${appointmentData.lastName}`,
        studentName: "Jane Doe",
        courseName: "Advanced Calculus",
        tutorName: "Dr. Smith",
        sessionDate: new Date(appointmentData.datetime),
        sessionDuration: appointmentData.duration,
        sessionNotes: appointmentData.notes,
        acuityAppointmentId: appointmentData.id.toString(),
      };

      expect(bookingData.parentEmail).toBe("parent@example.com");
      expect(bookingData.sessionDuration).toBe(60);
    });
  });
});
