-- Shared, derived address ledger. Existing normalized collisions deliberately fail
-- migration; resolve them through a reviewed plan before applying this release.
CREATE TABLE mailbox_address_claims (
  id text PRIMARY KEY NOT NULL,
  domain_id text NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  local_part text NOT NULL
);
CREATE UNIQUE INDEX mailbox_address_claims_address_idx ON mailbox_address_claims(domain_id, local_part);
INSERT INTO mailbox_address_claims(id, domain_id, local_part) SELECT 'm:' || id, domain_id, lower(replace(substr(local_part, 1, instr(local_part || '+', '+') - 1), '.', '')) FROM mailboxes;
CREATE TRIGGER mailboxes_claim_insert AFTER INSERT ON mailboxes BEGIN
  INSERT INTO mailbox_address_claims(id, domain_id, local_part) VALUES ('m:' || NEW.id, NEW.domain_id, lower(replace(substr(NEW.local_part, 1, instr(NEW.local_part || '+', '+') - 1), '.', '')));
END;
CREATE TRIGGER mailboxes_claim_update AFTER UPDATE ON mailboxes BEGIN
  DELETE FROM mailbox_address_claims WHERE id = 'm:' || OLD.id;
  INSERT INTO mailbox_address_claims(id, domain_id, local_part) VALUES ('m:' || NEW.id, NEW.domain_id, lower(replace(substr(NEW.local_part, 1, instr(NEW.local_part || '+', '+') - 1), '.', '')));
END;
CREATE TRIGGER mailboxes_claim_delete AFTER DELETE ON mailboxes BEGIN
  DELETE FROM mailbox_address_claims WHERE id = 'm:' || OLD.id;
END;
INSERT INTO mailbox_address_claims(id, domain_id, local_part) SELECT 'a:' || id, domain_id, lower(replace(substr(local_part, 1, instr(local_part || '+', '+') - 1), '.', '')) FROM mailbox_aliases;
CREATE TRIGGER mailbox_aliases_claim_insert AFTER INSERT ON mailbox_aliases BEGIN
  INSERT INTO mailbox_address_claims(id, domain_id, local_part) VALUES ('a:' || NEW.id, NEW.domain_id, lower(replace(substr(NEW.local_part, 1, instr(NEW.local_part || '+', '+') - 1), '.', '')));
END;
CREATE TRIGGER mailbox_aliases_claim_update AFTER UPDATE ON mailbox_aliases BEGIN
  DELETE FROM mailbox_address_claims WHERE id = 'a:' || OLD.id;
  INSERT INTO mailbox_address_claims(id, domain_id, local_part) VALUES ('a:' || NEW.id, NEW.domain_id, lower(replace(substr(NEW.local_part, 1, instr(NEW.local_part || '+', '+') - 1), '.', '')));
END;
CREATE TRIGGER mailbox_aliases_claim_delete AFTER DELETE ON mailbox_aliases BEGIN
  DELETE FROM mailbox_address_claims WHERE id = 'a:' || OLD.id;
END;
