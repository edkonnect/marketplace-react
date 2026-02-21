CREATE TABLE `password_setup_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_setup_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `messages` MODIFY COLUMN `fileUrl` mediumtext;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `accountSetupComplete` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `password_setup_tokens` ADD CONSTRAINT `password_setup_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `password_setup_tokens_tokenHash_idx` ON `password_setup_tokens` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `password_setup_tokens_userId_idx` ON `password_setup_tokens` (`userId`);