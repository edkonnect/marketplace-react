import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("Tutor Availability Management", () => {
  let adminUser: AuthenticatedUser;
  let tutorUser: AuthenticatedUser;
  let parentUser: AuthenticatedUser;

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

    tutorUser = {
      id: 998,
      openId: "tutor-test-openid",
      name: "Test Tutor",
      email: "tutor@test.com",
      role: "tutor" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    parentUser = {
      id: 997,
      openId: "parent-test-openid",
      name: "Test Parent",
      email: "parent@test.com",
      role: "parent" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe("admin.getTutorAvailability", () => {
    it("should allow admin to get tutor availability", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const availability = await caller.admin.getTutorAvailability({
        tutorId: tutorUser.id,
      });
      
      expect(availability).toBeDefined();
      expect(Array.isArray(availability)).toBe(true);
    });

    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createContext(parentUser));
      
      await expect(
        caller.admin.getTutorAvailability({ tutorId: tutorUser.id })
      ).rejects.toThrow("Only administrators can access this resource");
    });
  });

  describe("admin.getAllTutorsWithAvailability", () => {
    it("should allow admin to get all tutors with availability", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const tutors = await caller.admin.getAllTutorsWithAvailability();
      
      expect(tutors).toBeDefined();
      expect(Array.isArray(tutors)).toBe(true);
    });

    it("should include availability array for each tutor", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      const tutors = await caller.admin.getAllTutorsWithAvailability();
      
      tutors.forEach(tutor => {
        expect(tutor).toHaveProperty("id");
        expect(tutor).toHaveProperty("name");
        expect(tutor).toHaveProperty("availability");
        expect(Array.isArray(tutor.availability)).toBe(true);
      });
    });

    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createContext(tutorUser));
      
      await expect(
        caller.admin.getAllTutorsWithAvailability()
      ).rejects.toThrow("Only administrators can access this resource");
    });
  });

  describe("admin.setTutorAvailability", () => {
    it("should validate time format (HH:MM)", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      await expect(
        caller.admin.setTutorAvailability({
          tutorId: tutorUser.id,
          dayOfWeek: 1,
          startTime: "9:00", // Invalid format (should be 09:00)
          endTime: "12:00",
        })
      ).rejects.toThrow();
    });

    it("should reject end time before start time", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      await expect(
        caller.admin.setTutorAvailability({
          tutorId: tutorUser.id,
          dayOfWeek: 1,
          startTime: "12:00",
          endTime: "09:00", // Before start time
        })
      ).rejects.toThrow("End time must be after start time");
    });

    it("should reject end time equal to start time", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      await expect(
        caller.admin.setTutorAvailability({
          tutorId: tutorUser.id,
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "09:00", // Same as start time
        })
      ).rejects.toThrow("End time must be after start time");
    });

    it("should validate day of week range (0-6)", async () => {
      const caller = appRouter.createCaller(createContext(adminUser));
      
      await expect(
        caller.admin.setTutorAvailability({
          tutorId: tutorUser.id,
          dayOfWeek: 7, // Invalid (should be 0-6)
          startTime: "09:00",
          endTime: "12:00",
        })
      ).rejects.toThrow();
    });

    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createContext(parentUser));
      
      await expect(
        caller.admin.setTutorAvailability({
          tutorId: tutorUser.id,
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "12:00",
        })
      ).rejects.toThrow("Only administrators can access this resource");
    });
  });

  describe("admin.deleteTutorAvailability", () => {
    it("should reject non-admin users", async () => {
      const caller = appRouter.createCaller(createContext(tutorUser));
      
      await expect(
        caller.admin.deleteTutorAvailability({ id: 1 })
      ).rejects.toThrow("Only administrators can access this resource");
    });
  });
});
