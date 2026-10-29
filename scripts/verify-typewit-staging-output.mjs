import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function verifyTypewitStaging(config) {
  assert.equal(config.name, "typewit-mail-staging");
  assert.equal(config.workers_dev, true);
  assert.ok(!config.routes?.length && !config.route && !config.zone_id, "Custom routes are forbidden");
  assert.ok(!config.triggers?.crons?.length, "Scheduled triggers are forbidden");
  assert.equal(config.d1_databases?.length, 1, "Exactly one staging database required");
  assert.equal(config.d1_databases[0].binding, "DB");
  assert.equal(config.d1_databases[0].database_name, "typewit-mail-staging");
  assert.equal(config.d1_databases[0].database_id, "6b12d806-054a-4953-918b-a5eb67877f21");
  assert.equal(config.r2_buckets?.length, 1, "Exactly one staging bucket required");
  assert.equal(config.r2_buckets[0].binding, "BUCKET");
  assert.equal(config.r2_buckets[0].bucket_name, "typewit-mail-staging-raw");
  assert.ok(!config.r2_buckets[0].preview_bucket_name || config.r2_buckets[0].preview_bucket_name === "typewit-mail-staging-raw");
  const queues = ["inbound", "outbound", "agent"];
  assert.equal(config.queues?.producers?.length, 3);
  assert.equal(config.queues?.consumers?.length, 3);
  for (const name of queues) {
    assert.ok(config.queues.producers.some(x => x.binding === `${name.toUpperCase()}_QUEUE` && x.queue === `typewit-mail-staging-${name}`));
    const consumer = config.queues.consumers.find(x => x.queue === `typewit-mail-staging-${name}`);
    assert.ok(consumer && consumer.max_retries === 3 && !consumer.dead_letter_queue, "Unexpected consumer/dead-letter target");
  }
  assert.equal(config.services?.length, 1);
  assert.equal(config.services[0].binding, "WORKER_SELF_REFERENCE");
  assert.equal(config.services[0].service, "typewit-mail-staging");
  assert.ok(!config.services[0].environment);
  assert.equal(config.durable_objects?.bindings?.length, 1);
  assert.equal(config.durable_objects.bindings[0].class_name, "RealtimeHub");
  assert.ok(!config.durable_objects.bindings[0].script_name);
  for (const key of ["kv_namespaces", "hyperdrive", "send_email", "dispatch_namespaces", "vectorize", "workflows", "pipelines", "mtls_certificates", "unsafe", "env", "build"]) {
    assert.ok(!config[key] || (Array.isArray(config[key]) && config[key].length === 0), `Unexpected binding/override: ${key}`);
  }
  assert.deepEqual(config.vars, {
    CF_EMAIL_WORKER_NAME: "typewit-mail-staging", TYPEWIT_STAGING: "true", TYPEWIT_FORWARDING_ENABLED: "false",
  }, "Unexpected runtime variables or provider secrets");
  const serialized = JSON.stringify(config);
  for (const value of ["f07e8795-57a2-4311-b02b-0a09424780e5", '"mailflare"', '"mailflare-raw"', '"mailflare-inbound"', '"mailflare-outbound"', '"mailflare-agent"']) {
    assert.ok(!serialized.includes(value), "Production resource in staging artifact");
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = resolve(process.argv[2] ?? "dist/server/wrangler.json");
  verifyTypewitStaging(JSON.parse(readFileSync(file, "utf8")));
  console.log("Verified staging artifact bindings; no deploy performed.");
}
