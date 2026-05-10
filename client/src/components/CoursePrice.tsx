import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useIsIndianUser } from "@/hooks/useIsIndianUser";

const LOYALTY_PCT = 5;
const SIBLING_PCT = 5;
const TOTAL_PCT_DISCOUNT = (LOYALTY_PCT + SIBLING_PCT) / 100; // 0.10

interface CoursePriceProps {
  price: string | number;
  priceInr?: string | number | null;
  region?: "global" | "us" | "india";
  className?: string;
  priceClassName?: string;
  // When provided, switches to "as low as" mode using max possible discounts
  referralDiscountUsd?: number;
  referralDiscountInr?: number;
  // When provided alongside referral props, shows per-session price
  totalSessions?: number | null;
}

export function CoursePrice({ price, priceInr, region = "global", className = "", priceClassName = "", referralDiscountUsd, referralDiscountInr, totalSessions }: CoursePriceProps) {
  const usdAmount = typeof price === "string" ? parseFloat(price) : price;
  const isIndian = useIsIndianUser();
  const exchangeRate = useExchangeRate();
  const showAsLowAs = referralDiscountUsd !== undefined || referralDiscountInr !== undefined;

  if (isIndian) {
    // India-only: price column already holds INR, use directly
    // Global with priceInr set: use stored INR value
    // Otherwise: convert USD → INR via exchange rate
    const inrAmount = region === "india"
      ? usdAmount
      : priceInr != null
        ? (typeof priceInr === "string" ? parseFloat(priceInr) : priceInr)
        : Math.round(usdAmount * exchangeRate);

    if (showAsLowAs) {
      const afterPct = inrAmount * (1 - TOTAL_PCT_DISCOUNT);
      const asLowAs = Math.max(0, afterPct - (referralDiscountInr ?? 0));
      const displayAmt = totalSessions ? asLowAs / totalSessions : asLowAs;
      const formatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(displayAmt);
      return (
        <div className={`flex items-baseline gap-1 ${className}`}>
          <span className="text-xs text-muted-foreground font-normal">as low as</span>
          <span className={priceClassName}>{formatted}</span>
          {totalSessions && <span className="text-xs text-muted-foreground font-normal">/session</span>}
        </div>
      );
    }

    const inrFormatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(inrAmount);
    return (
      <div className={`flex items-baseline gap-1 ${className}`}>
        <span className="text-xs text-muted-foreground font-normal">from</span>
        <span className={priceClassName}>{inrFormatted}</span>
      </div>
    );
  }

  // Non-Indian users always see USD
  if (showAsLowAs) {
    const afterPct = usdAmount * (1 - TOTAL_PCT_DISCOUNT);
    const asLowAs = Math.max(0, afterPct - (referralDiscountUsd ?? 0));
    const displayAmt = totalSessions ? asLowAs / totalSessions : asLowAs;
    const formatted = displayAmt % 1 === 0 ? displayAmt.toFixed(0) : displayAmt.toFixed(2);
    return (
      <div className={`flex items-baseline gap-1 ${className}`}>
        <span className="text-xs text-muted-foreground font-normal">as low as</span>
        <span className={priceClassName}>${formatted}</span>
        {totalSessions && <span className="text-xs text-muted-foreground font-normal">/session</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-baseline gap-1 ${className}`}>
      <span className="text-xs text-muted-foreground font-normal">from</span>
      <span className={priceClassName}>${usdAmount}</span>
    </div>
  );
}
