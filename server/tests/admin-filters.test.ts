import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { convertToCSV, formatUsersForCSV, formatEnrollmentsForCSV, formatPaymentsForCSV } from "../csv-export";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("Admin Filtering & Export", () => {
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

  describe("User Filtering", () => {
    it("should filter users by role", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const allUsers = await caller.admin.getAllUsers({ limit: 100, offset: 0 });
      const parentUsers = await caller.admin.getAllUsers({ limit: 100, offset: 0, role: "parent" });
      
      expect(parentUsers.users.every(u => u.role === "parent")).toBe(true);
      expect(parentUsers.total).toBeLessThanOrEqual(allUsers.total);
    });

    it("should filter users by search term", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const searchResults = await caller.admin.getAllUsers({ limit: 100, offset: 0, search: "test" });
      
      searchResults.users.forEach(user => {
        const matchesName = user.name?.toLowerCase().includes("test");
        const matchesEmail = user.email?.toLowerCase().includes("test");
        expect(matchesName || matchesEmail).toBe(true);
      });
    });

    it("should filter users by date range", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const startDate = "2024-01-01";
      const endDate = "2024-12-31";
      
      const filteredUsers = await caller.admin.getAllUsers({
        limit: 100,
        offset: 0,
        startDate,
        endDate,
      });
      
      filteredUsers.users.forEach(user => {
        if (user.createdAt) {
          const userDate = new Date(user.createdAt);
          expect(userDate >= new Date(startDate)).toBe(true);
          expect(userDate <= new Date(endDate + "T23:59:59")).toBe(true);
        }
      });
    });

    it("should combine multiple filters", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const results = await caller.admin.getAllUsers({
        limit: 100,
        offset: 0,
        role: "parent",
        search: "test",
      });
      
      results.users.forEach(user => {
        expect(user.role).toBe("parent");
        const matchesSearch = user.name?.toLowerCase().includes("test") || user.email?.toLowerCase().includes("test");
        expect(matchesSearch).toBe(true);
      });
    });
  });

  describe("Enrollment Filtering", () => {
    it("should filter enrollments by status", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const activeEnrollments = await caller.admin.getAllEnrollments({
        limit: 100,
        offset: 0,
        status: "active",
      });
      
      expect(activeEnrollments.enrollments.every(e => e.status === "active")).toBe(true);
    });

    it("should filter enrollments by payment status", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const paidEnrollments = await caller.admin.getAllEnrollments({
        limit: 100,
        offset: 0,
        paymentStatus: "paid",
      });
      
      expect(paidEnrollments.enrollments.every(e => e.paymentStatus === "paid")).toBe(true);
    });

    it("should filter enrollments by date range", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const startDate = "2024-01-01";
      const endDate = "2024-12-31";
      
      const filteredEnrollments = await caller.admin.getAllEnrollments({
        limit: 100,
        offset: 0,
        startDate,
        endDate,
      });
      
      filteredEnrollments.enrollments.forEach(enrollment => {
        const enrollmentDate = new Date(enrollment.createdAt);
        expect(enrollmentDate >= new Date(startDate)).toBe(true);
        expect(enrollmentDate <= new Date(endDate + "T23:59:59")).toBe(true);
      });
    });

    it("should combine status and payment status filters", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const results = await caller.admin.getAllEnrollments({
        limit: 100,
        offset: 0,
        status: "active",
        paymentStatus: "paid",
      });
      
      results.enrollments.forEach(enrollment => {
        expect(enrollment.status).toBe("active");
        expect(enrollment.paymentStatus).toBe("paid");
      });
    });
  });

  describe("Payment Filtering", () => {
    it("should filter payments by status", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const completedPayments = await caller.admin.getAllPayments({
        limit: 100,
        offset: 0,
        status: "completed",
      });
      
      expect(completedPayments.payments.every(p => p.status === "completed")).toBe(true);
    });

    it("should filter payments by date range", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const startDate = "2024-01-01";
      const endDate = "2024-12-31";
      
      const filteredPayments = await caller.admin.getAllPayments({
        limit: 100,
        offset: 0,
        startDate,
        endDate,
      });
      
      filteredPayments.payments.forEach(payment => {
        const paymentDate = new Date(payment.createdAt);
        expect(paymentDate >= new Date(startDate)).toBe(true);
        expect(paymentDate <= new Date(endDate + "T23:59:59")).toBe(true);
      });
    });
  });

  describe("CSV Export", () => {
    it("should export users to CSV format", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const users = await caller.admin.exportUsersCSV({});
      
      expect(Array.isArray(users)).toBe(true);
      if (users.length > 0) {
        expect(users[0]).toHaveProperty("id");
        expect(users[0]).toHaveProperty("role");
      }
    });

    it("should export enrollments to CSV format", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const enrollments = await caller.admin.exportEnrollmentsCSV({});
      
      expect(Array.isArray(enrollments)).toBe(true);
      if (enrollments.length > 0) {
        expect(enrollments[0]).toHaveProperty("id");
        expect(enrollments[0]).toHaveProperty("courseName");
        expect(enrollments[0]).toHaveProperty("status");
      }
    });

    it("should export payments to CSV format", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const payments = await caller.admin.exportPaymentsCSV({});
      
      expect(Array.isArray(payments)).toBe(true);
      if (payments.length > 0) {
        expect(payments[0]).toHaveProperty("id");
        expect(payments[0]).toHaveProperty("amount");
        expect(payments[0]).toHaveProperty("status");
      }
    });

    it("should apply filters to CSV exports", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const parentUsers = await caller.admin.exportUsersCSV({ role: "parent" });
      
      expect(parentUsers.every(u => u.role === "parent")).toBe(true);
    });
  });

  describe("CSV Formatting Functions", () => {
    it("should convert array to CSV string", () => {
      const data = [
        { name: "John", age: 30 },
        { name: "Jane", age: 25 },
      ];
      
      const csv = convertToCSV(data, ["name", "age"]);
      
      expect(csv).toContain("name,age");
      expect(csv).toContain("John,30");
      expect(csv).toContain("Jane,25");
    });

    it("should handle commas in values", () => {
      const data = [{ name: "Doe, John", city: "New York" }];
      
      const csv = convertToCSV(data, ["name", "city"]);
      
      expect(csv).toContain('"Doe, John"');
    });

    it("should handle quotes in values", () => {
      const data = [{ name: 'John "Johnny" Doe' }];
      
      const csv = convertToCSV(data, ["name"]);
      
      expect(csv).toContain('John ""Johnny"" Doe');
    });

    it("should format users for CSV export", () => {
      const users = [
        {
          id: 1,
          name: "Test User",
          email: "test@example.com",
          role: "parent" as const,
          createdAt: new Date("2024-01-01"),
        },
      ];
      
      const formatted = formatUsersForCSV(users);
      
      expect(formatted[0]).toHaveProperty("id");
      expect(formatted[0]).toHaveProperty("name");
      expect(formatted[0]).toHaveProperty("email");
      expect(formatted[0]).toHaveProperty("role");
      expect(formatted[0]).toHaveProperty("createdAt");
    });

    it("should format enrollments for CSV export", () => {
      const enrollments = [
        {
          id: 1,
          courseName: "Math 101",
          studentName: "John Doe",
          parentName: "Jane Doe",
          parentEmail: "jane@example.com",
          tutorName: "Dr. Smith",
          status: "active" as const,
          paymentStatus: "paid" as const,
          paymentPlan: "full" as const,
          createdAt: new Date("2024-01-01"),
        },
      ];
      
      const formatted = formatEnrollmentsForCSV(enrollments);
      
      expect(formatted[0]).toHaveProperty("courseName");
      expect(formatted[0]).toHaveProperty("studentName");
      expect(formatted[0]).toHaveProperty("status");
      expect(formatted[0]).toHaveProperty("paymentPlan");
    });

    it("should format payments for CSV export", () => {
      const payments = [
        {
          id: 1,
          amount: 100.50,
          currency: "usd",
          status: "completed" as const,
          paymentType: "full" as const,
          courseName: "Math 101",
          studentName: "John Doe",
          parentName: "Jane Doe",
          parentEmail: "jane@example.com",
          tutorName: "Dr. Smith",
          stripePaymentIntentId: "pi_123",
          createdAt: new Date("2024-01-01"),
        },
      ];
      
      const formatted = formatPaymentsForCSV(payments);
      
      expect(formatted[0]).toHaveProperty("amount");
      expect(formatted[0]).toHaveProperty("currency");
      expect(formatted[0].currency).toBe("USD");
      expect(formatted[0]).toHaveProperty("status");
      expect(formatted[0]).toHaveProperty("paymentType");
    });
  });
});
