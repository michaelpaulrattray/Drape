CREATE TABLE `blocked_ips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`reason` text NOT NULL,
	`blockedBy` int NOT NULL,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocked_ips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emergency_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(64) NOT NULL,
	`action` enum('block_ip','suspend_user') NOT NULL,
	`targetId` varchar(128) NOT NULL,
	`metadata` json,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`usedBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emergency_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `emergency_tokens_token_unique` UNIQUE(`token`)
);
