import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("Tutor Availability - Tutor Self-Management", () => {
  let dbAvailable = false;
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
    const existingDb = await getDb();
    if (!existingDb) return;

    try {
      const tutors = await existingDb.select().from(users).where(eq(users.role, "tutor")).limit(1);
      const tutorId = tutors.length > 0 ? tutors[0].id : 1;

      const parents = await existingDb.select().from(users).where(eq(users.role, "parent")).limit(1);
      const parentId = parents.length > 0 ? parents[0].id : 2;

      tutorUser = {
        id: tutorId,
        openId: "tutor-availability-test",
        name: "Test Tutor",
        email: "tutor-avail@test.com",
        role: "tutor" as const,
        passwordHash: "",
        firstName: "Test",
        lastName: "Tutor",
        userType: "tutor" as const,
        loginMethod: "email",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as AuthenticatedUser;

      parentUser = {
        id: parentId,
        openId: "parent-availability-test",
        name: "Test Parent",
        email: "parent-avail@test.com",
        role: "parent" as const,
        passwordHash: "",
        firstName: "Test",
        lastName: "Parent",
        userType: "parent" as const,
        loginMethod: "email",
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as AuthenticatedUser;

      dbAvailable = true;
    } catch {
      // DB setup failed
    }
  });

  describe("tutorAvailability.getAvailability", () => {
    it("should allow tutors to get their own availability", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const availability = await caller.tutorAvailability.getAvailability();
      expect(availability).toBeDefined();
      expect(Array.isArray(availability)).toBe(true);
    });

    it("should reject non-tutor users", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(parentUser));
      await expect(caller.tutorAvailability.getAvailability()).rejects.toThrow();
    });
  });

  describe("tutorAvailability.createSlot", () => {
    it("should allow tutors to create availability slots", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const slot = await caller.tutorAvailability.createSlot({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "17:00",
      });
      expect(slot).toBeDefined();
      expect(slot.dayOfWeek).toBe(1);
      expect(slot.startTime).toBe("09:00");
      expect(slot.endTime).toBe("17:00");
      expect(slot.tutorId).toBe(tutorUser.id);
    });

    it("should reject invalid time ranges", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      await expect(
        caller.tutorAvailability.createSlot({
          dayOfWeek: 1,
          startTime: "17:00",
          endTime: "09:00",
        })
      ).rejects.toThrow("End time must be after start time");
    });

    it("should reject non-tutor users", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(parentUser));
      await expect(
        caller.tutorAvailability.createSlot({
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "17:00",
        })
      ).rejects.toThrow();
    });
  });

  describe("tutorAvailability.updateSlot", () => {
    it("should allow tutors to update their availability slots", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const slot = await caller.tutorAvailability.createSlot({
        dayOfWeek: 2,
        startTime: "10:00",
        endTime: "16:00",
      });
      const updated = await caller.tutorAvailability.updateSlot({
        id: slot.id,
        startTime: "11:00",
        endTime: "17:00",
      });
      expect(updated).toBeDefined();
      expect(updated.startTime).toBe("11:00");
      expect(updated.endTime).toBe("17:00");
    });

    it("should allow deactivating slots", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const slot = await caller.tutorAvailability.createSlot({
        dayOfWeek: 3,
        startTime: "09:00",
        endTime: "17:00",
      });
      const updated = await caller.tutorAvailability.updateSlot({
        id: slot.id,
        isActive: false,
      });
      expect(updated.isActive).toBe(false);
    });
  });

  describe("tutorAvailability.deleteSlot", () => {
    it("should allow tutors to delete their availability slots", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const slot = await caller.tutorAvailability.createSlot({
        dayOfWeek: 4,
        startTime: "09:00",
        endTime: "17:00",
      });
      const result = await caller.tutorAvailability.deleteSlot({ id: slot.id });
      expect(result.success).toBe(true);
    });
  });

  describe("tutorAvailability.getTimeBlocks", () => {
    it("should allow tutors to get their time blocks", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const now = Date.now();
      const future = now + (7 * 24 * 60 * 60 * 1000);
      const blocks = await caller.tutorAvailability.getTimeBlocks({
        startTime: now,
        endTime: future,
      });
      expect(Array.isArray(blocks)).toBe(true);
    });

    it("should reject non-tutor users", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(parentUser));
      await expect(caller.tutorAvailability.getTimeBlocks({})).rejects.toThrow();
    });
  });

  describe("tutorAvailability.createTimeBlock", () => {
    it("should allow tutors to create time blocks", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const start = Date.now() + (24 * 60 * 60 * 1000);
      const end = start + (24 * 60 * 60 * 1000);
      const block = await caller.tutorAvailability.createTimeBlock({
        startTime: start,
        endTime: end,
        reason: "Vacation",
      });
      expect(block).toBeDefined();
      expect(block.tutorId).toBe(tutorUser.id);
      expect(block.reason).toBe("Vacation");
    });

    it("should reject overlapping time blocks", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const start = Date.now() + (48 * 60 * 60 * 1000);
      const end = start + (24 * 60 * 60 * 1000);
      await caller.tutorAvailability.createTimeBlock({
        startTime: start,
        endTime: end,
        reason: "Conference",
      });
      const overlapStart = start + (12 * 60 * 60 * 1000);
      const overlapEnd = overlapStart + (24 * 60 * 60 * 1000);
      await expect(
        caller.tutorAvailability.createTimeBlock({
          startTime: overlapStart,
          endTime: overlapEnd,
        })
      ).rejects.toThrow("overlaps");
    });

    it("should reject invalid time ranges", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const now = Date.now();
      await expect(
        caller.tutorAvailability.createTimeBlock({
          startTime: now + 1000,
          endTime: now,
        })
      ).rejects.toThrow("End time must be after start time");
    });
  });

  describe("tutorAvailability.updateTimeBlock", () => {
    it("should allow tutors to update their time blocks", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const start = Date.now() + (72 * 60 * 60 * 1000);
      const end = start + (24 * 60 * 60 * 1000);
      const block = await caller.tutorAvailability.createTimeBlock({
        startTime: start,
        endTime: end,
        reason: "Original",
      });
      const result = await caller.tutorAvailability.updateTimeBlock({
        id: block.id,
        reason: "Updated",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("tutorAvailability.deleteTimeBlock", () => {
    it("should allow tutors to delete their time blocks", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const start = Date.now() + (96 * 60 * 60 * 1000);
      const end = start + (24 * 60 * 60 * 1000);
      const block = await caller.tutorAvailability.createTimeBlock({
        startTime: start,
        endTime: end,
      });
      const result = await caller.tutorAvailability.deleteTimeBlock({ id: block.id });
      expect(result.success).toBe(true);
    });
  });

  describe("Multiple slots and blocks", () => {
    it("should support multiple availability slots per day", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const morning = await caller.tutorAvailability.createSlot({
        dayOfWeek: 5,
        startTime: "08:00",
        endTime: "12:00",
      });
      const afternoon = await caller.tutorAvailability.createSlot({
        dayOfWeek: 5,
        startTime: "14:00",
        endTime: "18:00",
      });
      expect(morning.dayOfWeek).toBe(5);
      expect(afternoon.dayOfWeek).toBe(5);
      expect(morning.id).not.toBe(afternoon.id);
    });

    it("should support availability across all days of week", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));
      const slots = [];
      for (let day = 0; day <= 6; day++) {
        const slot = await caller.tutorAvailability.createSlot({
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "17:00",
        });
        slots.push(slot);
      }
      expect(slots.length).toBe(7);
      expect(slots.every(s => s.tutorId === tutorUser.id)).toBe(true);
    });
  });
});
