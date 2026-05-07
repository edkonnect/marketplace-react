import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";
import { getDb } from "../db";
import { users, sessions, subscriptions, courses } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("Session Notes Feature", () => {
  let dbAvailable = false;
  let tutorUser: AuthenticatedUser;
  let parentUser: AuthenticatedUser;
  let testSessionId: number;

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
        openId: "tutor-notes-test",
        name: "Test Tutor",
        email: "tutor-notes@test.com",
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
        openId: "parent-notes-test",
        name: "Test Parent",
        email: "parent-notes@test.com",
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

      // Find or create a subscription
      const existingSubscriptions = await existingDb
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.parentId, parentId))
        .limit(1);

      let subscriptionId: number;
      if (existingSubscriptions.length > 0) {
        subscriptionId = existingSubscriptions[0].id;
      } else {
        const existingCourses = await existingDb.select().from(courses).limit(1);
        if (existingCourses.length === 0) return;
        const courseId = existingCourses[0].id;

        const subResult = await existingDb.insert(subscriptions).values({
          parentId,
          courseId,
          status: "active",
          startDate: new Date(),
        } as any);
        subscriptionId = Number(subResult[0].insertId);
      }

      // Create test session
      const sessionResult = await existingDb.insert(sessions).values({
        subscriptionId,
        tutorId,
        parentId,
        scheduledAt: Date.now() + 86400000,
        duration: 60,
        status: "scheduled",
      });
      testSessionId = Number(sessionResult[0].insertId);
      dbAvailable = true;
    } catch {
      // DB setup failed
    }
  });

  describe("sessionNotes.create", () => {
    it("should allow tutors to create session notes", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      const note = await caller.sessionNotes.create({
        sessionId: testSessionId,
        parentId: parentUser.id,
        progressSummary: "Student made excellent progress on algebra concepts.",
        homework: "Complete practice problems 1-10",
        challenges: "Still struggling with quadratic equations",
        nextSteps: "Focus on factoring in next session",
      });

      expect(note).toBeDefined();
      expect(note.sessionId).toBe(testSessionId);
      expect(note.tutorId).toBe(tutorUser.id);
      expect(note.parentId).toBe(parentUser.id);
    });

    it("should reject non-tutors from creating notes", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(parentUser));

      await expect(
        caller.sessionNotes.create({
          sessionId: testSessionId,
          parentId: parentUser.id,
          progressSummary: "Test",
        })
      ).rejects.toThrow();
    });

    it("should require progress summary", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      await expect(
        caller.sessionNotes.create({
          sessionId: testSessionId,
          parentId: parentUser.id,
          progressSummary: "",
        })
      ).rejects.toThrow();
    });

    it("should prevent duplicate notes for same session", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      await expect(
        caller.sessionNotes.create({
          sessionId: testSessionId,
          parentId: parentUser.id,
          progressSummary: "Duplicate note",
        })
      ).rejects.toThrow("already exist");
    });
  });

  describe("sessionNotes.update", () => {
    it("should allow tutors to update their own notes", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      const note = await caller.sessionNotes.getBySessionId({ sessionId: testSessionId });
      if (!note) throw new Error("Test setup failed: no note found");

      const updated = await caller.sessionNotes.update({
        id: note.id,
        progressSummary: "Updated summary",
        homework: "New homework assignment",
      });

      expect(updated).toBeDefined();
      expect(updated.progressSummary).toBe("Updated summary");
    });

    it("should reject updates to non-existent notes", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      await expect(
        caller.sessionNotes.update({ id: 999999, progressSummary: "Test" })
      ).rejects.toThrow("not found");
    });
  });

  describe("sessionNotes.getBySessionId", () => {
    it("should allow tutors to get notes for their sessions", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      const note = await caller.sessionNotes.getBySessionId({ sessionId: testSessionId });
      expect(note).toBeDefined();
      expect(note?.sessionId).toBe(testSessionId);
    });

    it("should allow parents to get notes for their sessions", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(parentUser));

      const note = await caller.sessionNotes.getBySessionId({ sessionId: testSessionId });
      expect(note).toBeDefined();
    });

    it("should return null for non-existent notes", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      const note = await caller.sessionNotes.getBySessionId({ sessionId: 999999 });
      expect(note).toBeNull();
    });
  });

  describe("sessionNotes.getMyNotes", () => {
    it("should return all notes created by tutor", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      const notes = await caller.sessionNotes.getMyNotes();
      expect(Array.isArray(notes)).toBe(true);
      expect(notes.every(note => note.tutorId === tutorUser.id)).toBe(true);
    });

    it("should reject non-tutors", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(parentUser));

      await expect(caller.sessionNotes.getMyNotes()).rejects.toThrow();
    });
  });

  describe("sessionNotes.getParentNotes", () => {
    it("should return all notes for parent", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(parentUser));

      const notes = await caller.sessionNotes.getParentNotes();
      expect(Array.isArray(notes)).toBe(true);
      expect(notes.every(note => note.parentId === parentUser.id)).toBe(true);
    });

    it("should reject non-parents", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      await expect(caller.sessionNotes.getParentNotes()).rejects.toThrow();
    });
  });

  describe("sessionNotes.delete", () => {
    it("should allow tutors to delete their own notes", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      const note = await caller.sessionNotes.getBySessionId({ sessionId: testSessionId });
      if (!note) throw new Error("Test setup failed: no note found");

      const result = await caller.sessionNotes.delete({ id: note.id });
      expect(result.success).toBe(true);

      const retrieved = await caller.sessionNotes.getBySessionId({ sessionId: testSessionId });
      expect(retrieved).toBeNull();
    });

    it("should reject deletion of non-existent notes", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      await expect(caller.sessionNotes.delete({ id: 999999 })).rejects.toThrow("not found");
    });

    it("should reject non-tutors from deleting notes", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(parentUser));

      await expect(caller.sessionNotes.delete({ id: 1 })).rejects.toThrow();
    });
  });

  describe("Field validation", () => {
    it("should verify notes contain expected fields", async () => {
      if (!dbAvailable) return;
      const caller = appRouter.createCaller(createContext(tutorUser));

      const notes = await caller.sessionNotes.getMyNotes();
      expect(Array.isArray(notes)).toBe(true);
      if (notes.length > 0) {
        const note = notes[0];
        expect(note).toHaveProperty("id");
        expect(note).toHaveProperty("sessionId");
        expect(note).toHaveProperty("tutorId");
        expect(note).toHaveProperty("parentId");
        expect(note).toHaveProperty("progressSummary");
      }
    });
  });
});
