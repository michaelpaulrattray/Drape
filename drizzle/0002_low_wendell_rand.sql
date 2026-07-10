CREATE TABLE `board_edges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`sourceItemId` int NOT NULL,
	`targetItemId` int NOT NULL,
	`relation` enum('iterated_from','vto_input_model','vto_input_garment','reference_for','variant_of','generated_from_cast','forked_from') NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `board_edges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `board_items` ADD `kind` enum('image','cast_config','wardrobe_config','note','frame','video');--> statement-breakpoint
ALTER TABLE `board_items` ADD `deletedAt` timestamp;--> statement-breakpoint
CREATE INDEX `idx_board_edges_source` ON `board_edges` (`sourceItemId`);--> statement-breakpoint
CREATE INDEX `idx_board_edges_target` ON `board_edges` (`targetItemId`);--> statement-breakpoint
CREATE INDEX `idx_board_edges_board` ON `board_edges` (`boardId`);--> statement-breakpoint
CREATE INDEX `idx_board_items_kind` ON `board_items` (`kind`);