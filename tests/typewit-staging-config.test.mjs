import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { verifyTypewitStaging } from "../scripts/verify-typewit-staging-output.mjs";
const { config, error } = ts.parseConfigFileTextToJson("wrangler.staging.jsonc", readFileSync("wrangler.staging.jsonc", "utf8"));
assert.equal(error, undefined);
test("staging source passes exact resource isolation checks", () => verifyTypewitStaging(config));
for (const [name, mutate] of [
  ["extra database", x => x.d1_databases.push({ binding: "OTHER", database_id: "production" })],
  ["extra bucket", x => x.r2_buckets.push({ bucket_name: "production" })],
  ["wrong producer", x => x.queues.producers[0].queue = "mailflare-inbound"],
  ["wrong consumer", x => x.queues.consumers[0].queue = "mailflare-inbound"],
  ["dead letter queue", x => x.queues.consumers[0].dead_letter_queue = "production"],
  ["service target", x => x.services[0].service = "mailflare"],
  ["durable object target", x => x.durable_objects.bindings[0].script_name = "production"],
  ["credentials", x => x.vars.CF_TOKEN = "test-only-placeholder"],
  ["live forwarding", x => x.vars.TYPEWIT_FORWARDING_ENABLED = "true"],
  ["route", x => x.routes = ["mail.typewit.com/*"]],
  ["cron", x => x.triggers.crons = ["* * * * *"]],
  ["extra remote binding", x => x.kv_namespaces = [{ id: "production", binding: "KV" }]],
]) test(`staging validator rejects ${name}`, () => {
  const altered = structuredClone(config); mutate(altered); assert.throws(() => verifyTypewitStaging(altered));
});
