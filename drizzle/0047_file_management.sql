CREATE TABLE `course_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`courseId` int,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_files_id` PRIMARY KEY(`id`)
);

CREATE TABLE `course_file_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileId` int NOT NULL,
	`tutorId` int NOT NULL,
	`assignedBy` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_file_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `cfa_unique` UNIQUE(`fileId`,`tutorId`)
);

CREATE TABLE `tutor_file_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileId` int NOT NULL,
	`parentId` int NOT NULL,
	`tutorId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutor_file_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `tfa_unique` UNIQUE(`fileId`,`parentId`,`tutorId`)
);

ALTER TABLE `course_files` ADD CONSTRAINT `course_files_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `course_files` ADD CONSTRAINT `course_files_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;
ALTER TABLE `course_file_assignments` ADD CONSTRAINT `course_file_assignments_fileId_course_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `course_files`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `course_file_assignments` ADD CONSTRAINT `course_file_assignments_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `course_file_assignments` ADD CONSTRAINT `course_file_assignments_assignedBy_users_id_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;
ALTER TABLE `tutor_file_assignments` ADD CONSTRAINT `tutor_file_assignments_fileId_course_files_id_fk` FOREIGN KEY (`fileId`) REFERENCES `course_files`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `tutor_file_assignments` ADD CONSTRAINT `tutor_file_assignments_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `tutor_file_assignments` ADD CONSTRAINT `tutor_file_assignments_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;

CREATE INDEX `course_files_uploadedBy_idx` ON `course_files` (`uploadedBy`);
CREATE INDEX `course_files_courseId_idx` ON `course_files` (`courseId`);
CREATE INDEX `cfa_fileId_idx` ON `course_file_assignments` (`fileId`);
CREATE INDEX `cfa_tutorId_idx` ON `course_file_assignments` (`tutorId`);
CREATE INDEX `tfa_fileId_idx` ON `tutor_file_assignments` (`fileId`);
CREATE INDEX `tfa_parentId_idx` ON `tutor_file_assignments` (`parentId`);
CREATE INDEX `tfa_tutorId_idx` ON `tutor_file_assignments` (`tutorId`);
