import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest, verifySuperUserCookie } from "./services/authService";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  superUserVerified: boolean;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }

  let superUserVerified = false;
  if (user?.role === 'admin') {
    try {
      const suPayload = await verifySuperUserCookie(opts.req);
      superUserVerified = Number(suPayload.sub) === user.id;
    } catch {
      superUserVerified = false;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    superUserVerified,
  };
}
