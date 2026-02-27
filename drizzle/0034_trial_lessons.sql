-- Make subscriptionId nullable to support trial sessions without enrollment
ALTER TABLE sessions MODIFY COLUMN subscriptionId INT NULL;

-- Add isTrial field to identify trial sessions
ALTER TABLE sessions ADD COLUMN isTrial BOOLEAN NOT NULL DEFAULT FALSE;

-- Add composite index for efficient trial counting queries
CREATE INDEX sessions_trial_parent_idx ON sessions(parentId, isTrial);
