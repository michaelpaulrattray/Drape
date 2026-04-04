CREATE TABLE `board_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`type` enum('model','garment','vto_result','reference','iteration','note') NOT NULL,
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
CREATE INDEX `idx_board_items_board` ON `board_items` (`boardId`,`type`);--> statement-breakpoint
CREATE INDEX `idx_boards_user_status` ON `boards` (`userId`,`status`);