CREATE TABLE trial_welcome_messages (
    id INT NOT NULL AUTO_INCREMENT,
    tutorId INT NOT NULL,
    parentId INT NOT NULL,
    studentKey VARCHAR(191) NOT NULL,
    studentName VARCHAR(255) NOT NULL,
    sessionId INT DEFAULT NULL,
    conversationId INT DEFAULT NULL,
    messageId INT DEFAULT NULL,
    emailStatus VARCHAR(20) NOT NULL DEFAULT 'pending',
    sentAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY trial_welcome_unique (tutorId, parentId, studentKey),
    KEY trial_welcome_parentId_idx (parentId),
    CONSTRAINT trial_welcome_tutorId_fk FOREIGN KEY (tutorId) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT trial_welcome_parentId_fk FOREIGN KEY (parentId) REFERENCES users (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;