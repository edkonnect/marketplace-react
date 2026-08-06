CREATE TABLE `sat_student_details` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`interestType` varchar(100),
	`targetScoreRange` varchar(50),
	`plannedTestMonth` varchar(20),
	`courseType` varchar(50),
	`courseCompletionDate` timestamp,
	`satTestDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sat_student_details_id` PRIMARY KEY(`id`),
	CONSTRAINT `sat_student_details_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `sat_student_details` ADD CONSTRAINT `sat_student_details_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sat_student_details_userId_idx` ON `sat_student_details` (`userId`);