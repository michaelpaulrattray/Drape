CREATE TABLE `waitlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` text,
	`company` text,
	`role` varchar(128),
	`source` varchar(64),
	`referralCode` varchar(32),
	`notified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `waitlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `waitlist_email_unique` UNIQUE(`email`)
);
