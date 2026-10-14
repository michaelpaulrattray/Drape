-- A CAST'S HIDDEN VOICE CARD — rung N4b, card #2498.
-- One new table, nothing else.
--
-- ============================================================================
-- WHAT A CUSTOMER GETS
-- ============================================================================
--
-- Voices that sound like the cast. The visible voice line is written for the
-- video generator; sent alone to the voice designer it gave a cast written
-- as female three male voices (his listening test, 2026-10-14). This table holds a second
-- description written FOR the voice designer, plus an in-character line for the
-- three voices to read. The customer never sees either.
--
-- ============================================================================
-- SENSITIVITY
-- ============================================================================
--
-- Derived from the customer's brief and their master picture, so it is the
-- same field family as masterPrompt: owner-only, in no staff projection, never
-- logged, on REFUSING_KEYS, in the GDPR export, and deleted by both deletion
-- paths. One row per cast (unique modelId); userId denormalised so every
-- statement carries the owner in its own WHERE. No foreign keys, as everywhere
-- else in this schema.
--
-- ============================================================================
-- ZERO BACKFILL
-- ============================================================================
--
-- No existing row is read or written. A card is written the first time a
-- cast's voices are designed.
--
-- PURELY ADDITIVE. One CREATE TABLE and one CREATE INDEX on the table this file
-- creates, so scripts/lib/ceremonyAutoApply.mts recognises every statement and
-- no ceremony reaches the founder.
CREATE TABLE `cast_voice_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelId` int NOT NULL,
	`userId` int NOT NULL,
	`sourceHash` varchar(64) NOT NULL,
	`voiceCard` text NOT NULL,
	`previewLine` text NOT NULL,
	`writerModel` varchar(128) NOT NULL,
	`writtenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cast_voice_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cast_voice_cards_model` UNIQUE(`modelId`)
);
--> statement-breakpoint
CREATE INDEX `ix_cast_voice_cards_user` ON `cast_voice_cards` (`userId`);
