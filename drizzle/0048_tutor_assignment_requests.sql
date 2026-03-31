CREATE TABLE `tutor_assignment_requests` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `parentId` int NOT NULL,
  `courseId` int NOT NULL,
  `message` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `tutor_request_parent_course_unique` UNIQUE (`parentId`, `courseId`)
);

ALTER TABLE `tutor_assignment_requests`
  ADD CONSTRAINT `tutor_assignment_requests_parentId_users_id_fk`
  FOREIGN KEY (`parentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;

ALTER TABLE `tutor_assignment_requests`
  ADD CONSTRAINT `tutor_assignment_requests_courseId_courses_id_fk`
  FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;
