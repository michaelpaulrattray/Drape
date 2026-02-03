ALTER TABLE `users` ADD `displayName` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarKey` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `bannerUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bannerKey` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `storageUsed` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `storageLimit` int DEFAULT 104857600 NOT NULL;