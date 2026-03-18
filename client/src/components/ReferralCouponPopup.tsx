import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, UserPlus, Copy, CheckCircle } from "lucide-react";

/**
 * Returns a localStorage key scoped to the user + coupon code.
 * Storing "seen" here means we never show the popup for that coupon again
 * once dismissed — even across logins/remounts — until the coupon is used.
 */
function seenKey(userId: number, couponCode: string) {
  return `couponSeen:${userId}:${couponCode}`;
}

export function ReferralCouponPopup() {
  const { user, isAuthenticated } = useAuth();

  const { data: myCoupons = [] } = trpc.referral.getMyCoupons.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const [couponPopup, setCouponPopup] = useState<{
    code: string;
    discountPercent: number;
    type: "referred" | "referrer";
  } | null>(null);
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  // Prevent re-triggering within the same render cycle if myCoupons re-fetches
  const shownThisMountRef = useRef(false);

  useEffect(() => {
    if (!user || !myCoupons.length) return;
    if (shownThisMountRef.current) return;

    // If the user just came back from Stripe after applying a coupon,
    // suppress the popup for that specific coupon (webhook delay).
    const justUsedCode = sessionStorage.getItem("justUsedCoupon");

    const referredCoupon = myCoupons.find((c: any) => !c.isUsed && c.isReferredCoupon);
    const referrerCoupon = myCoupons.find((c: any) => !c.isUsed && !c.isReferredCoupon);
    const coupon = referredCoupon || referrerCoupon;

    // Clean up sessionStorage once the webhook has confirmed the coupon used
    if (justUsedCode) {
      const isStillUnused = myCoupons.some((c: any) => c.code === justUsedCode && !c.isUsed);
      if (!isStillUnused) {
        sessionStorage.removeItem("justUsedCoupon");
        // Also clear the "seen" flag so it won't linger
        localStorage.removeItem(seenKey(user.id, justUsedCode));
      }
    }

    if (!coupon) return;

    // Suppress if this coupon was just applied at Stripe checkout
    if (justUsedCode && coupon.code === justUsedCode) {
      shownThisMountRef.current = true;
      return;
    }

    // Suppress if user already dismissed this popup in a previous session
    if (localStorage.getItem(seenKey(user.id, coupon.code))) {
      shownThisMountRef.current = true;
      return;
    }

    setCouponPopup({
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      type: referredCoupon ? "referred" : "referrer",
    });
    shownThisMountRef.current = true;
  }, [myCoupons, user]);

  const handleDismiss = () => {
    if (couponPopup && user) {
      // Remember that user has seen this coupon's popup — don't show again
      localStorage.setItem(seenKey(user.id, couponPopup.code), "1");
    }
    setCouponPopup(null);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  return (
    <Dialog open={!!couponPopup} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              couponPopup?.type === "referrer" ? "bg-amber-100 dark:bg-amber-950/30" : "bg-primary/10"
            }`}>
              {couponPopup?.type === "referrer"
                ? <UserPlus className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                : <Gift className="w-8 h-8 text-primary" />
              }
            </div>
          </div>
          {couponPopup?.type === "referrer" ? (
            <>
              <DialogTitle className="text-2xl">Your referral paid off! 🎉</DialogTitle>
              <DialogDescription className="text-base">
                Someone you referred has enrolled in their first course on EdKonnect Academy. As a thank you, here's your <strong>{couponPopup?.discountPercent}% discount coupon</strong> — use it on your next enrollment.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle className="text-2xl">You've got a welcome gift!</DialogTitle>
              <DialogDescription className="text-base">
                A friend referred you to EdKonnect Academy. Here's your <strong>{couponPopup?.discountPercent}% discount coupon</strong> — use it on your first course enrollment.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        <div className="my-4">
          <div className="flex items-center justify-center gap-3 bg-muted rounded-xl px-6 py-4 border-2 border-dashed border-primary/40">
            <span className="text-2xl font-mono font-bold tracking-widest text-primary">
              {couponPopup?.code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => couponPopup && handleCopy(couponPopup.code)}
              className="shrink-0"
            >
              {copiedCoupon
                ? <CheckCircle className="w-5 h-5 text-green-500" />
                : <Copy className="w-5 h-5" />
              }
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {couponPopup?.type === "referrer"
              ? "Valid for one-time use · No expiry · Apply at enrollment"
              : "Valid for one-time use · No expiry · First enrollment only"
            }
          </p>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button onClick={handleDismiss} className="w-full sm:w-auto">
            Got it, thanks!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
