-- THE RECORD OF WHAT SHE ASKED FITS WHAT SHE IS ALLOWED TO ASK (issue #1126,
-- his reply on the Desk card `refine-record-width-1126`, 2026-09-25: "a").
--
-- `casting_candidate_variants.requestText` held 220 characters while an
-- answer to a clarifying question may carry 309 (`REFINE_ANSWERING_MAX_LENGTH`)
-- and the studio composes her sentence plus its own clause on top of that, so
-- on a long ask something was ALWAYS thrown away. PR #1186 made the loss the
-- better one (her last words rather than our clause, cut at a word boundary);
-- this makes it no loss at all.
--
-- PURELY ADDITIVE: a WIDENING of one varchar. No row is rewritten, no value
-- can be truncated by growing its column, nothing is dropped. It is a
-- ceremony rather than the rite's automatic act only because `MODIFY COLUMN`
-- is refused by `ceremonyAutoApply.mts` on purpose — the classifier cannot tell
-- a widening from a narrowing and getting that wrong deletes data — so a person
-- runs it, naming the world. Read at the rows the day it ran: the table held
-- ZERO variant rows on production, so the alter was instant.
ALTER TABLE `casting_candidate_variants`
	MODIFY COLUMN `requestText` varchar(400);
