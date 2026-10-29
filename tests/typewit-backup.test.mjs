import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import { loadTypewitRuntime, testDatabase } from "./helpers/typewit-runtime.mjs";
let runtime;
before(async () => { runtime = await loadTypewitRuntime(); });
after(() => runtime?.cleanup());
test("TypeWit state backs up and restores with parent records; older backups remain restorable", async () => {
  const current = testDatabase(), previous = testDatabase({ beforeTypewit: true });
  try {
    current.sqlite.exec(`INSERT INTO users(id,email,password_hash,name,created_at) VALUES ('u','u@example.test','hash','User',0);
      INSERT INTO domains(id,user_id,hostname,zone_id,status,created_at) VALUES ('d','u','example.test','zone','active',0);
      INSERT INTO mailboxes(id,user_id,domain_id,local_part,created_at) VALUES ('m','u','d','u',0);
      INSERT INTO typewit_accounts(user_id,state) VALUES ('u','ready');
      INSERT INTO typewit_forwarding(mailbox_id,destination,enabled,verified_at,updated_at) VALUES ('m','verified@external.test',0,1,1);
      INSERT INTO typewit_forwarding_attempts(id,mailbox_id,state,created_at) VALUES ('synthetic-attempt','m','failed',1);`);
    const bytes = await runtime.exportDatabaseRecords(current.DB);
    const document = JSON.parse(new TextDecoder().decode(bytes));
    assert.equal(document.tables.typewit_accounts[0].state, "ready");
    assert.equal(document.tables.typewit_forwarding[0].enabled, 0);
    assert.equal(document.tables.typewit_forwarding_attempts[0].state, "failed");
    assert.equal(document.tables.mailbox_address_claims, undefined, "derived claims are rebuilt rather than copied");
    await runtime.restoreDatabaseRecords(current.DB, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.equal(current.sqlite.prepare("SELECT state FROM typewit_accounts").get().state, "ready");
    assert.equal(current.sqlite.prepare("SELECT destination FROM typewit_forwarding").get().destination, "verified@external.test");
    assert.equal(current.sqlite.prepare("SELECT state FROM typewit_forwarding_attempts").get().state, "failed");
    assert.equal(current.sqlite.prepare("SELECT local_part FROM mailbox_address_claims").get().local_part, "u");
    const old = await runtime.exportDatabaseRecords(previous.DB);
    const oldDocument = JSON.parse(new TextDecoder().decode(old));
    assert.deepEqual(oldDocument.tables.typewit_accounts, []);
    delete oldDocument.tables.typewit_accounts;
    delete oldDocument.tables.typewit_forwarding;
    delete oldDocument.tables.typewit_forwarding_attempts;
    oldDocument.includedTables = oldDocument.includedTables.filter(name => !name.startsWith("typewit_"));
    const legacy = new TextEncoder().encode(JSON.stringify(oldDocument));
    await runtime.restoreDatabaseRecords(current.DB, legacy.buffer);
    await runtime.restoreDatabaseRecords(current.DB, old.buffer.slice(old.byteOffset, old.byteOffset + old.byteLength));
    assert.equal(current.sqlite.prepare("SELECT count(*) AS n FROM typewit_accounts").get().n, 0);
  } finally { current.close(); previous.close(); }
});
