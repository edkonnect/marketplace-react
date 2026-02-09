CREATE TABLE `tutor_course_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tutorId` int NOT NULL,
	`courseId` int NOT NULL,
	`hourlyRate` decimal(10,2) NOT NULL DEFAULT '0.00',
	`approvalStatus` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tutor_course_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `tutor_course_pref_unique` UNIQUE(`tutorId`,`courseId`)
);
--> statement-breakpoint
ALTER TABLE `tutor_course_preferences` ADD CONSTRAINT `tutor_course_preferences_tutorId_users_id_fk` FOREIGN KEY (`tutorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tutor_course_preferences` ADD CONSTRAINT `tutor_course_preferences_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tutor_course_pref_tutor_idx` ON `tutor_course_preferences` (`tutorId`);--> statement-breakpoint
CREATE INDEX `tutor_course_pref_course_idx` ON `tutor_course_preferences` (`courseId`);

-- Backfill existing course tutor assignments as approved preferences to preserve behavior
INSERT INTO tutor_course_preferences (tutorId, courseId, hourlyRate, approvalStatus, createdAt, updatedAt)
SELECT DISTINCT ct.tutorId, ct.courseId, COALESCE(c.price, 0.00), 'APPROVED', NOW(), NOW()
FROM course_tutors ct
LEFT JOIN tutor_course_preferences tcp ON tcp.tutorId = ct.tutorId AND tcp.courseId = ct.courseId
LEFT JOIN courses c ON c.id = ct.courseId
WHERE tcp.id IS NULL;
