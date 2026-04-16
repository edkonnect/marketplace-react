import { ENV } from "../_core/env";

export async function validateReferralPromo(
  code: string,
  parentEmail: string
): Promise<{ valid: boolean; discount: number | null; reason: string | null }> {
  if (!ENV.referralAppUrl) {
    console.warn("[referralApp] REFERRAL_APP_URL not configured");
    return { valid: false, discount: null, reason: "Promo service unavailable." };
  }
  try {
    const input = encodeURIComponent(
      JSON.stringify({ json: { code: code.toUpperCase(), parentEmail } })
    );
    const res = await fetch(
      `${ENV.referralAppUrl}/api/trpc/promoCodes.validate?input=${input}`
    );
    const json = await res.json();
    const data = json?.result?.data?.json ?? json?.result?.data;
    if (data?.valid) {
      return { valid: true, discount: data.discount ?? 10, reason: null };
    }
    const reason =
      data?.reason === "email_mismatch"
        ? "This code is not linked to your account."
        : "Invalid or expired promo code.";
    return { valid: false, discount: null, reason };
  } catch (err) {
    console.error("[referralApp] validateReferralPromo error:", err);
    return { valid: false, discount: null, reason: "Could not validate promo code. Please try again." };
  }
}

export async function redeemReferralPromo(
  code: string,
  parentEmail: string
): Promise<void> {
  if (!ENV.referralAppUrl || !ENV.referralAppApiKey) {
    console.warn("[referralApp] REFERRAL_APP_URL or MARKETPLACE_API_KEY not configured — skipping redeem");
    return;
  }
  const res = await fetch(`${ENV.referralAppUrl}/api/trpc/promoCodes.redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: {
        code: code.toUpperCase(),
        parentEmail,
        apiKey: ENV.referralAppApiKey,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[referralApp] redeemReferralPromo failed (${res.status}): ${text}`);
  }
}
