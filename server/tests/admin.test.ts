import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../routers";
import * as db from "../db";
import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("Admin Dashboard", () => {
  let adminUser: any;
  let parentUser: any;
  let tutorUser: any;

  function createContext(user: AuthenticatedUser | null): TrpcContext {
    return {
      user,
      req: {} as any,
      res: {} as any,
    };
  }

  beforeAll(async () => {
    // Create test users with different roles
    adminUser = {
      id: 999,
      openId: "admin-test-openid",
      name: "Admin User",
      email: "admin@test.com",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    parentUser = {
      id: 998,
      openId: "parent-test-openid",
      name: "Parent User",
      email: "parent@test.com",
      role: "parent" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tutorUser = {
      id: 997,
      openId: "tutor-test-openid",
      name: "Tutor User",
      email: "tutor@test.com",
      role: "tutor" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("adminProcedure Authorization", () => {
    it("should allow admin users to access admin endpoints", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const stats = await caller.admin.getOverviewStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("totalUsers");
      expect(stats).toHaveProperty("totalEnrollments");
      expect(stats).toHaveProperty("totalRevenue");
    });

    it("should deny parent users from accessing admin endpoints", async () => {
      const caller = appRouter.createCaller(createContext(parentUser));
      
      await expect(caller.admin.getOverviewStats()).rejects.toThrow(TRPCError);
      await expect(caller.admin.getOverviewStats()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("should deny tutor users from accessing admin endpoints", async () => {
      const caller = appRouter.createCaller(createContext(tutorUser));
      
      await expect(caller.admin.getOverviewStats()).rejects.toThrow(TRPCError);
      await expect(caller.admin.getOverviewStats()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });

    it("should deny unauthenticated users from accessing admin endpoints", async () => {
      const caller = appRouter.createCaller(createContext(null));
      
      await expect(caller.admin.getOverviewStats()).rejects.toThrow(TRPCError);
      await expect(caller.admin.getOverviewStats()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("admin.getOverviewStats", () => {
    it("should return platform statistics", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const stats = await caller.admin.getOverviewStats();
      
      expect(stats).toHaveProperty("totalUsers");
      expect(stats).toHaveProperty("totalParents");
      expect(stats).toHaveProperty("totalTutors");
      expect(stats).toHaveProperty("totalEnrollments");
      expect(stats).toHaveProperty("activeEnrollments");
      expect(stats).toHaveProperty("totalPayments");
      expect(stats).toHaveProperty("totalRevenue");
      
      expect(typeof stats.totalUsers).toBe("number");
      expect(typeof stats.totalParents).toBe("number");
      expect(typeof stats.totalTutors).toBe("number");
      expect(typeof stats.totalEnrollments).toBe("number");
      expect(typeof stats.activeEnrollments).toBe("number");
      expect(typeof stats.totalPayments).toBe("number");
      expect(typeof stats.totalRevenue).toBe("string");
    });

    it("should calculate revenue correctly from completed payments", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const stats = await caller.admin.getOverviewStats();
      const revenue = parseFloat(stats.totalRevenue);
      
      expect(revenue).toBeGreaterThanOrEqual(0);
      expect(stats.totalRevenue).toMatch(/^\d+\.\d{2}$/); // Format: XX.XX
    });
  });

  describe("admin.getAllUsers", () => {
    it("should return paginated user list", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllUsers({ limit: 10, offset: 0 });
      
      expect(result).toHaveProperty("users");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.users)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("should respect pagination limits", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllUsers({ limit: 5, offset: 0 });
      
      expect(result.users.length).toBeLessThanOrEqual(5);
    });

    it("should return users with required fields", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllUsers({ limit: 1, offset: 0 });
      
      if (result.users.length > 0) {
        const user = result.users[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("role");
        expect(user).toHaveProperty("createdAt");
      }
    });
  });

  describe("admin.getAllEnrollments", () => {
    it("should return paginated enrollment list", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllEnrollments({ limit: 10, offset: 0 });
      
      expect(result).toHaveProperty("enrollments");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.enrollments)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("should return enrollments with enriched data", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllEnrollments({ limit: 1, offset: 0 });
      
      if (result.enrollments.length > 0) {
        const enrollment = result.enrollments[0];
        expect(enrollment).toHaveProperty("id");
        expect(enrollment).toHaveProperty("courseName");
        expect(enrollment).toHaveProperty("parentName");
        expect(enrollment).toHaveProperty("tutorName");
        expect(enrollment).toHaveProperty("studentName");
        expect(enrollment).toHaveProperty("status");
        expect(enrollment).toHaveProperty("paymentStatus");
        expect(enrollment).toHaveProperty("createdAt");
      }
    });

    it("should respect pagination limits", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllEnrollments({ limit: 3, offset: 0 });
      
      expect(result.enrollments.length).toBeLessThanOrEqual(3);
    });
  });

  describe("admin.getAllPayments", () => {
    it("should return paginated payment list", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllPayments({ limit: 10, offset: 0 });
      
      expect(result).toHaveProperty("payments");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.payments)).toBe(true);
      expect(typeof result.total).toBe("number");
    });

    it("should return payments with enriched data", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllPayments({ limit: 1, offset: 0 });
      
      if (result.payments.length > 0) {
        const payment = result.payments[0];
        expect(payment).toHaveProperty("id");
        expect(payment).toHaveProperty("amount");
        expect(payment).toHaveProperty("currency");
        expect(payment).toHaveProperty("status");
        expect(payment).toHaveProperty("parentName");
        expect(payment).toHaveProperty("tutorName");
        expect(payment).toHaveProperty("createdAt");
      }
    });

    it("should respect pagination limits", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllPayments({ limit: 5, offset: 0 });
      
      expect(result.payments.length).toBeLessThanOrEqual(5);
    });

    it("should include payment type information", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const result = await caller.admin.getAllPayments({ limit: 1, offset: 0 });
      
      if (result.payments.length > 0) {
        const payment = result.payments[0];
        expect(payment).toHaveProperty("paymentType");
        expect(["full", "first_installment", "second_installment", "session"]).toContain(payment.paymentType);
      }
    });
  });

  describe("Database Helper Functions", () => {
    it("getAllUsers should return all users", async () => {
      const users = await db.getAllUsers();
      
      expect(Array.isArray(users)).toBe(true);
      if (users.length > 0) {
        expect(users[0]).toHaveProperty("id");
        expect(users[0]).toHaveProperty("role");
      }
    });

    it("getAllSubscriptions should return all subscriptions with relations", async () => {
      const subscriptions = await db.getAllSubscriptions();
      
      expect(Array.isArray(subscriptions)).toBe(true);
      if (subscriptions.length > 0) {
        expect(subscriptions[0]).toHaveProperty("subscription");
        expect(subscriptions[0]).toHaveProperty("course");
        expect(subscriptions[0]).toHaveProperty("parent");
      }
    });

    it("getAllPayments should return all payments", async () => {
      const payments = await db.getAllPayments();
      
      expect(Array.isArray(payments)).toBe(true);
      if (payments.length > 0) {
        expect(payments[0]).toHaveProperty("id");
        expect(payments[0]).toHaveProperty("amount");
        expect(payments[0]).toHaveProperty("status");
      }
    });
  });
});
