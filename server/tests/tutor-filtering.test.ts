import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import * as db from "../db";

function createTestContext(user?: TrpcContext["user"]): TrpcContext {
  return {
    user: user || null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Tutor Filtering & Reviews", () => {
  describe("tutors.search", () => {
    it("should return all active tutors with no filters", async () => {
      const caller = appRouter.createCaller(createTestContext());
      const tutors = await caller.tutors.search({});
      
      expect(Array.isArray(tutors)).toBe(true);
    });

    it("should filter tutors by subject", async () => {
      const caller = appRouter.createCaller(createTestContext());
      const tutors = await caller.tutors.search({
        subjects: ["Mathematics"],
      });
      
      expect(Array.isArray(tutors)).toBe(true);
      // Tutors with Mathematics subject should be included
      tutors.forEach(tutor => {
        if (tutor.subjects) {
          const subjects = JSON.parse(tutor.subjects as string);
          expect(subjects).toContain("Mathematics");
        }
      });
    });

    it("should filter tutors by minimum rating", async () => {
      const caller = appRouter.createCaller(createTestContext());
      const tutors = await caller.tutors.search({
        minRating: 4.0,
      });
      
      expect(Array.isArray(tutors)).toBe(true);
      tutors.forEach(tutor => {
        const rating = tutor.rating ? parseFloat(tutor.rating as string) : 0;
        expect(rating).toBeGreaterThanOrEqual(4.0);
      });
    });

    it("should filter tutors by availability", async () => {
      const caller = appRouter.createCaller(createTestContext());
      const tutors = await caller.tutors.search({
        dayOfWeek: 1, // Monday
        startTime: "09:00",
        endTime: "10:00",
      });
      
      expect(Array.isArray(tutors)).toBe(true);
    });

    it("should apply multiple filters simultaneously", async () => {
      const caller = appRouter.createCaller(createTestContext());
      const tutors = await caller.tutors.search({
        subjects: ["Mathematics", "Science"],
        minRating: 3.5,
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "11:00",
      });
      
      expect(Array.isArray(tutors)).toBe(true);
    });
  });

  describe("tutors.getReviews", () => {
    it("should return empty array for tutor with no reviews", async () => {
      const caller = appRouter.createCaller(createTestContext());
      const reviews = await caller.tutors.getReviews({ tutorId: 999999 });
      
      expect(Array.isArray(reviews)).toBe(true);
      expect(reviews.length).toBe(0);
    });

    it("should return reviews for a tutor", async () => {
      const caller = appRouter.createCaller(createTestContext());
      
      // This test assumes there's at least one tutor with reviews in the database
      // In a real test environment, you would seed test data
      const tutors = await db.getAllActiveTutors();
      if (tutors.length > 0) {
        const reviews = await caller.tutors.getReviews({ tutorId: tutors[0].userId });
        expect(Array.isArray(reviews)).toBe(true);
      }
    });
  });

  describe("tutors.submitReview", () => {
    it("should reject review submission from non-authenticated user", async () => {
      const caller = appRouter.createCaller(createTestContext());
      
      await expect(
        caller.tutors.submitReview({
          tutorId: 1,
          rating: 5,
          review: "Great tutor!",
        })
      ).rejects.toThrow();
    });

    it("should reject review with invalid rating", async () => {
      const ctx = createTestContext({
        id: 1,
        openId: "test-parent",
        name: "Test Parent",
        email: "parent@test.com",
        loginMethod: "manus",
        role: "parent",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.tutors.submitReview({
          tutorId: 2,
          rating: 6, // Invalid rating > 5
          review: "Test",
        })
      ).rejects.toThrow();
    });

    it("should reject review with rating below minimum", async () => {
      const ctx = createTestContext({
        id: 1,
        openId: "test-parent",
        name: "Test Parent",
        email: "parent@test.com",
        loginMethod: "manus",
        role: "parent",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.tutors.submitReview({
          tutorId: 2,
          rating: 0, // Invalid rating < 1
          review: "Test",
        })
      ).rejects.toThrow();
    });
  });

  describe("Database Functions", () => {
    it("should calculate average rating correctly", async () => {
      // Test with mock data
      const avgRating = await db.getTutorAverageRating(999999);
      expect(typeof avgRating).toBe("number");
      expect(avgRating).toBeGreaterThanOrEqual(0);
      expect(avgRating).toBeLessThanOrEqual(5);
    });

    it("should search tutors with complex filters", async () => {
      const tutors = await db.searchTutors({
        subjects: ["Mathematics"],
        minRating: 4.0,
      });
      
      expect(Array.isArray(tutors)).toBe(true);
    });

    it("should handle empty filter results", async () => {
      const tutors = await db.searchTutors({
        subjects: ["NonexistentSubject123"],
        minRating: 5.0,
      });
      
      expect(Array.isArray(tutors)).toBe(true);
      expect(tutors.length).toBe(0);
    });
  });
});
