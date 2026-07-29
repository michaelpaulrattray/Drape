CREATE TABLE `model_identity_feature_projection_evidence` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`modelId` int NOT NULL,
	`featureId` varchar(36) NOT NULL,
	`featureVersionId` varchar(36) NOT NULL,
	`targetViewAngle` enum('frontClose','threeQuarter','frontFull','sideClose','sideFull','backFull') NOT NULL,
	`sourceAssetId` int,
	`acceptedAssetId` int NOT NULL,
	`acceptedCandidatePlateId` varchar(36) NOT NULL,
	`recipeVersion` varchar(64) NOT NULL,
	`createdByOperationId` varchar(36) NOT NULL,
	`createdByOperationStepKey` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_identity_feature_projection_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_feature_projection_version_angle` UNIQUE(`featureVersionId`,`targetViewAngle`),
	CONSTRAINT `uq_feature_projection_accepted_asset` UNIQUE(`acceptedAssetId`),
	CONSTRAINT `uq_feature_projection_operation_step` UNIQUE(`createdByOperationId`,`createdByOperationStepKey`)
);
--> statement-breakpoint
ALTER TABLE `model_identity_feature_versions` DROP INDEX `uq_identity_feature_versions_created_operation`;--> statement-breakpoint
ALTER TABLE `model_identity_features` DROP INDEX `uq_identity_features_created_operation`;--> statement-breakpoint
ALTER TABLE `casting_evidence_candidates` MODIFY COLUMN `targetViewAngle` enum('frontClose','threeQuarter','frontFull','sideClose','sideFull','backFull') NOT NULL;--> statement-breakpoint
ALTER TABLE `model_identity_feature_versions` MODIFY COLUMN `sourceViewAngle` enum('frontClose','threeQuarter','frontFull','sideClose','sideFull','backFull') NOT NULL;--> statement-breakpoint
ALTER TABLE `casting_evidence_candidates` ADD `purpose` enum('feature_authoring','feature_projection') DEFAULT 'feature_authoring' NOT NULL;--> statement-breakpoint
ALTER TABLE `model_identity_feature_versions` ADD `createdByOperationStepKey` varchar(64) DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE `model_identity_features` ADD `createdByOperationStepKey` varchar(64) DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE `model_identity_feature_versions` ADD CONSTRAINT `uq_identity_feature_versions_operation_step` UNIQUE(`createdByOperationId`,`createdByOperationStepKey`);--> statement-breakpoint
ALTER TABLE `model_identity_features` ADD CONSTRAINT `uq_identity_features_operation_step` UNIQUE(`createdByOperationId`,`createdByOperationStepKey`);--> statement-breakpoint
CREATE INDEX `idx_feature_projection_owner_model` ON `model_identity_feature_projection_evidence` (`userId`,`modelId`);--> statement-breakpoint
CREATE INDEX `idx_feature_projection_feature` ON `model_identity_feature_projection_evidence` (`featureId`);--> statement-breakpoint
CREATE INDEX `idx_feature_projection_version` ON `model_identity_feature_projection_evidence` (`featureVersionId`);--> statement-breakpoint
CREATE INDEX `idx_feature_projection_plate` ON `model_identity_feature_projection_evidence` (`acceptedCandidatePlateId`);