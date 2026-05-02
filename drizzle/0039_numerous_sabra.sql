ALTER TABLE `subscriptions` MODIFY COLUMN `paymentPlan` enum('full','installment','monthly') NOT NULL DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE `payments` ADD `stripeInvoiceId` varchar(255);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripeItemId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);