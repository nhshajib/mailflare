import assert from "node:assert/strict";
import test, { before, after, beforeEach, afterEach } from "node:test";
import { loadTypewitRuntime, testDatabase } from "./helpers/typewit-runtime.mjs";

let runtime, fixture, adminToken, userToken;
before(async () => { runtime = await loadTypewitRuntime(); });
after(() => runtime?.cleanup());
beforeEach(async () => {
  fixture = testDatabase();
  globalThis.__typewitTestEnv = { DB: fixture.DB };
  fixture.sqlite.exec(`INSERT INTO users(id,email,password_hash,name,role,is_primary_admin,created_at) VALUES
    ('admin','admin@example.test','hash','Admin','admin',1,0),
    ('user','user@example.test','hash','User','user',0,0);
    INSERT INTO domains(id,user_id,hostname,zone_id,status,receiving_provider,created_at) VALUES ('domain','admin','example.test','zone','active','none',0);`);
  adminToken = await runtime.createSession(globalThis.__typewitTestEnv, "admin");
  userToken = await runtime.createSession(globalThis.__typewitTestEnv, "user");
});
afterEach(() => { fixture.close(); delete globalThis.__typewitTestEnv; });
const input = (username = "alice") => ({ domainId: "domain", username, password: "a sufficiently long password" });
function request(method, data, token = adminToken, headers = {}) {
  return new Request("https://staging.example.test/api/typewit/accounts", { method,
    headers: { Authorization: `Bearer ${token}`, Origin: "https://staging.example.test", "Content-Type": "application/json", ...headers },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
}

test("anonymous and ordinary users cannot list, create or change accounts", async () => {
  for (const token of ["invalid", userToken]) for (const method of ["GET", "POST", "PATCH"]) {
    const response = await runtime.accounts[method](request(method, method === "GET" ? undefined : input(), token));
    assert.equal(response.status, 403);
  }
  assert.equal(fixture.sqlite.prepare("SELECT count(*) AS n FROM users").get().n, 2);
});
test("exact origin, JSON media type, bounded body and strict schema protect mutations", async () => {
  for (const [headers, body, expected] of [
    [{ Origin: "https://evil.test" }, input(), 403], [{ Origin: "null" }, input(), 403],
    [{ "Content-Type": "text/application/json" }, input(), 415],
    [{}, { ...input(), role: "admin" }, 400], [{}, { ...input(), password: "é".repeat(40) }, 400],
    [{}, { ...input(), name: "a".repeat(20_000) }, 413],
  ]) assert.equal((await runtime.accounts.POST(request("POST", body, adminToken, headers))).status, expected);
});
test("creation hashes password, fixes normal role, owns one mailbox and hides hashes in directory", async () => {
  const response = await runtime.accounts.POST(request("POST", input("ALICE")));
  assert.equal(response.status, 201, await response.clone().text());
  const { account } = await response.json();
  const user = fixture.sqlite.prepare("SELECT * FROM users WHERE id=?").get(account.id);
  assert.equal(user.email, "alice@example.test"); assert.equal(user.role, "user"); assert.equal(user.disabled, 0);
  assert.equal(runtime.verifyPassword(input().password, user.password_hash), true);
  assert.notEqual(user.password_hash, input().password);
  const mailbox = fixture.sqlite.prepare("SELECT * FROM mailboxes WHERE user_id=?").get(account.id);
  assert.equal(mailbox.use_all_domains, 0); assert.equal(mailbox.local_part, "alice");
  const directory = await runtime.accounts.GET(request("GET"));
  assert.match(directory.headers.get("cache-control"), /no-store/);
  assert.doesNotMatch(await directory.text(), /passwordHash|password_hash|\$2[aby]\$/);
});
test("two users can access only their personal mailbox, including admins without delegation", async () => {
  const accounts = [];
  for (const name of ["alice", "bob"]) {
    const response = await runtime.accounts.POST(request("POST", input(name)));
    assert.equal(response.status, 201); accounts.push(await response.json());
  }
  const db = runtime.getDb(globalThis.__typewitTestEnv);
  for (const own of accounts) for (const other of accounts) {
    const access = await runtime.getMailboxAccessLevel(db, { id: own.account.id, role: "user" }, other.mailbox.id);
    assert.equal(!!access, own === other);
  }
  assert.equal(await runtime.getMailboxAccessLevel(db, { id: "admin", role: "admin" }, accounts[0].mailbox.id), null);
});
test("duplicate normalized requests commit exactly one user and mailbox", async () => {
  const responses = await Promise.all([runtime.accounts.POST(request("POST", input())), runtime.accounts.POST(request("POST", input("ALICE")))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(fixture.sqlite.prepare("SELECT count(*) AS n FROM mailboxes").get().n, 1);
});
test("aliases, noncanonical dot/plus usernames, inactive and foreign domains are refused", async () => {
  fixture.sqlite.exec(`INSERT INTO mailboxes(id,user_id,domain_id,local_part,created_at) VALUES ('m','user','domain','owner',0);
    INSERT INTO mailbox_aliases(id,mailbox_id,domain_id,local_part,created_at) VALUES ('a','m','domain','a.li.ce+tag',0);`);
  assert.equal((await runtime.accounts.POST(request("POST", input()))).status, 409);
  for (const value of ["a.li.ce", "alice+tag"]) assert.equal((await runtime.accounts.POST(request("POST", input(value)))).status, 400);
  fixture.sqlite.exec("UPDATE domains SET status='pending'");
  assert.equal((await runtime.accounts.POST(request("POST", input("bob")))).status, 400);
  fixture.sqlite.exec("UPDATE domains SET status='active',user_id='user'");
  assert.equal((await runtime.accounts.POST(request("POST", input("bob")))).status, 400);
});
test("disabled, deleted and expired sessions are rejected and disabling revokes tokens permanently", async () => {
  const response = await runtime.accounts.POST(request("POST", input()));
  const { account } = await response.json();
  const token = await runtime.createSession(globalThis.__typewitTestEnv, account.id);
  assert.ok(await runtime.getUserFromSession(globalThis.__typewitTestEnv, token));
  assert.equal((await runtime.accounts.PATCH(request("PATCH", { id: account.id, disabled: true }))).status, 200);
  assert.equal(await runtime.getUserFromSession(globalThis.__typewitTestEnv, token), null);
  assert.equal((await runtime.accounts.PATCH(request("PATCH", { id: account.id, disabled: false }))).status, 200);
  assert.equal(await runtime.getUserFromSession(globalThis.__typewitTestEnv, token), null);
  fixture.sqlite.exec("UPDATE sessions SET expires_at=0");
  assert.equal((await runtime.accounts.GET(request("GET"))).status, 403);
});
test("incomplete provisioning cannot be activated, and primary admin cannot be disabled", async () => {
  const { account } = await (await runtime.accounts.POST(request("POST", input()))).json();
  fixture.sqlite.prepare("UPDATE typewit_accounts SET state='cleanup_required' WHERE user_id=?").run(account.id);
  assert.equal((await runtime.accounts.PATCH(request("PATCH", { id: account.id, disabled: false }))).status, 409);
  assert.equal((await runtime.accounts.PATCH(request("PATCH", { id: "admin", disabled: true }))).status, 404);
});
test("routing failure rolls back atomic database records without leaking provider errors", async () => {
  fixture.sqlite.exec("UPDATE domains SET receiving_provider='cloudflare'");
  const response = await runtime.accounts.POST(request("POST", input()));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /rolled back/);
  assert.equal(fixture.sqlite.prepare("SELECT count(*) AS n FROM typewit_accounts").get().n, 0);
  assert.equal(fixture.sqlite.prepare("SELECT count(*) AS n FROM mailboxes").get().n, 0);
});

test("real login handler creates fresh sessions for admin and normal users and rejects disabled credentials", async () => {
  const password = "long test password";
  const hash = runtime.hashPassword(password);
  fixture.sqlite.prepare("UPDATE users SET password_hash=?").run(hash);
  const login = email => runtime.login.POST(request("POST", { email, password }));
  const first = await login("admin@example.test"), second = await login("admin@example.test");
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.notEqual((await first.json()).token, (await second.json()).token);
  assert.match(first.headers.get("set-cookie"), /HttpOnly/i);
  assert.equal((await login("user@example.test")).status, 200);
  fixture.sqlite.exec("UPDATE users SET disabled=1 WHERE id='user'");
  assert.equal((await login("user@example.test")).status, 403);
  fixture.sqlite.exec("UPDATE users SET disabled=0,deleted_at=1 WHERE id='user'");
  assert.equal((await login("user@example.test")).status, 403);
});

test("partial provider failure retains disabled account when remote cleanup is uncertain", async () => {
  fixture.sqlite.exec("UPDATE domains SET receiving_provider='cloudflare'");
  globalThis.__typewitTestEnv.CF_TOKEN = "test-only";
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push([url, init.method ?? "GET"]);
    if ((init.method ?? "GET") === "GET") return Response.json({ success: true, result: [] });
    if (init.method === "POST") return Response.json({ success: true, result: { id: "created-rule" } });
    throw new Error("provider unavailable during cleanup");
  };
  const originalBatch = fixture.DB.batch;
  let batches = 0;
  fixture.DB.batch = async queries => {
    if (++batches === 2) throw new Error("activation database failure");
    return originalBatch(queries);
  };
  try {
    const response = await runtime.accounts.POST(request("POST", input()));
    assert.equal(response.status, 502);
    const result = await response.json();
    assert.match(result.error, /administrator review/);
    const row = fixture.sqlite.prepare("SELECT disabled,state FROM users JOIN typewit_accounts ON users.id=user_id WHERE users.id=?").get(result.accountId);
    assert.equal(row.disabled, 1); assert.equal(row.state, "cleanup_required");
    assert.ok(calls.some(([, method]) => method === "DELETE"));
  } finally { globalThis.fetch = original; }
});

test("legacy mixed-case logins cannot claim a second normalized account", async () => {
  fixture.sqlite.exec("UPDATE users SET email='ALICE@EXAMPLE.TEST' WHERE id='user'");
  assert.equal((await runtime.accounts.POST(request("POST", input()))).status, 409);
});
