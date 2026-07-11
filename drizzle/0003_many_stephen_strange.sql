ALTER TABLE `model_assets` MODIFY COLUMN `viewType` enum('frontClose','threeQuarter','frontFull','sideClose','sideFull','backFull') NOT NULL;--> statement-breakpoint
ALTER TABLE `model_assets` ADD `pinned` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `model_assets` ADD `status` json;--> statement-breakpoint
ALTER TABLE `model_assets` ADD `provenance` json;