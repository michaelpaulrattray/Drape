-- THE YEARLY RENEWAL REMINDER'S RECORD — one additive table (#1941, his word
-- 2026-10-08, verbatim: "on 1 and 2 go with your reccomendations").
--
-- ============================================================================
-- WHY A ROW AT ALL
-- ============================================================================
--
-- A yearly plan renews silently, and the card's requirement is that exactly
-- ONE reminder leaves the building per subscription per period. "Exactly one"
-- is a fact about the past, and nothing in the product records it today:
-- `points` holds the subscription's CURRENT period and is overwritten at every
-- renewal, so it can never answer "have we already written to this person
-- about this renewal".
--
-- ============================================================================
-- WHY THE PERIOD END IS IN THE KEY
-- ============================================================================
--
-- The unique index is (stripeSubscriptionId, periodEnd), not the subscription
-- alone. A subscription renews every year and every renewal earns its own
-- notice, so keying on the subscription would send one reminder ever. The
-- period end is the only identifier of a renewal that both sides agree on
-- BEFORE the invoice exists — Stripe has not minted an invoice id yet, which
-- is the whole point of a notice sent a month early.
--
-- It is taken from Stripe's own `current_period_end`, to the second, so two
-- sweeps on different days of the same window compute the same key. A period
-- end that MOVES (a plan change mid-period, a trial extension) therefore earns
-- a second notice, and that is the right answer rather than a hole: the date
-- and the amount the first notice stated are no longer true.
--
-- ============================================================================
-- WHY IT IS A CLAIM AND NOT A LOG
-- ============================================================================
--
-- The row is written BEFORE the send and deleted if the send fails — the
-- Stripe webhook replay guard's shape (`claimWebhookEvent`, #1361), for the
-- same reason: a SELECT-then-send is check-then-act, and two processes inside
-- one window would both pass it. The unique index is the arbiter, decided by
-- the database at the only moment two sweeps can be ordered.
--
-- `amountCents`, `currency` and `planTier` record what the customer was
-- actually TOLD, because a support question about a renewal notice is "what
-- did it say" and Stripe's upcoming-invoice preview will have moved on by
-- then.
--
-- ============================================================================
-- WHY `sentAt` IS DECLARED FIRST
-- ============================================================================
--
-- MySQL's `explicit_defaults_for_timestamp` is OFF under its own default, and
-- with it the FIRST `TIMESTAMP` column of a table that declares neither a
-- DEFAULT nor an ON UPDATE silently acquires
-- `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. `periodEnd` is half
-- the unique key, so a column that rewrites itself on any future UPDATE is the
-- last thing it may be. `sentAt` carries an explicit DEFAULT, so declaring it
-- first means no column here takes the implicit behaviour. Nothing updates
-- this table today; the point is that the first thing that does cannot break
-- the key.
CREATE TABLE `subscription_renewal_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`userId` int NOT NULL,
	`stripeSubscriptionId` varchar(64) NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`planTier` varchar(32) NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(8) NOT NULL,
	CONSTRAINT `subscription_renewal_reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_renewal_reminder_sub_period` UNIQUE(`stripeSubscriptionId`,`periodEnd`)
);
--> statement-breakpoint
CREATE INDEX `idx_renewal_reminder_user` ON `subscription_renewal_reminders` (`userId`);
