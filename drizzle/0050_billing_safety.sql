ALTER TABLE `subscriptions`
  ADD COLUMN `appliedCouponId` int NULL,
  ADD CONSTRAINT `subscriptions_appliedCouponId_coupons_id_fk`
    FOREIGN KEY (`appliedCouponId`) REFERENCES `coupons`(`id`) ON DELETE set null;
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_invoice_subscription_type_unique`
  ON `payments` (`stripeInvoiceId`, `subscriptionId`, `paymentType`);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_pi_subscription_type_unique`
  ON `payments` (`stripePaymentIntentId`, `subscriptionId`, `paymentType`);
