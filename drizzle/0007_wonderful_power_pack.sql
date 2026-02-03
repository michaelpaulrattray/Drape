ALTER TABLE `models` MODIFY COLUMN `agencyId` varchar(32);--> statement-breakpoint
ALTER TABLE `models` MODIFY COLUMN `status` enum('draft','active','locked','archived') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `models` ADD `mintedAt` timestamp;