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
