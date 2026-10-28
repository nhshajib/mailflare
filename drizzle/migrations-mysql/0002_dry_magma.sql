CREATE TABLE `typewit_accounts` (
	`user_id` varchar(191) NOT NULL,
	`state` varchar(64) NOT NULL DEFAULT 'provisioning',
	CONSTRAINT `typewit_accounts_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `typewit_forwarding` (
	`mailbox_id` varchar(191) NOT NULL,
	`destination` longtext NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`verified_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `typewit_forwarding_mailbox_id` PRIMARY KEY(`mailbox_id`)
);
--> statement-breakpoint
ALTER TABLE `typewit_accounts` ADD CONSTRAINT `typewit_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `typewit_forwarding` ADD CONSTRAINT `typewit_forwarding_mailbox_id_mailboxes_id_fk` FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON DELETE cascade ON UPDATE no action;