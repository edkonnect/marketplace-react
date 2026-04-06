SET @dedupe_key_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversations'
    AND COLUMN_NAME = 'dedupeKey'
);--> statement-breakpoint
SET @add_dedupe_key_sql = IF(
  @dedupe_key_exists = 0,
  'ALTER TABLE `conversations` ADD `dedupeKey` varchar(191)',
  'SELECT 1'
);--> statement-breakpoint
PREPARE add_dedupe_key_stmt FROM @add_dedupe_key_sql;--> statement-breakpoint
EXECUTE add_dedupe_key_stmt;--> statement-breakpoint
DEALLOCATE PREPARE add_dedupe_key_stmt;--> statement-breakpoint
UPDATE `conversations`
SET `dedupeKey` = CONCAT(
  `conversationType`,
  ':',
  `parentId`,
  ':',
  COALESCE(`tutorId`, 0),
  ':',
  COALESCE(`coordinatorId`, 0),
  ':',
  COALESCE(`studentId`, 0)
)
WHERE `dedupeKey` IS NULL OR `dedupeKey` = '';--> statement-breakpoint
DROP TEMPORARY TABLE IF EXISTS `conversation_duplicate_groups`;--> statement-breakpoint
CREATE TEMPORARY TABLE `conversation_duplicate_groups` AS
SELECT
  MIN(`id`) AS `keep_id`,
  `dedupeKey`,
  MAX(`lastMessageAt`) AS `merged_last_message_at`
FROM `conversations`
GROUP BY `dedupeKey`
HAVING COUNT(*) > 1;--> statement-breakpoint
DROP TEMPORARY TABLE IF EXISTS `conversation_dedup_map`;--> statement-breakpoint
CREATE TEMPORARY TABLE `conversation_dedup_map` AS
SELECT
  `c`.`id` AS `duplicate_id`,
  `g`.`keep_id`
FROM `conversations` `c`
INNER JOIN `conversation_duplicate_groups` `g`
  ON `c`.`dedupeKey` = `g`.`dedupeKey`
WHERE `c`.`id` <> `g`.`keep_id`;--> statement-breakpoint
UPDATE `messages` `m`
INNER JOIN `conversation_dedup_map` `d`
  ON `m`.`conversationId` = `d`.`duplicate_id`
SET `m`.`conversationId` = `d`.`keep_id`;--> statement-breakpoint
UPDATE `conversations` `c`
INNER JOIN `conversation_duplicate_groups` `g`
  ON `c`.`id` = `g`.`keep_id`
SET `c`.`lastMessageAt` = `g`.`merged_last_message_at`;--> statement-breakpoint
DELETE `c`
FROM `conversations` `c`
INNER JOIN `conversation_dedup_map` `d`
  ON `c`.`id` = `d`.`duplicate_id`;--> statement-breakpoint
DROP TEMPORARY TABLE IF EXISTS `conversation_dedup_map`;--> statement-breakpoint
DROP TEMPORARY TABLE IF EXISTS `conversation_duplicate_groups`;--> statement-breakpoint
ALTER TABLE `conversations` MODIFY COLUMN `dedupeKey` varchar(191) NOT NULL;--> statement-breakpoint
SET @dedupe_key_unique_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'conversations'
    AND INDEX_NAME = 'conversations_dedupeKey_unique'
);--> statement-breakpoint
SET @add_dedupe_key_unique_sql = IF(
  @dedupe_key_unique_exists = 0,
  'ALTER TABLE `conversations` ADD CONSTRAINT `conversations_dedupeKey_unique` UNIQUE(`dedupeKey`)',
  'SELECT 1'
);--> statement-breakpoint
PREPARE add_dedupe_key_unique_stmt FROM @add_dedupe_key_unique_sql;--> statement-breakpoint
EXECUTE add_dedupe_key_unique_stmt;--> statement-breakpoint
DEALLOCATE PREPARE add_dedupe_key_unique_stmt;
