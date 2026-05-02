ALTER TABLE `subscriptions` ADD `siblingDiscountApplied` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `discountAmount` decimal(10,2);