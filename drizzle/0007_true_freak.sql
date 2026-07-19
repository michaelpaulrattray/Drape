CREATE TABLE `generation_operation_locks` (
	`lockKey` varchar(96) NOT NULL,
	`operationId` varchar(36) NOT NULL,
	`kind` varchar(48) NOT NULL,
	`acquiredAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `generation_operation_locks_lockKey` PRIMARY KEY(`lockKey`),
	CONSTRAINT `uq_generation_operation_locks_operation` UNIQUE(`operationId`)
);
--> statement-breakpoint
CREATE TABLE `generation_operations` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`clientRequestId` varchar(36) NOT NULL,
	`kind` varchar(48) NOT NULL,
	`modelId` int,
	`originBoardId` int,
	`originItemId` int,
	`payloadHash` varchar(64) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'claimed',
	`expectedIdentityRevisionId` varchar(64),
	`plannedCredits` int NOT NULL DEFAULT 0,
	`chargedCredits` int NOT NULL DEFAULT 0,
	`refundedCredits` int NOT NULL DEFAULT 0,
	`chargeReferenceId` varchar(64),
	`result` json,
	`errorCode` varchar(32),
	`publicMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `generation_operations_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_generation_ops_user_request` UNIQUE(`userId`,`clientRequestId`),
	CONSTRAINT `uq_generation_ops_charge_ref` UNIQUE(`chargeReferenceId`)
);
--> statement-breakpoint
CREATE INDEX `idx_generation_ops_model_status_created` ON `generation_operations` (`modelId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_generation_ops_user_created` ON `generation_operations` (`userId`,`createdAt`);