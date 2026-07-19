DROP INDEX `idx_credit_txn_user_ref` ON `point_transactions`;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD CONSTRAINT `uq_point_txn_user_ref` UNIQUE(`userId`,`referenceId`);