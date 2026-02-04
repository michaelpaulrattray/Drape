ALTER TABLE `points` ADD `stripeCustomerId` varchar(64);--> statement-breakpoint
ALTER TABLE `points` ADD `stripeSubscriptionId` varchar(64);--> statement-breakpoint
ALTER TABLE `points` ADD `subscriptionStatus` enum('active','canceled','past_due','unpaid','trialing');--> statement-breakpoint
ALTER TABLE `points` ADD `currentPeriodStart` timestamp;--> statement-breakpoint
ALTER TABLE `points` ADD `currentPeriodEnd` timestamp;