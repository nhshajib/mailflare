import assert from "node:assert/strict";
import test, { before, after, beforeEach, afterEach } from "node:test";
import { loadTypewitRuntime, testDatabase } from "./helpers/typewit-runtime.mjs";
let runtime, fixture, admin, user;
before(async () => { runtime = await loadTypewitRuntime(); });
after(() => runtime?.cleanup());
beforeEach(async () => {
  fixture = testDatabase();
  globalThis.__typewitTestEnv = { DB: fixture.DB };
  fixture.sqlite.exec(`INSERT INTO users(id,email,password_hash,name,role,is_primary_admin,created_at) VALUES
    ('admin','admin@example.test','hash','Admin','admin',1,0), ('u','alice@example.test','hash','Alice','user',0,0);
    INSERT INTO domains(id,user_id,hostname,zone_id,status,receiving_provider,created_at) VALUES ('d','admin','example.test','zone','active','none',0);
    INSERT INTO mailboxes(id,user_id,domain_id,local_part,type,created_at) VALUES ('m','admin','d','shared','shared',0), ('personal','u','d','alice','personal',0);
    DROP TABLE license_settings;`);
  admin = await runtime.createSession(globalThis.__typewitTestEnv, "admin");
  user = await runtime.createSession(globalThis.__typewitTestEnv, "u");
});
afterEach(() => { fixture.close(); delete globalThis.__typewitTestEnv; });

test("branding is customizable without activation but writes still require the primary administrator", async () => {
  const form = new FormData(); form.set("appName", "TypeWit test branding");
  const request = token => new Request("https://local.test/api/branding", { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Branding must not contact a billing service"); };
  try {
    assert.equal((await runtime.branding.PUT(request(user))).status, 403);
    assert.equal((await runtime.branding.PUT(request("invalid"))).status, 403);
    const saved = await runtime.branding.PUT(request(admin));
    assert.equal(saved.status, 200);
    const data = await (await runtime.branding.GET()).json();
    assert.equal(data.appName, "TypeWit test branding"); assert.equal(data.canCustomizeBranding, true);
  } finally { globalThis.fetch = originalFetch; }
});

test("shared mailbox access still requires an explicit grant and respects revocation without billing data", async () => {
  const db = runtime.getDb(globalThis.__typewitTestEnv);
  assert.equal(await runtime.getMailboxAccessLevel(db, { id: "u", role: "user" }, "m"), null);
  fixture.sqlite.exec("INSERT INTO mailbox_access(id,mailbox_id,user_id,permission,created_at) VALUES ('grant','m','u','read_only',0)");
  const access = await runtime.getMailboxAccessLevel(db, { id: "u", role: "user" }, "m");
  assert.equal(access.canRead, true); assert.equal(access.canSendAs, false); assert.equal(access.canManage, false);
  fixture.sqlite.exec("DELETE FROM mailbox_access");
  assert.equal(await runtime.getMailboxAccessLevel(db, { id: "u", role: "user" }, "m"), null);
});

test("users can configure only their own forwarding without activation; disabled owners never forward", async () => {
  const request = token => new Request("https://local.test/api/settings/forwarding", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ forwardingEmail: "verified@external.test" }) });
  assert.equal((await runtime.accountForwarding.PATCH(request(user))).status, 200);
  assert.equal(fixture.sqlite.prepare("SELECT forwarding_email FROM users WHERE id='admin'").get().forwarding_email, null);
  assert.equal(await runtime.getAccountForwardingDestination(globalThis.__typewitTestEnv, "alice@example.test"), "verified@external.test");
  fixture.sqlite.exec("UPDATE users SET disabled=1 WHERE id='u'");
  assert.equal(await runtime.getAccountForwardingDestination(globalThis.__typewitTestEnv, "alice@example.test"), null);
});
