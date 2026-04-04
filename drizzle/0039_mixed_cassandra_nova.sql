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
CREATE INDEX `idx_biv_item` ON `board_item_versions` (`itemId`,`version`);