CREATE TABLE `password_reset_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `password_reset_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` MODIFY COLUMN `paymentPlan` enum('full','installment','monthly') NOT NULL DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE `payments` ADD `stripeInvoiceId` varchar(255);--> statement-breakpoint
ALTER TABLE `session_quizzes` ADD `correctCount` int;--> statement-breakpoint
ALTER TABLE `session_quizzes` ADD `totalCount` int;--> statement-breakpoint
ALTER TABLE `session_quizzes` ADD `studentAnswers` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `stripeItemId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `password_reset_tokens_tokenHash_idx` ON `password_reset_tokens` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_userId_idx` ON `password_reset_tokens` (`userId`);--> statement-breakpoint
ALTER TABLE `session_quizzes` DROP COLUMN `answersJson`;