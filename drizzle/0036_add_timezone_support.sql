-- Migration: Add Timezone Support
-- This migration adds timezone fields to store user timezones for proper time display

-- Add timezone to parent profiles (tutors already have it)
ALTER TABLE `parentProfiles` ADD COLUMN `timezone` VARCHAR(100) DEFAULT 'America/New_York';

-- Update existing parent profiles with detected timezone (will be updated on next login)
UPDATE `parentProfiles` SET `timezone` = 'America/New_York' WHERE `timezone` IS NULL;

-- Optionally add timezone to users table for admins
ALTER TABLE `users` ADD COLUMN `timezone` VARCHAR(100) DEFAULT NULL;
