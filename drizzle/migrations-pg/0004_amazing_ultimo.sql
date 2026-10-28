CREATE TABLE "typewit_forwarding_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"mailbox_id" text NOT NULL,
	"state" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "typewit_forwarding_attempts" ADD CONSTRAINT "typewit_forwarding_attempts_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "typewit_forwarding_attempts_mailbox_idx" ON "typewit_forwarding_attempts" USING btree ("mailbox_id");