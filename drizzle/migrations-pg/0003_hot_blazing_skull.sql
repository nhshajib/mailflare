CREATE TABLE "mailbox_address_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"domain_id" text NOT NULL,
	"local_part" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mailbox_address_claims" ADD CONSTRAINT "mailbox_address_claims_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mailbox_address_claims_address_idx" ON "mailbox_address_claims" USING btree ("domain_id","local_part");
--> statement-breakpoint
INSERT INTO mailbox_address_claims(id, domain_id, local_part) SELECT 'm:' || id, domain_id, lower(replace(split_part(local_part, '+', 1), '.', '')) FROM mailboxes;
--> statement-breakpoint
CREATE FUNCTION mailboxes_claim_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    DELETE FROM mailbox_address_claims WHERE id = 'm:' || OLD.id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    INSERT INTO mailbox_address_claims(id, domain_id, local_part)
      VALUES ('m:' || NEW.id, NEW.domain_id, lower(replace(split_part(NEW.local_part, '+', 1), '.', '')));
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER mailboxes_claim_write AFTER INSERT OR UPDATE OR DELETE ON mailboxes
FOR EACH ROW EXECUTE FUNCTION mailboxes_claim_write();
--> statement-breakpoint
INSERT INTO mailbox_address_claims(id, domain_id, local_part) SELECT 'a:' || id, domain_id, lower(replace(split_part(local_part, '+', 1), '.', '')) FROM mailbox_aliases;
--> statement-breakpoint
CREATE FUNCTION mailbox_aliases_claim_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    DELETE FROM mailbox_address_claims WHERE id = 'a:' || OLD.id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    INSERT INTO mailbox_address_claims(id, domain_id, local_part)
      VALUES ('a:' || NEW.id, NEW.domain_id, lower(replace(split_part(NEW.local_part, '+', 1), '.', '')));
    RETURN NEW;
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER mailbox_aliases_claim_write AFTER INSERT OR UPDATE OR DELETE ON mailbox_aliases
FOR EACH ROW EXECUTE FUNCTION mailbox_aliases_claim_write();
--> statement-breakpoint
