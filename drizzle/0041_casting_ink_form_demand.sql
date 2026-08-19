-- WHO WANTED A BLANK FORM THAT DOES NOT EXIST — the demand record behind the
-- ink studio's missing-form refusal (ruled fable-1025 §3, rider two of the
-- ruling that made the refusal itself).
--
-- ============================================================================
-- WHY A TABLE AND NOT THE REFUSAL COUNTER THAT ALREADY EXISTS
-- ============================================================================
--
-- `castingV2/refusalCounter.ts` counts refusals into `audit_logs`, and its own
-- docblock makes the argument for doing so: no schema change, no ceremony,
-- countable tonight. That argument does not survive this refusal, and the
-- reason is the whole point of this table.
--
-- Every audit row carries a `userId` and a resource id. A row saying "this
-- account was refused because there is no torso form for their Cast's build"
-- is one bit of that Cast's `technicalSchema` handed to every staff member who
-- can read audit logs — and `technicalSchema` is a third of the recipe for
-- reproducing a Cast, which the founder's 2026-07-25 ruling says to treat like
-- a password. The refusal is ABOUT a build. Attributing it is the leak.
--
-- So the count goes somewhere that cannot be attributed, which means its own
-- table, which means this migration.
--
-- ============================================================================
-- THE COLUMN LIST IS THE PRIVACY BOUNDARY — the same rule as 0031 and 0036
-- ============================================================================
--
-- `kind`, `placement`, `outcome`, `createdAt`. NOT the account, not the cast,
-- not the design, not the picture, not a storage key — **absent from the row
-- rather than omitted from a projection** (invariant 8).
--
-- A staff member reading this learns that eleven people wanted a tattoo on a
-- neck we have no form for; they learn nothing whatever about any one of them.
-- The correlation this shape still permits is the same one 0031 names and
-- accepts: a row's timestamp sits near other timestamps. It is not narrowed
-- further because narrowing it would cost the ordering that makes a trend
-- readable, and the row holds nothing to correlate TO.
--
-- ============================================================================
-- WHY `placement` IS IN AND `outcome` IS NEARLY EMPTY
-- ============================================================================
--
-- `placement` is the half that makes this actionable rather than merely
-- countable: "forty people wanted a NECK piece" and "forty wanted an UPPER
-- CHEST piece" lead to different artwork. It is a surface, not a person.
--
-- `outcome` can only be `refused` today — the form does not exist, so nothing
-- else can happen. `delivered` is in the enum so the table survives the day a
-- third form ships: on that day these rows answer *did commissioning it work*,
-- and a table that could only record the absence would need migrating to
-- answer the question it was built for.
--
-- ============================================================================
-- PURELY ADDITIVE
-- ============================================================================
--
-- One new table. No column of any existing table changes. It lands ahead of
-- its writer for the standing reason — a new table is in every INSERT the
-- moment its writer ships, so there is no dark landing for one, and this
-- program has the scar that named that rule.
CREATE TABLE `casting_ink_form_demand` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('torsoNonbinary','torsoUnstated') NOT NULL,
	`placement` enum('neck','upperArm','upperChest') NOT NULL,
	`outcome` enum('refused','delivered') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_ink_form_demand_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_casting_ink_form_demand_kind` ON `casting_ink_form_demand` (`kind`,`outcome`);
--> statement-breakpoint
CREATE INDEX `idx_casting_ink_form_demand_created` ON `casting_ink_form_demand` (`createdAt`);
