-- THE PLATE STORE — station two of the plate road (ruled fable-959 §3, on the
-- recommendation in opus-702 §6).
--
-- One row is: **a design re-drawn onto a blank ghost mannequin, by a named
-- engine, from a template whose bytes the founder approved.**
--
-- ============================================================================
-- WHY A SEPARATE TABLE AND NOT COLUMNS ON `casting_ink_designs`
-- ============================================================================
--
-- Because the plate court (fable-936 §4) mints ONE design on BOTH engines, and
-- that is two plates for one design. Columns cannot hold that without becoming
-- a two-engine hack — `engineAPlateKey`, `engineBPlateKey` — which is a shape
-- that has to be undone the moment a third candidate engine appears, and which
-- makes "which engine drew this one" a thing you infer from which column is
-- non-null rather than a thing the row says.
--
-- ============================================================================
-- THE ENGINE IS A COLUMN FROM THE FIRST COMMIT — the court's own axis
-- ============================================================================
--
-- The court is a comparison: same design, both engines, speed and cost from the
-- census and QUALITY by the founder's eye. A plate whose engine is not on its
-- own row makes that comparison an archaeology of when each specimen was made.
-- It is a string rather than an enum on purpose: the members are provider model
-- ids (`fal:openai/gpt-image-2/edit`, `fal:fal-ai/nano-banana-pro/edit`), and an
-- enum would need a migration to record the LOSER of a court whose whole job is
-- to compare them.
--
-- ============================================================================
-- THE TEMPLATE'S DIGEST RIDES ON THE ROW, NOT ONLY IN THE SUITE
-- ============================================================================
--
-- `inkTemplates.ts` pins the sha256 the founder's rulings landed on and the
-- suite asserts the file on disk still hashes to it — so a silently swapped
-- template is a red suite. That protects every plate minted AFTER the swap. It
-- says nothing about the ones minted before, and a plate PERSISTS and is shown
-- to an engine on every later render.
--
-- So the mint records the digest it ACTUALLY read off disk. Then "which artwork
-- is this plate standing on" is a fact of the row rather than an inference from
-- the deployment's date, and a plate drawn on a form nobody approved can be
-- found by a query rather than by an eye.
--
-- ============================================================================
-- UNIQUE PER (DESIGN, ENGINE), NOT PER DESIGN
-- ============================================================================
--
-- A design is plated once PER ENGINE. `inkPlateAlreadyMintedRefusal` is what
-- keeps the cost argument of minting-at-upload honest (fable-936 §2: made once,
-- reused by every later render), and this index is what makes it exact under a
-- race rather than exact in the comments — two mints of one design on one engine
-- cannot both write, whichever order they arrive in.
--
-- No separate index on `designId`: it is the leftmost column of the unique key
-- above, so "every plate of this design" already has one. A second index over
-- the same prefix is a parallel copy that costs writes and buys nothing.
--
-- ============================================================================
-- RETENTION
-- ============================================================================
--
-- A plate dies with its design, which dies with its Cast — unconditionally, and
-- NOT gated on `CASTING_INK_STUDIO_SCOPE`. There is no `candidateId` column
-- here: the sweep reaches these rows through the design's own (working law 4 —
-- a mirrored parent id is a second source of truth that drifts), which fixes the
-- delete ORDER as plates-then-designs, and that order carries its own assertion.
--
-- PURELY ADDITIVE. One new table; no column of any existing table changes; and
-- nothing reads or writes it until the mint ships beside it. The migration lands
-- first anyway, because a new table is in every INSERT the moment its writer
-- ships and there is no dark landing for one.
CREATE TABLE `casting_ink_plates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	-- Denormalized so ownership is decided in the statement that reads or
	-- writes, never by a SELECT followed by a write keyed on id alone
	-- (invariant 1). It is proved against the design's parent candidate at
	-- insert rather than trusted from a caller.
	`userId` int NOT NULL,
	-- The seed this plate re-drew. →casting_ink_designs.id
	`designId` int NOT NULL,
	-- The model as the provider names it, so a court verdict and an invoice
	-- line can be matched to the same specimen.
	`engine` varchar(128) NOT NULL,
	-- Which blank form it stands on. Derived in `drizzle/schema.ts` from
	-- `INK_TEMPLATE_KINDS` rather than retyped, and compared against it on
	-- every commit.
	`templateKind` enum('arm','body') NOT NULL,
	-- The sha256 the mint READ off disk — the founder's approval bound to this
	-- row, not only to the suite. See the header.
	`templateDigest` varchar(64) NOT NULL,
	-- OUR object, under the candidate's purge path. Never a pointer.
	`storageKey` varchar(512) NOT NULL,
	-- sha256 of the plate's own bytes — byte identity, as the library does it.
	`digest` varchar(64) NOT NULL,
	`mime` varchar(64) NOT NULL,
	`byteSize` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_ink_plates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- One plate per design per engine — the door's exactness, in the schema.
CREATE UNIQUE INDEX `uq_casting_ink_plates_design_engine` ON `casting_ink_plates` (`designId`,`engine`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_casting_ink_plates_publicId` ON `casting_ink_plates` (`publicId`);
