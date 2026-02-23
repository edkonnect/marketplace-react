CREATE TABLE `session_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`parentId` int NOT NULL,
	`tutorId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `session_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessionRatings_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `session_ratings` ADD CONSTRAINT `session_ratings_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_ratings` ADD CONSTRAINT `session_ratings_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_ratings` ADD CONSTRAINT `session_ratings_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sessionRatings_parentId_idx` ON `session_ratings` (`parentId`);--> statement-breakpoint
CREATE INDEX `sessionRatings_tutorId_idx` ON `session_ratings` (`tutorId`);