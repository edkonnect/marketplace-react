import { useEffect, useState } from "react";

const FALLBACK_RATE = 83.5;
const CACHE_KEY = "usd_inr_rate";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Free APIs tried in order — if one fails or goes paid, next is tried
const RATE_FETCHERS: Array<() => Promise<number>> = [
  // 1. frankfurter.app — open source, ECB data
  () =>
    fetch("https://api.frankfurter.app/latest?from=USD&to=INR")
      .then((r) => r.json())
      .then((d) => {
        const rate = d?.rates?.INR;
        if (!rate) throw new Error("no rate");
        return rate as number;
      }),

  // 2. open.er-api.com — free tier, 1500 req/month
  () =>
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((d) => {
        const rate = d?.rates?.INR;
        if (!rate) throw new Error("no rate");
        return rate as number;
      }),

  // 3. cdn.jsdelivr.net mirrors exchangerate-api data — no key needed
  () =>
    fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json")
      .then((r) => r.json())
      .then((d) => {
        const rate = d?.usd?.inr;
        if (!rate) throw new Error("no rate");
        return rate as number;
      }),
];

async function fetchRateWithFallback(): Promise<number> {
  for (const fetcher of RATE_FETCHERS) {
    try {
      const rate = await fetcher();
      return rate;
    } catch {
      // try next
    }
  }
  return FALLBACK_RATE;
}

export function useExchangeRate() {
  const [rate, setRate] = useState<number>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { value, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS) return value;
      }
    } catch {}
    return FALLBACK_RATE;
  });

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL_MS) return;
      }
    } catch {}

    fetchRateWithFallback().then((fetched) => {
      setRate(fetched);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ value: fetched, timestamp: Date.now() }));
    });
  }, []);

  return rate;
}
