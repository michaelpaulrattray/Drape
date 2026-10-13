-- A CAST'S KEPT VOICE — rung N4b, card #2469 (N4b-1).
-- One new table, nothing else.
--
-- ============================================================================
-- WHAT A CUSTOMER GETS
-- ============================================================================
--
-- Nothing yet, on purpose. This is the store the Voice card (N4b-2) will read;
-- until that ships no surface reads it, and the road that writes it is dark
-- behind CASTING_VOICE_SCOPE, which is unset everywhere. The design is
-- docs/specs/N4B_VOICE_DESIGN_2026-10-13.md.
--
-- ============================================================================
-- THE SHAPE, AND WHY IT IS ROUND THIS WAY
-- ============================================================================
--
-- His own storage design: THE CLIP IS THE CAST'S ASSET AND THE PROVIDER'S
-- SAVED-VOICE SLOT IS A CACHE. So the clip's key, its sha256 and its size are
-- NOT NULL, and `voiceId` — the slot — is NULLABLE, where NULL means "not
-- resident" rather than "missing". N4b-4 re-mints an evicted voice from the
-- clip.
--
-- One row per cast (unique modelId). `userId` is denormalised so every
-- statement carries the owner in its own WHERE (enforcement invariants 1 and
-- 2). No foreign-key constraints, as everywhere else in this schema.
--
-- `designSentence` is the customer's own voice line, copied VERBATIM at design
-- time rather than pointed at: the same words give a different voice every run,
-- so a pointer would not record what this voice was made from. It is therefore
-- the same field family as masterPrompt — owner-only, on REFUSING_KEYS, in no
-- staff projection, in the GDPR export, and scrubbed by both deletion paths.
--
-- `clipStorageKey` is a KEY and never a URL. Ninety seconds of a voice is a
-- cloning source, so nothing projects it; the owner-only authenticated route
-- that serves it arrives with N4b-2.
--
-- ============================================================================
-- ZERO BACKFILL
-- ============================================================================
--
-- No existing row is read or written. A cast signed before this ships simply
-- has no voice until somebody keeps one.
--
-- PURELY ADDITIVE. One CREATE TABLE and two CREATE INDEX on the table this
-- file creates, so scripts/lib/ceremonyAutoApply.mts recognises every statement
-- and no ceremony reaches the founder.
CREATE TABLE `cast_voices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelId` int NOT NULL,
	`userId` int NOT NULL,
	`designSentence` text NOT NULL,
	`voiceId` varchar(128),
	`clipStorageKey` varchar(512) NOT NULL,
	`clipSha256` varchar(64) NOT NULL,
	`clipBytes` int NOT NULL,
	`clipContentType` varchar(64) NOT NULL,
	`passageVersion` int NOT NULL,
	`lastUsedAt` timestamp,
	`keptAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cast_voices_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cast_voices_model` UNIQUE(`modelId`)
);
--> statement-breakpoint
CREATE INDEX `ix_cast_voices_user` ON `cast_voices` (`userId`);
--> statement-breakpoint
CREATE INDEX `ix_cast_voices_last_used` ON `cast_voices` (`lastUsedAt`);
