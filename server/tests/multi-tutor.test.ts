import { describe, expect, it } from "vitest";
import * as db from "../db";

describe("Multi-Tutor Courses and Profile Pictures", () => {
  describe("Profile Pictures", () => {
    it("should return an array from getAllActiveTutors", async () => {
      const tutors = await db.getAllActiveTutors();
      expect(Array.isArray(tutors)).toBe(true);
    });

    it("should have valid profile picture URLs when tutors have them", async () => {
      const tutors = await db.getAllActiveTutors();
      const tutorsWithPictures = tutors.filter(t => t.profileImageUrl);
      tutorsWithPictures.forEach(tutor => {
        expect(tutor.profileImageUrl).toMatch(/^https?:\/\//);
      });
    });
  });

  describe("Multi-Tutor Courses", () => {
    it("should return an array from getAllActiveCourses", async () => {
      const courses = await db.getAllActiveCourses();
      expect(Array.isArray(courses)).toBe(true);
    });

    it("should return tutor data for courses when data exists", async () => {
      const courses = await db.getAllActiveCourses();

      for (const course of courses) {
        const tutors = await db.getTutorsForCourse(course.id);
        expect(Array.isArray(tutors)).toBe(true);

        tutors.forEach(tutor => {
          expect(tutor).toHaveProperty('tutorId');
          expect(tutor).toHaveProperty('isPrimary');
          expect(tutor).toHaveProperty('user');
          expect(tutor.user).toHaveProperty('name');
          expect(tutor.user).toHaveProperty('email');
        });

        // At most one primary tutor per course
        const primaryTutors = tutors.filter(t => t.isPrimary);
        expect(primaryTutors.length).toBeLessThanOrEqual(1);
      }
    });

    it("should get courses by tutor ID when data exists", async () => {
      const tutors = await db.getAllActiveTutors();

      if (tutors.length > 0) {
        const testTutor = tutors[0];
        const courses = await db.getCoursesByTutorId(testTutor.userId);
        expect(Array.isArray(courses)).toBe(true);
      }
    });
  });
});
