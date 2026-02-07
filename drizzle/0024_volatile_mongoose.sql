CREATE TABLE `change_request_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`changeRequestId` int,
	`filename` varchar(256) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`url` text NOT NULL,
	`mimeType` varchar(128) NOT NULL,
	`size` int NOT NULL,
	`uploadedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `change_request_attachments_id` PRIMARY KEY(`id`)
);
