-- THE FACE SCAN, KEPT (founder 2026-08-16 via fable-698: *"yes to the scan - as
-- long as it wont clog up storage eventually many users will be using this"*).
--
-- Every time a face-version is opened the panel scans it — twelve segmenter
-- questions, about ten cents — and remembers the answer IN MEMORY only. The
-- process dies on every deploy, and this program deploys many times a night, so
-- the same face is bought again and again. Measured across two days of ordinary
-- live use: 58 paid scans for 28 distinct faces.
--
-- PURELY ADDITIVE. One new table, no column of any existing table changes, and
-- nothing reads or writes it yet — the writer lands behind its own scope flag
-- in a later commit. The migration lands FIRST anyway, because a new table is in
-- every INSERT the moment its writer ships and there is no dark landing for one.
--
-- ============================================================================
-- THE STORAGE CONDITION IS PART OF THE RULING, AND IT DECIDED THIS SHAPE
-- ============================================================================
--
-- His yes came with a bound, so the growth curve was measured before this file
-- existed rather than estimated after. From 29 clean production scans on
-- 2026-08-16, read out of the service's own log lines (which have carried
-- `stencilBytes` since the panel shipped): stencils per scan min 5,899 B,
-- median 8,360 B, mean 8,365 B, max 11,567 B.
--
--   one row, geometry + words as JSON            1,212 B
--   the same row with stencils base64 inside    12,365 B
--
--   10,000 users × 5 casts × 8 versions   stencils inside    4,717 MB
--                                         geometry only        462 MB
--   100,000 users × 5 casts × 8 versions  stencils inside   47,169 MB
--                                         geometry only      4,623 MB
--
-- Nearly five gigabytes of MySQL at a modest ten-thousand-user shape is exactly
-- the clog he named. So the row holds GEOMETRY and the stencils become objects
-- under the candidate's own purge path — fable-698 §2c's own conditional,
-- answered by the measurement rather than by taste.
--
-- And the road not taken, said out loud: dropping the stencils altogether would
-- be cheaper still and would be the fidelity law's violation, not a saving. A
-- stencil is the feature's SHAPE. Without it the panel draws a rectangle where a
-- masked cutout belongs.
--
-- ============================================================================
-- WHY `versionKey` IS A NOT-NULL STRING AND NOT A NULLABLE `variantId`
-- ============================================================================
--
-- One row per (candidate, version) is the founder's bound made mechanical, and
-- a bound enforced by a key that can hold duplicates is not enforced at all.
-- MySQL lets NULLs repeat inside a unique index, and the version being scanned
-- is sometimes the candidate's own master frame, which has no variant row. A
-- nullable `variantId` in the key would therefore admit unlimited master-frame
-- rows for one cast — the exact defect `casting_segments` documents at length
-- and solved the same way.
--
-- So the version travels as a string that is never null: the variant's id, or
-- the literal `master`. It is the same discriminator the in-memory cache has
-- always keyed on.
--
-- `frameKey` is beside it and NOT in the key: it records WHICH bytes were read,
-- so a row whose frame has since moved is refused by the reader rather than
-- served as a reading of a picture that is no longer there.
CREATE TABLE `casting_face_scans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	-- Denormalized so ownership is provable in the statement that reads or
	-- writes, never by a SELECT followed by a keyed write (invariant 1).
	`userId` int NOT NULL,
	-- →casting_candidates. The lifetime this row belongs to.
	`candidateId` int NOT NULL,
	-- The variant's id as text, or `master` for the candidate's own frame.
	`versionKey` varchar(24) NOT NULL,
	-- The storage key of the frame that was read, so moved bytes invalidate.
	`frameKey` varchar(512) NOT NULL,
	-- Boxes, the two described rows, the sides summary, and the counts. The
	-- stencils are NOT here: each slot's entry names its own object key.
	`geometry` json NOT NULL,
	-- What the stencils cost, carried so the growth curve stays a reading after
	-- the table exists rather than a measurement taken once before it did.
	`stencilBytes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_face_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_casting_face_scans_public` ON `casting_face_scans` (`publicId`);--> statement-breakpoint
-- The bound itself: one row per (candidate, version), and both columns NOT NULL
-- so the key cannot quietly hold duplicates.
CREATE UNIQUE INDEX `uq_casting_face_scans_identity` ON `casting_face_scans` (`candidateId`,`versionKey`);--> statement-breakpoint
-- The purge reads by candidate, and it runs on every sweep whether the feature
-- is on or off.
CREATE INDEX `idx_casting_face_scans_candidate` ON `casting_face_scans` (`candidateId`);
