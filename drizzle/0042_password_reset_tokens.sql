CREATE TABLE `password_reset_tokens` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `userId` int NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `consumedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `password_reset_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE INDEX `password_reset_tokens_tokenHash_idx` ON `password_reset_tokens` (`tokenHash`);
CREATE INDEX `password_reset_tokens_userId_idx` ON `password_reset_tokens` (`userId`);
