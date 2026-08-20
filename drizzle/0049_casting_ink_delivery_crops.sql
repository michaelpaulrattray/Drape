-- THE DELIVERED TATTOO — how the design landed on HER (design report opus-886
-- §3, countersigned fable-1193 §3 and fable-1194 §2).
--
-- One row is: **the frame that first delivered one design onto one Cast, cut
-- down to the tattoo as it sits on her, and where OUR copy of that cut lives.**
--
-- ============================================================================
-- THE FRAMES THAT BOUGHT IT — three carry renders, three shirts
-- ============================================================================
--
--   485   carry, no realism language at all                      SHIRT
--   487   carry, realism + the clothing prohibition in full      SHIRT
--   490   carry, + a boundary clause saying where it stops       SHIRT
--
-- Three clauses were said to that lane and none of them moved it. The extent is
-- not a word problem, and the reason is arithmetic rather than mysterious: what
-- the carry sent was the customer's ARTWORK — 1200x1697 of design on
-- transparency with no body in it — under the sentence "keep it exactly as it
-- is, in the same place and at the same size", on a render anchored to the
-- MASTER, a photograph with no tattoo on it anywhere.
--
-- THERE IS NO SIZE IN THAT PICTURE AND NO SIZE IN THAT FRAME. The painter was
-- told to preserve a measurement neither of its inputs contained, so it
-- invented one, and on three renders of three it invented one that ran onto
-- cloth. A fourth sentence cannot supply a number no picture holds.
--
-- A crop of the DELIVERED frame is a reference with the extent IN it. Measured
-- before anything was designed on top of it (fable-1193 §3a ordered the arm
-- first): `tattooed skin` on three delivered frames returned 27,374 / 51,596 /
-- 2,632 px — the ink and not the man, at both scales, every mask and every cut
-- opened at full size (opus-887 §2).
--
-- ============================================================================
-- WHY THIS IS A TABLE AND NOT A ROW IN `casting_reference_library`
-- ============================================================================
--
-- fable-1193 §2 amended fable-1137 §3 to ALLOW ink's delivery crop there, and
-- the amendment's distinction is the one this table is built on: the DESIGN ROW
-- stays the identity source forever, and this is a DELIVERY FACT. But the
-- library's door refuses these bytes, and migration 0040 is the house record of
-- the same refusal happening once before:
--
--   anchor   AN UPLOAD, AND NEVER A CUT.
--   carry    A CUT FROM HER OWN DELIVERED FRAME. Geometry, mask and A GUARD
--            READING are all REQUIRED.
--
-- This is a cut from her own delivered frame, so `carry` is the right shape and
-- the wrong door. The guard is "an independent second read of the crop's own
-- region on its own frame, scored against a specimen family", and INK HAS NO
-- SPECIMEN FAMILY — the whole measured population is the three masks above.
-- Through `mintGuardedReference` every ink crop refuses `noSpecimen` and files
-- a words-only row, which delivers nothing; around it, a library row with no
-- guard reading breaks the one invariant that door exists to hold.
--
-- The second reason is independent of the first: `deriveLibrary` is generic, so
-- a row there becomes a `LibraryEntry` and the assembler emits a SECOND
-- sentence about the same feature beside the ink carry sentence — one picture,
-- two instructions, which is what the assembler refuses one layer up.
--
-- ============================================================================
-- MINTED ONCE, AND THE DATABASE IS WHAT SAYS SO
-- ============================================================================
--
-- fable-1193 §3b: minted ONCE, from the frame that FIRST delivered the design,
-- never re-cut from a later carry. The reason is the chained-anchor trap — a
-- crop taken from a frame that was itself carried is a copy of a copy, and the
-- drift compounds with nothing going red.
--
-- `uq_casting_ink_delivery_crops_design` is that rule rather than a comment
-- about it: over (candidateId, designId, slot), so a second mint cannot be
-- written whatever a caller believes. The writer inserts and tolerates the
-- duplicate; it never updates.
--
-- ============================================================================
-- WHAT IS ABSENT, AND THE ABSENCE IS THE DESIGN
-- ============================================================================
--
-- NO NULLABLE `designId`. A tattoo painted from WORDS ALONE — D-137's face and
-- neck road — delivers a real tattoo with no design row anywhere, and today it
-- cannot carry for a reason one layer away: `inkApplied` is `slot -> designId`
-- and its strict reader requires a UUID, so a designless delivery is never
-- recorded as applied at all. A delivered crop needs no design row and COULD
-- hold that, which is exactly why the column is NOT NULL here — a nullable key
-- with no writer is a half-built road that reads as a finished one. Filed as
-- opus-888 §2; it lands with its writer or it does not land.
--
-- NO MASK OBJECT. The crop carries its own alpha, the way `casting_reference_
-- crops` does, so a cutout is one object rather than two that can come apart.
--
-- ============================================================================
-- RETENTION
-- ============================================================================
--
-- Rows and their objects die with the candidate, unconditionally and NOT gated
-- on any feature flag — the rule library crops, face scans, ink designs, ink
-- plates, reference crops and attachments already follow. `candidateRetention`
-- is ROW-DRIVEN: it builds its purge list by enumerating rows and collecting
-- their storage keys, so THE ROW IS WHAT MAKES THE OBJECT PURGEABLE AT ALL, and
-- an unrowed crop would be a picture of a real person's neck that nothing ever
-- deletes. The sweep clause lands in the same commit as the writer.
--
-- PURELY ADDITIVE. One new table; no column of any existing table changes. It
-- lands ahead of its writer for the standing reason — a new table is in every
-- INSERT the moment its writer ships, and there is no dark landing for one.
CREATE TABLE `casting_ink_delivery_crops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	-- Denormalized so ownership is decided in the statement that reads or writes,
	-- never by a SELECT followed by a write keyed on id alone (invariant 1).
	`userId` int NOT NULL,
	`candidateId` int NOT NULL,
	-- The design this delivered. The identity source stays `casting_ink_designs`;
	-- this row says how it LANDED.
	`designId` int NOT NULL,
	-- THE FRAME IT WAS CUT FROM, and the one that FIRST delivered this design.
	-- NOT NULL, unlike the library's, and the difference is the point: a library
	-- row may be minted from the master and a delivery cannot be.
	`variantId` int NOT NULL,
	-- The panel's slot key the design went on: `ink:neck`, `ink:upperArm@left`.
	`slot` varchar(64) NOT NULL,
	-- The segmentation question that drew the cut — `tattooed skin` today.
	-- Written down rather than assumed, so a later reader can tell what was
	-- asked without re-deriving it from the date.
	`region` varchar(64) NOT NULL,
	-- OUR copy of the CUT, under the candidate's purge path.
	`storageKey` varchar(512) NOT NULL,
	-- sha256 of the cut's own bytes: byte identity, and what `repaintRender`
	-- refuses on when the bytes at the key have moved.
	`digest` varchar(64) NOT NULL,
	`mime` varchar(64) NOT NULL,
	`byteSize` int NOT NULL,
	-- The CROP's own size, which is the box below and not the frame.
	`width` int NOT NULL,
	`height` int NOT NULL,
	-- Where the crop sat on the frame it came from, and how big that frame was.
	-- The stored cut is crop-local, so without these its pixels can be looked at
	-- and never placed — a crop means nothing except against its own frame.
	`bboxX` int NOT NULL,
	`bboxY` int NOT NULL,
	`bboxW` int NOT NULL,
	`bboxH` int NOT NULL,
	`frameWidth` int NOT NULL,
	`frameHeight` int NOT NULL,
	-- HOW MANY PIXELS THE REGION HELD, and how many the cut KEPT. Counted, never
	-- sampled, and both written down because they are the arm against a failure
	-- this build has already hit twice: `composite({blend:"dest-in"})` with a raw
	-- greyscale alpha returns THE WHOLE FRAME, silently, while every number
	-- beside it stays correct. A row whose `keptPixels` equals
	-- `frameWidth * frameHeight` is that failure, findable by a query rather
	-- than by somebody happening to open a picture.
	`maskPixels` int NOT NULL,
	`keptPixels` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_ink_delivery_crops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- Every read is "the delivered ink on this cast", so the candidate is the index.
CREATE INDEX `ix_casting_ink_delivery_crops_candidate` ON `casting_ink_delivery_crops` (`candidateId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_casting_ink_delivery_crops_publicId` ON `casting_ink_delivery_crops` (`publicId`);
--> statement-breakpoint
-- MINTED ONCE, as a fact the database holds rather than a rule somebody recalls.
CREATE UNIQUE INDEX `uq_casting_ink_delivery_crops_design` ON `casting_ink_delivery_crops` (`candidateId`,`designId`,`slot`);
