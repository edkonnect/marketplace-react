import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../shared/const";
import type { TrpcContext } from "../_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    passwordHash: "",
    firstName: "Sample",
    lastName: "User",
    name: "Sample User",
    role: "parent" as const,
    userType: "parent" as const,
    loginMethod: "email",
    emailVerified: true,
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } as AuthenticatedUser;

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears auth cookies and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    // clearAuthCookies clears both access and refresh token cookies
    expect(clearedCookies).toHaveLength(2);
    expect(clearedCookies.map(c => c.name)).toContain(ACCESS_TOKEN_COOKIE);
    expect(clearedCookies.map(c => c.name)).toContain(REFRESH_TOKEN_COOKIE);
  });
});
