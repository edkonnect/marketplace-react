import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {} as any,
    res: {} as any,
  };
}

describe("Sample Data Verification", () => {
  it("should return an array of tutors from tutorProfile.list", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const tutors = await caller.tutorProfile.list();

    expect(Array.isArray(tutors)).toBe(true);
  });

  it("should return an array of courses from course.list", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const courses = await caller.course.list();

    expect(Array.isArray(courses)).toBe(true);
  });

  it("should have tutors with proper profile data when data exists", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const tutors = await caller.tutorProfile.list();

    if (tutors.length > 0) {
      const firstTutor = tutors[0];
      expect(firstTutor.userName).toBeDefined();
      expect(firstTutor.subjects).toBeDefined();
      expect(firstTutor.hourlyRate).toBeDefined();
    }
  });

  it("should have courses with proper data when data exists", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const courses = await caller.course.list();

    if (courses.length > 0) {
      const firstCourse = courses[0];
      expect(firstCourse.title).toBeDefined();
      expect(firstCourse.subject).toBeDefined();
      expect(firstCourse.price).toBeDefined();
    }
  });

  it("should be able to search courses by subject", async () => {
    const caller = appRouter.createCaller(createMockContext());
    const results = await caller.course.search({
      subject: "Mathematics",
    });

    expect(Array.isArray(results)).toBe(true);
  });
});
