-- Derived rows only: repair reservations whose source was removed by a foreign-key cascade.
DELETE FROM mailbox_address_claims WHERE
 (id LIKE 'm:%' AND NOT EXISTS (SELECT 1 FROM mailboxes WHERE mailboxes.id = substr(mailbox_address_claims.id, 3))) OR
 (id LIKE 'a:%' AND NOT EXISTS (SELECT 1 FROM mailbox_aliases WHERE mailbox_aliases.id = substr(mailbox_address_claims.id, 3)));

--> statement-breakpoint
CREATE FUNCTION mailboxes_claim_cascade_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM mailbox_address_claims WHERE id IN (SELECT 'a:' || id FROM mailbox_aliases WHERE mailbox_id = OLD.id);
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER mailboxes_claim_cascade_cleanup BEFORE DELETE ON mailboxes FOR EACH ROW EXECUTE FUNCTION mailboxes_claim_cascade_cleanup();

--> statement-breakpoint
CREATE FUNCTION users_claim_cascade_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM mailbox_address_claims WHERE id IN (SELECT 'm:' || id FROM mailboxes WHERE user_id = OLD.id) OR id IN (SELECT 'a:' || mailbox_aliases.id FROM mailbox_aliases INNER JOIN mailboxes ON mailboxes.id = mailbox_aliases.mailbox_id WHERE mailboxes.user_id = OLD.id);
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_claim_cascade_cleanup BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION users_claim_cascade_cleanup();
