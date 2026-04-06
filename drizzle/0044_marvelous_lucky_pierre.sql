ALTER TABLE `conversations` MODIFY COLUMN `conversationType` enum('parent_tutor','parent_tutor_inquiry','parent_coordinator') NOT NULL DEFAULT 'parent_tutor';--> statement-breakpoint
SET @price_inr_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'courses'
    AND COLUMN_NAME = 'priceInr'
);--> statement-breakpoint
SET @price_inr_sql = IF(
  @price_inr_exists = 0,
  'ALTER TABLE `courses` ADD `priceInr` decimal(10,2)',
  'SELECT 1'
);--> statement-breakpoint
PREPARE price_inr_stmt FROM @price_inr_sql;--> statement-breakpoint
EXECUTE price_inr_stmt;--> statement-breakpoint
DEALLOCATE PREPARE price_inr_stmt;
