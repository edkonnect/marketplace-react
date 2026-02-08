CREATE TABLE `email_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_tutor_start_unique` UNIQUE(`tutorId`,`scheduledAt`);--> statement-breakpoint
ALTER TABLE `email_verifications` ADD CONSTRAINT `email_verifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `email_verifications_token_idx` ON `email_verifications` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `email_verifications_userId_idx` ON `email_verifications` (`userId`);