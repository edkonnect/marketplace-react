import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(user: Partial<AuthenticatedUser> & { id: number; email: string; role: string }): TrpcContext {
  const fullUser: AuthenticatedUser = {
    id: user.id,
    openId: user.openId || `test-openid-${user.id}`,
    email: user.email,
    name: user.name || "Test User",
    loginMethod: "manus",
    role: user.role as "admin" | "user" | "tutor" | "parent",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user: fullUser,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Parent Dashboard", () => {
  describe("getUpcomingSessions", () => {
    it("should return upcoming sessions for parent", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const sessions = await caller.parentProfile.getUpcomingSessions();

      expect(Array.isArray(sessions)).toBe(true);
    });

    it("should only return sessions scheduled in the future", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const sessions = await caller.parentProfile.getUpcomingSessions();

      const now = Date.now();
      sessions.forEach((session) => {
        expect(session.scheduledAt).toBeGreaterThanOrEqual(now);
      });
    });
  });

  describe("getPastSessions", () => {
    it("should return past sessions for parent", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const sessions = await caller.parentProfile.getPastSessions({ limit: 5 });

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeLessThanOrEqual(5);
    });

    it("should only return sessions scheduled in the past", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const sessions = await caller.parentProfile.getPastSessions({ limit: 10 });

      const now = Date.now();
      sessions.forEach((session) => {
        expect(session.scheduledAt).toBeLessThan(now);
      });
    });
  });

  describe("getSessionNotes", () => {
    it("should return session notes for parent", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const notes = await caller.parentProfile.getSessionNotes({ limit: 10 });

      expect(Array.isArray(notes)).toBe(true);
      expect(notes.length).toBeLessThanOrEqual(10);
    });

    it("should include tutor information in notes", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const notes = await caller.parentProfile.getSessionNotes({ limit: 5 });

      notes.forEach((note) => {
        expect(note).toHaveProperty("tutorName");
        expect(note).toHaveProperty("progressSummary");
        expect(note).toHaveProperty("scheduledAt");
      });
    });
  });

  describe("getPayments", () => {
    it("should return payment history for parent", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const payments = await caller.parentProfile.getPayments();

      expect(Array.isArray(payments)).toBe(true);
    });

    it("should include payment details", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const payments = await caller.parentProfile.getPayments();

      payments.forEach((payment) => {
        expect(payment).toHaveProperty("amount");
        expect(payment).toHaveProperty("currency");
        expect(payment).toHaveProperty("status");
        expect(payment).toHaveProperty("createdAt");
      });
    });
  });

  describe("getDashboardStats", () => {
    it("should return dashboard statistics for parent", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const stats = await caller.parentProfile.getDashboardStats();

      expect(stats).toBeDefined();
      if (stats) {
        expect(stats).toHaveProperty("totalSessions");
        expect(stats).toHaveProperty("totalSpending");
        expect(stats).toHaveProperty("activeTutors");
        expect(stats).toHaveProperty("upcomingSessions");
        expect(typeof stats.totalSessions).toBe("number");
        expect(typeof stats.totalSpending).toBe("number");
        expect(typeof stats.activeTutors).toBe("number");
        expect(typeof stats.upcomingSessions).toBe("number");
      }
    });

    it("should calculate statistics correctly", async () => {
      const ctx = createAuthContext({
        id: 1,
        name: "Test Parent",
        email: "parent@test.com",
        role: "parent",
        openId: "test-parent-openid",
      });

      const caller = appRouter.createCaller(ctx);
      const stats = await caller.parentProfile.getDashboardStats();

      if (stats) {
        expect(stats.totalSessions).toBeGreaterThanOrEqual(0);
        expect(stats.totalSpending).toBeGreaterThanOrEqual(0);
        expect(stats.activeTutors).toBeGreaterThanOrEqual(0);
        expect(stats.upcomingSessions).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Access Control", () => {
    it("should only allow parents to access dashboard data", async () => {
      const tutorCtx = createAuthContext({
        id: 2,
        name: "Test Tutor",
        email: "tutor@test.com",
        role: "tutor",
        openId: "test-tutor-openid",
      });

      const caller = appRouter.createCaller(tutorCtx);

      await expect(caller.parentProfile.getUpcomingSessions()).rejects.toThrow();
      await expect(caller.parentProfile.getSessionNotes({ limit: 10 })).rejects.toThrow();
      await expect(caller.parentProfile.getPayments()).rejects.toThrow();
      await expect(caller.parentProfile.getDashboardStats()).rejects.toThrow();
    });
  });
});
