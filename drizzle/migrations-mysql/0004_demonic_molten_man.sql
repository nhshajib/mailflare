CREATE TABLE `typewit_forwarding_attempts` (
	`id` varchar(191) NOT NULL,
	`mailbox_id` varchar(191) NOT NULL,
	`state` varchar(64) NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `typewit_forwarding_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `typewit_forwarding_attempts` ADD CONSTRAINT `typewit_forwarding_attempts_mailbox_id_mailboxes_id_fk` FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `typewit_forwarding_attempts_mailbox_idx` ON `typewit_forwarding_attempts` (`mailbox_id`);