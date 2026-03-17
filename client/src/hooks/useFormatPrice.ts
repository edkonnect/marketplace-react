import { useIsIndianUser } from "./useIsIndianUser";
import { useExchangeRate } from "./useExchangeRate";

/**
 * Returns a formatPrice function that converts USD amounts to INR for Indian users,
 * or formats as USD for all others.
 *
 * Detection priority:
 *  1. Logged-in user's saved timezone from DB (most authoritative)
 *  2. Browser timezone fallback (for logged-out visitors)
 *
 * Usage:
 *   const formatPrice = useFormatPrice();
 *   formatPrice(99.99)        → "$100"   or "₹8,349"
 *   formatPrice(99.99, "/hr") → "$100/hr" or "₹8,349/hr"
 */
export function useFormatPrice() {
  const isIndian = useIsIndianUser();
  const exchangeRate = useExchangeRate();

  return (amount: number | string, suffix = "") => {
    const usd = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(usd)) return "—";

    if (isIndian) {
      const inr = Math.round(usd * exchangeRate);
      const formatted = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(inr);
      return `${formatted}${suffix}`;
    }

    return `$${usd % 1 === 0 ? usd.toFixed(0) : usd.toFixed(2)}${suffix}`;
  };
}
