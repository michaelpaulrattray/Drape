ALTER TABLE `users` ADD `approved` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `accessCode` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `approvedAt` timestamp;