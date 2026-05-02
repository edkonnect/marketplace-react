ALTER TABLE `sessions` MODIFY COLUMN `subscriptionId` int;--> statement-breakpoint
ALTER TABLE `sessions` ADD `isTrial` boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `sessions_trial_parent_idx` ON `sessions` (`parentId`,`isTrial`);--> statement-breakpoint
ALTER TABLE `session_notes` DROP COLUMN `transcript`;--> statement-breakpoint
ALTER TABLE `session_notes` DROP COLUMN `topicsCovered`;