import assert from "node:assert/strict";
import test from "node:test";
import { testDatabase } from "./helpers/typewit-runtime.mjs";

function fixture() {
  const db = testDatabase();
  db.sqlite.exec(`INSERT INTO users(id,email,password_hash,name,created_at) VALUES ('u','u@example.test','hash','U',0);
    INSERT INTO domains(id,user_id,hostname,zone_id,status,created_at) VALUES ('d','u','example.test','zone','active',0);
    INSERT INTO mailboxes(id,user_id,domain_id,local_part,created_at) VALUES ('m','u','d','owner',0);`);
  return db;
}

test("all mailbox and alias writes share normalized unique claims, including direct SQL", () => {
  const db = fixture();
  try {
    db.sqlite.exec("INSERT INTO mailbox_aliases(id,mailbox_id,domain_id,local_part,created_at) VALUES ('a','m','d','A.li.ce+tag',0)");
    assert.throws(() => db.sqlite.exec("INSERT INTO mailboxes(id,user_id,domain_id,local_part,created_at) VALUES ('other','u','d','alice',0)"), /UNIQUE/);
    assert.throws(() => db.sqlite.exec("UPDATE mailboxes SET local_part='ALICE+other' WHERE id='m'"), /UNIQUE/);
    assert.equal(db.sqlite.prepare("SELECT local_part FROM mailboxes WHERE id='m'").get().local_part, "owner");
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM mailbox_address_claims").get().n, 2);
    db.sqlite.exec("DELETE FROM mailbox_aliases WHERE id='a'");
    db.sqlite.exec("INSERT INTO mailboxes(id,user_id,domain_id,local_part,created_at) VALUES ('other','u','d','alice',0)");
    assert.throws(() => db.sqlite.exec("INSERT INTO mailbox_aliases(id,mailbox_id,domain_id,local_part,created_at) VALUES ('b','m','d','a.li.ce+again',0)"), /UNIQUE/);
    db.sqlite.exec("DELETE FROM mailboxes WHERE id='other'");
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM mailbox_address_claims").get().n, 1);
  } finally { db.close(); }
});

test("a failed multi-record transaction releases every address reservation", async () => {
  const db = fixture();
  try {
    await assert.rejects(db.DB.batch([
      db.DB.prepare("INSERT INTO mailboxes(id,user_id,domain_id,local_part,created_at) VALUES ('new','u','d','fresh',0)"),
      db.DB.prepare("INSERT INTO mailbox_aliases(id,mailbox_id,domain_id,local_part,created_at) VALUES ('a','m','d','OWNER+duplicate',0)"),
    ]), /UNIQUE/);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM mailbox_address_claims WHERE local_part='fresh'").get().n, 0);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM mailboxes WHERE id='new'").get().n, 0);
  } finally { db.close(); }
});

test("user deletion releases claims even on engines whose FK cascades skip child triggers", () => {
  const db = fixture();
  try {
    db.sqlite.exec(`INSERT INTO users(id,email,password_hash,name,created_at) VALUES ('admin','admin@example.test','hash','Admin',0);
      UPDATE domains SET user_id='admin';
      INSERT INTO mailbox_aliases(id,mailbox_id,domain_id,local_part,created_at) VALUES ('a','m','d','alias',0);
      DROP TRIGGER mailbox_aliases_claim_delete;
      DROP TRIGGER mailboxes_claim_delete;
      DELETE FROM users WHERE id='u';`);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM domains").get().n, 1);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM mailbox_address_claims").get().n, 0);
  } finally { db.close(); }
});

test("read-only preflight detects legacy collisions and migration failure preserves old rows", async () => {
  const { readFileSync } = await import("node:fs");
  const db = testDatabase({ beforeTypewit: true });
  try {
    db.sqlite.exec(`INSERT INTO users(id,email,password_hash,name,created_at) VALUES ('u','u@example.test','hash','U',0);
      INSERT INTO domains(id,user_id,hostname,zone_id,created_at) VALUES ('d','u','example.test','zone',0);
      INSERT INTO mailboxes(id,user_id,domain_id,local_part,created_at) VALUES ('m','u','d','alice',0);
      INSERT INTO mailbox_aliases(id,mailbox_id,domain_id,local_part,created_at) VALUES ('a','m','d','a.li.ce+tag',0);`);
    const preflight = readFileSync("scripts/typewit-address-preflight.sql", "utf8");
    assert.equal(db.sqlite.prepare(preflight).get().conflicting_address_groups, 1);
    db.sqlite.exec("BEGIN");
    assert.throws(() => db.sqlite.exec(readFileSync("drizzle/migrations/0079_mailbox_address_claims.sql", "utf8")), /UNIQUE/);
    db.sqlite.exec("ROLLBACK");
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM mailboxes").get().n, 1);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM mailbox_aliases").get().n, 1);
    assert.equal(db.sqlite.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='mailbox_address_claims'").get().n, 0);
  } finally { db.close(); }
});
