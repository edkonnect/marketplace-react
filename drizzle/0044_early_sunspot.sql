ALTER TABLE `courses` MODIFY COLUMN `gradeLevel` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `progressStatus` enum('low','medium','high');