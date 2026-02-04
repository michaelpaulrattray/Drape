ALTER TABLE `point_transactions` MODIFY COLUMN `type` enum('generation','purchase','bonus','refund','signup','topup','subscription') NOT NULL;--> statement-breakpoint
ALTER TABLE `points` MODIFY COLUMN `planTier` enum('free','starter','pro','studio','enterprise') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `engineUsed` varchar(32);--> statement-breakpoint
ALTER TABLE `points` ADD `creditsPurchased` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `points` ADD `creditsUsed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `points` ADD `rolloverCredits` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `points` ADD `lastRefreshAt` timestamp;