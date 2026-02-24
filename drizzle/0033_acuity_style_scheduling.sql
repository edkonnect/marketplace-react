-- Migration: Add Acuity-style scheduling fields
-- This migration adds fields for SMS opt-in, meeting platform, timezone, and session series tracking

-- Add SMS opt-in fields to subscriptions
ALTER TABLE `subscriptions`
ADD COLUMN `smsOptIn` boolean DEFAULT false NOT NULL,
ADD COLUMN `smsConsentTimestamp` timestamp NULL;

-- Add meeting platform and URL fields to sessions
ALTER TABLE `sessions`
ADD COLUMN `meetingPlatform` varchar(50) DEFAULT 'Zoom',
ADD COLUMN `meetingUrl` text NULL,
ADD COLUMN `hostMeetingUrl` text NULL,
ADD COLUMN `seriesId` varchar(64) NULL,
ADD COLUMN `sessionNumberInSeries` int NULL,
ADD COLUMN `totalSessionsInSeries` int NULL;

-- Add phone and timezone fields to users
ALTER TABLE `users`
ADD COLUMN `phoneNumber` varchar(20) NULL,
ADD COLUMN `phoneNumberVerified` boolean DEFAULT false,
ADD COLUMN `timezone` varchar(100) NULL;

-- Add contact preferences to parent_profiles
ALTER TABLE `parent_profiles`
ADD COLUMN `preferredContactMethod` enum('email', 'sms', 'phone') DEFAULT 'email',
ADD COLUMN `emergencyContactName` varchar(255) NULL,
ADD COLUMN `emergencyContactPhone` varchar(20) NULL,
ADD COLUMN `bestTimeToContact` varchar(100) NULL;

-- Add timezone to tutor_profiles
ALTER TABLE `tutor_profiles`
ADD COLUMN `timezone` varchar(100) NULL,
ADD COLUMN `businessTimezone` varchar(100) NULL;

-- Add index for seriesId lookups
CREATE INDEX `sessions_seriesId_idx` ON `sessions` (`seriesId`);
