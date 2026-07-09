CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`type` enum('info','warning','maintenance','feature') NOT NULL DEFAULT 'info',
	`isActive` boolean NOT NULL DEFAULT false,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(64) NOT NULL,
	`resourceType` varchar(32),
	`resourceId` varchar(64),
	`metadata` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blocked_ips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`reason` text NOT NULL,
	`blockedBy` int NOT NULL,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocked_ips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `board_item_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemId` int NOT NULL,
	`version` int NOT NULL,
	`imageUrl` text NOT NULL,
	`prompt` text,
	`tool` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `board_item_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `board_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`type` enum('model','garment','vto_result','reference','iteration','note','frame') NOT NULL,
	`label` varchar(256),
	`imageUrl` text,
	`imageKey` varchar(256),
	`positionX` int NOT NULL DEFAULT 0,
	`positionY` int NOT NULL DEFAULT 0,
	`width` int NOT NULL DEFAULT 280,
	`height` int NOT NULL DEFAULT 280,
	`zIndex` int NOT NULL DEFAULT 0,
	`parentItemId` int,
	`sourceModelId` int,
	`sourceGarmentId` int,
	`sourceSessionId` int,
	`sourceLookId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `board_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL DEFAULT 'Untitled Board',
	`description` text,
	`thumbnailUrl` text,
	`thumbnailKey` varchar(256),
	`startedWith` enum('casting','wardrobe') NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`viewportX` int DEFAULT 0,
	`viewportY` int DEFAULT 0,
	`viewportZoom` int DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `boards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bug_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`description` text NOT NULL,
	`category` enum('casting','wardrobe','export','billing','ui','other','feedback') NOT NULL DEFAULT 'other',
	`page` varchar(256),
	`modelId` int,
	`userAgent` varchar(512),
	`viewport` varchar(32),
	`status` enum('new','reviewing','resolved','dismissed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bug_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `change_request_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`changeRequestId` int,
	`filename` varchar(256) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`url` text NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`size` int NOT NULL,
	`uploadedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `change_request_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `change_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('refund_credits','add_credits','flag_account','note_incident','suspend_user','unsuspend_user','block_ip','stripe_refund','other') NOT NULL,
	`status` enum('pending','approved','denied','cancelled','expired','pending_execution') NOT NULL DEFAULT 'pending',
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`submittedById` int NOT NULL,
	`submittedByName` varchar(256),
	`targetUserId` int NOT NULL,
	`targetUserName` varchar(256),
	`title` varchar(512) NOT NULL,
	`description` text NOT NULL,
	`evidenceSummary` text,
	`relatedAuditLogId` int,
	`creditAmount` int,
	`creditReason` varchar(512),
	`ipAddress` varchar(45),
	`stripeSessionId` varchar(128),
	`refundType` enum('full','proportional'),
	`refundAmountCents` int,
	`originalCredits` int,
	`creditsToDeduct` int,
	`reviewedById` int,
	`reviewedByName` varchar(256),
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`slackApprovalId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `change_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`type` enum('generation','purchase','bonus','refund','signup','topup','subscription','admin_add','admin_deduct') NOT NULL,
	`description` text,
	`referenceId` varchar(64),
	`balanceAfter` int NOT NULL,
	`engineUsed` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 5000,
	`planTier` enum('free','starter','pro','studio','studio_plus','business','business_plus','scale','scale_plus','enterprise','enterprise_plus','ultimate') NOT NULL DEFAULT 'free',
	`planExpiresAt` timestamp,
	`stripeCustomerId` varchar(64),
	`stripeSubscriptionId` varchar(64),
	`subscriptionStatus` enum('active','canceled','past_due','unpaid','trialing'),
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`creditsPurchased` int NOT NULL DEFAULT 0,
	`creditsUsed` int NOT NULL DEFAULT 0,
	`rolloverCredits` int NOT NULL DEFAULT 0,
	`lastRefreshAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `points_id` PRIMARY KEY(`id`),
	CONSTRAINT `points_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `emergency_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`action` enum('block_ip','suspend_user') NOT NULL,
	`targetId` varchar(128) NOT NULL,
	`metadata` json,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`usedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emergency_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `emergency_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`modelId` int,
	`type` enum('masterPrompt','castingImage','fullBody','multiView','iteration','upscale','wardrobeVTO','wardrobeComposite','wardrobeRefinement','wardrobeDigitize') NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`pointsCost` int NOT NULL,
	`resultUrl` text,
	`errorMessage` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `generations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(64) NOT NULL,
	`createdBy` int NOT NULL,
	`maxUses` int NOT NULL DEFAULT 1,
	`currentUses` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invite_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `invite_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `model_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelId` int NOT NULL,
	`viewType` enum('frontClose','frontFull','sideClose','sideFull','backFull') NOT NULL,
	`resolution` enum('1K','2K','4K') NOT NULL DEFAULT '1K',
	`storageUrl` text NOT NULL,
	`storageKey` varchar(256),
	`pointsCost` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agencyId` varchar(32),
	`name` varchar(128),
	`masterPrompt` text NOT NULL,
	`technicalSchema` json NOT NULL,
	`preferences` json NOT NULL,
	`status` enum('draft','active','locked','archived') NOT NULL DEFAULT 'draft',
	`mintedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `models_id` PRIMARY KEY(`id`),
	CONSTRAINT `models_agencyId_unique` UNIQUE(`agencyId`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerUserId` int NOT NULL,
	`referredUserId` int,
	`referredEmail` varchar(320),
	`status` enum('pending','signed_up','completed','subscribed','expired') NOT NULL DEFAULT 'pending',
	`referrerCredited` boolean NOT NULL DEFAULT false,
	`referredCredited` boolean NOT NULL DEFAULT false,
	`creditsAwarded` int NOT NULL DEFAULT 0,
	`referrerIp` varchar(45),
	`referredIp` varchar(45),
	`sameIpFlag` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_webhook_events_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`displayName` varchar(128),
	`email` varchar(320),
	`avatarUrl` text,
	`avatarKey` varchar(256),
	`bannerUrl` text,
	`bannerKey` varchar(256),
	`bio` text,
	`loginMethod` varchar(64),
	`role` enum('user','admin','moderator') NOT NULL DEFAULT 'user',
	`storageUsed` int NOT NULL DEFAULT 0,
	`storageLimit` int NOT NULL DEFAULT 104857600,
	`suspendedAt` timestamp,
	`suspendedReason` text,
	`suspendedBy` int,
	`frozenAt` timestamp,
	`frozenReason` text,
	`frozenBy` varchar(64),
	`referralCode` varchar(16),
	`referredByUserId` int,
	`approved` boolean NOT NULL DEFAULT false,
	`accessCode` varchar(64),
	`approvedAt` timestamp,
	`passwordHash` text,
	`authProvider` varchar(32) DEFAULT 'manus_legacy',
	`emailVerified` boolean NOT NULL DEFAULT false,
	`emailVerificationToken` varchar(128),
	`emailVerificationExpiresAt` timestamp,
	`failedLoginAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
	CONSTRAINT `users_referralCode_unique` UNIQUE(`referralCode`)
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` text,
	`company` text,
	`role` varchar(128),
	`source` varchar(64),
	`referralCode` varchar(32),
	`notified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `waitlist_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `wardrobe_garments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`slotType` enum('full_look','tops','bottoms','shoes','accessories') NOT NULL,
	`shortName` varchar(128),
	`description` text,
	`tags` json,
	`suggestedActions` json,
	`originalImageUrl` text NOT NULL,
	`originalImageKey` varchar(256),
	`isolatedImageUrl` text,
	`isolatedImageKey` varchar(256),
	`sourceImageUrl` text,
	`sourceImageKey` varchar(256),
	`qualityIssues` json,
	`detectedItems` json,
	`status` enum('processing','ready','failed') NOT NULL DEFAULT 'processing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wardrobe_garments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wardrobe_looks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionId` int,
	`modelId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`name` varchar(100),
	`garmentIds` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wardrobe_looks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wardrobe_outfits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`garmentIds` json NOT NULL,
	`styleNotes` json,
	`resultThumbUrl` text,
	`resultThumbKey` varchar(256),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wardrobe_outfits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wardrobe_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`modelId` int,
	`modelImageUrl` text NOT NULL,
	`history` json,
	`historyIndex` int DEFAULT 0,
	`activeGarmentIds` json,
	`tattooMapData` json,
	`styleNotes` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wardrobe_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_audit_severity_created` ON `audit_logs` (`severity`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `audit_logs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_biv_item` ON `board_item_versions` (`itemId`,`version`);--> statement-breakpoint
CREATE INDEX `idx_board_items_board` ON `board_items` (`boardId`,`type`);--> statement-breakpoint
CREATE INDEX `idx_boards_user_status` ON `boards` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_bug_reports_user` ON `bug_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_bug_reports_status` ON `bug_reports` (`status`);--> statement-breakpoint
CREATE INDEX `idx_credit_txn_user_ref` ON `point_transactions` (`userId`,`referenceId`);--> statement-breakpoint
CREATE INDEX `idx_credit_txn_user_created` ON `point_transactions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_generations_user` ON `generations` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_generations_status` ON `generations` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_model_assets_model` ON `model_assets` (`modelId`);--> statement-breakpoint
CREATE INDEX `idx_models_user` ON `models` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `idx_webhook_event_id` ON `stripe_webhook_events` (`eventId`);--> statement-breakpoint
CREATE INDEX `idx_webhook_processed_at` ON `stripe_webhook_events` (`processedAt`);--> statement-breakpoint
CREATE INDEX `idx_wardrobe_garments_user` ON `wardrobe_garments` (`userId`,`slotType`);--> statement-breakpoint
CREATE INDEX `idx_wardrobe_looks_user` ON `wardrobe_looks` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_wardrobe_looks_model` ON `wardrobe_looks` (`modelId`);--> statement-breakpoint
CREATE INDEX `idx_wardrobe_outfits_user` ON `wardrobe_outfits` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_wardrobe_sessions_user` ON `wardrobe_sessions` (`userId`);