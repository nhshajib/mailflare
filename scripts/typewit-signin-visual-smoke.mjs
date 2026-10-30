// Local-only browser checks for the public administrator sign-in screen.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: process.env.TYPEWIT_BROWSER_EXECUTABLE || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : "/usr/bin/google-chrome"), headless: true, args: ["--no-sandbox"] });
try {
  for (const theme of ["light", "dark"]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 640 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
      const context = await browser.newContext({ viewport, colorScheme: theme, baseURL: "http://localhost:3001" });
      await context.addInitScript(theme => localStorage.setItem("mailflare-theme", theme), theme);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const response = await page.goto("/");
      assert.equal(response.status(), 200);
      await page.locator('input[name="password"]').waitFor();
      await page.waitForFunction(() => { const form = document.querySelector("form"); return form && Object.keys(form).some(k => k.startsWith("__reactProps")); });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${theme} ${viewport.width}: overflow`);
      assert.equal(await page.locator("main").evaluate(el => getComputedStyle(el).colorScheme), "light");
      assert.equal(await page.locator("section").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
      assert.equal(await page.locator('a[href="/register"], a[href="/signup"]').count(), 0);
      await page.locator("#email").fill("admin@example.invalid");
      await page.locator("#password").fill("visibility-test-only");
      await page.getByRole("button", { name: "Show password", exact: true }).click();
      assert.equal(await page.locator("#password").getAttribute("type"), "text");
      await page.getByRole("button", { name: "Hide password", exact: true }).click();
      assert.equal(await page.locator("#password").getAttribute("type"), "password");
      await page.route("**/api/auth/login", route => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Invalid credentials" }) }));
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.getByRole("alert").waitFor();
      const contrast = await page.locator('h1, label, section p, input, button[type="submit"], [role="alert"], footer a').evaluateAll(elements => {
        const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
        const luminance = values => values.slice(0, 3).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        return elements.map(el => {
          const style = getComputedStyle(el);
          let parent = el, bg;
          while (parent) { bg = rgb(getComputedStyle(parent).backgroundColor); if (bg.length === 3 || bg[3] === 1) break; parent = parent.parentElement; }
          const a = luminance(rgb(style.color)), b = luminance(bg || [255, 255, 255]);
          return { name: el.getAttribute("name") || el.tagName, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
        });
      });
      for (const result of contrast) assert.ok(result.ratio >= 4.5, `${theme} ${viewport.width}: ${result.name} contrast ${result.ratio}`);
      await page.locator("#email").focus();
      assert.equal(await page.locator("#email").evaluate(el => el === document.activeElement), true);
      const client = await context.newCDPSession(page);
      await client.send("DOM.enable");
      await client.send("CSS.enable");
      const { root } = await client.send("DOM.getDocument");
      const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#email" });
      await client.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["autofill"] });
      assert.equal(await page.locator("#email").evaluate(el => getComputedStyle(el).webkitTextFillColor), "rgb(23, 36, 61)");
      assert.match(await page.locator("#email").evaluate(el => getComputedStyle(el).boxShadow), /1000px/, "Browser autofill colors must be overridden");
      assert.equal(await page.evaluate(() => localStorage.getItem("mailflare-theme")), theme, "The sign-in page must preserve the saved inbox theme");
      if (process.env.TYPEWIT_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.TYPEWIT_SCREENSHOT_DIR}/typewit-signin-${theme}-${viewport.width}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
  const recoveryContext = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", baseURL: "http://localhost:3001" });
  await recoveryContext.addInitScript(() => localStorage.setItem("mailflare-theme", "dark"));
  const recovery = await recoveryContext.newPage();
  for (const path of ["/forgot-password", "/reset-password?token=local-visual-test"]) {
    await recovery.goto(path);
    await recovery.locator("h1").waitFor();
    assert.equal(await recovery.locator("section").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
    assert.equal(await recovery.locator("h1").evaluate(el => getComputedStyle(el).color), "rgb(20, 33, 59)");
    assert.equal(await recovery.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await recovery.goto("/");
  await recovery.waitForFunction(() => { const form = document.querySelector("form"); return form && Object.keys(form).some(k => k.startsWith("__reactProps")); });
  await recovery.route("**/api/auth/login", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ mfaRequired: true, challengeToken: "local-visual-challenge" }) }));
  await recovery.locator("#email").fill("admin@example.invalid");
  await recovery.locator("#password").fill("local-visual-only");
  await recovery.getByRole("button", { name: "Sign in", exact: true }).click();
  await recovery.locator("#code").waitFor();
  assert.equal(await recovery.locator("#code").evaluate(el => getComputedStyle(el).color), "rgb(23, 36, 61)");
  assert.equal(await recovery.locator("section").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
  await recoveryContext.close();
  console.log("PASS: sign-in contrast, saved light/dark themes, autofill, password visibility, errors, focus, four viewport sizes, recovery and MFA screens. No external delivery or authentication changes.");
} finally { await browser.close(); }
