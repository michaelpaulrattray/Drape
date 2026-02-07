CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerUserId` int NOT NULL,
	`referredUserId` int,
	`referredEmail` varchar(320),
	`status` enum('pending','signed_up','completed','expired') NOT NULL DEFAULT 'pending',
	`referrerCredited` boolean NOT NULL DEFAULT false,
	`referredCredited` boolean NOT NULL DEFAULT false,
	`creditsAwarded` int NOT NULL DEFAULT 0,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `referralCode` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD `referredByUserId` int;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_referralCode_unique` UNIQUE(`referralCode`);