CREATE TABLE `casting_evidence_candidate_attempts` (
	`id` varchar(36) NOT NULL,
	`candidateId` varchar(36) NOT NULL,
	`attemptNumber` int NOT NULL,
	`generationId` int,
	`status` enum('planned','generating','stored','probe_passed','probe_failed','probe_unknown','promoted','cleanup_pending','cleaned') NOT NULL DEFAULT 'planned',
	`privatePlateId` varchar(36) NOT NULL,
	`privateStorageKey` varchar(512),
	`mime` varchar(32),
	`width` int,
	`height` int,
	`byteSize` int,
	`contentHash` varchar(64),
	`promotedPublicStorageKey` varchar(512),
	`cleanupBatchId` varchar(36),
	`actualImageEngine` varchar(64) NOT NULL,
	`composerRecipeVersion` varchar(64) NOT NULL,
	`probeModel` varchar(64) NOT NULL,
	`probeRecipeVersion` varchar(64) NOT NULL,
	`predictedVisibility` enum('pass','fail','unknown'),
	`identityOutcome` enum('pass','fail','unknown'),
	`placementOutcome` enum('pass','fail','unknown'),
	`featureMatchOutcome` enum('pass','fail','unknown'),
	`poseFramingOutcome` enum('pass','fail','unknown'),
	`unexpectedInkOutcome` enum('pass','fail','unknown'),
	`overallOutcome` enum('pass','fail','unknown'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`storedAt` timestamp,
	`probedAt` timestamp,
	`promotedAt` timestamp,
	CONSTRAINT `casting_evidence_candidate_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_evidence_candidate_attempt_number` UNIQUE(`candidateId`,`attemptNumber`),
	CONSTRAINT `uq_evidence_candidate_attempt_generation` UNIQUE(`generationId`),
	CONSTRAINT `uq_evidence_candidate_attempt_plate` UNIQUE(`privatePlateId`),
	CONSTRAINT `uq_evidence_candidate_attempt_private_key` UNIQUE(`privateStorageKey`),
	CONSTRAINT `uq_evidence_candidate_attempt_public_key` UNIQUE(`promotedPublicStorageKey`),
	CONSTRAINT `chk_evidence_candidate_attempt_number` CHECK(`casting_evidence_candidate_attempts`.`attemptNumber` in (1, 2))
);
--> statement-breakpoint
CREATE TABLE `casting_evidence_candidates` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`modelId` int NOT NULL,
	`intentId` varchar(36) NOT NULL,
	`originatingOperationId` varchar(36) NOT NULL,
	`capabilityKey` varchar(96) NOT NULL,
	`activeSlot` enum('active'),
	`expectedStateVersion` int NOT NULL,
	`identitySnapshotId` varchar(36) NOT NULL,
	`packageSnapshotId` varchar(36) NOT NULL,
	`targetViewAngle` enum('frontFull') NOT NULL,
	`sourceAssetId` int NOT NULL,
	`status` enum('processing','ready','accepted','rejected','cancelled','expired','invalid') NOT NULL DEFAULT 'processing',
	`readyAttemptId` varchar(36),
	`acceptedAssetId` int,
	`acceptedIdentitySnapshotId` varchar(36),
	`acceptedPackageSnapshotId` varchar(36),
	`cleanupBatchId` varchar(36),
	`composerRecipeVersion` varchar(64) NOT NULL,
	`probeRecipeVersion` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`resolvedAt` timestamp,
	`resolvedByOperationId` varchar(36),
	CONSTRAINT `casting_evidence_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_evidence_candidates_origin_operation` UNIQUE(`originatingOperationId`),
	CONSTRAINT `uq_evidence_candidates_intent_active` UNIQUE(`intentId`,`activeSlot`)
);
--> statement-breakpoint
CREATE TABLE `model_identity_feature_intents` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`modelId` int NOT NULL,
	`capabilityKey` varchar(96) NOT NULL,
	`activeCapabilityKey` varchar(96),
	`status` enum('pending','resolved','cancelled') NOT NULL DEFAULT 'pending',
	`category` enum('ink') NOT NULL,
	`operation` enum('add') NOT NULL,
	`ontologyVersion` varchar(64) NOT NULL,
	`zone` varchar(64) NOT NULL,
	`surface` varchar(64) NOT NULL,
	`side` varchar(32) NOT NULL,
	`normalizedDescriptor` varchar(512),
	`sourceAssetId` int NOT NULL,
	`expectedStateVersion` int NOT NULL,
	`identitySnapshotId` varchar(36) NOT NULL,
	`packageSnapshotId` varchar(36) NOT NULL,
	`createdByOperationId` varchar(36) NOT NULL,
	`resolvedByOperationId` varchar(36),
	`resolvedCandidateId` varchar(36),
	`resolvedFeatureId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `model_identity_feature_intents_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_identity_feature_intents_model_active` UNIQUE(`modelId`,`activeCapabilityKey`),
	CONSTRAINT `uq_identity_feature_intents_created_operation` UNIQUE(`createdByOperationId`)
);
--> statement-breakpoint
CREATE TABLE `model_identity_feature_versions` (
	`id` varchar(36) NOT NULL,
	`modelId` int NOT NULL,
	`featureId` varchar(36) NOT NULL,
	`operation` enum('present') NOT NULL,
	`ontologyVersion` varchar(64) NOT NULL,
	`zone` varchar(64) NOT NULL,
	`surface` varchar(64) NOT NULL,
	`side` varchar(32) NOT NULL,
	`normalizedDescriptor` varchar(512) NOT NULL,
	`sourceAssetId` int NOT NULL,
	`sourceViewAngle` enum('frontFull') NOT NULL,
	`sourceReferencePlateId` varchar(36),
	`acceptedCandidatePlateId` varchar(36) NOT NULL,
	`evidenceCropId` varchar(36),
	`recipeVersion` varchar(64) NOT NULL,
	`createdByOperationId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_identity_feature_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_identity_feature_versions_created_operation` UNIQUE(`createdByOperationId`)
);
--> statement-breakpoint
CREATE TABLE `model_identity_features` (
	`id` varchar(36) NOT NULL,
	`modelId` int NOT NULL,
	`category` enum('ink') NOT NULL,
	`createdByOperationId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_identity_features_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_identity_features_created_operation` UNIQUE(`createdByOperationId`)
);
--> statement-breakpoint
CREATE TABLE `model_snapshot_feature_selections` (
	`id` varchar(36) NOT NULL,
	`modelId` int NOT NULL,
	`identitySnapshotId` varchar(36) NOT NULL,
	`featureId` varchar(36) NOT NULL,
	`featureVersionId` varchar(36) NOT NULL,
	`selectionReason` enum('accepted','carried','restored') NOT NULL,
	`sourceSelectionId` varchar(36),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_snapshot_feature_selections_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_snapshot_feature_selections_snapshot_feature` UNIQUE(`identitySnapshotId`,`featureId`),
	CONSTRAINT `uq_snapshot_feature_selections_snapshot_version` UNIQUE(`identitySnapshotId`,`featureVersionId`)
);
--> statement-breakpoint
ALTER TABLE `casting_evidence_ingestions` MODIFY COLUMN `purpose` enum('reference_plate','evidence_crop','fork_copy') NOT NULL;--> statement-breakpoint
ALTER TABLE `generations` MODIFY COLUMN `type` enum('masterPrompt','castingImage','fullBody','multiView','iteration','upscale','wardrobeVTO','wardrobeComposite','wardrobeRefinement','wardrobeDigitize','evidenceCandidate') NOT NULL;--> statement-breakpoint
ALTER TABLE `model_package_snapshot_slots` MODIFY COLUMN `selectionReason` enum('generated','carried','refreshed','restored','late_view','bootstrap','evidence_accept') NOT NULL;--> statement-breakpoint
ALTER TABLE `model_package_snapshots` MODIFY COLUMN `reason` enum('bootstrap','create','identity_change','image_refine','slot_generate','slot_refresh','slot_restore','add_views','whole_restore','mint','late_view','evidence_accept') NOT NULL;--> statement-breakpoint
ALTER TABLE `model_reference_plates` MODIFY COLUMN `kind` enum('uploaded_reference','accepted_candidate') NOT NULL;--> statement-breakpoint
ALTER TABLE `models` MODIFY COLUMN `status` enum('draft','active','locked','archived','provisioning') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `storage_cleanup_batches` MODIFY COLUMN `kind` enum('model_delete','account_delete','evidence_cleanup','candidate_cleanup') NOT NULL;--> statement-breakpoint
ALTER TABLE `casting_evidence_ingestions` ADD `stepKey` varchar(64) DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE `model_evidence_crops` ADD `createdByOperationStepKey` varchar(64) DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE `model_reference_plates` ADD `featureIntentId` varchar(36);--> statement-breakpoint
ALTER TABLE `model_reference_plates` ADD `createdByOperationStepKey` varchar(64) DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE `casting_evidence_ingestions` ADD CONSTRAINT `uq_casting_evidence_ingestions_operation_step` UNIQUE(`operationId`,`stepKey`);--> statement-breakpoint
ALTER TABLE `model_evidence_crops` ADD CONSTRAINT `uq_model_evidence_crops_operation_step` UNIQUE(`createdByOperationId`,`createdByOperationStepKey`);--> statement-breakpoint
ALTER TABLE `model_reference_plates` ADD CONSTRAINT `uq_model_reference_plates_feature_intent` UNIQUE(`featureIntentId`);--> statement-breakpoint
ALTER TABLE `model_reference_plates` ADD CONSTRAINT `uq_model_reference_plates_operation_step` UNIQUE(`createdByOperationId`,`createdByOperationStepKey`);--> statement-breakpoint
ALTER TABLE `casting_evidence_ingestions` DROP INDEX `uq_casting_evidence_ingestions_operation`;--> statement-breakpoint
ALTER TABLE `model_evidence_crops` DROP INDEX `uq_model_evidence_crops_operation`;--> statement-breakpoint
ALTER TABLE `model_reference_plates` DROP INDEX `uq_model_reference_plates_operation`;--> statement-breakpoint
CREATE INDEX `idx_evidence_candidate_attempt_status` ON `casting_evidence_candidate_attempts` (`candidateId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_evidence_candidates_owner_model_status` ON `casting_evidence_candidates` (`userId`,`modelId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_evidence_candidates_intent_created` ON `casting_evidence_candidates` (`intentId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_evidence_candidates_status_expiry` ON `casting_evidence_candidates` (`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_identity_feature_intents_owner_model_status` ON `model_identity_feature_intents` (`userId`,`modelId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_identity_feature_intents_model_created` ON `model_identity_feature_intents` (`modelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_identity_feature_versions_model_created` ON `model_identity_feature_versions` (`modelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_identity_feature_versions_feature` ON `model_identity_feature_versions` (`featureId`);--> statement-breakpoint
CREATE INDEX `idx_identity_features_model_created` ON `model_identity_features` (`modelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_feature_selections_model` ON `model_snapshot_feature_selections` (`modelId`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_feature_selections_snapshot` ON `model_snapshot_feature_selections` (`identitySnapshotId`);--> statement-breakpoint
CREATE INDEX `idx_snapshot_feature_selections_version` ON `model_snapshot_feature_selections` (`featureVersionId`);
