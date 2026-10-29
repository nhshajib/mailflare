CREATE TABLE "typewit_accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"state" text DEFAULT 'provisioning' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "typewit_forwarding" (
	"mailbox_id" text PRIMARY KEY NOT NULL,
	"destination" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"verified_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "typewit_accounts" ADD CONSTRAINT "typewit_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "typewit_forwarding" ADD CONSTRAINT "typewit_forwarding_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;