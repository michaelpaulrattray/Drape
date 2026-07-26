CREATE TABLE `casting_evidence_ingestions` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`modelId` int NOT NULL,
	`operationId` varchar(36) NOT NULL,
	`purpose` enum('reference_plate','evidence_crop') NOT NULL,
	`status` enum('planned','stored','attached','cleanup_pending','cleaned') NOT NULL DEFAULT 'planned',
	`storageKey` varchar(512) NOT NULL,
	`mime` varchar(32) NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`byteSize` int NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`attachedEntityKind` enum('reference_plate','evidence_crop'),
	`attachedEntityId` varchar(36),
	`cleanupBatchId` varchar(36),
	`attachedAt` timestamp,
	`cleanupQueuedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `casting_evidence_ingestions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_casting_evidence_ingestions_operation` UNIQUE(`operationId`),
	CONSTRAINT `uq_casting_evidence_ingestions_storage_key` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE TABLE `model_evidence_crops` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`modelId` int NOT NULL,
	`plateId` varchar(36) NOT NULL,
	`ontologyVersion` varchar(64) NOT NULL,
	`zone` varchar(64) NOT NULL,
	`surface` varchar(64) NOT NULL,
	`side` varchar(32) NOT NULL,
	`sourceX` decimal(10,9) NOT NULL,
	`sourceY` decimal(10,9) NOT NULL,
	`sourceWidth` decimal(10,9) NOT NULL,
	`sourceHeight` decimal(10,9) NOT NULL,
	`sourceImageWidth` int NOT NULL,
	`sourceImageHeight` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mime` varchar(32) NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`byteSize` int NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`cropRecipeVersion` varchar(64) NOT NULL,
	`createdByOperationId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_evidence_crops_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_model_evidence_crops_storage_key` UNIQUE(`storageKey`),
	CONSTRAINT `uq_model_evidence_crops_operation` UNIQUE(`createdByOperationId`)
);
--> statement-breakpoint
CREATE TABLE `model_reference_plates` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`modelId` int NOT NULL,
	`kind` enum('uploaded_reference') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`mime` varchar(32) NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`byteSize` int NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`createdByOperationId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_reference_plates_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_model_reference_plates_storage_key` UNIQUE(`storageKey`),
	CONSTRAINT `uq_model_reference_plates_operation` UNIQUE(`createdByOperationId`)
);
--> statement-breakpoint
ALTER TABLE `storage_cleanup_batches` MODIFY COLUMN `kind` enum('model_delete','account_delete','evidence_cleanup') NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_casting_evidence_ingestions_status_updated` ON `casting_evidence_ingestions` (`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `idx_casting_evidence_ingestions_owner_model_status` ON `casting_evidence_ingestions` (`userId`,`modelId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_model_evidence_crops_plate` ON `model_evidence_crops` (`plateId`);--> statement-breakpoint
CREATE INDEX `idx_model_evidence_crops_owner_model_created` ON `model_evidence_crops` (`userId`,`modelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_model_reference_plates_owner_model_created` ON `model_reference_plates` (`userId`,`modelId`,`createdAt`);