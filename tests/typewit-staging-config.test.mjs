import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Validate staging configuration without asking Wrangler to bundle vinext's
// virtual worker entry outside its Vite plugin.
const staging = readFileSync("wrangler.staging.jsonc", "utf8");
const production = readFileSync("wrangler.jsonc", "utf8");
test("staging Worker and bindings use dedicated resources", () => {
  for (const name of [
    "typewit-mail-staging",
    "typewit-mail-staging-raw",
    "typewit-mail-staging-inbound",
    "typewit-mail-staging-outbound",
    "typewit-mail-staging-agent",
  ]) assert.ok(staging.includes(name), `Missing staging binding: ${name}`);
  assert.match(staging, /"workers_dev":\s*true/);
  assert.match(staging, /"directory":\s*"\.\/dist\/client"/);
  assert.match(staging, /"crons":\s*\[\]/);
});
test("staging config does not refer to production resource IDs or names", () => {
  const productionDbId = production.match(/"database_id":\s*"([^"]+)"/)?.[1];
  assert.ok(productionDbId, "Production DB identifier missing");
  assert.ok(!staging.includes(productionDbId), "Production D1 identifier leaked into staging config");
  for (const name of ["mailflare-raw", "mailflare-inbound", "mailflare-outbound", "mailflare-agent"]) {
    assert.ok(!staging.includes('"' + name + '"'), `Production resource referenced: ${name}`);
  }
});
test("staging does not use a custom production domain or cron", () => {
  assert.doesNotMatch(staging, /"routes"\s*:|"route"\s*:|"zone_id"\s*:/);
  assert.doesNotMatch(staging, /mail\.typewit\.com|support@typewit\.com/);
});
