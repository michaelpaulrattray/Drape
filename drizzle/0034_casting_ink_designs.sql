-- THE INK DESIGN STORE — M12 row 15's upload, tattoos first (ordered
-- fable-711 as the row M12 does not close without; sequenced fable-921/922).
--
-- One row is: **a design the customer supplied, the place on her it is meant
-- for, and where OUR copy of the bytes lives.**
--
-- ============================================================================
-- WHY THIS TABLE IS THE SEED AND NOT THE REFERENCE
-- ============================================================================
--
-- An uploaded photograph never reaches a render. The founder's own architecture
-- (D-138, confirmed in person at fable-684 §2) re-draws ink onto a neutral ghost
-- mannequin, and it is that PLATE the painter is shown. So this table holds the
-- seed; the plate is a separate artifact with its own columns, and it does not
-- exist yet because the mannequin templates are a founder taste gate that has
-- not closed.
--
-- The consequence worth writing down, because it is the reason ink is first of
-- the three reference-guided features: the real-person fence (fable-711 §3a) is
-- met by CONSTRUCTION here rather than by a filter. A person cannot ride along
-- a reference that is not the reference. Hair has no such conversion step,
-- which is exactly why its ingestion form is still unruled.
--
-- ============================================================================
-- COPY, NEVER POINTER — a condition inherited from a CLOSED item
-- ============================================================================
--
-- `storageKey` is our own object, written under the candidate's purge path, the
-- way `referenceMint.ts` writes a reference's bytes. It is never a URL into a
-- customer's own storage, and that is a condition rather than a preference:
-- `POST_SIGN_ROADMAP.md` §7's L10 (the refine deferred-delete determination)
-- closed as MOOT on the grounds that *a reference holds its own bytes*. An
-- attachment BY POINTER is the one thing that reopens the whole deferred-delete
-- question, and there is still no `notBefore` concept anywhere in `server/`.
--
-- ============================================================================
-- THE SIDE IS PART OF THE ROW, AND IT HAS A RECEIPT
-- ============================================================================
--
-- Laterality is this road's proven killer, twice, on two engines:
--
--   2026-07-29  the legacy ink road delivered a candidate that "visibly
--               MIRRORED the left-shoulder triangle", and its placement audit
--               rejected both Walk attempts at 90% confidence for wrong
--               anatomical side. 300 credits refunded, twice (DECISION_LOG,
--               R7-7G). Every projection angle is closed to this day.
--   2026-08-16  V2 measured the same failure from scratch: her right eye 3/6
--               against her left 6/6, and "her left ear" clearing the image's
--               RIGHT half 6 times of 6 even mirrored.
--
-- So a left upper arm and a right upper arm are two different places. They earn
-- their release separately (`shared/inkReleasedPlacements.ts`, which starts
-- EMPTY: measured is not earned), and a side is never inferred from its twin.
--
-- ============================================================================
-- PROVENANCE RIDES FROM THE FIRST COMMIT (ruled fable-922 §3a)
-- ============================================================================
--
-- Two values, and they are not new: the legacy ink road already typed its
-- inputs `["synthetic", "consented"]` (`inkCalibration.ts`). The fence is not a
-- filter applied to arbitrary pictures — it is a constraint on what a reference
-- may BE. Either we made it, or somebody agreed to it.
--
-- It is a column now rather than a migration later because provenance added
-- afterwards has to be back-filled with a guess for every row that predates it,
-- and a guessed provenance is precisely the value the fence cannot tolerate.
--
-- ============================================================================
-- THE THREE PLACEMENTS ARE THE PHOTOGRAPH'S, NOT THE BODY'S
-- ============================================================================
--
-- `neck`, `upperArm`, `upperChest` — the measured survivors of
-- `V3B_PLACEMENT_VOCABULARY_READING.md`: sixteen production masters opened at
-- full resolution, sixteen of sixteen cropped above the elbow, sixteen of
-- sixteen in the roll prompt's own crew tee. The legacy road's ontology had 16
-- zones x 6 surfaces x 3 sides and was NOT naive — it painted a Cast with
-- full-body views. On this road there is one waist-up frame, so the same
-- ontology would be 285 of 288 unbuildable. Inherit the rule, never the table.
--
-- The enums are derived in `drizzle/schema.ts` from the TypeScript constants
-- rather than retyped here, so the column and the vocabulary cannot come apart
-- (working law 4) — and the ceremony reads the enum members back and compares
-- them, because a hand-written DDL beside a constant is the parallel copy that
-- drifts.
--
-- ============================================================================
-- RETENTION
-- ============================================================================
--
-- Rows and their objects die with the candidate, unconditionally and NOT gated
-- on `CASTING_INK_STUDIO_SCOPE` — the same rule library crops and face scans
-- follow. A customer's uploaded picture leaves with the work it was uploaded
-- for.
--
-- PURELY ADDITIVE. One new table; no column of any existing table changes; and
-- **nothing reads or writes it in this commit** — the procedure is the next
-- step. The migration lands first anyway, because a new table is in every
-- INSERT the moment its writer ships and there is no dark landing for one.
CREATE TABLE `casting_ink_designs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	-- Denormalized so ownership is decided in the statement that reads or writes,
	-- never by a SELECT followed by a write keyed on id alone (invariant 1).
	`userId` int NOT NULL,
	`candidateId` int NOT NULL,
	-- The measured survivors. A fourth member is a claim that the photograph
	-- contains it, proven the way these were: frames opened, then a reader asked,
	-- then the word checked against a covered control.
	`placement` enum('neck','upperArm','upperChest') NOT NULL,
	-- Part of the identity, not a modifier on it. See the receipt above.
	`side` enum('left','right','centre') NOT NULL,
	-- What was CLAIMED about the source. Never guessed, never back-filled.
	`provenance` enum('synthetic','consented') NOT NULL,
	-- OUR copy, under the candidate's purge path. Never a pointer.
	`storageKey` varchar(512) NOT NULL,
	-- sha256 of the object's bytes: byte identity, read rather than re-fetched.
	`digest` varchar(64) NOT NULL,
	`mime` varchar(64) NOT NULL,
	`byteSize` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_ink_designs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- Every read is "her designs on this cast", so the candidate is the index.
CREATE INDEX `ix_casting_ink_designs_candidate` ON `casting_ink_designs` (`candidateId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_casting_ink_designs_publicId` ON `casting_ink_designs` (`publicId`);
