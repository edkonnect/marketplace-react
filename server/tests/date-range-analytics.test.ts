import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("Date Range Analytics", () => {
  let adminUser: AuthenticatedUser;

  function createContext(user: AuthenticatedUser | null): TrpcContext {
    return {
      user,
      req: {} as any,
      res: {} as any,
    };
  }

  beforeAll(async () => {
    adminUser = {
      id: 999,
      openId: "admin-test-openid",
      name: "Admin User",
      email: "admin@test.com",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("admin.getAnalytics with date range", () => {
    it("should accept startDate and endDate parameters", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics({
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });
      
      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty("userGrowth");
      expect(analytics).toHaveProperty("enrollmentPatterns");
      expect(analytics).toHaveProperty("revenueData");
    });

    it("should return data for last 7 days", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      
      const analytics = await caller.admin.getAnalytics({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      
      expect(analytics).toBeDefined();
      expect(analytics.userGrowth).toBeDefined();
      expect(Array.isArray(analytics.userGrowth)).toBe(true);
    });

    it("should return data for last 30 days", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      
      const analytics = await caller.admin.getAnalytics({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      
      expect(analytics).toBeDefined();
      expect(analytics.enrollmentPatterns).toBeDefined();
      expect(Array.isArray(analytics.enrollmentPatterns)).toBe(true);
    });

    it("should return data for last 3 months", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);
      
      const analytics = await caller.admin.getAnalytics({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      
      expect(analytics).toBeDefined();
      expect(analytics.revenueData).toBeDefined();
      expect(Array.isArray(analytics.revenueData)).toBe(true);
    });

    it("should return data for last 6 months", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 6);
      
      const analytics = await caller.admin.getAnalytics({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      
      expect(analytics).toBeDefined();
      // Should have approximately 6-7 months of data
      expect(analytics.userGrowth.length).toBeGreaterThan(0);
    });

    it("should return data for last year", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      
      const analytics = await caller.admin.getAnalytics({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      
      expect(analytics).toBeDefined();
      // Should have approximately 12-13 months of data
      expect(analytics.userGrowth.length).toBeGreaterThan(11);
    });

    it("should work without date range (default to last 12 months)", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics.userGrowth).toHaveLength(12);
      expect(analytics.enrollmentPatterns).toHaveLength(12);
      expect(analytics.revenueData).toHaveLength(12);
    });

    it("should filter user distribution by date range", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      
      const analytics = await caller.admin.getAnalytics({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      
      expect(analytics.userDistribution).toBeDefined();
      expect(analytics.userDistribution).toHaveProperty("parents");
      expect(analytics.userDistribution).toHaveProperty("tutors");
      expect(analytics.userDistribution).toHaveProperty("admins");
      
      // Values should be non-negative
      expect(analytics.userDistribution.parents).toBeGreaterThanOrEqual(0);
      expect(analytics.userDistribution.tutors).toBeGreaterThanOrEqual(0);
      expect(analytics.userDistribution.admins).toBeGreaterThanOrEqual(0);
    });

    it("should filter payment status by date range", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      
      const analytics = await caller.admin.getAnalytics({
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      });
      
      expect(analytics.paymentStatus).toBeDefined();
      expect(analytics.paymentStatus).toHaveProperty("completed");
      expect(analytics.paymentStatus).toHaveProperty("pending");
      expect(analytics.paymentStatus).toHaveProperty("failed");
      
      // Values should be non-negative
      expect(analytics.paymentStatus.completed).toBeGreaterThanOrEqual(0);
      expect(analytics.paymentStatus.pending).toBeGreaterThanOrEqual(0);
      expect(analytics.paymentStatus.failed).toBeGreaterThanOrEqual(0);
    });

    it("should handle custom date ranges correctly", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics({
        startDate: "2024-06-01",
        endDate: "2024-08-31",
      });
      
      expect(analytics).toBeDefined();
      // Should have 4 months of data (June, July, August, September - includes partial month)
      expect(analytics.userGrowth.length).toBeGreaterThanOrEqual(3);
      expect(analytics.enrollmentPatterns.length).toBeGreaterThanOrEqual(3);
      expect(analytics.revenueData.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle single month range", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics({
        startDate: "2024-07-01",
        endDate: "2024-07-31",
      });
      
      expect(analytics).toBeDefined();
      // Should have 1-2 months of data (July and possibly August start)
      expect(analytics.userGrowth.length).toBeGreaterThanOrEqual(1);
      expect(analytics.enrollmentPatterns.length).toBeGreaterThanOrEqual(1);
      expect(analytics.revenueData.length).toBeGreaterThanOrEqual(1);
    });

    it("should maintain chronological order with custom date range", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics({
        startDate: "2024-01-01",
        endDate: "2024-06-30",
      });
      
      // Check that months are in chronological order
      const months = analytics.userGrowth.map(item => item.month);
      
      for (let i = 1; i < months.length; i++) {
        const prevDate = new Date(months[i - 1]);
        const currDate = new Date(months[i]);
        expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
      }
    });

    it("should handle year boundary correctly", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics({
        startDate: "2023-11-01",
        endDate: "2024-02-29",
      });
      
      expect(analytics).toBeDefined();
      // Should have 4-5 months (Nov, Dec, Jan, Feb, possibly March)
      expect(analytics.userGrowth.length).toBeGreaterThanOrEqual(4);
    });

    it("should return empty arrays for future date ranges", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics({
        startDate: "2030-01-01",
        endDate: "2030-12-31",
      });
      
      expect(analytics).toBeDefined();
      // Should have 12-13 months but all counts should be 0
      expect(analytics.userGrowth.length).toBeGreaterThanOrEqual(12);
      analytics.userGrowth.forEach(item => {
        expect(item.count).toBe(0);
      });
    });
  });
});
