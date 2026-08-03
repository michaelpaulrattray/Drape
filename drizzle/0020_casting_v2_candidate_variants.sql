CREATE TABLE `casting_candidate_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`candidateId` int NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('queued','dispatched','ready','failed','expired') NOT NULL DEFAULT 'queued',
	`instructions` json NOT NULL,
	`deltas` json,
	`internalPrompt` json,
	`imageKey` varchar(512),
	`thumbKey` varchar(512),
	`provider` varchar(32),
	`providerModel` varchar(96),
	`providerRef` varchar(96),
	`pointsCost` int NOT NULL DEFAULT 0,
	`failureClass` varchar(24),
	`operationId` varchar(36) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `casting_candidate_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_casting_variants_public` UNIQUE(`publicId`),
	CONSTRAINT `uq_casting_variants_operation` UNIQUE(`operationId`)
);
--> statement-breakpoint
ALTER TABLE `casting_candidates` ADD `selectedVariantId` int;--> statement-breakpoint
ALTER TABLE `casting_rolls` ADD `parentVariantId` int;--> statement-breakpoint
CREATE INDEX `idx_casting_variants_candidate` ON `casting_candidate_variants` (`candidateId`);--> statement-breakpoint
CREATE INDEX `idx_casting_variants_expires` ON `casting_candidate_variants` (`expiresAt`);