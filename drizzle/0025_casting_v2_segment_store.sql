-- The unified segment store — segment permanence, slice 1.
--
-- One named, masked region of one face per row, in the stylist's vocabulary:
-- the pixels an edit ADDED and the user kept (`edit_patch`), and the things the
-- picture says she already has (`detected_born`). The founder's ruling was to
-- build the whole system at once rather than bolt the catalogue on later —
-- one schema, one provenance model, one retention regime.
--
-- PURELY ADDITIVE. One new table, no column of any existing table changes
-- meaning, and nothing reads or writes it until `CASTING_SEGMENTS_SCOPE` is
-- set — so an application version in flight cannot be confused by it, in
-- either direction.
--
-- RETENTION IS NOT DEFERRED TO A LATER SLICE. The candidate sweep purges
-- segment rows and hands their objects to the cleanup worker inside the same
-- transaction and on the same manifest as the candidate's own objects, from
-- this migration onward. There is deliberately no `expiresAt` here: two
-- schedules for one lifetime is two things to keep in step, and the one that
-- falls behind leaves paid pictures of a person at public URLs after the sheet
-- they belonged to is gone.
--
-- THE `storage_cleanup_batches` ALTER BELOW IS A NO-OP IN PRODUCTION. That
-- enum value was applied there on 2026-08-08 by ceremony
-- (`0024_casting_diagnostic_cleanup.sql`, run by hand against the production
-- database); this restates it for every database that tracks the journal, and
-- MODIFY COLUMN to an identical value set changes nothing where it is already
-- present.
CREATE TABLE `casting_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`candidateId` int NOT NULL,
	`variantId` int,
	`provenance` enum('edit_patch','detected_born') NOT NULL,
	`facet` varchar(48) NOT NULL,
	`region` varchar(48) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`maskKey` varchar(512) NOT NULL,
	`contentKey` varchar(512) NOT NULL,
	`bboxX` int NOT NULL,
	`bboxY` int NOT NULL,
	`bboxW` int NOT NULL,
	`bboxH` int NOT NULL,
	`frameWidth` int NOT NULL,
	`frameHeight` int NOT NULL,
	`verifiedAt` timestamp,
	`verdict` varchar(24),
	`detector` varchar(64),
	`retiredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_segments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_casting_segments_public` UNIQUE(`publicId`),
	CONSTRAINT `uq_casting_segments_identity` UNIQUE(`candidateId`,`facet`,`region`,`version`)
);
--> statement-breakpoint
ALTER TABLE `storage_cleanup_batches` MODIFY COLUMN `kind` enum('model_delete','account_delete','evidence_cleanup','candidate_cleanup','casting_candidate_cleanup','casting_diagnostic_cleanup') NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_casting_segments_candidate` ON `casting_segments` (`candidateId`);--> statement-breakpoint
CREATE INDEX `idx_casting_segments_variant` ON `casting_segments` (`variantId`);