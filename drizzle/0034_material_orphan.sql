ALTER TABLE `tutor_profiles` ADD `zoomMeetingId` varchar(255);--> statement-breakpoint
ALTER TABLE `tutor_profiles` ADD `zoomJoinUrl` text;--> statement-breakpoint
ALTER TABLE `tutor_profiles` ADD `zoomHostUrl` text;--> statement-breakpoint
ALTER TABLE `tutor_profiles` ADD `zoomMeetingPassword` varchar(50);--> statement-breakpoint
ALTER TABLE `tutor_profiles` ADD `zoomCreatedAt` timestamp;