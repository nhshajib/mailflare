-- Preserve forwarding reservations across duplicate events and uncertain provider responses.
CREATE TABLE typewit_forwarding_attempts (
  id text PRIMARY KEY NOT NULL,
  mailbox_id text NOT NULL REFERENCES mailboxes(id) ON DELETE CASCADE,
  state text NOT NULL,
  created_at integer NOT NULL
);
CREATE INDEX typewit_forwarding_attempts_mailbox_idx ON typewit_forwarding_attempts(mailbox_id);
