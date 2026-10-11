-- CAMPAIGNS — a customer's named collections of signed casts. Rung N2c,
-- card #2249. Two new tables, nothing else.
--
-- ============================================================================
-- WHAT A CUSTOMER GETS
-- ============================================================================
--
-- Nothing yet, on purpose. This is the store the cast library's campaign
-- chips will read (later cards); until they ship no surface reads it, and the
-- product looks exactly as it did.
--
-- His word, 2026-09-29: "in n2c instead of calling them shoots call it
-- Campaign". The tables carry the same noun as the copy, so nobody has to
-- translate between the two.
--
-- ============================================================================
-- THE SHAPE (Approach A, locked)
-- ============================================================================
--
-- Many-to-many: a cast may sit in several campaigns at once. A single column
-- on `models` would be exclusive folders, which the design refuses.
--
-- `userId` is denormalised onto both tables so that every statement that
-- reads or writes a campaign or a membership carries the owner in its own
-- WHERE (enforcement invariants 1 and 2). No foreign-key constraints, as
-- everywhere else in this schema.
--
-- No `deletedAt`: a soft-deleted row would hold its name against the unique
-- (`userId`, `name`) forever. Deleting a campaign removes it and its member
-- rows; the casts themselves are never touched.
--
-- ============================================================================
-- ZERO BACKFILL
-- ============================================================================
--
-- No existing row is read or written. Every signed cast starts unfiled, which
-- is the truth: nobody has made a campaign yet.
--
-- PURELY ADDITIVE. Two CREATE TABLEs and two CREATE INDEXes on a table this
-- file creates, so `scripts/lib/ceremonyAutoApply.mts` recognises every statement
-- and no ceremony reaches the founder.
CREATE TABLE `cast_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cast_campaigns_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cast_campaigns_publicId` UNIQUE(`publicId`),
	CONSTRAINT `uq_cast_campaigns_user_name` UNIQUE(`userId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `cast_campaign_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`modelId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cast_campaign_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_cast_campaign_members_campaign_model` UNIQUE(`campaignId`,`modelId`)
);
--> statement-breakpoint
CREATE INDEX `ix_cast_campaign_members_user_model` ON `cast_campaign_members` (`userId`,`modelId`);
--> statement-breakpoint
CREATE INDEX `ix_cast_campaign_members_campaign` ON `cast_campaign_members` (`campaignId`);
