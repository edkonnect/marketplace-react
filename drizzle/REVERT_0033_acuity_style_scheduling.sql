-- REVERT Migration: Remove Acuity-style scheduling fields
-- Run this to revert all changes from 0033_acuity_style_scheduling.sql

-- Remove index
DROP INDEX `sessions_seriesId_idx` ON `sessions`;

-- Remove fields from tutor_profiles
ALTER TABLE `tutor_profiles`
DROP COLUMN `timezone`,
DROP COLUMN `businessTimezone`;

-- Remove fields from parent_profiles
ALTER TABLE `parent_profiles`
DROP COLUMN `preferredContactMethod`,
DROP COLUMN `emergencyContactName`,
DROP COLUMN `emergencyContactPhone`,
DROP COLUMN `bestTimeToContact`;

-- Remove fields from users
ALTER TABLE `users`
DROP COLUMN `phoneNumber`,
DROP COLUMN `phoneNumberVerified`,
DROP COLUMN `timezone`;

-- Remove fields from sessions
ALTER TABLE `sessions`
DROP COLUMN `meetingPlatform`,
DROP COLUMN `meetingUrl`,
DROP COLUMN `hostMeetingUrl`,
DROP COLUMN `seriesId`,
DROP COLUMN `sessionNumberInSeries`,
DROP COLUMN `totalSessionsInSeries`;

-- Remove fields from subscriptions
ALTER TABLE `subscriptions`
DROP COLUMN `smsOptIn`,
DROP COLUMN `smsConsentTimestamp`;
