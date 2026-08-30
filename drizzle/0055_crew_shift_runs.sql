-- THE LIVE SHIFT ROW — what is running, while it runs (issue #272).
--
-- One row is: **one night-shift session**, opened at the moment it chooses its
-- brief and stamped terminal when it exits.
--
-- Founder, 2026-08-30, verbatim: *"if my shifts are running and i have no idea
-- what they are working on or doing thats dangerous"* — and, immediately
-- before, *"how was i meant to be aware of these 77 if i never asked you?"*
--
-- ============================================================================
-- ⚠ THIS TABLE OVERRIDES A STATED DESIGN PRINCIPLE OF ITS OWN NEIGHBOUR, AND
--    THAT IS DECLARED HERE RATHER THAN DISCOVERED LATER
-- ============================================================================
--
-- `0054_crew_replies.sql` — the table this one sits beside — rejected exactly
-- this shape in as many words:
--
--   "The mirror option — one database blob both sides write — fails the other
--    way. A night shift writing production rows outside deployed code is the
--    class of direct production change `CLAUDE.local.md` reserves for the
--    founder … So each writer keeps the road it already owns, and the page
--    merges them at read time."
--
-- That reasoning was correct for the BRIEFING, and the briefing keeps its road:
-- it is still a tracked JSON file, still deployed by the rite, still audited by
-- git. What #272 measured is that the road has a property the briefing cannot
-- shed — **it arrives on a DEPLOY, and a deploy happens at the END of a shift,
-- if at all.** So the page describes the previous session while the current one
-- edits his product. `crew-briefing.json`'s `shift` field naming the last shift
-- to write it, not the one that is running, is that defect in one field.
--
-- A live row cannot travel a road that needs a deploy. So this table takes the
-- one property the briefing road cannot give, and pays for it with a shift
-- write credential — narrowed as far as the shape allows:
--
--   * **This table only.** `scripts/crew-shift-start.mts` and
--     `scripts/crew-shift-close.mts` name no other table, issue no DDL, and
--     never DELETE. `server/crewShiftWriterBoundary.test.ts` reads their source
--     and reddens on a second table name, a DROP/ALTER/TRUNCATE, or a DELETE —
--     a positive control included, because a boundary test that cannot fail is
--     the thing it is guarding against.
--   * **His half stays untouchable.** `crew_replies` is unreachable from the
--     shift road exactly as before. That property was never about the shift
--     having no credential — `railway.cmd run --service MySQL` has been every
--     ceremony's road for months — it was about which tables the shift's own
--     tools can name, and that is what the boundary test pins.
--   * **It owns nothing that matters.** No user data, no bytes, no storage key,
--     no money, no credential. It is the team's own status board. The worst a
--     corrupted row can do is tell him the wrong thing about the team, which is
--     the failure mode he already has today and is the one being fixed.
--
-- ============================================================================
-- STALLED IS COMPUTED AT READ TIME, NEVER WRITTEN
-- ============================================================================
--
-- #272's bar: *"A shift that dies without stamping its row shows as stalled,
-- not as working."* A shift that dies cannot write "I died" — that is the whole
-- point — so no `status` column could ever be trusted to say it.
--
-- `heartbeatAt` therefore carries the last moment the shift PROVED it was
-- alive, and the reader derives the verdict: `endedAt` set ⇒ finished;
-- `endedAt` NULL and `heartbeatAt` inside the window ⇒ running; `endedAt` NULL
-- and `heartbeatAt` outside it ⇒ **stalled**. Working law 4 — the state is
-- derived from the timestamps, never mirrored into a column that can disagree
-- with them.
--
-- No heartbeat WRITER process is added, and that is deliberate twice over: a
-- new persistent process is a founder-announced act (`PROGRAM.md`), and the bar
-- he set is an HOUR — coarse enough that the shift's own natural updates
-- (start, close, and `--note` at any point between) carry it.
--
-- ============================================================================
-- `workKind` IS HERE AHEAD OF ITS CONSUMER, ON PURPOSE AND AT A PRICE
-- ============================================================================
--
-- #277 — his background-work switch, the very next card — needs to record what
-- mode a shift ran under, and the mode is a property of the RUN rather than of
-- the switch. Adding the column later costs him a second production ceremony;
-- adding it now costs one varchar. It is declared rather than quiet.
--
-- It earns its place in #272 alone regardless: *"Working now — #270 topbar and
-- rail"* and *"Working now — background: bug fixes"* are different sentences,
-- and the second is one he must be able to see at a glance.
--
-- ============================================================================
-- NO PURGE PATH, AND NO AUDIT ROW
-- ============================================================================
--
-- It owns no bytes. One row per shift, a handful a day; the table is the
-- permanent record of what the team did and stays small. An audit row would be
-- a second copy of a fact this row already holds (working law 4).
--
-- ============================================================================
-- IT LANDS AHEAD OF ITS PRODUCTION CEREMONY, BY DESIGN
-- ============================================================================
--
-- Dev takes it now; **production takes it by
-- `scripts/ceremony-crew-shift-runs.mts`, which is a founder act**
-- (`CLAUDE.local.md` reserves production-database migrations to him).
--
-- Until it runs, the reader DEGRADES rather than throwing: a missing table
-- returns "no runs" and the page says the row is unavailable. That is not
-- politeness — `crew.getState` is the ONE call the whole Crew tab makes, so a
-- reader that threw on an absent table would take his briefing, his replies and
-- his reply box down with it, to report that a status strip is missing. The
-- 2026-07-31 boot-guard incident is the law there.
--
-- PURELY ADDITIVE. One new table. No column of any existing table changes, no
-- index moves, no row is rewritten.
CREATE TABLE `crew_shift_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shift` varchar(64) NOT NULL,
	`seat` varchar(32) NOT NULL,
	`workKind` varchar(16) NOT NULL,
	`cardRef` varchar(64),
	`cardTitle` varchar(255),
	`intent` varchar(500) NOT NULL,
	`branch` varchar(255),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`heartbeatAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`outcome` varchar(16),
	`outcomeNote` varchar(500),
	`prNumber` int,
	CONSTRAINT `crew_shift_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_crew_shift_runs_started` ON `crew_shift_runs` (`startedAt`);
