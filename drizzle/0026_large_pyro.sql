CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`type` enum('info','warning','maintenance','feature') NOT NULL DEFAULT 'info',
	`isActive` boolean NOT NULL DEFAULT false,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
