ALTER TABLE `generation_operations` ADD `phase` varchar(48);--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `progress` json;--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `heartbeatAt` timestamp;--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `leaseExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `landingStatus` varchar(24) DEFAULT 'not_applicable' NOT NULL;--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `landedItemId` int;--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `landingAcknowledgedAt` timestamp;--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `recoveryAttemptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `generations` ADD `operationId` varchar(36);--> statement-breakpoint
ALTER TABLE `generations` ADD `stepKey` varchar(64);--> statement-breakpoint
ALTER TABLE `generations` ADD `viewAngle` varchar(32);--> statement-breakpoint
CREATE INDEX `idx_generation_ops_status_lease` ON `generation_operations` (`status`,`leaseExpiresAt`);--> statement-breakpoint
CREATE INDEX `idx_generations_operation_created` ON `generations` (`operationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_generations_operation_step` ON `generations` (`operationId`,`stepKey`);