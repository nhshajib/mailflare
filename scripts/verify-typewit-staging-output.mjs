import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const expected = {
  name: "typewit-mail-staging",
  databaseId: "6b12d806-054a-4953-918b-a5eb67877f21",
  bucket: "typewit-mail-staging-raw",
  queues: [
    "typewit-mail-staging-inbound",
    "typewit-mail-staging-outbound",
    "typewit-mail-staging-agent",
  ],
};
const file = resolve("dist/server/wrangler.json");
assert.ok(existsSync(file), "Vite output dist/wrangler.json not found; refusing deployment");
const config = JSON.parse(readFileSync(file, "utf8"));
assert.equal(config.name, expected.name);
assert.equal(config.workers_dev, true);
assert.ok(!config.routes?.length && !config.route, "Custom routes are forbidden in staging");
assert.ok(!config.triggers?.crons?.length, "Scheduled triggers are forbidden in staging");
assert.ok(config.d1_databases?.some(x => x.binding === "DB" && x.database_id === expected.databaseId));
assert.ok(config.r2_buckets?.some(x => x.binding === "BUCKET" && x.bucket_name === expected.bucket));
for (const name of expected.queues) {
  assert.ok(config.queues?.producers?.some(x => x.queue === name), `Missing staging queue ${name}`);
}
assert.ok(!JSON.stringify(config).includes("f07e8795-57a2-4311-b02b-0a09424780e5"), "Production database ID in output");
assert.ok(!JSON.stringify(config).includes("mailflare-raw"), "Production R2 bucket in output");
process.stdout.write("Verified built staging Worker bindings; no deploy performed.\n");
