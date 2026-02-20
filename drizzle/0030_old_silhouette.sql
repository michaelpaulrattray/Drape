CREATE TABLE `stripe_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`eventType` varchar(128) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_webhook_events_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_event_id` ON `stripe_webhook_events` (`eventId`);--> statement-breakpoint
CREATE INDEX `idx_webhook_processed_at` ON `stripe_webhook_events` (`processedAt`);