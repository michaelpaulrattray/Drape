-- WHAT CUSTOMERS TAKE FROM REFERENCES, AND HOW IT GOES — the demand record for
-- the ingestion map's WORDS and CROP forms (ruled fable-941 §3a, discharging
-- fable-937 §3's tally for the roads that keep nothing).
--
-- ============================================================================
-- WHY THIS TABLE EXISTS AT ALL, WHEN `casting_ink_designs.intents` ALREADY
-- RECORDS THE SAME FACT
-- ============================================================================
--
-- Because it records it ON A ROW, and the makeup road deliberately has none.
--
-- The founder ruled that makeup travels as WORDS — *"the image is looked at it
-- describes her makeup in words"* — and fable-941 took that at its word: the
-- reference is READ AND DISCARDED. No object, no row, no digest, no purge path.
-- That is the strongest form of the real-person fence this program has, because
-- there is no artifact that could be wrong.
--
-- It also means the intent declaration, which rides on the ink design row for
-- tattoos, has nowhere to live for makeup. Without this table, fable-937 §3's
-- tally — *what are references uploaded FOR* — would be a log line for every
-- form except the one that keeps bytes, which is precisely backwards: the
-- forms that keep nothing are the ones whose demand is otherwise invisible.
--
-- ============================================================================
-- THE COLUMN LIST IS THE PRIVACY BOUNDARY — the same rule as migration 0031
-- ============================================================================
--
-- `intent`, `outcome`, `createdAt`. NOT the sentence the reader produced, not
-- the account, not the cast, not the picture, not a storage key — **absent from
-- the row rather than omitted from a projection** (invariant 8).
--
-- The sentence is the sharpest exclusion and it is worth naming. A makeup note
-- read off a customer's own reference is a description of a real person's
-- face, produced from a photograph she supplied. It is exactly the material the
-- founder's 2026-07-25 ruling says to treat like a password, and this table
-- exists to be read by staff. So a staff member reading it learns that nine
-- people took makeup from a reference and seven of those reads landed; they
-- learn nothing whatever about any one of them, or about any face.
--
-- ============================================================================
-- THE OUTCOME VALUES ARE THE READER'S OWN REFUSAL CODES
-- ============================================================================
--
-- One value per way a read can end, derived from `MAKEUP_READ_REFUSAL_CODES`
-- rather than invented here, so a tally can distinguish *we could not see any
-- makeup* from *the transport was down* — two rows that would otherwise both
-- read as "it did not work" and lead a reviewer to the wrong repair.
--
-- The anti-drift guard is a test, not a comment: `referenceReadDemand.test.ts`
-- asserts that every refusal code the reader can produce has a column value to
-- land in, so adding a refusal without a migration reddens the suite instead of
-- writing a row that MySQL truncates to the empty string.
--
-- Future forms (hair by crop, eye colour by crop) add their own values by their
-- own migration. `intent` already carries the whole ruled vocabulary, because
-- the vocabulary is ruled even where the form is not built.
--
-- ============================================================================
-- PURELY ADDITIVE
-- ============================================================================
--
-- One new table. No column of any existing table changes. It lands ahead of its
-- writer for the standing reason — a new table is in every INSERT the moment
-- its writer ships, so there is no dark landing for one, and this program has
-- the scar that named that rule.
CREATE TABLE `casting_reference_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intent` enum('tattoo','hair','makeup','eyeColour') NOT NULL,
	`outcome` enum('delivered','no_transport','unreadable','no_makeup_visible','names_hair') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_reference_reads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_casting_reference_reads_intent` ON `casting_reference_reads` (`intent`,`outcome`);
--> statement-breakpoint
CREATE INDEX `idx_casting_reference_reads_created` ON `casting_reference_reads` (`createdAt`);
