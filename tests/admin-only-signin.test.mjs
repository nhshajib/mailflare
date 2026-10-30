import assert from "node:assert/strict";
import test, { before, after, beforeEach, afterEach } from "node:test";
import { loadTypewitRuntime, testDatabase } from "./helpers/typewit-runtime.mjs";

let runtime, fixture;
const password = "local-test-password";
before(async () => { runtime = await loadTypewitRuntime(); });
after(() => runtime.cleanup());
beforeEach(() => {
  fixture = testDatabase();
  globalThis.__typewitTestEnv = { DB: fixture.DB };
  const insert = fixture.sqlite.prepare("INSERT INTO users(id,email,password_hash,name,role,created_at) VALUES (?,?,?,?,?,0)");
  for (const [id, role] of [["a", "admin"], ["u", "user"]]) insert.run(id, `${id}@example.test`, runtime.hashPassword(password), id, role);
});
afterEach(() => { fixture.close(); delete globalThis.__typewitTestEnv; });
const request = body => new Request("https://local.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("only admins receive sessions; existing sessions and account switching reject demoted admins", async () => {
  assert.equal((await runtime.login.POST(request({ email: "a@example.test", password }))).status, 200);
  const token = await runtime.createSession(globalThis.__typewitTestEnv, "a");
  assert.ok(await runtime.getUserFromSession(globalThis.__typewitTestEnv, token));
  fixture.sqlite.exec("UPDATE users SET role='user' WHERE id='a'");
  assert.equal(await runtime.getUserFromSession(globalThis.__typewitTestEnv, token), null);
  assert.deepEqual(await runtime.resolveAccounts(globalThis.__typewitTestEnv, [token]), []);
  const response = await runtime.login.POST(request({ email: "u@example.test", password }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(fixture.sqlite.prepare("SELECT count(*) AS n FROM sessions WHERE user_id='u'").get().n, 0);
});

test("non-admin MFA and mobile sign-in cannot bypass the role check", async () => {
  fixture.sqlite.exec("UPDATE users SET totp_enabled=1,totp_secret='not-used' WHERE id='u'");
  const response = await runtime.login.POST(request({ email: "u@example.test", password }));
  assert.equal(response.status, 403);
  assert.equal(fixture.sqlite.prepare("SELECT count(*) AS n FROM login_challenges").get().n, 0);
  const challengeToken = await runtime.createLoginChallenge(globalThis.__typewitTestEnv, "u");
  assert.equal((await runtime.mfaLogin.POST(request({ challengeToken, code: "123456" }))).status, 403);
  assert.equal((await runtime.deviceLogin.POST(request({ email: "u@example.test", password, deviceName: "test" }))).status, 403);
  assert.equal((await runtime.deviceLogin.POST(request({ challengeToken, code: "123456", deviceName: "test" }))).status, 403);
  assert.equal(fixture.sqlite.prepare("SELECT count(*) AS n FROM api_keys WHERE user_id='u'").get().n, 0);
});
