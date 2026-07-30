CREATE TABLE `casting_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`rollId` int NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`position` int NOT NULL,
	`status` enum('queued','dispatched','ready','failed','discarded','signed','cancelled','expired') NOT NULL DEFAULT 'queued',
	`pointsCost` int NOT NULL DEFAULT 0,
	`imageKey` varchar(512),
	`thumbKey` varchar(512),
	`provider` varchar(32),
	`providerModel` varchar(96),
	`providerRef` varchar(96),
	`personaLine` varchar(160),
	`internalPrompt` json,
	`keptAt` timestamp,
	`discardedAt` timestamp,
	`attemptCount` int NOT NULL DEFAULT 0,
	`failureClass` varchar(24),
	`signedCastId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `casting_candidates_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_casting_candidates_public` UNIQUE(`publicId`),
	CONSTRAINT `uq_casting_candidates_roll_position` UNIQUE(`rollId`,`position`),
	CONSTRAINT `uq_casting_candidates_signed_cast` UNIQUE(`signedCastId`)
);
--> statement-breakpoint
CREATE TABLE `casting_rolls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`rollIndex` int NOT NULL,
	`briefText` text NOT NULL,
	`compiledBrief` json,
	`cohortKey` varchar(48),
	`styleKey` varchar(48),
	`styleProfile` json,
	`lockContract` json,
	`parentRollId` int,
	`parentCandidateId` int,
	`status` enum('pending','generating','complete','partial','failed','cancelled') NOT NULL DEFAULT 'pending',
	`priceCredits` int NOT NULL DEFAULT 0,
	`operationId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_rolls_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_casting_rolls_public` UNIQUE(`publicId`),
	CONSTRAINT `uq_casting_rolls_operation` UNIQUE(`operationId`),
	CONSTRAINT `uq_casting_rolls_session_index` UNIQUE(`sessionId`,`rollIndex`)
);
--> statement-breakpoint
CREATE TABLE `casting_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`originType` enum('roster','canvas','wardrobe') NOT NULL DEFAULT 'roster',
	`originBoardId` int,
	`originItemId` int,
	`activeRollId` int,
	`status` enum('open','abandoned','expired') NOT NULL DEFAULT 'open',
	`signedCastCount` int NOT NULL DEFAULT 0,
	`parentCastId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expiresAt` timestamp,
	CONSTRAINT `casting_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_casting_sessions_public` UNIQUE(`publicId`)
);
--> statement-breakpoint
ALTER TABLE `storage_cleanup_batches` MODIFY COLUMN `kind` enum('model_delete','account_delete','evidence_cleanup','candidate_cleanup','casting_candidate_cleanup') NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_casting_candidates_roll` ON `casting_candidates` (`rollId`);--> statement-breakpoint
CREATE INDEX `idx_casting_candidates_tray` ON `casting_candidates` (`sessionId`,`keptAt`);--> statement-breakpoint
CREATE INDEX `idx_casting_candidates_expires` ON `casting_candidates` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `idx_casting_sessions_user_status` ON `casting_sessions` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_casting_sessions_expires` ON `casting_sessions` (`expiresAt`);