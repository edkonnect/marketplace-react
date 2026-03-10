/**
 * Lightweight sliding-window rate limiter for the chatbot endpoint.
 *
 * Uses an in-memory Map keyed by IP address.
 * No external dependencies required — suitable for single-process deployments.
 *
 * Config:
 *   WINDOW_MS   — Rolling time window (default 60 s)
 *   MAX_REQUESTS — Max requests per IP per window (default 20)
 */

const WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS = 20;      // requests per window per IP

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

/**
 * Check whether the given IP is within rate limits.
 * Mutates internal state (slides the window on each call).
 *
 * @returns true if the request is allowed, false if it should be rejected
 */
export function checkChatbotRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  let entry = store.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(ip, entry);
  }

  // Evict timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    return false; // rate limit exceeded
  }

  entry.timestamps.push(now);
  return true;
}

// Periodically evict stale IPs to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  const keys = Array.from(store.keys());
  for (const ip of keys) {
    const entry = store.get(ip)!;
    const active = entry.timestamps.filter((t: number) => t > cutoff);
    if (active.length === 0) {
      store.delete(ip);
    } else {
      entry.timestamps = active;
    }
  }
}, WINDOW_MS);
