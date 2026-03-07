CREATE TABLE `session_quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`courseId` int,
	`tutorId` int NOT NULL,
	`parentId` int NOT NULL,
	`questions` text NOT NULL,
	`session_quiz_status` enum('draft','approved','completed') NOT NULL DEFAULT 'draft',
	`assignedAt` timestamp,
	`completedAt` timestamp,
	`parentNotified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `session_quizzes_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_quizzes_session_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
ALTER TABLE `courses` ADD `quizEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `session_notes` ADD `transcript` mediumtext;--> statement-breakpoint
ALTER TABLE `session_notes` ADD `topicsCovered` text;--> statement-breakpoint
ALTER TABLE `session_quizzes` ADD CONSTRAINT `session_quizzes_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_quizzes` ADD CONSTRAINT `session_quizzes_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_quizzes` ADD CONSTRAINT `session_quizzes_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_quizzes` ADD CONSTRAINT `session_quizzes_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `session_quizzes_sessionId_idx` ON `session_quizzes` (`sessionId`);--> statement-breakpoint
CREATE INDEX `session_quizzes_tutorId_idx` ON `session_quizzes` (`tutorId`);--> statement-breakpoint
CREATE INDEX `session_quizzes_parentId_idx` ON `session_quizzes` (`parentId`);--> statement-breakpoint
CREATE INDEX `session_quizzes_courseId_idx` ON `session_quizzes` (`courseId`);