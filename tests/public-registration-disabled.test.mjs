import assert from "node:assert/strict";
import test from "node:test";
import { loadTypewitRuntime } from "./helpers/typewit-runtime.mjs";

test("public registration is denied even without an initialized database or valid input", async () => {
  const runtime = await loadTypewitRuntime();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Registration must not provision external resources"); };
  try {
    const response = await runtime.registration.POST(new Request("https://local.test/api/auth/register", { method: "POST", body: "not-json" }));
    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /registration is disabled/);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally { globalThis.fetch = originalFetch; runtime.cleanup(); }
});
