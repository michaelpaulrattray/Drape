-- HIS "NOT RELEVANT" TAP — the intent, recorded (issue #325, second half).
--
-- One row is: **one card he has said something about from his own page**, and
-- what a shift did about it afterwards.
--
-- Founder, 2026-08-31, verbatim: *"should there be a delete icon next to them
-- so i can close them or remove them myself if they are not relevant?"* — then
-- **"yes"** to the shape below.
--
-- ============================================================================
-- ⚠ THE THING THIS TABLE EXISTS TO AVOID IS A REPO WRITE TOKEN IN PRODUCTION
-- ============================================================================
--
-- Closing the card from the server needs a credential with **write** access to
-- the repository, living in the deployed service. #285 already declined a READ
-- token on the same page for a smaller benefit, and the reasoning there was
-- about exposure rather than convenience — this one can CHANGE things.
--
-- So the road is the one his switches already take: the page records what he
-- wants in his own table, and a shift acts on it. That is one hop slower and it
-- buys a second pair of eyes before a card disappears, which is not a
-- consolation — he found four already-finished cards himself on 2026-08-30 by
-- reading them.
--
-- ============================================================================
-- TWO WRITERS, ONE TABLE, AND THE SPLIT IS BY COLUMN
-- ============================================================================
--
-- `crew_replies` is his and `crew_queue_counts` is the shifts'; this table is
-- BOTH, which is new here and is the reason the split is written down rather
-- than remembered:
--
--   * **HIS half** — `intent`, `markedByUserId`, `markedAt`, `withdrawnAt`.
--     Written only by `crew.setCardIntent` from a session id (invariant 3).
--     No shift tool may write these.
--   * **THE SHIFTS' half** — `resolution`, `resolutionNote`, `resolvedAt`.
--     Written only by `scripts/crew-card-intents.mts --resolve`. The server has
--     no procedure that sets them.
--
-- `server/crewShiftWriterBoundary.test.ts` reads both roads' bytes and reddens
-- if either crosses, with positive controls — a boundary in a docblock is a
-- promise, not a control (invariant 7).
--
-- ============================================================================
-- NOTHING ON THIS ROAD DELETES A ROW
-- ============================================================================
--
-- His card's rule for cards — *"CLOSE, never DELETE. Closed is recoverable,
-- keeps the history"* — is applied to the intent itself. Taking a tap back sets
-- `withdrawnAt`; it does not remove the row. So there is no DELETE in the
-- mutation and none in the shift tool, and a tap he took back is still a thing
-- he once said about that card.
--
-- `withdrawnAt` also settles a real race in the only safe direction: a shift
-- that reads the pending list, then finds the row withdrawn when it comes to
-- resolve it, must not close a card he decided to keep. Pending is
-- `withdrawnAt IS NULL AND resolution IS NULL`, asked at the moment of the
-- write.
--
-- ============================================================================
-- `issueNumber` IS UNIQUE, AND THAT IS THE WHOLE CONCURRENCY DESIGN
-- ============================================================================
--
-- One live intent per card. The tap is an upsert on this key, so tapping twice
-- cannot produce two rows saying different things about one card and leave the
-- reader to pick — the same reason `crew_queue_counts.categoryKey` is unique.
--
-- ⚠ It is an issue NUMBER and nothing is joined on it. The queue lives in
-- GitHub, this database has no cards table, and a foreign key to a system this
-- service cannot see is not available at any price. What that costs is a row
-- for a card that does not exist, which the shift tool reports rather than
-- acting on.
--
-- ============================================================================
-- IT LANDS AHEAD OF ITS PRODUCTION CEREMONY, BY DESIGN
-- ============================================================================
--
-- Dev takes it now; production takes it by
-- `scripts/ceremony-crew-card-intents.mts` OR, since #322 shipped
-- (2026-09-01), by the deploy rite itself — it applies an additive migration
-- the code declares before it deploys, and this table is the first thing it
-- ever applied. Only a DESTRUCTIVE statement is still the founder's.
--
-- Until it runs the reader DEGRADES rather than throwing — `crew.getState` is
-- the ONE call his whole Crew tab makes, so a reader that threw on an absent
-- table would take his briefing, his replies and his reply box down with it to
-- report that a tap is unavailable. The 2026-07-31 boot-guard incident is the
-- law there. What he sees meanwhile is exactly the panel he has today, with no
-- tap on it.
--
-- PURELY ADDITIVE. One new table. No column of any existing table changes, no
-- index moves, no row is rewritten.
CREATE TABLE `crew_card_intents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`issueNumber` int NOT NULL,
	`intent` varchar(16) NOT NULL,
	`markedByUserId` int NOT NULL,
	`markedAt` timestamp NOT NULL DEFAULT (now()),
	`withdrawnAt` timestamp,
	`resolution` varchar(16),
	`resolutionNote` varchar(500),
	`resolvedAt` timestamp,
	CONSTRAINT `crew_card_intents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_crew_card_intents_issue` ON `crew_card_intents` (`issueNumber`);
