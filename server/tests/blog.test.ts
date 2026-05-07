import { describe, it, expect } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

const mockPublicContext: TrpcContext = {
  user: null,
  req: {} as any,
  res: {} as any,
};

describe("Blog Posts API", () => {
  describe("home.blogPosts", () => {
    it("should return list of published blog posts", async () => {
      const caller = appRouter.createCaller(mockPublicContext);
      const result = await caller.home.blogPosts();

      expect(Array.isArray(result)).toBe(true);

      if (result.length > 0) {
        const post = result[0];
        expect(post).toHaveProperty("id");
        expect(post).toHaveProperty("title");
        expect(post).toHaveProperty("slug");
        expect(post).toHaveProperty("excerpt");
        expect(post).toHaveProperty("content");
        expect(post.isPublished).toBe(true);
      }
    });

    it("should respect limit parameter", async () => {
      const caller = appRouter.createCaller(mockPublicContext);
      const result = await caller.home.blogPosts({ limit: 2 });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(2);
    });
  });

  describe("home.blogPost", () => {
    it("should throw NOT_FOUND error for non-existent slug", async () => {
      const caller = appRouter.createCaller(mockPublicContext);

      await expect(
        caller.home.blogPost({ slug: "non-existent-slug-12345" })
      ).rejects.toThrow();
    });
  });

  describe("Blog Post Data Integrity", () => {
    it("should have all required fields when data exists", async () => {
      const caller = appRouter.createCaller(mockPublicContext);
      const posts = await caller.home.blogPosts({ limit: 1 });

      if (posts.length > 0) {
        const post = posts[0];

        expect(post.title).toBeTruthy();
        expect(post.slug).toBeTruthy();
        expect(post.excerpt).toBeTruthy();
        expect(post.content).toBeTruthy();
        expect(typeof post.isPublished).toBe("boolean");
        expect(typeof post.displayOrder).toBe("number");
        expect(post.createdAt).toBeInstanceOf(Date);
        expect(post.updatedAt).toBeInstanceOf(Date);
      }
    });

    it("should have valid read time if present", async () => {
      const caller = appRouter.createCaller(mockPublicContext);
      const posts = await caller.home.blogPosts();

      posts.forEach(post => {
        if (post.readTime !== null) {
          expect(typeof post.readTime).toBe("number");
          expect(post.readTime).toBeGreaterThan(0);
        }
      });
    });
  });
});
