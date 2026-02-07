ALTER TABLE `referrals` ADD `referrerIp` varchar(45);--> statement-breakpoint
ALTER TABLE `referrals` ADD `referredIp` varchar(45);--> statement-breakpoint
ALTER TABLE `referrals` ADD `sameIpFlag` boolean DEFAULT false NOT NULL;