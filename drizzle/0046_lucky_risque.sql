CREATE TABLE `acuity_email_aliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`acuityEmail` varchar(320) NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `acuity_email_aliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `acuity_email_aliases_acuityEmail_unique` UNIQUE(`acuityEmail`)
);
--> statement-breakpoint
CREATE TABLE `trial_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`reminderNumber` int NOT NULL,
	`status` varchar(20) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trial_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leads` ADD `status` varchar(20) DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE `acuity_email_aliases` ADD CONSTRAINT `acuity_email_aliases_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trial_reminders` ADD CONSTRAINT `trial_reminders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `acuity_email_aliases_email_idx` ON `acuity_email_aliases` (`acuityEmail`);--> statement-breakpoint
CREATE INDEX `acuity_email_aliases_user_idx` ON `acuity_email_aliases` (`userId`);--> statement-breakpoint
CREATE INDEX `trial_reminders_userId_idx` ON `trial_reminders` (`userId`);