CREATE TABLE `generations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`modelId` int,
	`type` enum('masterPrompt','castingImage','fullBody','multiView','iteration','upscale') NOT NULL,
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
	`agencyId` varchar(32) NOT NULL,
	`name` varchar(128),
	`masterPrompt` text NOT NULL,
	`technicalSchema` json NOT NULL,
	`preferences` json NOT NULL,
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `models_id` PRIMARY KEY(`id`),
	CONSTRAINT `models_agencyId_unique` UNIQUE(`agencyId`)
);
