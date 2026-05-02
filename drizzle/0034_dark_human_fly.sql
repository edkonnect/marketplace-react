ALTER TABLE `sessions` ADD `studentFirstName` varchar(255);--> statement-breakpoint
ALTER TABLE `sessions` ADD `studentLastName` varchar(255);--> statement-breakpoint
ALTER TABLE `sessions` ADD `studentGrade` varchar(50);--> statement-breakpoint
ALTER TABLE `sessions` ADD `courseId` int;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sessions_courseId_idx` ON `sessions` (`courseId`);