CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(64) NOT NULL,
	`resourceType` varchar(32),
	`resourceId` varchar(64),
	`metadata` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE `point_transactions` MODIFY COLUMN `type` enum('generation','purchase','bonus','refund','signup','topup','subscription','admin_add','admin_deduct') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','moderator') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `suspendedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `suspendedReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `suspendedBy` int;--> statement-breakpoint
ALTER TABLE `users` ADD `failedLoginAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `lockedUntil` timestamp;