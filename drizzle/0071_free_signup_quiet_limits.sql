-- THE TWO QUIET LIMITS BEHIND A CARDLESS FREE SIGNUP (#1603, P1-4, under the
-- pricing rung #1598).
--
-- ============================================================================
-- WHAT A CUSTOMER GETS, AND WHY THESE TWO TABLES EXIST AT ALL
-- ============================================================================
--
-- His ruling: a new account signs up with an email or a Google sign-in, gets a
-- free allowance, and is asked for NOTHING else — no card, no phone, no
-- captcha, and (verbatim) *"i dont think we need to add the water mark i hate
-- water marks"*. The limits *"run quietly in the background, so honest users
-- never notice them"*.
--
-- That allowance is real money: 13,500 ledger credits, which is 2,700 display
-- credits and eleven rolls. With nothing at all behind the signup, the grant is
-- the one thing in the product worth farming in bulk. These two tables are the
-- whole of what stands in the way, and neither is visible to anybody who is not
-- farming.
--
--   free_grant_claims      one row per free grant actually MADE, carrying the
--                          device it went to and the network it came from, so
--                          the (N+1)th from one of those inside the window can
--                          be refused.
--   face_scan_daily_usage  one row per account per UTC day, counting the face
--                          scans it has bought. A scan is fourteen segmenter
--                          calls at fal and the customer is never charged for
--                          it — `castingV2.faceScan`'s own words: *"a scan is
--                          house money on a read they never asked to pay for"*.
--
-- ============================================================================
-- WHY DURABLE, WHEN THE REPOSITORY ALREADY HAS A RATE LIMITER
-- ============================================================================
--
-- `server/security/rateLimit.ts` is a `Map` inside the process. This program
-- DEPLOYS ON EVERY MERGE TO `main`, several times a night, and a deploy
-- replaces the process. So a seven-day window held there is a seven-day window
-- in its name and a forty-minute one in fact.
--
-- The repository already carries one control that made that trade and stated
-- it: the site-wide login alarm's counter *"is in memory and resets on every
-- deploy, so it catches a fast, loud attack and would miss a slow, patient
-- one"*. That is honest where the window is minutes. It would be a hole here,
-- where the whole point is a window measured in days.
--
-- ============================================================================
-- WHY NOT DERIVED FROM `audit_logs`, WHICH WORKING LAW 4 WOULD ASK FOR
-- ============================================================================
--
-- Read at the schema rather than assumed: `audit_logs` carries `ipAddress` and
-- has NO device column, so half the question cannot be put to it. And it is a
-- staff reporting surface — a control whose population is owned by somebody
-- else's retention decision is a control that can be switched off by a tidy-up.
-- Law 4 forbids a MIRROR of a source of truth; it does not ask a control to
-- read a set that answers a different question.
--
-- ============================================================================
-- PURELY ADDITIVE
-- ============================================================================
--
-- Two new tables, their keys and two indexes. No column of any existing table
-- changes, no index moves, no row is rewritten, nothing is dropped. A
-- `CREATE TABLE` is a shape `scripts/lib/ceremonyAutoApply.mts` positively
-- recognises, so the rite applies it pre-deploy, before the new code takes
-- traffic — no reader ever meets an absent table and no ceremony reaches the
-- founder (#322).
--
-- Both tables start EMPTY on both worlds, and that is the correct starting
-- state rather than a gap: an account that signed up before this file has no
-- claim row, so it is counted against nobody, and no existing customer can be
-- refused by a cap over a window it has no history in.
CREATE TABLE `free_grant_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceKey` varchar(64) NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `free_grant_claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `face_scan_daily_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`day` varchar(10) NOT NULL,
	`scans` int NOT NULL DEFAULT 0,
	CONSTRAINT `face_scan_daily_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_face_scan_day` UNIQUE(`userId`,`day`)
);
--> statement-breakpoint
CREATE INDEX `idx_free_grant_claim_device` ON `free_grant_claims` (`deviceKey`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `idx_free_grant_claim_ip` ON `free_grant_claims` (`ipAddress`,`createdAt`);
