CREATE TABLE `mailbox_address_claims` (
	`id` varchar(191) NOT NULL,
	`domain_id` varchar(191) NOT NULL,
	`local_part` varchar(191) NOT NULL,
	CONSTRAINT `mailbox_address_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `mailbox_address_claims_address_idx` UNIQUE(`domain_id`,`local_part`)
);
--> statement-breakpoint
ALTER TABLE `mailbox_address_claims` ADD CONSTRAINT `mailbox_address_claims_domain_id_domains_id_fk` FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO mailbox_address_claims(id, domain_id, local_part) SELECT CONCAT('m:', id), domain_id, lower(replace(substring_index(local_part, '+', 1), '.', '')) FROM mailboxes;
--> statement-breakpoint
CREATE TRIGGER mailboxes_claim_insert AFTER INSERT ON mailboxes FOR EACH ROW BEGIN
  INSERT INTO mailbox_address_claims(id, domain_id, local_part) VALUES (CONCAT('m:', NEW.id), NEW.domain_id, lower(replace(substring_index(NEW.local_part, '+', 1), '.', '')));
END;
--> statement-breakpoint
CREATE TRIGGER mailboxes_claim_update AFTER UPDATE ON mailboxes FOR EACH ROW BEGIN
  DELETE FROM mailbox_address_claims WHERE id = CONCAT('m:', OLD.id);
  INSERT INTO mailbox_address_claims(id, domain_id, local_part) VALUES (CONCAT('m:', NEW.id), NEW.domain_id, lower(replace(substring_index(NEW.local_part, '+', 1), '.', '')));
END;
--> statement-breakpoint
CREATE TRIGGER mailboxes_claim_delete AFTER DELETE ON mailboxes FOR EACH ROW BEGIN
  DELETE FROM mailbox_address_claims WHERE id = CONCAT('m:', OLD.id);
END;
--> statement-breakpoint
INSERT INTO mailbox_address_claims(id, domain_id, local_part) SELECT CONCAT('a:', id), domain_id, lower(replace(substring_index(local_part, '+', 1), '.', '')) FROM mailbox_aliases;
--> statement-breakpoint
CREATE TRIGGER mailbox_aliases_claim_insert AFTER INSERT ON mailbox_aliases FOR EACH ROW BEGIN
  INSERT INTO mailbox_address_claims(id, domain_id, local_part) VALUES (CONCAT('a:', NEW.id), NEW.domain_id, lower(replace(substring_index(NEW.local_part, '+', 1), '.', '')));
END;
--> statement-breakpoint
CREATE TRIGGER mailbox_aliases_claim_update AFTER UPDATE ON mailbox_aliases FOR EACH ROW BEGIN
  DELETE FROM mailbox_address_claims WHERE id = CONCAT('a:', OLD.id);
  INSERT INTO mailbox_address_claims(id, domain_id, local_part) VALUES (CONCAT('a:', NEW.id), NEW.domain_id, lower(replace(substring_index(NEW.local_part, '+', 1), '.', '')));
END;
--> statement-breakpoint
CREATE TRIGGER mailbox_aliases_claim_delete AFTER DELETE ON mailbox_aliases FOR EACH ROW BEGIN
  DELETE FROM mailbox_address_claims WHERE id = CONCAT('a:', OLD.id);
END;
--> statement-breakpoint
