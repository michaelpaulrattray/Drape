CREATE TABLE `storage_cleanup_batches` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`operationId` varchar(36) NOT NULL,
	`kind` enum('model_delete','account_delete') NOT NULL,
	`status` enum('pending','processing','succeeded','partial','failed') NOT NULL DEFAULT 'pending',
	`expectedCount` int NOT NULL DEFAULT 0,
	`deletedCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`leaseToken` varchar(64),
	`leaseExpiresAt` timestamp,
	`heartbeatAt` timestamp,
	`attemptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storage_cleanup_batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_storage_cleanup_batches_operation` UNIQUE(`operationId`)
);
--> statement-breakpoint
CREATE TABLE `storage_cleanup_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`batchId` varchar(36) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`status` enum('pending','processing','succeeded','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`nextAttemptAt` timestamp,
	`lastErrorCode` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storage_cleanup_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_storage_cleanup_items_batch_key` UNIQUE(`batchId`,`storageKey`)
);
--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `subjectDeletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `models` ADD `deletedAt` timestamp;--> statement-breakpoint
CREATE INDEX `idx_storage_cleanup_batches_status_lease` ON `storage_cleanup_batches` (`status`,`leaseExpiresAt`);--> statement-breakpoint
CREATE INDEX `idx_storage_cleanup_items_status_next` ON `storage_cleanup_items` (`status`,`nextAttemptAt`);--> statement-breakpoint
CREATE INDEX `idx_board_items_source_model` ON `board_items` (`sourceModelId`);