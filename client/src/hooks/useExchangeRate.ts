import { useEffect, useState } from "react";

const FALLBACK_RATE = 83.5;
const CACHE_KEY = "usd_inr_rate";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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

    fetch("https://api.frankfurter.app/latest?from=USD&to=INR")
      .then((res) => res.json())
      .then((data) => {
        const fetched = data?.rates?.INR;
        if (fetched) {
          setRate(fetched);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ value: fetched, timestamp: Date.now() }));
        }
      })
      .catch(() => {}); // silently fall back to cached/default
  }, []);

  return rate;
}
