CREATE TABLE `model_identity_snapshots` (
	`id` varchar(36) NOT NULL,
	`modelId` int NOT NULL,
	`sequence` int NOT NULL,
	`parentSnapshotId` varchar(36),
	`restoredFromSnapshotId` varchar(36),
	`reason` enum('bootstrap','create','identity_edit','anchor_reroll','document_compact','evidence_accept','evidence_remove','restore','fork_bootstrap') NOT NULL,
	`masterPrompt` text NOT NULL,
	`technicalSchema` json NOT NULL,
	`preferences` json NOT NULL,
	`identityText` text NOT NULL,
	`identityTextHash` varchar(64) NOT NULL,
	`anchorAssetId` int NOT NULL,
	`recipeVersion` varchar(64) NOT NULL,
	`createdByOperationId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_identity_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_model_identity_snapshots_model_sequence` UNIQUE(`modelId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `model_package_snapshot_slots` (
	`id` varchar(36) NOT NULL,
	`packageSnapshotId` varchar(36) NOT NULL,
	`viewAngle` enum('frontClose','threeQuarter','frontFull','sideClose','sideFull','backFull') NOT NULL,
	`selectedAssetId` int NOT NULL,
	`compatibility` enum('current','stale','unverified') NOT NULL,
	`selectionReason` enum('generated','carried','refreshed','restored','late_view','bootstrap') NOT NULL,
	`sourceSelectionId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_package_snapshot_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_model_package_slots_snapshot_angle` UNIQUE(`packageSnapshotId`,`viewAngle`),
	CONSTRAINT `uq_model_package_slots_snapshot_asset` UNIQUE(`packageSnapshotId`,`selectedAssetId`)
);
--> statement-breakpoint
CREATE TABLE `model_package_snapshots` (
	`id` varchar(36) NOT NULL,
	`modelId` int NOT NULL,
	`identitySnapshotId` varchar(36) NOT NULL,
	`sequence` int NOT NULL,
	`parentPackageSnapshotId` varchar(36),
	`reason` enum('bootstrap','create','identity_change','image_refine','slot_generate','slot_refresh','slot_restore','add_views','whole_restore','mint','late_view') NOT NULL,
	`createdByOperationId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_package_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_model_package_snapshots_model_sequence` UNIQUE(`modelId`,`sequence`)
);
--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `expectedStateVersion` int;--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `expectedIdentitySnapshotId` varchar(36);--> statement-breakpoint
ALTER TABLE `generation_operations` ADD `expectedPackageSnapshotId` varchar(36);--> statement-breakpoint
ALTER TABLE `models` ADD `currentPackageSnapshotId` varchar(36);--> statement-breakpoint
ALTER TABLE `models` ADD `stateVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `models` ADD `sealedIdentitySnapshotId` varchar(36);--> statement-breakpoint
ALTER TABLE `models` ADD `sealedPackageSnapshotId` varchar(36);--> statement-breakpoint
CREATE INDEX `idx_model_identity_snapshots_model_created` ON `model_identity_snapshots` (`modelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_model_identity_snapshots_anchor` ON `model_identity_snapshots` (`anchorAssetId`);--> statement-breakpoint
CREATE INDEX `idx_model_package_slots_asset` ON `model_package_snapshot_slots` (`selectedAssetId`);--> statement-breakpoint
CREATE INDEX `idx_model_package_snapshots_identity` ON `model_package_snapshots` (`identitySnapshotId`);--> statement-breakpoint
CREATE INDEX `idx_model_package_snapshots_model_created` ON `model_package_snapshots` (`modelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_models_current_package_snapshot` ON `models` (`currentPackageSnapshotId`);