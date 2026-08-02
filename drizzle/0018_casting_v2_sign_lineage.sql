ALTER TABLE `casting_candidates` ADD `expiredReason` enum('cancelled_unseen','retention');--> statement-breakpoint
ALTER TABLE `models` ADD `cohortKey` varchar(48);--> statement-breakpoint
ALTER TABLE `models` ADD `styleKey` varchar(48);--> statement-breakpoint
ALTER TABLE `models` ADD `sourceCandidateId` int;--> statement-breakpoint
ALTER TABLE `models` ADD `sourceRollId` int;