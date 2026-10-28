import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("src/app/api/typewit/accounts/route.ts", "utf8");
const create = readFileSync("src/app/api/typewit/accounts/create.ts", "utf8");
const layout = readFileSync("src/app/(admin)/layout.tsx", "utf8");

test("account listing and creation require primary administrator", () => {
  assert.match(route, /export async function GET[\s\S]*?assertPrimaryAdmin\(viewer\)/);
  assert.match(route, /export async function POST[\s\S]*?assertPrimaryAdmin\(viewer\)/);
  assert.match(layout, /"\/typewit-accounts"/);
});
test("account creation rejects missing or cross-site origin", () => {
  assert.match(route, /!origin\s*\|\|/);
  assert.match(route, /new URL\(origin\)\.origin\s*!==\s*new URL\(request\.url\)\.origin/);
});
test("account provisioning never creates administrator or cross-domain account", () => {
  assert.match(create, /role:\s*"user"/);
  assert.match(create, /useAllDomains:\s*false/);
  assert.match(create, /domain\.userId\s*!==\s*primaryAdminUserId/);
  assert.match(create, /domain\.status\s*!==\s*"active"/);
});
test("new account and mailbox commit atomically with failure cleanup", () => {
  assert.match(create, /await db\.batch\(\[/);
  assert.match(create, /db\.insert\(users\)/);
  assert.match(create, /db\.insert\(mailboxes\)/);
  assert.match(create, /rollbackEmailRoutingRuleChanges\(env, changes\)/);
});
test("no entitlement or license state changes are introduced in TypeWit endpoint", () => {
  assert.doesNotMatch(create + route, /licenseSettings|updateLicenseFromPaymug|canManageAccounts\s*:/);
});
