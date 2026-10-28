// Local-only Worker/D1 integration check. Start the isolated staging dev server on 3001 first.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const origin = "http://localhost:3001";
const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const adminId = `smoke_admin_${suffix}`;
const domainId = `smoke_domain_${suffix}`;
const host = `smoke-${suffix}.invalid`;
const password = randomBytes(24).toString("hex");
const directory = mkdtempSync(join(tmpdir(), "typewit-smoke-"));
function localSql(sql) {
  const file = join(directory, "fixture.sql"); writeFileSync(file, sql, { mode: 0o600 });
  execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--config", "wrangler.staging.jsonc", "--file", file], { stdio: "pipe" });
}
async function api(path, { method = "GET", body, token } = {}) {
  return fetch(`${origin}${path}`, { method, headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function login(email) {
  const response = await api("/api/auth/login", { method: "POST", body: { email, password } });
  assert.equal(response.status, 200, "Local login must succeed");
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
  return (await response.json()).token;
}
try {
  localSql(`INSERT INTO users(id,email,password_hash,name,role,is_primary_admin,created_at) VALUES ('${adminId}','admin@${host}','${bcrypt.hashSync(password, 12)}','Local smoke admin','admin',1,0);
    INSERT INTO domains(id,user_id,hostname,zone_id,status,receiving_provider,created_at) VALUES ('${domainId}','${adminId}','${host}','local-only','active','none',0);`);
  const admin = await login(`admin@${host}`);
  const accounts = [];
  for (const username of ["alice", "bob"]) {
    const response = await api("/api/typewit/accounts", { method: "POST", token: admin, body: { domainId, username, password } });
    assert.equal(response.status, 201, "Personal account provisioning must succeed locally without routing changes");
    const created = await response.json();
    accounts.push({ ...created, token: await login(`${username}@${host}`) });
  }
  for (const [index, own] of accounts.entries()) {
    const messageId = `smoke_message_${suffix}_${index}`;
    own.messageId = messageId;
    localSql(`INSERT INTO messages(id,user_id,mailbox_id,direction,from_addr,to_addr,subject,text_body,created_at) VALUES ('${messageId}','${own.account.id}','${own.mailbox.id}','inbound','sender@external.invalid','${own.account.email}','Isolated test','local synthetic mail only',0);`);
  }
  for (const own of accounts) {
    const response = await api("/api/mailboxes", { token: own.token });
    assert.equal(response.status, 200);
    const { mailboxes } = await response.json();
    assert.deepEqual(mailboxes.map(x => x.id), [own.mailbox.id]);
    assert.equal((await api(`/api/messages/${own.messageId}`, { token: own.token })).status, 200);
    for (const other of accounts.filter(account => account !== own)) {
      assert.equal((await api(`/api/messages/${other.messageId}`, { token: own.token })).status, 404);
    }
    assert.equal((await api("/api/typewit/accounts", { token: own.token })).status, 403);
    assert.equal((await api("/api/typewit/forwarding", { token: own.token })).status, 403);
  }
  if (process.argv.includes("--browser")) {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ executablePath: process.env.TYPEWIT_BROWSER_EXECUTABLE || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : "/usr/bin/google-chrome"), headless: true, args: ["--no-sandbox"] });
    try {
      for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport, baseURL: origin });
        const page = await context.newPage();
        page.setDefaultTimeout(30_000);
        page.setDefaultNavigationTimeout(60_000);
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto("/login");
        await page.waitForFunction(() => { const form = document.querySelector("form"); return form && Object.keys(form).some(key => key.startsWith("__reactProps")); });
        await page.locator('input[type="email"]').fill(`admin@${host}`);
        await page.locator('input[type="password"]').fill(password);
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.waitForURL(url => !url.pathname.startsWith("/login"), { timeout: 30_000 });
        await page.goto("/typewit-accounts");
        await page.getByRole("heading", { name: "TypeWit accounts", exact: true }).waitFor();
        await page.getByText(`alice@${host}`, { exact: true }).waitFor();
        assert.equal(await page.locator('input[type="password"]').getAttribute("autocomplete"), "new-password");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Account page must fit the viewport");
        await page.waitForFunction(() => {
          const heading = [...document.querySelectorAll("h1")].find(node => node.textContent === "TypeWit accounts");
          if (!heading) return false;
          for (let node = heading; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (Number(style.opacity) < 0.99 || style.visibility === "hidden") return false;
          }
          return true;
        });
        await page.getByRole("button", { name: `Disable bob@${host}`, exact: true }).click({ trial: true });
        await page.getByRole("button", { name: `Disable bob@${host}`, exact: true }).focus();
        assert.equal(await page.evaluate(() => document.activeElement?.tagName), "BUTTON");
        assert.deepEqual(errors, [], "Account UI must not throw client exceptions");
        const unlabeled = await page.locator('input:not([type="hidden"]), select, textarea').evaluateAll(controls => controls.filter(control => !control.labels?.length && !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby")).map(control => control.tagName));
        assert.deepEqual(unlabeled, [], "Account forms must label every input");
        await page.keyboard.press("Tab");
        assert.notEqual(await page.evaluate(() => document.activeElement?.tagName), "BODY");
        if (process.env.TYPEWIT_SCREENSHOT_DIR) {
          await page.evaluate(() => { for (const element of document.querySelectorAll("*")) if (element.scrollTop > 0) element.scrollTop = 0; });
          await page.screenshot({ path: `${process.env.TYPEWIT_SCREENSHOT_DIR}/typewit-accounts-${viewport.width}.png`, fullPage: true });
        }
        await page.goto("/mailboxes");
        await page.getByRole("button", { name: "New mailbox", exact: true }).click();
        await page.waitForFunction(() => document.getElementById("mailbox-name")?.value === "Local smoke admin");
        await page.locator("#mailbox-name").fill("");
        assert.equal(await page.locator("#mailbox-name").inputValue(), "", "Clearing a default name must preserve the edit");
        await page.locator("#mailbox-name").fill("Local test mailbox");
        await page.locator("#mailbox-username").fill("browsercheck");
        await page.getByRole("combobox", { name: "Domain", exact: true }).selectOption(domainId);
        assert.equal(await page.getByRole("button", { name: "Create mailbox", exact: true }).isEnabled(), true, "Displayed defaults and submitted owner must agree");
        assert.deepEqual(errors, [], "Mailbox settings must not throw client exceptions");
        await context.close();
      }
      console.log("PASS: real Chromium desktop/mobile login and account directory, keyboard focus, labels, no horizontal overflow or client exceptions.");
    } finally { await browser.close(); }
  }
  const disabled = await api("/api/typewit/accounts", { method: "PATCH", token: admin, body: { id: accounts[0].account.id, disabled: true } });
  assert.equal(disabled.status, 200);
  const denied = await api("/api/auth/login", { method: "POST", body: { email: `alice@${host}`, password } });
  assert.equal(denied.status, 403);
  console.log("PASS: real local Worker admin/user login, two-account mailbox isolation, admin API denial and disabled-login rejection. No external mail or remote database operations.");
} finally {
  localSql(`DELETE FROM users WHERE created_by_user_id='${adminId}'; DELETE FROM users WHERE id='${adminId}';`);
  rmSync(directory, { recursive: true, force: true });
}
