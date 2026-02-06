ALTER TABLE `change_requests` MODIFY COLUMN `type` enum('refund_credits','add_credits','flag_account','note_incident','suspend_user','unsuspend_user','block_ip','stripe_refund','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `change_requests` ADD `stripeSessionId` varchar(128);--> statement-breakpoint
ALTER TABLE `change_requests` ADD `refundType` enum('full','proportional');--> statement-breakpoint
ALTER TABLE `change_requests` ADD `refundAmountCents` int;--> statement-breakpoint
ALTER TABLE `change_requests` ADD `originalCredits` int;--> statement-breakpoint
ALTER TABLE `change_requests` ADD `creditsToDeduct` int;