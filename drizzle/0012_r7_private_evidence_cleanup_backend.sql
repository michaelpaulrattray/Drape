ALTER TABLE `storage_cleanup_items` ADD `storageBackend` enum('public_r2','private_evidence_r2') DEFAULT 'public_r2' NOT NULL;--> statement-breakpoint
ALTER TABLE `storage_cleanup_items`
	DROP INDEX `uq_storage_cleanup_items_batch_key`,
	ADD CONSTRAINT `uq_storage_cleanup_items_batch_key` UNIQUE(`batchId`,`storageBackend`,`storageKey`);
