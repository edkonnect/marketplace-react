-- Migration: Remove Acuity Scheduling Integration
-- This migration removes all Acuity-related fields and tables as the application
-- now uses a custom React-based calendar booking system (BookableCalendar)

-- Drop Acuity mapping templates table entirely
DROP TABLE IF EXISTS `acuity_mapping_templates`;

-- Remove Acuity fields from tutorProfiles
ALTER TABLE `tutorProfiles` DROP COLUMN IF EXISTS `acuityLink`;

-- Remove Acuity fields from courses
ALTER TABLE `courses` DROP COLUMN IF EXISTS `acuityAppointmentTypeId`;
ALTER TABLE `courses` DROP COLUMN IF EXISTS `acuityCalendarId`;

-- Remove Acuity fields from sessions
ALTER TABLE `sessions` DROP COLUMN IF EXISTS `acuityAppointmentId`;

-- Remove Acuity fields from tutorTimeBlocks
ALTER TABLE `tutorTimeBlocks` DROP COLUMN IF EXISTS `acuityBlockId`;
