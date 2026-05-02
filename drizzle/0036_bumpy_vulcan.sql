ALTER TABLE `coordinator_assignments` DROP INDEX `coordinator_assignments_unique`;--> statement-breakpoint
ALTER TABLE `session_notes` ADD `transcript` mediumtext;--> statement-breakpoint
ALTER TABLE `session_notes` ADD `topicsCovered` text;--> statement-breakpoint
ALTER TABLE `coordinator_assignments` ADD CONSTRAINT `coordinator_assignments_unique` UNIQUE(`coordinatorId`,`parentId`);