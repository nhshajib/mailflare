import assert from "node:assert/strict";
import test, { before, after, beforeEach, afterEach } from "node:test";
import { loadTypewitRuntime, testDatabase } from "./helpers/typewit-runtime.mjs";
let runtime, fixture, token, originalFetch;
before(async () => { runtime = await loadTypewitRuntime(); });
after(() => runtime?.cleanup());
beforeEach(async () => {
  fixture = testDatabase();
  globalThis.__typewitTestEnv = { DB: fixture.DB, TYPEWIT_FORWARDING_ENABLED: "true", CF_ACCOUNT_ID: "a".repeat(32), CF_TOKEN: "test-only" };
  fixture.sqlite.exec(`INSERT INTO users(id,email,password_hash,name,role,is_primary_admin,created_at) VALUES ('admin','admin@example.test','hash','Admin','admin',1,0), ('u','alice@example.test','hash','Alice','user',0,0);
    INSERT INTO domains(id,user_id,hostname,zone_id,status,created_at) VALUES ('d','admin','example.test','zone','active',0);
    INSERT INTO mailboxes(id,user_id,domain_id,local_part,created_at) VALUES ('m','u','d','alice',0);`);
  token = await runtime.createSession(globalThis.__typewitTestEnv, "admin");
  originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(url, /^https:\/\/api.cloudflare.com\/client\/v4\/accounts\/a{32}\/email\/routing\/addresses\?email=/);
    return Response.json({ success: true, result: [{ email: "verified@external.test", verified: "2026-10-28T00:00:00Z" }] });
  };
});
afterEach(() => { globalThis.fetch = originalFetch; fixture.close(); delete globalThis.__typewitTestEnv; });
const request = (data, key = token) => new Request("https://staging.test/api/typewit/forwarding", { method: "PUT", headers: { Origin: "https://staging.test", Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(data) });
const rule = (destination = "verified@external.test") => ({ mailboxId: "m", destination, enabled: true });
async function enable() { const r = await runtime.forwarding.PUT(request(rule())); assert.equal(r.status, 200, await r.clone().text()); }

test("only primary admin can save forwarding; destination verification is server-side", async () => {
  const userToken = await runtime.createSession(globalThis.__typewitTestEnv, "u");
  assert.equal((await runtime.forwarding.PUT(request(rule(), userToken))).status, 403);
  assert.equal((await runtime.forwarding.PUT(request(rule("unverified@external.test")))).status, 400);
  assert.equal((await runtime.forwarding.PUT(request({ ...rule(), verified: true }))).status, 400);
  await enable();
  const row = fixture.sqlite.prepare("SELECT * FROM typewit_forwarding").get();
  assert.equal(row.enabled, 1); assert.ok(row.verified_at > 0);
});
test("header loop guard, local-domain rejection, disabled rules/users and feature flag fail closed", async () => {
  assert.equal((await runtime.forwarding.PUT(request(rule("bob@example.test")))).status, 400);
  await enable();
  let calls = 0;
  const message = { to: "a.li.ce+tag@example.test", headers: new Headers(), forward: async () => { calls++; } };
  for (const header of [runtime.TYPEWIT_FORWARD_HEADER, "X-Mailflare-Forwarded", "Auto-Submitted"]) {
    message.headers = new Headers({ [header]: "1" });
    assert.equal(await runtime.forwardTypewitMail(globalThis.__typewitTestEnv, message, new TextEncoder().encode("synthetic MIME").buffer), false);
  }
  message.headers = new Headers();
  assert.equal(await runtime.forwardTypewitMail({ ...globalThis.__typewitTestEnv, TYPEWIT_STAGING: "true" }, message, new TextEncoder().encode("synthetic MIME").buffer), false);
  assert.equal(await runtime.forwardTypewitMail({ ...globalThis.__typewitTestEnv, TYPEWIT_FORWARDING_ENABLED: "false" }, message, new TextEncoder().encode("synthetic MIME").buffer), false);
  fixture.sqlite.exec("UPDATE users SET disabled=1 WHERE id='u'");
  assert.equal(await runtime.forwardTypewitMail(globalThis.__typewitTestEnv, message, new TextEncoder().encode("synthetic MIME").buffer), false);
  assert.equal(calls, 0);
});
test("delivery adds loop headers; provider errors preserve local-copy path and log no content/address", async () => {
  await enable();
  const message = { to: "alice@example.test", headers: new Headers(), forward: async (to, headers) => {
    assert.equal(to, "verified@external.test"); assert.equal(headers.get(runtime.TYPEWIT_FORWARD_HEADER), "1");
  } };
  assert.equal(await runtime.forwardTypewitMail(globalThis.__typewitTestEnv, message, new TextEncoder().encode("synthetic MIME").buffer), true);
  const errors = [], original = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    message.to = "alice+failure@example.test";
    message.forward = async () => { throw new Error("secret@example.test message body/token"); };
    assert.equal(await runtime.forwardTypewitMail(globalThis.__typewitTestEnv, message, new TextEncoder().encode("different MIME failure").buffer), false);
  } finally { console.error = original; }
  assert.equal(JSON.parse(errors[0]).event, "typewit.forward.failed");
  assert.doesNotMatch(errors.join(""), /secret|external.test|alice|token/);
});
test("disabling never requires a working provider; staging blocks activation", async () => {
  await enable(); globalThis.fetch = async () => { throw new Error("offline"); };
  assert.equal((await runtime.forwarding.PUT(request({ ...rule(), enabled: false }))).status, 200);
  assert.equal(fixture.sqlite.prepare("SELECT enabled FROM typewit_forwarding").get().enabled, 0);
  globalThis.__typewitTestEnv.TYPEWIT_STAGING = "true";
  assert.equal((await runtime.forwarding.PUT(request(rule()))).status, 503);
});

test("duplicate events and uncertain failures reserve at most one provider attempt", async () => {
  await enable();
  let calls = 0;
  const raw = new TextEncoder().encode("deduplicated raw MIME").buffer;
  const message = { to: "alice@example.test", headers: new Headers(), forward: async () => { calls++; } };
  assert.deepEqual(await Promise.all([
    runtime.forwardTypewitMail(globalThis.__typewitTestEnv, message, raw),
    runtime.forwardTypewitMail(globalThis.__typewitTestEnv, message, raw),
  ]).then(values => values.map(Boolean)), [true, true]);
  assert.equal(calls, 1);
  assert.equal(fixture.sqlite.prepare("SELECT state FROM typewit_forwarding_attempts").get().state, "delivered");
  message.forward = async () => { calls++; throw new Error("uncertain provider response"); };
  const failedRaw = new TextEncoder().encode("different raw MIME").buffer;
  assert.equal(await runtime.forwardTypewitMail(globalThis.__typewitTestEnv, message, failedRaw), false);
  assert.equal(await runtime.forwardTypewitMail(globalThis.__typewitTestEnv, message, failedRaw), false);
  assert.equal(calls, 2, "an uncertain failure is retained for review, never blindly re-forwarded");
});
