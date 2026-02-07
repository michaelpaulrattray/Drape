ALTER TABLE `users` ADD `frozenAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `frozenReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `frozenBy` varchar(64);