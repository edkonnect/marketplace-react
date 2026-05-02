CREATE TABLE `billing_cycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscriptionId` int NOT NULL,
	`cycleStart` timestamp NOT NULL,
	`cycleEnd` timestamp NOT NULL,
	`sessionsCount` int NOT NULL DEFAULT 0,
	`amountCents` int NOT NULL DEFAULT 0,
	`status` enum('pending','invoiced','paid','failed') NOT NULL DEFAULT 'pending',
	`stripeInvoiceId` varchar(255),
	`processedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_cycles_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_cycles_sub_start_unique` UNIQUE(`subscriptionId`,`cycleStart`)
);
--> statement-breakpoint
ALTER TABLE `session_ai_insights` MODIFY COLUMN `recordingId` varchar(255);--> statement-breakpoint
ALTER TABLE `courses` ADD `courseType` enum('test_prep','tutor','homework') DEFAULT 'tutor' NOT NULL;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricAcademicEfficiency` int;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricInstructionalQuality` int;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricStrategyInsight` int;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricSynthesisBranding` int;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricEvidence` text;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricOverallScore` decimal(3,2);--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricGradedAt` timestamp;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricTranscriptQuality` varchar(10);--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricTranscriptQualityReason` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `thirdInstallmentPaid` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `thirdInstallmentAmount` decimal(10,2);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `numberOfInstallments` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billingCycleStart` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billingCycleEnd` timestamp;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `perSessionRateCents` int;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `loyaltyDiscountApplied` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `billing_cycles` ADD CONSTRAINT `billing_cycles_subscriptionId_subscriptions_id_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `subscriptions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `billing_cycles_subscriptionId_idx` ON `billing_cycles` (`subscriptionId`);--> statement-breakpoint
CREATE INDEX `billing_cycles_status_idx` ON `billing_cycles` (`status`);--> statement-breakpoint
CREATE INDEX `billing_cycles_cycleEnd_idx` ON `billing_cycles` (`cycleEnd`);