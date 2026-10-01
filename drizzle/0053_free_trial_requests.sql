CREATE TABLE IF NOT EXISTS `free_trial_requests` (
    `id` int AUTO_INCREMENT NOT NULL,
    `parentName` varchar(255) NOT NULL,
    `email` varchar(320) NOT NULL,
    `phone` varchar(50),
    `students` text NOT NULL,
    `timezone` varchar(100) NOT NULL,
    `trialDate` varchar(10) NOT NULL,
    `status` varchar(20) NOT NULL DEFAULT 'new',
    `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
);