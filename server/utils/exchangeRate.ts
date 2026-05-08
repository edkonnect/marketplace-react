let cachedRate: number = 93.5;
let rateExpiresAt: number = 0;
const RATE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getUsdToInrRate(): Promise<number> {
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
    // keep previous cached rate
  }
  return cachedRate;
}
