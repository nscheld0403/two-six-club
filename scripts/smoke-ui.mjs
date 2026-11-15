#!/usr/bin/env node
// UI smoke test against a running production build (default http://localhost:3100).
// Checks public pages, route protection and server-side validation. Writes
// screenshots to ./.smoke/ for visual review against the approved design.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const out = ".smoke";
mkdirSync(out, { recursive: true });

const results = [];
const check = (ok, name) => {
  results.push({ ok, name });
  console.log(`${ok ? "ok  " : "FAIL"} - ${name}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// Route protection: signed-out visitors land on /welcome.
for (const path of ["/", "/schedule", "/admin", "/admin/members", "/account", "/pending"]) {
  const res = await page.goto(BASE + path);
  check(new URL(page.url()).pathname === "/welcome" && res.ok(), `signed-out ${path} redirects to /welcome`);
}

// Welcome
await page.goto(BASE + "/welcome");
check(await page.getByRole("heading", { name: /train with your people/i }).isVisible(), "welcome headline renders");
await page.screenshot({ path: `${out}/welcome.png` });

// Join: server-side validation errors
await page.getByRole("link", { name: "Request to join" }).click();
await page.waitForURL("**/join");
await page.getByRole("button", { name: "Request membership" }).click();
await page.getByText("Enter your name").waitFor({ timeout: 10000 });
check(true, "join shows name error when empty");
check(await page.getByText(/enter your birthday/i).isVisible(), "join shows birthday error when empty");

await page.getByLabel("Name").fill("Test Person");
await page.getByLabel("Birthday").fill(`${new Date().getFullYear() - 9}-03-15`);
await page.getByText("Male", { exact: true }).click();
await page.getByRole("button", { name: "Request membership" }).click();
await page.getByText("Members must be 13 or older").waitFor({ timeout: 10000 });
check(await page.getByLabel("Name").inputValue() === "Test Person", "join keeps entered values after a validation error");
check(await page.getByLabel("Male", { exact: true }).isChecked(), "join keeps sex selection");
await page.screenshot({ path: `${out}/join-errors.png` });

// Sign in: client-side format check
await page.goto(BASE + "/sign-in");
await page.getByLabel("Sign-in code").fill("not-a-code");
await page.getByRole("button", { name: "Sign in" }).click();
check(await page.getByText(/doesn't look like a sign-in code/i).isVisible(), "sign-in rejects malformed code");
await page.screenshot({ path: `${out}/sign-in.png` });

// Desktop width keeps the phone column centred
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(BASE + "/welcome");
const box = await page.locator("main").first().boundingBox();
check(box && box.width <= 480 && box.x > 300, "desktop centres the member column");
await page.screenshot({ path: `${out}/welcome-desktop.png` });

check(errors.length === 0, `no uncaught page errors${errors.length ? ": " + errors.join(" | ") : ""}`);

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
