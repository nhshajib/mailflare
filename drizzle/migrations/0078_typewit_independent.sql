-- Additive TypeWit state. Existing SQLite snapshot predates hand-written migrations;
-- do not regenerate the historical schema or drop existing tables.
CREATE TABLE `typewit_accounts` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `state` text DEFAULT 'provisioning' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `typewit_forwarding` (
  `mailbox_id` text PRIMARY KEY NOT NULL REFERENCES `mailboxes`(`id`) ON DELETE cascade,
  `destination` text NOT NULL,
  `enabled` integer DEFAULT false NOT NULL,
  `verified_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
