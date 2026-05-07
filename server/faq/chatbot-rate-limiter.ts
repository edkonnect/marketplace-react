/**
 * Lightweight sliding-window rate limiter.
 *
 * Uses an in-memory Map keyed by an arbitrary string (IP, userId, etc.).
 * No external dependencies required — suitable for single-process deployments.
 */

export class RateLimiter {
  private store = new Map<string, { timestamps: number[] }>();
  private evictionTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number,
  ) {
    this.evictionTimer = setInterval(() => this.evict(), this.windowMs);
  }

  /** Returns true if the request is allowed, false if rate limit exceeded. */
  check(key: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let entry = this.store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.store.set(key, entry);
    }

    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= this.maxRequests) {
      return false;
    }

    entry.timestamps.push(now);
    return true;
  }

  private evict(): void {
    const cutoff = Date.now() - this.windowMs;
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      if (entry.timestamps.every((t: number) => t <= cutoff)) {
        this.store.delete(key);
      }
    });
  }
}

// Chatbot rate limiter: 20 requests per 60 seconds per IP (unchanged behaviour)
const _chatbotLimiter = new RateLimiter(60 * 1000, 20);

/**
 * Check whether the given IP is within the chatbot rate limit.
 * @returns true if the request is allowed, false if it should be rejected
 */
export function checkChatbotRateLimit(ip: string): boolean {
  return _chatbotLimiter.check(ip);
}

// Booking rate limiter: max 20 bookings per userId per 10 minutes
export const bookingRateLimiter = new RateLimiter(10 * 60 * 1000, 20);
