-- Add student and course info directly to sessions table for trial sessions
ALTER TABLE sessions ADD COLUMN studentFirstName VARCHAR(255) NULL;
ALTER TABLE sessions ADD COLUMN studentLastName VARCHAR(255) NULL;
ALTER TABLE sessions ADD COLUMN studentGrade VARCHAR(50) NULL;
ALTER TABLE sessions ADD COLUMN courseId INT NULL;

-- Add foreign key constraint for courseId
ALTER TABLE sessions ADD CONSTRAINT sessions_courseId_fk FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE;

-- Add index for course lookups
CREATE INDEX sessions_courseId_idx ON sessions(courseId);
