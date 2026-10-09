-- YEARLY PLANS ARE GIVEN THEIR CREDITS MONTH BY MONTH — nine additive columns
-- (#2152, his ruling on #2159, 2026-10-10, verbatim: "yearly credits apply
-- month by month it on the new notion card"). The Desk item's rollover rules
-- now read: "Yearly credits are granted month by month, not all 12 months up
-- front. The one-month rollover cap applies the same way on every plan, and
-- there's no separate yearly cap."
--
-- ============================================================================
-- WHAT EACH COLUMN IS FOR
-- ============================================================================
--
-- On `points` — the paid year a monthly grant belongs to, written ONLY by the
-- paid annual invoice (server/stripe/webhooks.ts), in the same compare-and-set
-- write that lands the year's first month:
--
--   annualGrantSubscriptionId  the subscription that paid for the year
--   annualGrantPeriodStart     when the paid year began (the invoice line's own)
--   annualGrantPeriodEnd       when it ends
--   annualGrantInvoiceId       the paid invoice that opened the year — so a
--                              LOST dispute clears the year only when it is
--                              over THAT invoice, never over a top-up
--   annualGrantMonthlyCredits  one month's allowance in ledger credits — the
--                              plan's base plus the dial's steps read off that
--                              invoice; raised mid-year only by an upgrade's
--                              settlement, when its money settles
--
-- The monthly grant worker (server/billing/annualMonthlyGrant.ts) reads these
-- and grants months 1..11 of the year at their boundaries. How many months
-- have been granted is NOT stored: it is read off the ledger, whose reference
-- `annual-month:<subscription>:<periodStart>:<month>` is unique per account,
-- so a re-run or a crash can never grant a month twice. A monthly invoice, a
-- cancellation, and the move to Free all clear the four columns.
--
-- On `plan_change_settlements` — `annualMonthlyCredits`, the new month's
-- allowance an instant upgrade on a yearly plan installs on the year when its
-- invoice is paid, and `annualPeriodStart`, WHICH year it was bought for: the
-- install is conditioned on that year still being the one on the row, so an
-- upgrade invoice paid late (after the next year's invoice, a switch or a
-- cancel) can never write its month onto a different year. NULL on every
-- other settlement. Beside them, on every settlement, the paid state the
-- change left: `previousPlanTier` (a failed UPGRADE puts the record back on
-- it) and `previousPeriodEnd` (a failed interval SWITCH's 30-day deadline
-- runs from it — the switch anchored a new period at the moment of the
-- change, so the failed invoice cannot state where the paid one ended).
--
-- ============================================================================
-- NULL — AND WHAT THAT MEANS FOR THE ROWS THAT EXIST
-- ============================================================================
--
-- Every existing row gets NULL. Production was read on 2026-10-09 (card #2152)
-- and holds 0 paid subscribers and none on a yearly plan, so no year is in
-- flight and nothing migrates. A yearly subscription granted 12 months up
-- front before this change (dev only) has NULL here and keeps exactly what it
-- was given: the worker grants nothing to it, and its next yearly invoice
-- starts the monthly road.
--
-- `ALTER TABLE … ADD COLUMN` is one of the shapes
-- `scripts/lib/ceremonyAutoApply.mts` recognises, so the deploy rite applies
-- these before the new code takes traffic and no ceremony reaches the founder.
--
-- PURELY ADDITIVE. Nine nullable columns. No row is rewritten, no index moves,
-- no existing column changes.
ALTER TABLE `points` ADD COLUMN `annualGrantSubscriptionId` varchar(64) NULL;
--> statement-breakpoint
ALTER TABLE `points` ADD COLUMN `annualGrantPeriodStart` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `points` ADD COLUMN `annualGrantPeriodEnd` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `points` ADD COLUMN `annualGrantMonthlyCredits` int NULL;
--> statement-breakpoint
ALTER TABLE `plan_change_settlements` ADD COLUMN `annualMonthlyCredits` int NULL;
--> statement-breakpoint
ALTER TABLE `plan_change_settlements` ADD COLUMN `annualPeriodStart` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `points` ADD COLUMN `annualGrantInvoiceId` varchar(128) NULL;
--> statement-breakpoint
ALTER TABLE `plan_change_settlements` ADD COLUMN `previousPlanTier` varchar(32) NULL;
--> statement-breakpoint
ALTER TABLE `plan_change_settlements` ADD COLUMN `previousPeriodEnd` timestamp NULL;
