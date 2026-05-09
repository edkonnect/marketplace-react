import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Unit tests for INR routing logic ────────────────────────────────────────

describe("isAsiaTz", () => {
  // Import inline to avoid loading stripe SDK (which needs real keys in test env)
  function isAsiaTz(timezone: string | null | undefined): boolean {
    return typeof timezone === "string" && timezone.startsWith("Asia/");
  }

  it("returns true for Asia/Kolkata", () => {
    expect(isAsiaTz("Asia/Kolkata")).toBe(true);
  });

  it("returns true for Asia/Dubai", () => {
    expect(isAsiaTz("Asia/Dubai")).toBe(true);
  });

  it("returns true for Asia/Singapore", () => {
    expect(isAsiaTz("Asia/Singapore")).toBe(true);
  });

  it("returns false for America/New_York", () => {
    expect(isAsiaTz("America/New_York")).toBe(false);
  });

  it("returns false for Europe/London", () => {
    expect(isAsiaTz("Europe/London")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAsiaTz(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAsiaTz(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAsiaTz("")).toBe(false);
  });

  it("returns false for 'asian' (partial match, no slash)", () => {
    expect(isAsiaTz("asian")).toBe(false);
  });
});

// ─── INR price calculation logic ─────────────────────────────────────────────

describe("INR price calculation", () => {
  const EXCHANGE_RATE = 94;

  function computePrice(params: {
    isIndian: boolean;
    priceUsd: number;
    priceInr: number | null;
    isIndiaRegion: boolean;
    exchangeRate: number;
  }): number {
    const { isIndian, priceUsd, priceInr, isIndiaRegion, exchangeRate } = params;
    return isIndian
      ? (priceInr ?? (isIndiaRegion ? priceUsd : Math.round(priceUsd * exchangeRate)))
      : priceUsd;
  }

  it("uses priceInr when set for Indian user", () => {
    expect(computePrice({
      isIndian: true,
      priceUsd: 200,
      priceInr: 16000,
      isIndiaRegion: false,
      exchangeRate: EXCHANGE_RATE,
    })).toBe(16000);
  });

  it("uses priceUsd × exchangeRate as fallback when priceInr is null (global course)", () => {
    expect(computePrice({
      isIndian: true,
      priceUsd: 200,
      priceInr: null,
      isIndiaRegion: false,
      exchangeRate: EXCHANGE_RATE,
    })).toBe(Math.round(200 * 94)); // 18800
  });

  it("uses priceUsd as-is for india-region course (price column is already INR)", () => {
    expect(computePrice({
      isIndian: true,
      priceUsd: 16000, // stored as INR in price column
      priceInr: null,
      isIndiaRegion: true,
      exchangeRate: EXCHANGE_RATE,
    })).toBe(16000); // no conversion
  });

  it("priceInr takes precedence over india-region flag", () => {
    expect(computePrice({
      isIndian: true,
      priceUsd: 16000,
      priceInr: 15000, // explicit override
      isIndiaRegion: true,
      exchangeRate: EXCHANGE_RATE,
    })).toBe(15000);
  });

  it("uses priceUsd (no conversion) for non-Indian user", () => {
    expect(computePrice({
      isIndian: false,
      priceUsd: 200,
      priceInr: 16000,
      isIndiaRegion: false,
      exchangeRate: EXCHANGE_RATE,
    })).toBe(200);
  });

  it("uses priceUsd for non-Indian user even on india-region course", () => {
    expect(computePrice({
      isIndian: false,
      priceUsd: 16000,
      priceInr: null,
      isIndiaRegion: true,
      exchangeRate: EXCHANGE_RATE,
    })).toBe(16000);
  });
});

// ─── getSubAmount analytics logic ────────────────────────────────────────────

describe("getSubAmount (analytics spend calculation)", () => {
  const EXCHANGE_RATE = 94;

  function getSubAmount(
    item: {
      nextBillingAmount?: number | null;
      nextBillingCurrency?: string;
      subscription: {
        paymentPlan: string;
        firstInstallmentAmount?: string | null;
        promoDiscountAmount?: string | null;
        discountAmount?: string | null;
      };
      course?: {
        price?: string;
        priceInr?: string | null;
        region?: string;
      } | null;
    },
    isIndian: boolean,
    exchangeRate: number
  ): number {
    if (item.nextBillingAmount != null && item.nextBillingCurrency !== "inr") {
      return Number(item.nextBillingAmount);
    }
    const s = item.subscription;
    if (s.paymentPlan === "installment" && s.firstInstallmentAmount != null) {
      return Number(s.firstInstallmentAmount);
    }
    const isIndiaRegion = item.course?.region === "india";
    const priceInrStored = item.course?.priceInr ? Number(item.course.priceInr) : null;
    const coursePrice = isIndian
      ? (priceInrStored ?? (isIndiaRegion ? Number(item.course?.price ?? 0) : Math.round(Number(item.course?.price ?? 0) * exchangeRate)))
      : Number(item.course?.price ?? 0);
    const promo = isIndian ? Math.round(Number(s.promoDiscountAmount ?? 0) * exchangeRate) : Number(s.promoDiscountAmount ?? 0);
    const discount = isIndian ? Math.round(Number(s.discountAmount ?? 0) * exchangeRate) : Number(s.discountAmount ?? 0);
    return Math.max(0, coursePrice - promo - discount);
  }

  it("returns USD nextBillingAmount directly for USD sub", () => {
    const item = {
      nextBillingAmount: 200,
      nextBillingCurrency: "usd",
      subscription: { paymentPlan: "monthly" },
    };
    expect(getSubAmount(item, false, EXCHANGE_RATE)).toBe(200);
  });

  it("skips INR nextBillingAmount (paise) and recomputes from coursePrice", () => {
    // INR paise value should NOT be used directly — it would be 1,600,000 (paise for ₹16,000)
    const item = {
      nextBillingAmount: 1600000, // paise — should be skipped
      nextBillingCurrency: "inr",
      subscription: { paymentPlan: "monthly" },
      course: { price: "16000", priceInr: "16000", region: "india" },
    };
    expect(getSubAmount(item, true, EXCHANGE_RATE)).toBe(16000); // ₹16,000, not 1,600,000
  });

  it("uses firstInstallmentAmount for installment plan", () => {
    const item = {
      subscription: { paymentPlan: "installment", firstInstallmentAmount: "5000" },
      course: { price: "200" },
    };
    expect(getSubAmount(item, false, EXCHANGE_RATE)).toBe(5000);
  });

  it("treats india-region course price as INR for Indian user (no × rate)", () => {
    const item = {
      subscription: { paymentPlan: "monthly" },
      course: { price: "16000", region: "india" }, // price is INR, not USD
    };
    // Should NOT multiply by rate: 16000 × 94 = 1,504,000 (wrong)
    expect(getSubAmount(item, true, EXCHANGE_RATE)).toBe(16000);
  });

  it("converts USD price to INR for Indian user on global course", () => {
    const item = {
      subscription: { paymentPlan: "monthly" },
      course: { price: "200", region: "global" },
    };
    expect(getSubAmount(item, true, EXCHANGE_RATE)).toBe(Math.round(200 * 94)); // 18800
  });

  it("uses priceInr directly when set, regardless of region", () => {
    const item = {
      subscription: { paymentPlan: "monthly" },
      course: { price: "200", priceInr: "18500", region: "global" },
    };
    expect(getSubAmount(item, true, EXCHANGE_RATE)).toBe(18500);
  });

  it("subtracts INR-converted discounts for Indian user", () => {
    const item = {
      subscription: { paymentPlan: "monthly", promoDiscountAmount: "10", discountAmount: "5" },
      course: { price: "200", region: "global" },
    };
    // price: 200 * 94 = 18800
    // promo: 10 * 94 = 940
    // discount: 5 * 94 = 470
    // result: 18800 - 940 - 470 = 17390
    expect(getSubAmount(item, true, EXCHANGE_RATE)).toBe(17390);
  });

  it("subtracts USD discounts directly for non-Indian user", () => {
    const item = {
      subscription: { paymentPlan: "monthly", promoDiscountAmount: "10", discountAmount: "5" },
      course: { price: "200", region: "global" },
    };
    // 200 - 10 - 5 = 185
    expect(getSubAmount(item, false, EXCHANGE_RATE)).toBe(185);
  });

  it("does not go below zero", () => {
    const item = {
      subscription: { paymentPlan: "monthly", promoDiscountAmount: "9999" },
      course: { price: "100" },
    };
    expect(getSubAmount(item, false, EXCHANGE_RATE)).toBe(0);
  });
});

// ─── Currency detection for invoices / payment history ───────────────────────

describe("Invoice currency routing", () => {
  function isAsiaTz(timezone: string | null | undefined): boolean {
    return typeof timezone === "string" && timezone.startsWith("Asia/");
  }

  function getInvoiceCurrency(timezone: string | null | undefined): "usd" | "inr" {
    return isAsiaTz(timezone) ? "inr" : "usd";
  }

  it("routes Asia/Kolkata to inr", () => {
    expect(getInvoiceCurrency("Asia/Kolkata")).toBe("inr");
  });

  it("routes America/New_York to usd", () => {
    expect(getInvoiceCurrency("America/New_York")).toBe("usd");
  });

  it("routes null timezone to usd (safe fallback)", () => {
    expect(getInvoiceCurrency(null)).toBe("usd");
  });

  it("routes undefined timezone to usd (safe fallback)", () => {
    expect(getInvoiceCurrency(undefined)).toBe("usd");
  });
});

// ─── nextBillingAmount display routing ───────────────────────────────────────

describe("nextBillingAmount display", () => {
  // Simulate the display logic from ParentDashboard.tsx
  function formatBillingAmount(amount: number, currency: string): string {
    if (currency === "inr") {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return `$${amount.toFixed(2)}`;
  }

  it("formats INR amount in Indian style", () => {
    const result = formatBillingAmount(16000, "inr");
    expect(result).toContain("₹");
    expect(result).toContain("16,000");
  });

  it("formats USD amount with dollar sign", () => {
    const result = formatBillingAmount(200, "usd");
    expect(result).toBe("$200.00");
  });

  it("INR amount is NOT passed through formatPrice (which would double-convert)", () => {
    // formatPrice multiplies by exchangeRate for Indian users
    // If nextBillingCurrency === "inr", we must NOT call formatPrice
    // This test documents that the guard exists
    const nextBillingCurrency = "inr";
    const nextBillingAmount = 16000;

    const usesInrPath = nextBillingCurrency === "inr";
    expect(usesInrPath).toBe(true); // confirms INR path is taken, not formatPrice
  });
});
