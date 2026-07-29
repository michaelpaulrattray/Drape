CREATE TABLE `casting_evidence_candidate_feature_targets` (
	`id` varchar(36) NOT NULL,
	`candidateId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`modelId` int NOT NULL,
	`identitySnapshotId` varchar(36) NOT NULL,
	`featureId` varchar(36) NOT NULL,
	`featureVersionId` varchar(36) NOT NULL,
	`coverageBasis` enum('registry_affected','observed_visible') NOT NULL,
	`coverageProbeRecipeVersion` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_evidence_candidate_feature_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_candidate_feature_targets_candidate_feature` UNIQUE(`candidateId`,`featureId`),
	CONSTRAINT `uq_candidate_feature_targets_candidate_version` UNIQUE(`candidateId`,`featureVersionId`)
);
--> statement-breakpoint
ALTER TABLE `model_identity_feature_projection_evidence` DROP INDEX `uq_feature_projection_accepted_asset`;--> statement-breakpoint
ALTER TABLE `casting_evidence_candidates` MODIFY COLUMN `intentId` varchar(36);--> statement-breakpoint
ALTER TABLE `casting_evidence_candidate_attempts` ADD `priorInkOutcome` enum('pass','fail','unknown');--> statement-breakpoint
ALTER TABLE `casting_evidence_candidates` ADD CONSTRAINT `uq_evidence_candidates_model_active` UNIQUE(`modelId`,`activeSlot`);--> statement-breakpoint
CREATE INDEX `idx_candidate_feature_targets_owner_model` ON `casting_evidence_candidate_feature_targets` (`userId`,`modelId`);--> statement-breakpoint
CREATE INDEX `idx_candidate_feature_targets_version` ON `casting_evidence_candidate_feature_targets` (`featureVersionId`);--> statement-breakpoint
CREATE INDEX `idx_feature_projection_accepted_asset` ON `model_identity_feature_projection_evidence` (`acceptedAssetId`);