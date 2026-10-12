-- THE CREATION RECORD BEHIND A KLIEG ID — rung N2d, card #2311 (N2d-1).
-- One new table, nothing else.
--
-- ============================================================================
-- WHAT A CUSTOMER GETS
-- ============================================================================
--
-- Nothing yet, on purpose. This is the store the Certificate of Creation
-- (N2d-2) and the public check page (N2d-3) will read; until they ship no
-- surface reads it, and the road that writes it is dark behind
-- CASTING_CREATION_RECORD_SCOPE. The design is
-- docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md.
--
-- ============================================================================
-- THE SHAPE
-- ============================================================================
--
-- One row per signed cast (unique modelId). `userId` is denormalised so every
-- statement that reads or writes a record carries the owner in its own WHERE
-- (enforcement invariants 1 and 2). No foreign-key constraints, as everywhere
-- else in this schema.
--
-- recordJson never carries masterPrompt, technicalSchema, preferences, the
-- brief, a refine's words or any other creative content — refused in code
-- before anything is signed (server/castingV2/creationRecord.ts).
--
-- ============================================================================
-- ZERO BACKFILL
-- ============================================================================
--
-- No existing row is read or written. Casts signed before this ships get their
-- record on first request, and that record states both dates honestly.
--
-- PURELY ADDITIVE. One CREATE TABLE and one CREATE INDEX on the table this
-- file creates, so scripts/lib/ceremonyAutoApply.mts recognises every
-- statement and no ceremony reaches the founder.
CREATE TABLE `cast_creation_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelId` int NOT NULL,
	`userId` int NOT NULL,
	`recordVersion` varchar(16) NOT NULL,
	`recordJson` text NOT NULL,
	`recordSha256` varchar(64) NOT NULL,
	`signature` varchar(512) NOT NULL,
	`signingKeyId` varchar(64) NOT NULL,
	`timestampToken` text,
	`timestampAuthority` varchar(32),
	`stampedAt` timestamp,
	`stampAttempts` int NOT NULL DEFAULT 0,
	`lastStampAttemptAt` timestamp,
	`publicAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cast_creation_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cast_creation_records_model` UNIQUE(`modelId`)
);
--> statement-breakpoint
CREATE INDEX `ix_cast_creation_records_user` ON `cast_creation_records` (`userId`);
