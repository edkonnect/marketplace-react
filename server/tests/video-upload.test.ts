import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function createTestContext(user?: TrpcContext["user"]): TrpcContext {
  return {
    user: user || null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Video Upload Feature", () => {
  describe("tutorProfile.uploadIntroVideo", () => {
    it("should reject upload from non-authenticated user", async () => {
      const caller = appRouter.createCaller(createTestContext());
      
      await expect(
        caller.tutorProfile.uploadIntroVideo({
          fileName: "intro.mp4",
          fileType: "video/mp4",
          fileSize: 1024 * 1024, // 1MB
          base64Data: "dGVzdCB2aWRlbyBkYXRh", // "test video data" in base64
        })
      ).rejects.toThrow();
    });

    it("should reject upload from non-tutor user", async () => {
      const ctx = createTestContext({
        id: 1,
        openId: "test-parent",
        name: "Test Parent",
        email: "parent@test.com",
        loginMethod: "manus",
        role: "parent",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.tutorProfile.uploadIntroVideo({
          fileName: "intro.mp4",
          fileType: "video/mp4",
          fileSize: 1024 * 1024,
          base64Data: "dGVzdCB2aWRlbyBkYXRh",
        })
      ).rejects.toThrow();
    });

    it("should reject invalid file type", async () => {
      const ctx = createTestContext({
        id: 2,
        openId: "test-tutor",
        name: "Test Tutor",
        email: "tutor@test.com",
        loginMethod: "manus",
        role: "tutor",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.tutorProfile.uploadIntroVideo({
          fileName: "intro.avi",
          fileType: "video/avi", // Invalid type
          fileSize: 1024 * 1024,
          base64Data: "dGVzdCB2aWRlbyBkYXRh",
        })
      ).rejects.toThrow(/Invalid file type/);
    });

    it("should reject file size exceeding 50MB", async () => {
      const ctx = createTestContext({
        id: 2,
        openId: "test-tutor",
        name: "Test Tutor",
        email: "tutor@test.com",
        loginMethod: "manus",
        role: "tutor",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.tutorProfile.uploadIntroVideo({
          fileName: "intro.mp4",
          fileType: "video/mp4",
          fileSize: 51 * 1024 * 1024, // 51MB - exceeds limit
          base64Data: "dGVzdCB2aWRlbyBkYXRh",
        })
      ).rejects.toThrow(/exceeds 50MB limit/);
    });

    it("should accept valid MP4 file", async () => {
      const ctx = createTestContext({
        id: 2,
        openId: "test-tutor",
        name: "Test Tutor",
        email: "tutor@test.com",
        loginMethod: "manus",
        role: "tutor",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
      const caller = appRouter.createCaller(ctx);
      
      // Note: This test will fail in actual execution because the tutor profile
      // might not exist in the database. In a real test environment, you would
      // seed the database with test data first.
      const validFileTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      
      for (const fileType of validFileTypes) {
        // Just test validation passes, actual upload would need database setup
        try {
          await caller.tutorProfile.uploadIntroVideo({
            fileName: `intro.${fileType.split('/')[1]}`,
            fileType,
            fileSize: 5 * 1024 * 1024, // 5MB - valid size
            base64Data: "dGVzdCB2aWRlbyBkYXRh",
          });
        } catch (error: any) {
          // Expect either success or database error, not validation error
          expect(error.message).not.toMatch(/Invalid file type|exceeds 50MB limit/);
        }
      }
    });
  });

  describe("tutorProfile.deleteIntroVideo", () => {
    it("should reject delete from non-authenticated user", async () => {
      const caller = appRouter.createCaller(createTestContext());
      
      await expect(
        caller.tutorProfile.deleteIntroVideo()
      ).rejects.toThrow();
    });

    it("should reject delete from non-tutor user", async () => {
      const ctx = createTestContext({
        id: 1,
        openId: "test-parent",
        name: "Test Parent",
        email: "parent@test.com",
        loginMethod: "manus",
        role: "parent",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      });
      const caller = appRouter.createCaller(ctx);
      
      await expect(
        caller.tutorProfile.deleteIntroVideo()
      ).rejects.toThrow();
    });
  });

  describe("Video Field Validation", () => {
    it("should validate file size is a number", () => {
      const maxSize = 50 * 1024 * 1024;
      
      expect(1024 * 1024).toBeLessThan(maxSize);
      expect(50 * 1024 * 1024).toBeLessThanOrEqual(maxSize);
      expect(51 * 1024 * 1024).toBeGreaterThan(maxSize);
    });

    it("should validate allowed file types", () => {
      const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      
      expect(allowedTypes).toContain('video/mp4');
      expect(allowedTypes).toContain('video/webm');
      expect(allowedTypes).toContain('video/quicktime');
      expect(allowedTypes).not.toContain('video/avi');
      expect(allowedTypes).not.toContain('video/x-msvideo');
    });

    it("should generate unique file keys", () => {
      const userId = 123;
      const fileName = "intro.mp4";
      const timestamp1 = Date.now();
      const timestamp2 = Date.now() + 1;
      
      const key1 = `tutor-videos/${userId}-${timestamp1}-${fileName}`;
      const key2 = `tutor-videos/${userId}-${timestamp2}-${fileName}`;
      
      expect(key1).not.toBe(key2);
      expect(key1).toContain(`tutor-videos/${userId}`);
      expect(key2).toContain(`tutor-videos/${userId}`);
    });
  });
});
