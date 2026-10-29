-- Read-only D1/SQLite check before migration 0079. Reveals counts, never addresses or message data.
-- Run against an existing installation with mailboxes and mailbox_aliases tables.
SELECT count(*) AS conflicting_address_groups
FROM (
  SELECT domain_id, normalized_local_part
  FROM (
    SELECT domain_id, lower(replace(substr(local_part, 1, instr(local_part || '+', '+') - 1), '.', '')) AS normalized_local_part FROM mailboxes
    UNION ALL
    SELECT domain_id, lower(replace(substr(local_part, 1, instr(local_part || '+', '+') - 1), '.', '')) AS normalized_local_part FROM mailbox_aliases
  )
  GROUP BY domain_id, normalized_local_part
  HAVING count(*) > 1
);
