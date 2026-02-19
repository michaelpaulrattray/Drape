CREATE INDEX `idx_audit_severity_created` ON `audit_logs` (`severity`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_audit_user` ON `audit_logs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_credit_txn_user_ref` ON `point_transactions` (`userId`,`referenceId`);--> statement-breakpoint
CREATE INDEX `idx_credit_txn_user_created` ON `point_transactions` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_generations_user` ON `generations` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_generations_status` ON `generations` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_model_assets_model` ON `model_assets` (`modelId`);--> statement-breakpoint
CREATE INDEX `idx_models_user` ON `models` (`userId`,`status`);