-- PLAN-CHANGE CREDIT SETTLEMENTS — one table, the queue between a Stripe
-- update succeeding and its money actually arriving (#711).
--
-- ============================================================================
-- THE DEFECT THIS CLOSES, IN MONEY TERMS
-- ============================================================================
--
-- `changePlan` moved credits the moment Stripe ACCEPTED the subscription
-- update — before the `always_invoice` charge settled. A subscriber whose
-- card declined at the exact moment they upgraded kept the upgrade's credits
-- with the invoice sitting unpaid: ×12 on an annual cycle, bounded only by
-- Stripe's retry schedule ending in auto-cancel (which claws nothing back).
-- The other direction was worse for the customer: an interval switch whose
-- invoice declined left them DEDUCTED their old cycle's unconsumed grant
-- with no new grant until retry or cancel.
--
-- ============================================================================
-- ONE ROW = ONE CHANGE INVOICE'S CREDIT MOVE, PENDING UNTIL THE MONEY SETTLES
-- ============================================================================
--
-- `changePlan` records the move here against the change's own invoice id,
-- then applies it immediately IF Stripe already reports the invoice paid
-- (a working card, and every zero-due downgrade invoice — the happy path
-- keeps its instant feel). Otherwise `invoice.payment_succeeded` applies it,
-- and a FINAL payment failure voids it. The unique invoice id plus the
-- credit ledger's own unique (userId, referenceId) index — keyed
-- `plan-change-settle:<invoiceId>` — is what lets the two appliers race
-- safely; this table is the queue and the record, never the arbiter.
-- `status` moves pending → applied | void and rows are never deleted.
--
-- Dev takes it now (applied directly with the change); production takes it
-- by the deploy rite (#322, #508): a `CREATE TABLE` is a shape
-- `scripts/lib/ceremonyAutoApply.mts` positively recognises, applied
-- pre-deploy, before the new code takes traffic — so no reader ever meets an
-- absent table and no ceremony reaches the founder.
--
-- PURELY ADDITIVE. One new table, its unique key and one index. No column of
-- any existing table changes, no index moves, no row is rewritten.
CREATE TABLE `plan_change_settlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`stripeInvoiceId` varchar(128) NOT NULL,
	`direction` enum('grant','unwind') NOT NULL,
	`credits` int NOT NULL,
	`description` text NOT NULL,
	`clientRequestId` varchar(64),
	`status` enum('pending','applied','void') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `plan_change_settlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_change_settlements_stripeInvoiceId_unique` UNIQUE(`stripeInvoiceId`)
);
--> statement-breakpoint
CREATE INDEX `idx_pcs_user` ON `plan_change_settlements` (`userId`);
