ALTER TABLE `casting_candidate_variants` ADD `outcome` enum('selected','backed_up','rephrased','corrected');--> statement-breakpoint
ALTER TABLE `casting_candidate_variants` ADD `outcomeAt` timestamp;