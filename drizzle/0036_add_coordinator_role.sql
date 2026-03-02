-- Add coordinator role to users table
ALTER TABLE `users` MODIFY COLUMN `role` enum('parent','tutor','admin','coordinator') NOT NULL DEFAULT 'parent';
ALTER TABLE `users` MODIFY COLUMN `userType` enum('parent','tutor','admin','coordinator') NOT NULL DEFAULT 'parent';

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
);

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
);

-- Add coordinatorId to conversations table
ALTER TABLE `conversations` ADD `coordinatorId` int;

-- Add indexes for coordinator_profiles
ALTER TABLE `coordinator_profiles` ADD INDEX `coordinator_profiles_userId_idx`(`userId`);

-- Add indexes for coordinator_assignments
ALTER TABLE `coordinator_assignments` ADD INDEX `coordinator_assignments_coordinatorId_idx`(`coordinatorId`);
ALTER TABLE `coordinator_assignments` ADD INDEX `coordinator_assignments_parentId_idx`(`parentId`);
ALTER TABLE `coordinator_assignments` ADD UNIQUE INDEX `coordinator_assignments_unique`(`coordinatorId`,`parentId`,`isActive`);

-- Add index for conversations.coordinatorId
ALTER TABLE `conversations` ADD INDEX `conversations_coordinatorId_idx`(`coordinatorId`);

-- Add foreign key constraints
ALTER TABLE `coordinator_profiles` ADD CONSTRAINT `coordinator_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `coordinator_assignments` ADD CONSTRAINT `coordinator_assignments_coordinatorId_users_id_fk` FOREIGN KEY (`coordinatorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `coordinator_assignments` ADD CONSTRAINT `coordinator_assignments_parentId_users_id_fk` FOREIGN KEY (`parentId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `coordinator_assignments` ADD CONSTRAINT `coordinator_assignments_assignedBy_users_id_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_coordinatorId_users_id_fk` FOREIGN KEY (`coordinatorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
