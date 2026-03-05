-- Migration: Add coordinator role, Zoom integration, and session/profile fields
-- Generated to match 0033_snapshot.json

-- Modify users role/userType enums to include coordinator
ALTER TABLE `users` MODIFY COLUMN `role` enum('parent','tutor','admin','coordinator') NOT NULL DEFAULT 'parent';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `userType` enum('parent','tutor','admin','coordinator') NOT NULL DEFAULT 'parent';--> statement-breakpoint

-- Add fields to users
ALTER TABLE `users` ADD `phoneNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneNumberVerified` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` varchar(100);--> statement-breakpoint

-- Add fields to tutor_profiles
ALTER TABLE `tutor_profiles` ADD `timezone` varchar(100);--> statement-breakpoint
ALTER TABLE `tutor_profiles` ADD `businessTimezone` varchar(100);--> statement-breakpoint

-- Add fields to parent_profiles
ALTER TABLE `parent_profiles` ADD `preferredContactMethod` enum('email','sms','phone') DEFAULT 'email';--> statement-breakpoint
ALTER TABLE `parent_profiles` ADD `emergencyContactName` varchar(255);--> statement-breakpoint
ALTER TABLE `parent_profiles` ADD `emergencyContactPhone` varchar(20);--> statement-breakpoint
ALTER TABLE `parent_profiles` ADD `bestTimeToContact` varchar(100);--> statement-breakpoint
ALTER TABLE `parent_profiles` ADD `timezone` varchar(100);--> statement-breakpoint

-- Add fields to subscriptions
ALTER TABLE `subscriptions` ADD `smsOptIn` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `smsConsentTimestamp` timestamp;--> statement-breakpoint

-- Add fields to sessions
ALTER TABLE `sessions` MODIFY COLUMN `subscriptionId` int;--> statement-breakpoint
ALTER TABLE `sessions` ADD `isTrial` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `meetingPlatform` varchar(50) DEFAULT 'Zoom';--> statement-breakpoint
ALTER TABLE `sessions` ADD `meetingUrl` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `hostMeetingUrl` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `seriesId` varchar(64);--> statement-breakpoint
ALTER TABLE `sessions` ADD `sessionNumberInSeries` int;--> statement-breakpoint
ALTER TABLE `sessions` ADD `totalSessionsInSeries` int;--> statement-breakpoint
ALTER TABLE `sessions` ADD `studentFirstName` varchar(255);--> statement-breakpoint
ALTER TABLE `sessions` ADD `studentLastName` varchar(255);--> statement-breakpoint
ALTER TABLE `sessions` ADD `studentGrade` varchar(50);--> statement-breakpoint
ALTER TABLE `sessions` ADD `courseId` int;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_courseId_courses_id_fk` FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Remove acuity fields
ALTER TABLE `sessions` DROP COLUMN `acuityAppointmentId`;--> statement-breakpoint
ALTER TABLE `tutor_profiles` DROP COLUMN `acuityLink`;--> statement-breakpoint
ALTER TABLE `courses` DROP COLUMN `acuityAppointmentTypeId`;--> statement-breakpoint
ALTER TABLE `courses` DROP COLUMN `acuityCalendarId`;--> statement-breakpoint
ALTER TABLE `tutor_time_blocks` DROP COLUMN `acuityBlockId`;--> statement-breakpoint
DROP TABLE IF EXISTS `acuity_mapping_templates`;--> statement-breakpoint

-- Add coordinatorId to conversations
ALTER TABLE `conversations` ADD `coordinatorId` int;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_coordinatorId_users_id_fk` FOREIGN KEY (`coordinatorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Create coordinator_profiles table
CREATE TABLE `coordinator_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bio` text,
	`specialization` varchar(255),
	`phoneNumber` varchar(20),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coordinator_profiles_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

-- Create coordinator_assignments table
CREATE TABLE `coordinator_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`coordinatorId` int NOT NULL,
	`parentId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedBy` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `coordinator_assignments_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

-- Create zoom_meeting_recordings table
CREATE TABLE `zoom_meeting_recordings` (
	`id` varchar(255) NOT NULL,
	`meetingId` varchar(255) NOT NULL,
	`sessionId` int,
	`topic` text,
	`hostId` varchar(255),
	`transcriptUrl` varchar(500),
	`transcriptText` mediumtext,
	`rawTranscript` mediumtext,
	`durationMinutes` int,
	`recordedAt` timestamp,
	`processedAt` timestamp,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`shareUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zoom_meeting_recordings_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

-- Create session_ai_insights table
CREATE TABLE `session_ai_insights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recordingId` varchar(255) NOT NULL,
	`sessionId` int,
	`summary` mediumtext,
	`homework` mediumtext,
	`studentProgress` mediumtext,
	`keyTopics` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_ai_insights_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

-- Foreign keys for new tables
ALTER TABLE `coordinator_profiles` ADD CONSTRAINT `coordinator_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coordinator_assignments` ADD CONSTRAINT `coordinator_assignments_coordinatorId_users_id_fk` FOREIGN KEY (`coordinatorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coordinator_assignments` ADD CONSTRAINT `coordinator_assignments_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coordinator_assignments` ADD CONSTRAINT `coordinator_assignments_assignedBy_users_id_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `zoom_meeting_recordings` ADD CONSTRAINT `zoom_meeting_recordings_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD CONSTRAINT `session_ai_insights_recordingId_zoom_meeting_recordings_id_fk` FOREIGN KEY (`recordingId`) REFERENCES `zoom_meeting_recordings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD CONSTRAINT `session_ai_insights_sessionId_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `sessions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Indexes
CREATE INDEX `sessions_seriesId_idx` ON `sessions` (`seriesId`);--> statement-breakpoint
CREATE INDEX `sessions_trial_parent_idx` ON `sessions` (`parentId`,`isTrial`);--> statement-breakpoint
CREATE INDEX `sessions_courseId_idx` ON `sessions` (`courseId`);--> statement-breakpoint
CREATE INDEX `coordinator_profiles_userId_idx` ON `coordinator_profiles` (`userId`);--> statement-breakpoint
CREATE INDEX `coordinator_assignments_coordinatorId_idx` ON `coordinator_assignments` (`coordinatorId`);--> statement-breakpoint
CREATE INDEX `coordinator_assignments_parentId_idx` ON `coordinator_assignments` (`parentId`);--> statement-breakpoint
CREATE UNIQUE INDEX `coordinator_assignments_unique` ON `coordinator_assignments` (`coordinatorId`,`parentId`,`isActive`);--> statement-breakpoint
CREATE INDEX `conversations_coordinatorId_idx` ON `conversations` (`coordinatorId`);--> statement-breakpoint
CREATE INDEX `zoom_recordings_meetingId_idx` ON `zoom_meeting_recordings` (`meetingId`);--> statement-breakpoint
CREATE INDEX `zoom_recordings_sessionId_idx` ON `zoom_meeting_recordings` (`sessionId`);--> statement-breakpoint
CREATE INDEX `zoom_recordings_status_idx` ON `zoom_meeting_recordings` (`status`);--> statement-breakpoint
CREATE INDEX `session_ai_insights_recordingId_idx` ON `session_ai_insights` (`recordingId`);--> statement-breakpoint
CREATE INDEX `session_ai_insights_sessionId_idx` ON `session_ai_insights` (`sessionId`);
