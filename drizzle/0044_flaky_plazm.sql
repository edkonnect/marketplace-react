ALTER TABLE `session_ai_insights` MODIFY COLUMN `recordingId` varchar(255);--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricAcademicEfficiency` int;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricInstructionalQuality` int;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricStrategyInsight` int;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricSynthesisBranding` int;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricEvidence` text;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricOverallScore` decimal(3,2);--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricGradedAt` timestamp;--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricTranscriptQuality` varchar(10);--> statement-breakpoint
ALTER TABLE `session_ai_insights` ADD `rubricTranscriptQualityReason` text;