-- What a signed Cast KEEPS — the promoted segment set (fable-092, shape ruled
-- in fable-101).
--
-- Sign copies and never invents. At Sign the signed variant's whole
-- lineage-derived segment set is copied into this table and its objects are
-- re-manifested onto the Cast's own lifetime, because a segment's lifetime is
-- its CANDIDATE'S and a signed Cast outlives its candidate by design. Without
-- this, the face chart on the object she actually keeps would go empty seven
-- days after Sign — the permanence promise expiring on a timer.
--
-- PURELY ADDITIVE. One new table. No column of any existing table changes, and
-- nothing reads or writes it until the Sign promotion merges — so this may land
-- ahead of its code, which is the ordering the program now runs under.
--
-- WHY A SECOND TABLE RATHER THAN `castId` ON `casting_segments`:
--
--   1. A nullable owner column would sit inside the identity key, and MySQL
--      lets NULLs repeat inside a unique index — so promoted rows would be
--      outside the only thing making promotion idempotent, on the one path
--      (the Sign adjudicator finishing a lapsed lease) that replays by design.
--   2. A non-null sentinel would put promoted rows inside the candidate purge,
--      whose `WHERE candidateId IN (…)` is deliberately unfiltered. The Cast's
--      kept pixels would be deleted with the candidate — the exact expiry this
--      promotion exists to prevent, reintroduced as a forgotten clause.
--
-- Two lifetimes, two owners, two tables. The candidate sweep structurally
-- cannot reach this table; these rows and objects are deleted by the CAST'S own
-- deletion, in that transaction, on its `model_delete` manifest.
CREATE TABLE `casting_cast_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`castId` int NOT NULL,
	`sourceSegmentId` int,
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_cast_segments_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_casting_cast_segments_public` UNIQUE(`publicId`),
	-- Identity, and promotion idempotency for free. Every column is NOT NULL,
	-- which is the whole reason this is a separate table from `casting_segments`
	-- rather than a widened key on it.
	CONSTRAINT `uq_casting_cast_segments_identity` UNIQUE(`castId`,`facet`,`region`,`version`)
);
--> statement-breakpoint
CREATE INDEX `idx_casting_cast_segments_cast` ON `casting_cast_segments` (`castId`);
