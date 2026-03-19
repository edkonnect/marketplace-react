-- profileImageUrl now stores S3 URLs (short strings), so TEXT is sufficient.
-- Revert the column back to TEXT (was changed to MEDIUMTEXT for base64 storage, which is no longer used).
ALTER TABLE `tutor_profiles` MODIFY COLUMN `profileImageUrl` TEXT;
