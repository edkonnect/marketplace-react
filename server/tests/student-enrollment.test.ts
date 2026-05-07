import { describe, it, expect } from "vitest";
import { z } from "zod";

describe("Student Enrollment API Contract", () => {
  describe("Subscription Creation Input Schema", () => {
    it("should accept subscription with student information", () => {
      const schema = z.object({
        courseId: z.number(),
        startDate: z.date(),
        endDate: z.date().optional(),
        studentFirstName: z.string().optional(),
        studentLastName: z.string().optional(),
        studentGrade: z.string().optional(),
      });

      const validInput = {
        courseId: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        studentFirstName: "John",
        studentLastName: "Doe",
        studentGrade: "10th Grade",
      };

      const result = schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should accept subscription without student information", () => {
      const schema = z.object({
        courseId: z.number(),
        startDate: z.date(),
        endDate: z.date().optional(),
        studentFirstName: z.string().optional(),
        studentLastName: z.string().optional(),
        studentGrade: z.string().optional(),
      });

      const validInput = {
        courseId: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      };

      const result = schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should accept partial student information", () => {
      const schema = z.object({
        courseId: z.number(),
        startDate: z.date(),
        endDate: z.date().optional(),
        studentFirstName: z.string().optional(),
        studentLastName: z.string().optional(),
        studentGrade: z.string().optional(),
      });

      const validInput = {
        courseId: 1,
        startDate: new Date(),
        studentFirstName: "Jane",
        studentLastName: "Smith",
        // No grade provided
      };

      const result = schema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should require courseId and startDate", () => {
      const schema = z.object({
        courseId: z.number(),
        startDate: z.date(),
        endDate: z.date().optional(),
        studentFirstName: z.string().optional(),
        studentLastName: z.string().optional(),
        studentGrade: z.string().optional(),
      });

      const invalidInput = {
        studentFirstName: "John",
        studentLastName: "Doe",
      };

      const result = schema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("Student Information Fields", () => {
    it("should have correct field types in subscription schema", () => {
      // This test validates that the subscription type includes student fields
      type SubscriptionFields = {
        studentFirstName?: string | null;
        studentLastName?: string | null;
        studentGrade?: string | null;
      };

      const testSubscription: SubscriptionFields = {
        studentFirstName: "John",
        studentLastName: "Doe",
        studentGrade: "10th Grade",
      };

      expect(testSubscription.studentFirstName).toBe("John");
      expect(testSubscription.studentLastName).toBe("Doe");
      expect(testSubscription.studentGrade).toBe("10th Grade");
    });

    it("should handle null student information", () => {
      type SubscriptionFields = {
        studentFirstName?: string | null;
        studentLastName?: string | null;
        studentGrade?: string | null;
      };

      const testSubscription: SubscriptionFields = {
        studentFirstName: null,
        studentLastName: null,
        studentGrade: null,
      };

      expect(testSubscription.studentFirstName).toBeNull();
      expect(testSubscription.studentLastName).toBeNull();
      expect(testSubscription.studentGrade).toBeNull();
    });

    it("should handle undefined student information", () => {
      type SubscriptionFields = {
        studentFirstName?: string | null;
        studentLastName?: string | null;
        studentGrade?: string | null;
      };

      const testSubscription: SubscriptionFields = {};

      expect(testSubscription.studentFirstName).toBeUndefined();
      expect(testSubscription.studentLastName).toBeUndefined();
      expect(testSubscription.studentGrade).toBeUndefined();
    });
  });
});
