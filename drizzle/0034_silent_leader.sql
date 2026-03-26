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
CREATE INDEX `idx_wardrobe_looks_user` ON `wardrobe_looks` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_wardrobe_looks_model` ON `wardrobe_looks` (`modelId`);