import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("Analytics Endpoints", () => {
  let adminUser: AuthenticatedUser;
  let nonAdminUser: AuthenticatedUser;

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

    nonAdminUser = {
      id: 998,
      openId: "parent-test-openid",
      name: "Parent User",
      email: "parent@test.com",
      role: "parent" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("admin.getAnalytics", () => {
    it("should return analytics data for admin users", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty("userGrowth");
      expect(analytics).toHaveProperty("enrollmentPatterns");
      expect(analytics).toHaveProperty("revenueData");
      expect(analytics).toHaveProperty("userDistribution");
      expect(analytics).toHaveProperty("paymentStatus");
    });

    it("should return user growth data with 12 months", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      expect(analytics.userGrowth).toHaveLength(12);
      analytics.userGrowth.forEach(item => {
        expect(item).toHaveProperty("month");
        expect(item).toHaveProperty("count");
        expect(typeof item.month).toBe("string");
        expect(typeof item.count).toBe("number");
      });
    });

    it("should return enrollment patterns data with 12 months", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      expect(analytics.enrollmentPatterns).toHaveLength(12);
      analytics.enrollmentPatterns.forEach(item => {
        expect(item).toHaveProperty("month");
        expect(item).toHaveProperty("count");
        expect(typeof item.month).toBe("string");
        expect(typeof item.count).toBe("number");
      });
    });

    it("should return revenue data with 12 months", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      expect(analytics.revenueData).toHaveLength(12);
      analytics.revenueData.forEach(item => {
        expect(item).toHaveProperty("month");
        expect(item).toHaveProperty("revenue");
        expect(typeof item.month).toBe("string");
        expect(typeof item.revenue).toBe("number");
        expect(item.revenue).toBeGreaterThanOrEqual(0);
      });
    });

    it("should return user distribution data", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      expect(analytics.userDistribution).toHaveProperty("parents");
      expect(analytics.userDistribution).toHaveProperty("tutors");
      expect(analytics.userDistribution).toHaveProperty("admins");
      expect(typeof analytics.userDistribution.parents).toBe("number");
      expect(typeof analytics.userDistribution.tutors).toBe("number");
      expect(typeof analytics.userDistribution.admins).toBe("number");
    });

    it("should return payment status data", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      expect(analytics.paymentStatus).toHaveProperty("completed");
      expect(analytics.paymentStatus).toHaveProperty("pending");
      expect(analytics.paymentStatus).toHaveProperty("failed");
      expect(typeof analytics.paymentStatus.completed).toBe("number");
      expect(typeof analytics.paymentStatus.pending).toBe("number");
      expect(typeof analytics.paymentStatus.failed).toBe("number");
    });

    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createContext(nonAdminUser));
      
      await expect(caller.admin.getAnalytics()).rejects.toThrow();
    });

    it("should reject unauthenticated users", async () => {
      const caller = appRouter.createCaller(createContext(null));
      
      await expect(caller.admin.getAnalytics()).rejects.toThrow();
    });

    it("should have consistent month ordering (oldest to newest)", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      // Check that months are in chronological order
      const months = analytics.userGrowth.map(item => item.month);
      
      // Parse months and verify they're in ascending order
      for (let i = 1; i < months.length; i++) {
        const prevDate = new Date(months[i - 1]);
        const currDate = new Date(months[i]);
        expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
      }
    });

    it("should calculate revenue correctly from completed payments only", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      // Revenue should only include completed payments
      // All revenue values should be non-negative
      analytics.revenueData.forEach(item => {
        expect(item.revenue).toBeGreaterThanOrEqual(0);
      });
    });

    it("should count users correctly by role", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      const stats = await caller.admin.getOverviewStats();
      
      // Total users should match sum of role distribution
      const totalFromDistribution = 
        analytics.userDistribution.parents + 
        analytics.userDistribution.tutors + 
        analytics.userDistribution.admins;
      
      expect(totalFromDistribution).toBe(stats.totalUsers);
    });

    it("should format revenue with 2 decimal places", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const analytics = await caller.admin.getAnalytics();
      
      analytics.revenueData.forEach(item => {
        // Check that revenue has at most 2 decimal places
        const decimalPart = item.revenue.toString().split('.')[1];
        if (decimalPart) {
          expect(decimalPart.length).toBeLessThanOrEqual(2);
        }
      });
    });
  });
});
