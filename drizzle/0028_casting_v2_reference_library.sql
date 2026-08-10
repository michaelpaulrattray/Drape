-- THE REFERENCE LIBRARY — what a face's features ARE, in the stylist's own
-- ontology, ready to be handed to the painter (COMPOSITOR_SWAP_DESIGN §2,
-- ruled fable-196).
--
-- One row is **the state of ONE feature slot as of ONE render**, plus the image
-- that render froze or minted for it. The recipe assembler reads a whole
-- library and emits a prompt; nothing else may keep a second copy of these
-- facts.
--
-- PURELY ADDITIVE. One new table. No column of any existing table changes, and
-- nothing reads or writes it yet — the writers land behind
-- `CASTING_REFERENCE_LIBRARY_SCOPE`, which is off everywhere. The migration
-- lands before the code that names it, which is the rule this program runs
-- under and the one written in blood a deploy ago.
--
-- ============================================================================
-- WHY THIS IS ITS OWN TABLE AND NOT A VIEW OVER `casting_segments` (fable-196)
-- ============================================================================
--
-- The obvious economy is to project the library out of the segment store, and
-- it is wrong on three counts, each independently fatal:
--
--   1. **The store seeds nothing** (fable-173, on D-243's audit): 7 of 14
--      production rows are the wrong facet entirely and the surviving best
--      holds 78.7% of its own region. A projection over that is a view of junk
--      wearing a clean name.
--   2. **The key spaces are different.** `casting_segments` is keyed
--      `facet@region` — *which instruction wrote these pixels*. The library is
--      keyed by the PANEL'S SLOT — *what is this a picture of* (`lips`,
--      `eye@left`, `earring@right`). The ledger's own drift is the proof they
--      are not the same question: "add nude lip gloss" filed itself at
--      `makeup@face skin` on one render and `makeup@lips` on the next.
--   3. **The library holds facts the segment table cannot represent**: a
--      feature's full declarative word stack, its tier, its stylist noun, and
--      an introduced item's FROZEN INTRODUCTION REFERENCE (D-192/D-244).
--
-- `casting_segments` stays exactly what it was built to be — the undo store.
-- Different facts, different keys, different jobs, so this is not the
-- second-list violation working law 4 forbids; the violation would be deriving
-- one from the other and letting them drift.
--
-- ============================================================================
-- WHY THE ROWS ARE IMMUTABLE AND THE LIVE LIBRARY IS DERIVED
-- ============================================================================
--
-- Refinement is a TREE (`casting_candidate_variants.parentVariantId`): the user
-- may fork-edit from any earlier face, and *"the layers are only what that
-- currently selected image holds"* is the founder's own semantics. A mutable
-- one-row-per-slot library would hold exactly one answer for a candidate that
-- has many — and this codebase has already paid for that mistake once, when a
-- fork from B was carrying D's glasses (fable-091).
--
-- So a row is never updated. Each row names the `variantId` that minted it, and
-- the library for a given branch is derived by walking that variant's ancestry
-- and taking the newest version per (slot, role) — the same recursive walk
-- `listLineageSegments` already runs, for the same reason.
--
-- `retiredAt` is a fact about a VERSION, not about a slot: the newest thing
-- this branch says about `earring@left` is either "this crop" or "gone", and
-- either way it is the branch's answer. A fork from before the removal still
-- finds its own newest version live and keeps the earring.
--
-- `variantId` NULL is meaningful rather than missing: the row was minted from
-- the candidate's MASTER (born anatomy read fresh, or an item introduced before
-- any edit landed), so it belongs to every branch of the tree.
--
-- ============================================================================
-- ONE ROW SHAPE, NOT TWO
-- ============================================================================
--
-- `role` says which IMAGE this row's key holds:
--
--   `anchor`  the frozen introduction reference (D-192/D-244 line 3) — a
--             tattoo's flash sheet, a makeup look's source image. Pixel-stable
--             forever; it is what the item's edits regenerate FROM.
--   `carry`   the crop minted from the frame that last delivered this slot
--             (D-244 line 4). Rides untouched renders byte-identical.
--
-- Both shapes carry the same state columns (`tier`, `noun`, `words`), and that
-- is deliberate: every row states what the slot WAS at that moment, so no row
-- is half-populated and no reader has to know which columns its `role` makes
-- meaningless. The state read for a branch is the newest row of either role.
--
-- `storageKey` NULL is the TIER BOUNDARY, not missing data (§3.0a): a SURFACE
-- is carried by words and never by a crop, so its rows hold a word stack and no
-- image, always. An anatomy slot that has accumulated words but has not been
-- delivered yet is the other legal NULL. Every other combination is refused by
-- the write helper, which is where a database CHECK constraint would be if MySQL
-- 5.7 could be relied on to enforce one.
--
-- TWO OBJECTS PER MINTED CROP, for the same reason `casting_segments` keeps
-- two: the RECIPE carries a rectangular crop (§5.1, fable-183 — cutouts lost as
-- references), and the PANEL shows a cutout. `storageKey` is the rectangle;
-- `maskKey` is the single-channel mask that turns it into one. The mask is also
-- the only thing that could ever re-measure a stored crop's coverage, and a
-- guard reading whose subject cannot be re-read is a number with no artifact
-- behind it. An UPLOADED anchor has neither a mask nor a bbox: it is not a cut.
--
-- `words` is the FULL declarative stack for the slot, oldest first — everything
-- ever accepted about this feature, which is what D-244 line 2 regenerates from.
-- It is not a copy of `casting_candidate_variants.instructions`: those are the
-- user's own sentences in the ledger's key space, this is declarative state in
-- the panel's.
--
-- The `guard*` columns record what the completeness guard READ when the crop
-- was minted (§2.4). They are evidence, never a gate at read time: a crop that
-- failed the guard was refused loudly and never stored, and under D-246 no
-- subtle reading may refuse a render afterwards.
--
-- ============================================================================
-- RETENTION
-- ============================================================================
--
-- A library row holds a crop of a person's FACE at a permanently public URL.
-- Its lifetime is its CANDIDATE'S: the candidate sweep deletes these rows and
-- hands their objects to the cleanup worker inside the same transaction and on
-- the same manifest as the candidate's own objects, from this migration onward.
-- That purge is UNCONDITIONAL and deliberately not gated on the feature flag —
-- the flag governs whether rows are WRITTEN; nothing governs whether they are
-- deleted.
--
-- What a SIGNED Cast keeps is a later slice, and it is named here as owed
-- rather than absent: promotion will copy into a second table on the Cast's own
-- lifetime, exactly as `casting_cast_segments` does for segments, and for the
-- same reason (a nullable owner inside a unique index, and a purge whose
-- `WHERE candidateId IN (…)` is deliberately unfiltered). Nothing about this
-- table needs to change when it lands.
CREATE TABLE `casting_reference_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`candidateId` int NOT NULL,
	`variantId` int,
	`role` enum('anchor','carry') NOT NULL,
	`slot` varchar(64) NOT NULL,
	`tier` enum('item','anatomy','surface') NOT NULL,
	`noun` varchar(64) NOT NULL,
	`words` json NOT NULL,
	`storageKey` varchar(512),
	`maskKey` varchar(512),
	`digest` char(64),
	`bboxX` int,
	`bboxY` int,
	`bboxW` int,
	`bboxH` int,
	`frameWidth` int,
	`frameHeight` int,
	`guardKind` varchar(48),
	`guardCoverage` int,
	`guardSpill` int,
	`guardThreshold` int,
	`version` int NOT NULL DEFAULT 1,
	`retiredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_reference_library_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_casting_reference_library_public` UNIQUE(`publicId`),
	-- Identity. Every column in it is NOT NULL, which is why `variantId` is not
	-- in it: MySQL lets NULLs repeat inside a unique index, and a key a master-
	-- minted row sits outside is not a key. Versions count past retired rows,
	-- so a number is never reused and two deliveries never share a name.
	CONSTRAINT `uq_casting_reference_library_identity` UNIQUE(`candidateId`,`slot`,`role`,`version`)
);
--> statement-breakpoint
CREATE INDEX `idx_casting_reference_library_candidate` ON `casting_reference_library` (`candidateId`);--> statement-breakpoint
CREATE INDEX `idx_casting_reference_library_variant` ON `casting_reference_library` (`variantId`);
