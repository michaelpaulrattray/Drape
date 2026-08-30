-- THE BACKGROUND-WORK SWITCH, AND THE COUNTS BESIDE IT (issue #277).
--
-- Founder-ordered 2026-08-30, verbatim:
--
--   "if the shifts have nothing to work on … it should have a toggle on the
--    crew page showing bug fixes etc that can run outside of the main work so
--    if i go to sleep i can toggle it on and the shifts will go ahead with bug
--    fixes an stuff when waiting on me to make decision on the main stuff"
--
-- ============================================================================
-- IT INVERTS TODAY'S DEFAULT, AND THAT IS THE POINT RATHER THAN A SIDE EFFECT
-- ============================================================================
--
-- MAINTENANCE MODE is currently the DEFAULT when no focus is confirmed
-- (`PROGRAM.md`, his law of 2026-08-25): with nothing named, shifts find
-- something on their own judgement. His order makes background work OPT-IN and
-- the switch HIS.
--
-- That is strictly stricter than what we have, and it guards a failure he named
-- himself: *"we need to ensure if they are waiting a long time for me they dont
-- completly over engineer security or anything because they are bored."* A
-- default-on maintenance mode is precisely the condition that produces it.
-- **Idle is a legitimate state for an autonomous team; inventing work is not.**
--
-- ============================================================================
-- TWO TABLES, BECAUSE THERE ARE TWO WRITERS — the Crew store's own law
-- ============================================================================
--
-- `0054_crew_replies.sql`: *the store is split by WHO WRITES*, and neither
-- writer can reach the other's road. #277 has two writers, so it gets two
-- tables and each has exactly one:
--
--   `crew_work_switches`  HE writes, through an `adminProcedure` with his
--                         session. Shifts READ it and may never write it —
--                         exactly the relationship they have with
--                         `crew_replies`.
--   `crew_queue_counts`   SHIFTS write it, mechanically, from the queue's own
--                         labels. He never writes it; the page reads it.
--
-- A switch a shift could write is not his switch. That is the whole reason
-- these are not one table with a `writtenBy` column.
--
-- ============================================================================
-- ONE ROW PER SWITCH, NOT ONE ROW OF COLUMNS
-- ============================================================================
--
-- The categories are `master`, `bugs`, `security`, `performance`,
-- `housekeeping`, `process`. As columns, a seventh category would be a
-- MIGRATION — which is a founder ceremony — for what is conceptually a new
-- label. As rows it is a row.
--
-- ⚠ **A MISSING ROW READS OFF, AND THAT IS THE SAFE DIRECTION BY CONSTRUCTION.**
-- His bar: *"A fresh install, a lost row, an unreadable value: OFF."* With one
-- row per switch, "off" is the ABSENCE of a row rather than a default anybody
-- can edit — so a truncated table, a failed ceremony or a half-written insert
-- all fail toward nothing running. There is no code path that can make the
-- unreadable case default to ON, because there is no default to get wrong.
--
-- ============================================================================
-- THE COUNTS ARE A DERIVED CACHE WITH ITS OWN TIMESTAMP, AND IT SAYS SO
-- ============================================================================
--
-- His card: *"THE COUNTS AND THE CATEGORIES ARE DERIVED FROM THE QUEUE'S OWN
-- LABELS — NEVER A SECOND LIST … A card relabelled in GitHub moves category on
-- his page without anyone touching the panel."*
--
-- The CATEGORIES are free — all five map to labels that already exist (`bug`,
-- `seat:warden`, `seat:machinist`, `seat:janitor`, `seat:retro`), so nothing
-- new is invented and a relabel moves a card between categories with no code.
--
-- The FRESHNESS is not free. Truly-live counts need the server to call the
-- GitHub API, which needs a repo-scoped token as a production environment
-- variable — a credential that can read this private repository, living in the
-- app's environment, plus an outbound dependency on his admin page. **That is a
-- founder-level security decision, not a shift's**, so it is named as the
-- upgrade rather than taken.
--
-- What lands instead: a shift writes the counts at start, derived MECHANICALLY
-- from the queue, and `countedAt` rides every row so the page can say
-- **"counted 14 min ago"** out loud. That does not break *never a second list* —
-- that law is about lists somebody AUTHORS (the standing-exceptions ranking
-- rotted because a person typed it), and no hand can edit these. What it is not
-- is INSTANT, and that word belongs on the panel rather than in this comment.
--
-- ============================================================================
-- NO PURGE PATH, NO AUDIT ROW
-- ============================================================================
--
-- Neither table owns bytes. `crew_work_switches` is at most six rows and
-- carries `changedByUserId` + `changedAt`, so the row IS the audit record — a
-- separate one would be a second copy of the same fact (working law 4).
-- `crew_queue_counts` is five rows, overwritten in place; its history is not
-- interesting and keeping one would be inventing a metric nobody asked for.
--
-- ============================================================================
-- BOTH LAND AHEAD OF THEIR PRODUCTION CEREMONY, IN ONE SCRIPT
-- ============================================================================
--
-- `scripts/ceremony-crew-work-switches.mts` creates BOTH, so this is ONE
-- command for him rather than two. Until it runs, the readers degrade the same
-- way #272's does — `available: false`, the panel says it is not live yet, and
-- `crew.getState` (the single call the whole Crew tab makes) does not throw.
--
-- PURELY ADDITIVE. Two new tables. No column of any existing table changes, no
-- index moves, no row is rewritten.
CREATE TABLE `crew_work_switches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`switchKey` varchar(32) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`changedByUserId` int NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crew_work_switches_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_crew_work_switches_key` UNIQUE(`switchKey`)
);
--> statement-breakpoint
CREATE TABLE `crew_queue_counts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`categoryKey` varchar(32) NOT NULL,
	`openCount` int NOT NULL,
	`countedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crew_queue_counts_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_crew_queue_counts_key` UNIQUE(`categoryKey`)
);
