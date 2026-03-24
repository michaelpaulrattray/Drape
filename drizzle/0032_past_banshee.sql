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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wardrobe_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bug_reports` MODIFY COLUMN `category` enum('casting','wardrobe','export','billing','ui','other') NOT NULL DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `generations` MODIFY COLUMN `type` enum('masterPrompt','castingImage','fullBody','multiView','iteration','upscale','wardrobeVTO','wardrobeComposite','wardrobeRefinement','wardrobeDigitize') NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_wardrobe_garments_user` ON `wardrobe_garments` (`userId`,`slotType`);--> statement-breakpoint
CREATE INDEX `idx_wardrobe_outfits_user` ON `wardrobe_outfits` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_wardrobe_sessions_user` ON `wardrobe_sessions` (`userId`);