-- THE REFERENCE CROP STORE — M12 row 15's CROP form (founder ruling relayed
-- fable-933; table ruled fable-1015 §3).
--
-- One row is: **one feature, cut out of a picture the customer supplied, and
-- where OUR copy of that CUT lives.**
--
-- ============================================================================
-- WHY THIS IS A TABLE AND NOT A ROW IN `casting_reference_library`
-- ============================================================================
--
-- The library has two image-bearing roles, and they are defined by an
-- assumption this feature breaks:
--
--   anchor   AN UPLOAD, AND NEVER A CUT. `assertShape` throws `anchorIsNotACut`
--            on a maskKey, and again on a bbox, because an anchor "was never in
--            a frame".
--   carry    A CUT FROM HER OWN DELIVERED FRAME. Geometry, mask and a guard
--            reading are all REQUIRED.
--
-- A hair reference is an upload THAT IS A CUT. It has to be: the founder's own
-- ruling is *"the SEGMENTED hair region… NEVER a rectangle containing a face"*,
-- and a rectangle is exactly what `anchor` permits. Relaxing either rule to fit
-- it would cost the distinction the two roles exist to hold.
--
-- An earlier reading ruled the library out on a DIFFERENT ground — that
-- `variantId` NULL would lie about provenance. That was wrong: NULL already
-- covers "an item introduced before any edit landed", and fable-195's
-- uploaded-anchor carve-out is live in both the write helper and the assembler.
-- Corrected in opus-751 §1 before this file was written, and the correction is
-- recorded here rather than only in a mailbox, because a table justified by a
-- wrong sentence outlives every shift that reads the table.
--
-- ============================================================================
-- THIS ROW HOLDS THE CUT AND NEVER THE UPLOAD — the fence, met by construction
-- ============================================================================
--
-- What persists HERE is the CUT alone: one PNG carrying its own alpha, so the
-- mask is not a second object and no rectangle of a stranger's face is in this
-- table.
--
-- ⚠ CORRECTED 2026-08-19. This section used to say the uploaded picture is
-- "read once and dropped, exactly as the makeup road drops it", and that
-- therefore "no rectangle of a stranger's face exists anywhere in this
-- product". The first half is still true of THIS TABLE. **The second half is a
-- claim about the product and it stopped being true**: fable-1063 §2 ruled that
-- an attached reference is KEPT — migration 0043, `casting_reference_attachments`
-- — for two stated reasons, that a crop minted from one must be re-derivable
-- and that "attach it again" is the friction the founder asked to be rid of.
--
-- The correction is here rather than only in a mailbox because a table
-- justified by a sentence that has moved outlives every shift that reads the
-- table, and because a REVERSED policy is the hardest kind to notice: nothing
-- fails, nothing goes red, and the old sentence goes on reassuring people.
--
-- There is deliberately NO bbox and NO frame size on this row. The absence is
-- the design, not an omission: geometry would locate this cut inside a
-- photograph we do not have and must never need.
--
-- ============================================================================
-- THE ENUMS ARE DERIVED, AND THIS FILE IS THE COPY THAT GETS CHECKED
-- ============================================================================
--
-- `intent` is the crop-form members of `shared/referenceIntents.ts`, computed
-- in `drizzle/schema.ts` rather than retyped; `provenance` is the ink road's
-- own two words, for the same reason it has them. `referenceCropSchema.test.ts`
-- compares THIS FILE against those constants on every commit, and the ceremony
-- compares what the DATABASE accepted against them too — a file can be right
-- about a table that was created from an older copy of it.
--
-- ============================================================================
-- RETENTION
-- ============================================================================
--
-- Rows and their objects die with the candidate, unconditionally and NOT gated
-- on any feature flag — the rule library crops, face scans and ink designs
-- already follow. `candidateRetention.ts` is ROW-DRIVEN: it builds its purge
-- list by enumerating rows and collecting their storage keys. So the row is
-- what makes the object purgeable at all, and an unrowed crop would be a
-- photograph-derived artifact of a real person that nothing ever deletes.
--
-- PURELY ADDITIVE. One new table; no column of any existing table changes; and
-- nothing reads or writes it in this commit — the procedure is the next step.
-- The migration lands first anyway, because a new table is in every INSERT the
-- moment its writer ships and there is no dark landing for one.
CREATE TABLE `casting_reference_crops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	-- Denormalized so ownership is decided in the statement that reads or writes,
	-- never by a SELECT followed by a write keyed on id alone (invariant 1).
	`userId` int NOT NULL,
	`candidateId` int NOT NULL,
	-- The features whose ingestion form is CROP. Derived, never listed.
	`intent` enum('hair','eyeColour') NOT NULL,
	-- The FOURTH source of references: not a render at all. The mint's three are
	-- a fresh read on the master, the delivered-anchored cut, and a composed
	-- region; this is a customer's own picture with one feature taken out of it.
	`source` enum('uploadedReference') NOT NULL,
	-- What was CLAIMED about the picture this was cut from. Never guessed.
	`provenance` enum('synthetic','consented') NOT NULL,
	-- The segmentation question that drew the cut.
	`region` varchar(64) NOT NULL,
	-- OUR copy of the CUT, under the candidate's purge path. Never the upload.
	`storageKey` varchar(512) NOT NULL,
	-- sha256 of the cut's own bytes: byte identity, read rather than re-fetched.
	`digest` varchar(64) NOT NULL,
	`mime` varchar(64) NOT NULL,
	`byteSize` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	-- What the completeness guard READ when this cut was taken. Evidence, never
	-- a gate at read time; same basis points and same family name as
	-- `casting_reference_library.guardCoverage`, so the two can be compared.
	`guardKind` varchar(48) NOT NULL,
	`guardCoverage` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_reference_crops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- Every read is "her crops on this cast", so the candidate is the index.
CREATE INDEX `ix_casting_reference_crops_candidate` ON `casting_reference_crops` (`candidateId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_casting_reference_crops_publicId` ON `casting_reference_crops` (`publicId`);
