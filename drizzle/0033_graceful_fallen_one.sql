ALTER TABLE `parent_profiles` ADD `preferredContactMethod` enum('email','sms','phone') DEFAULT 'email';--> statement-breakpoint
ALTER TABLE `parent_profiles` ADD `emergencyContactName` varchar(255);--> statement-breakpoint
ALTER TABLE `parent_profiles` ADD `emergencyContactPhone` varchar(20);--> statement-breakpoint
ALTER TABLE `parent_profiles` ADD `bestTimeToContact` varchar(100);--> statement-breakpoint
ALTER TABLE `sessions` ADD `meetingPlatform` varchar(50) DEFAULT 'Zoom';--> statement-breakpoint
ALTER TABLE `sessions` ADD `meetingUrl` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `hostMeetingUrl` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `seriesId` varchar(64);--> statement-breakpoint
ALTER TABLE `sessions` ADD `sessionNumberInSeries` int;--> statement-breakpoint
ALTER TABLE `sessions` ADD `totalSessionsInSeries` int;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `smsOptIn` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `smsConsentTimestamp` timestamp;--> statement-breakpoint
ALTER TABLE `tutor_profiles` ADD `timezone` varchar(100);--> statement-breakpoint
ALTER TABLE `tutor_profiles` ADD `businessTimezone` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneNumberVerified` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` varchar(100);--> statement-breakpoint
CREATE INDEX `sessions_seriesId_idx` ON `sessions` (`seriesId`);