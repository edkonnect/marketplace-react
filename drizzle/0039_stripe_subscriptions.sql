-- Migration: Add Stripe recurring subscription support
-- Adds stripeCustomerId to users, stripeInvoiceId to payments,
-- unique index on subscriptions.stripeSubscriptionId, and 'monthly' paymentPlan enum value.

-- 1. Add stripeCustomerId to users
ALTER TABLE `users`
  ADD COLUMN `stripeCustomerId` varchar(255) NULL;
CREATE INDEX `users_stripeCustomerId_idx` ON `users` (`stripeCustomerId`);

-- 2. Add stripeInvoiceId to payments
ALTER TABLE `payments`
  ADD COLUMN `stripeInvoiceId` varchar(255) NULL;
CREATE INDEX `payments_stripeInvoiceId_idx` ON `payments` (`stripeInvoiceId`);

-- 3. Add unique index on stripeSubscriptionId (column already exists)
ALTER TABLE `subscriptions`
  ADD UNIQUE INDEX `subscriptions_stripeSubscriptionId_unique` (`stripeSubscriptionId`);

-- 4. Add 'monthly' to paymentPlan enum (keep 'installment' for legacy rows)
ALTER TABLE `subscriptions`
  MODIFY COLUMN `paymentPlan` ENUM('full', 'installment', 'monthly') NOT NULL DEFAULT 'monthly';
