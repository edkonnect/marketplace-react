import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../routers";
import * as db from "../db";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function mockUser(overrides: Partial<AuthenticatedUser> & { id: number; role: "admin" | "parent" | "tutor" }): AuthenticatedUser {
  return {
    openId: `test-${overrides.id}`,
    email: `user-${overrides.id}@test.com`,
    passwordHash: "",
    firstName: "Test",
    lastName: "User",
    userType: overrides.role,
    name: "Test User",
    loginMethod: "email",
    emailVerified: true,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as AuthenticatedUser;
}

describe("session.quickBookRecurring", () => {
  let dbAvailable = false;
  let parentUserId = 0;
  let tutorUserId = 0;
  let courseId = 0;

  beforeAll(async () => {
    parentUserId = await db.createUser({
      openId: "test-parent-recurring-" + Date.now(),
      name: "Test Parent",
      email: "parent-recurring-" + Date.now() + "@test.com",
      role: "parent",
    }) || 0;

    tutorUserId = await db.createUser({
      openId: "test-tutor-recurring-" + Date.now(),
      name: "Test Tutor",
      email: "tutor-recurring-" + Date.now() + "@test.com",
      role: "tutor",
    }) || 0;

    courseId = await db.createCourse({
      title: "Test Recurring Course",
      description: "Course for testing recurring bookings",
      subject: "Mathematics",
      price: "50.00",
      duration: 60,
      isActive: true,
    }) || 0;

    if (parentUserId && tutorUserId && courseId) {
      await db.addTutorToCourse(courseId, tutorUserId);
      dbAvailable = true;
    }
  });

  it("should have quickBookRecurring procedure defined", () => {
    const user = mockUser({ id: 1, role: "parent" });
    const caller = appRouter.createCaller({ user, req: {} as any, res: {} as any });
    expect(caller.session.quickBookRecurring).toBeDefined();
  });

  it("should book recurring sessions when DB is available", async () => {
    if (!dbAvailable) return;

    const user = mockUser({ id: parentUserId, role: "parent" });
    const caller = appRouter.createCaller({ user, req: {} as any, res: {} as any });

    const now = new Date();
    const sessions = [];
    for (let i = 0; i < 4; i++) {
      const sessionDate = new Date(now);
      sessionDate.setDate(sessionDate.getDate() + (i * 7));
      sessionDate.setHours(14, 0, 0, 0);
      sessions.push({ scheduledAt: sessionDate.getTime() });
    }

    const result = await caller.session.quickBookRecurring({
      courseId,
      tutorId: tutorUserId,
      sessions,
      duration: 60,
      notes: "Test recurring booking",
    });

    expect(result).toBeDefined();
    expect(result.totalBooked).toBe(4);
    expect(result.totalFailed).toBe(0);
    expect(result.sessionIds).toHaveLength(4);
    expect(result.subscriptionId).toBeGreaterThan(0);
  });

  it("should reject non-parent users", async () => {
    const tutorUser = mockUser({ id: 999, role: "tutor" });
    const caller = appRouter.createCaller({ user: tutorUser, req: {} as any, res: {} as any });

    await expect(
      caller.session.quickBookRecurring({
        courseId: 1,
        tutorId: 1,
        sessions: [],
        duration: 60,
      })
    ).rejects.toThrow();
  });
});
