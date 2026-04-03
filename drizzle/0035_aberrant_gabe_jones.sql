ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `authProvider` varchar(32) DEFAULT 'manus_legacy';