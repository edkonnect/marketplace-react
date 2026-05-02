CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`userId` int NOT NULL,
	`discountPercent` int NOT NULL DEFAULT 25,
	`isUsed` boolean NOT NULL DEFAULT false,
	`usedAt` timestamp,
	`sourceReferralId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`),
	CONSTRAINT `coupons_code_idx` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerId` int NOT NULL,
	`invitedEmail` varchar(320) NOT NULL,
	`referredUserId` int,
	`referral_status` enum('pending','signed_up','rewarded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_referrer_email_unique` UNIQUE(`referrerId`,`invitedEmail`)
);
--> statement-breakpoint
ALTER TABLE `courses` ADD `aiPowered` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `region` enum('global','us','india') DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `promoDiscountPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `referralCode` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD `referredBy` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_referralCode_unique` UNIQUE(`referralCode`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_referralCode_idx` UNIQUE(`referralCode`);--> statement-breakpoint
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coupons` ADD CONSTRAINT `coupons_sourceReferralId_referrals_id_fk` FOREIGN KEY (`sourceReferralId`) REFERENCES `referrals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_referrerId_users_id_fk` FOREIGN KEY (`referrerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `referrals` ADD CONSTRAINT `referrals_referredUserId_users_id_fk` FOREIGN KEY (`referredUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `coupons_userId_idx` ON `coupons` (`userId`);--> statement-breakpoint
CREATE INDEX `referrals_referrer_idx` ON `referrals` (`referrerId`);--> statement-breakpoint
CREATE INDEX `referrals_invitedEmail_idx` ON `referrals` (`invitedEmail`);