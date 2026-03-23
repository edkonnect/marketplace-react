import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";

// In-memory exchange rate cache — same pattern as zoom-service.ts token cache
let cachedRate: number = 93.5;
let rateExpiresAt: number = 0;
const RATE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getUsdToInrRate(): Promise<number> {
  if (Date.now() < rateExpiresAt) return cachedRate;
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR");
    const data = await res.json();
    const rate = data?.rates?.INR;
    if (rate) {
      cachedRate = rate;
      rateExpiresAt = Date.now() + RATE_TTL_MS;
    }
  } catch {
    // keep previous cached rate, try again next call
  }
  return cachedRate;
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  getExchangeRate: publicProcedure.query(async () => {
    const rate = await getUsdToInrRate();
    return { rate };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
