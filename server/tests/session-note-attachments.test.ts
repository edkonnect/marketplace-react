import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";
import type { Context } from "../_core/context";

// Helper to create context
function createContext(user: any): Context {
  return {
    user,
    req: {} as any,
    res: {} as any,
  };
}

describe("Session Note Attachments Feature", () => {
  const tutorId = 1;
  const parentId = 2;
  const testNoteId = 1;

  const tutorUser = {
    id: tutorId,
    openId: "test-tutor-attachments",
    name: "Test Tutor",
    email: "tutor-attachments@test.com",
    role: "tutor" as const,
    createdAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "email" as const,
  };

  const parentUser = {
    id: parentId,
    openId: "test-parent-attachments",
    name: "Test Parent",
    email: "parent-attachments@test.com",
    role: "user" as const,
    createdAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "email" as const,
  };

  describe("sessionNotes.uploadAttachment", () => {
    it("should reject uploads for notes that don't belong to tutor", async () => {
      const caller = appRouter.createCaller(createContext(parentUser));

      const testFileBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      await expect(
        caller.sessionNotes.uploadAttachment({
          sessionNoteId: testNoteId,
          fileName: "test.png",
          fileData: testFileBase64,
          mimeType: "image/png",
        })
      ).rejects.toThrow();
    });
  });

  describe("sessionNotes.getAttachments", () => {
    it("should reject unauthorized users", async () => {
      const unauthorizedUser = {
        ...parentUser,
        id: 99999,
      };

      const caller = appRouter.createCaller(createContext(unauthorizedUser));

      await expect(
        caller.sessionNotes.getAttachments({
          sessionNoteId: testNoteId,
        })
      ).rejects.toThrow();
    });
  });
});
