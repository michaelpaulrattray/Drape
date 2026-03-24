CREATE TABLE `bug_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`description` text NOT NULL,
	`category` enum('casting','export','billing','ui','other') NOT NULL DEFAULT 'other',
	`page` varchar(256),
	`modelId` int,
	`userAgent` varchar(512),
	`viewport` varchar(32),
	`status` enum('new','reviewing','resolved','dismissed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bug_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_bug_reports_user` ON `bug_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_bug_reports_status` ON `bug_reports` (`status`);