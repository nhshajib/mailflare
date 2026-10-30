import assert from "node:assert/strict";
import test, { before, after, beforeEach, afterEach } from "node:test";
import { loadTypewitRuntime, testDatabase } from "./helpers/typewit-runtime.mjs";

let runtime, fixture, admin, user, originalFetch;
before(async () => { runtime = await loadTypewitRuntime(); });
after(() => runtime.cleanup());
beforeEach(async () => {
  fixture = testDatabase();
  globalThis.__typewitTestEnv = { DB: fixture.DB, GITHUB_UPDATE_TOKEN: "must-not-be-sent", GITHUB_UPDATE_REPO: "example/fork" };
  fixture.sqlite.exec(`INSERT INTO users(id,email,password_hash,name,role,is_primary_admin,created_at) VALUES
    ('a','admin@example.test','hash','Admin','admin',1,0), ('u','user@example.test','hash','User','user',0,0)`);
  admin = await runtime.createSession(globalThis.__typewitTestEnv, "a");
  user = await runtime.createSession(globalThis.__typewitTestEnv, "u");
  originalFetch = globalThis.fetch;
});
afterEach(() => { globalThis.fetch = originalFetch; fixture.close(); delete globalThis.__typewitTestEnv; });
const request = (token, method = "GET") => new Request("https://local.test/api/admin/update", { method, headers: { Authorization: `Bearer ${token}` } });

test("release checks compare numeric versions and reject prerelease/invalid tags", () => {
  assert.equal(runtime.isNewerRelease("v0.10.0", "0.9.9"), true);
  assert.equal(runtime.isNewerRelease("v1.0.0", "1.0.0"), false);
  assert.equal(runtime.isNewerRelease("0.5.1", "0.5.2"), false);
  for (const tag of ["v1.0.0-beta.1", "garbage", "1.2", "https://evil.test"]) assert.throws(() => runtime.isNewerRelease(tag, "0.5.2"));
});

test("notifications use public releases without a token, coalesce checks, and never dispatch workflows", async () => {
  delete globalThis.__typewitTestEnv.GITHUB_UPDATE_TOKEN;
  delete globalThis.__typewitTestEnv.GITHUB_UPDATE_REPO;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(url, "https://api.github.com/repos/hieunc229/mailflare/releases/latest");
    assert.equal(new Headers(init.headers).has("Authorization"), false);
    assert.ok(!init.method || init.method === "GET");
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json({ tag_name: "v99.0.0", draft: false, prerelease: false });
  };
  const [first, second] = await Promise.all([runtime.updates.GET(request(admin)), runtime.updates.GET(request(admin))]);
  assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(calls, 1);
  const result = await first.json();
  assert.equal(result.available, true); assert.equal(result.manualOnly, true);
  assert.equal(result.releaseUrl, "https://github.com/hieunc229/mailflare/releases/tag/v99.0.0");
  assert.equal(first.headers.get("Cache-Control"), "private, no-store");
  const disabled = await runtime.updates.POST(request(admin, "POST"));
  assert.equal(disabled.status, 405); assert.equal(disabled.headers.get("Allow"), "GET"); assert.equal(calls, 1);
});

test("release endpoints retain administrator authorization", async () => {
  globalThis.fetch = async () => { throw new Error("Must not fetch"); };
  for (const method of ["GET", "POST"]) {
    assert.equal((await runtime.updates[method](request("invalid", method))).status, 401);
    assert.equal((await runtime.updates[method](request(user, method))).status, 403);
  }
});

test("no published release is distinct from an up-to-date version", async () => {
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const result = await runtime.checkLatestRelease("0.0.91");
  assert.equal(result.available, false); assert.equal(result.targetVersion, undefined);
  assert.equal(result.releaseUrl, "https://github.com/hieunc229/mailflare/releases");
});

test("rate limits and malformed releases fail visibly instead of claiming up to date", async () => {
  globalThis.fetch = async () => new Response(null, { status: 403 });
  await assert.rejects(runtime.checkLatestRelease("0.0.92"), /Could not check/);
  globalThis.fetch = async () => Response.json({ tag_name: "v2.0.0-beta", prerelease: true });
  await assert.rejects(runtime.checkLatestRelease("0.0.93"), /stable release/);
  globalThis.fetch = async () => { throw new Error("Network unavailable"); };
  await assert.rejects(runtime.checkLatestRelease("0.0.94"), /Network unavailable/);
});
