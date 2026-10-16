-- ONE CURRENT DESCRIPTION PER VERSION — card #2565 slice 1 (#2545 folded in;
-- his word 2026-10-16, verbatim: "okay cool im happy with the build").
--
-- Every paid refine renders from the cast's untouched original. What carries
-- the edits already made is one natural description of the cast as they are
-- now — "it must read naturally into the description not as an edit list" —
-- rewritten after each edit lands, stored on the version, and read back by the
-- next refine of that version and by a Follow of it.
--
-- PURELY ADDITIVE: one nullable column on an existing table. No row is read,
-- rewritten or backfilled; every existing version reads NULL, which is the
-- honest "no description was written for this version" and is exactly what the
-- code does with the flag off. Nothing is dropped, renamed or narrowed.
--
-- SENSITIVITY: derived from the customer's brief and asks, so the recipe's
-- family — owner-only, in no staff projection, never logged, on REFUSING_KEYS.
-- It lives on `casting_candidate_variants`, whose rows both deletion roads
-- already delete, so no deletion path needs a new statement.
ALTER TABLE `casting_candidate_variants`
	ADD COLUMN `currentDescription` text;
