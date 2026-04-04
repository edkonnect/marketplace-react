import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useIsIndianUser } from "@/hooks/useIsIndianUser";

interface CoursePriceProps {
  price: string | number;
  priceInr?: string | number | null;
  region?: "global" | "us" | "india";
  className?: string;
  priceClassName?: string;
}

export function CoursePrice({ price, priceInr, region = "global", className = "", priceClassName = "" }: CoursePriceProps) {
  const usdAmount = typeof price === "string" ? parseFloat(price) : price;
  const isIndian = useIsIndianUser();
  const exchangeRate = useExchangeRate();

  if (isIndian) {
    // India-only: price column already holds INR, use directly
    // Global with priceInr set: use stored INR value
    // Otherwise: convert USD → INR via exchange rate
    const inrAmount = region === "india"
      ? usdAmount
      : priceInr != null
        ? (typeof priceInr === "string" ? parseFloat(priceInr) : priceInr)
        : Math.round(usdAmount * exchangeRate);
    const inrFormatted = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(inrAmount);
    return (
      <div className={`flex items-baseline gap-1 ${className}`}>
        <span className="text-xs text-muted-foreground font-normal">from</span>
        <span className={priceClassName}>{inrFormatted}</span>
      </div>
    );
  }

  // Non-Indian users always see USD
  return (
    <div className={`flex items-baseline gap-1 ${className}`}>
      <span className="text-xs text-muted-foreground font-normal">from</span>
      <span className={priceClassName}>${usdAmount}</span>
    </div>
  );
}
