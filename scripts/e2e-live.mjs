#!/usr/bin/env node
// Live end-to-end test, driven in phases so the database steps (approve,
// seed a test workout/class, clean up) can run in between via SQL.
//
//   node scripts/e2e-live.mjs register   -> registers test members, prints their sign-in codes as JSON
//   node scripts/e2e-live.mjs member     -> member flows (needs approval + seed first)
//
// Test members are named "E2E Test ..." so they are easy to find and delete.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const BASE = process.env.BASE_URL ?? "https://two-six-club.vercel.app";
const STATE = ".smoke/e2e-state.json";
mkdirSync(".smoke", { recursive: true });
const results = [];
const check = (ok, name, extra = "") => {
  results.push({ ok, name });
  console.log(`${ok ? "ok  " : "FAIL"} - ${name}${extra ? ` (${extra})` : ""}`);
};
const phase = process.argv[2];
const browser = await chromium.launch();
const errors = [];

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  return page;
}

async function register(name, age, sex) {
  const page = await newPage();
  await page.goto(`${BASE}/join`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Age").fill(String(age));
  await page.getByText(sex, { exact: true }).click();
  await page.getByRole("button", { name: "Request membership" }).click();
  const code = await page.getByLabel("Sign-in code").textContent({ timeout: 30000 });
  await page.getByRole("link", { name: /saved my code/i }).click();
  await page.waitForURL("**/pending", { timeout: 20000 });
  const pendingShown = await page.getByText("Pending approval").isVisible();
  return { page, code: code.trim(), pendingShown };
}

try {
  if (phase === "register") {
    const a = await register("E2E Test Alpha", 34, "Male");
    check(/^[0-9A-Z]{6}(-[0-9A-Z]{4}){4}$/.test(a.code), "registration shows a sign-in code");
    check(a.pendingShown, "new member lands on Pending approval");
    // Pending member is locked out of club pages.
    await a.page.goto(`${BASE}/schedule`);
    await a.page.waitForURL("**/pending", { timeout: 20000 });
    check(true, "pending member is redirected away from the schedule");
    await a.page.goto(`${BASE}/admin`);
    await a.page.waitForURL(/\/(pending|welcome)$/, { timeout: 20000 });
    check(true, "pending member cannot open the admin area");
    await a.page.screenshot({ path: ".smoke/live-pending.png" });

    const b = await register("E2E Test Bravo", 41, "Female");
    check(b.pendingShown, "second member registers");
    writeFileSync(STATE, JSON.stringify({ alpha: a.code, bravo: b.code }));
    console.log("CODES_WRITTEN");
  }

  if (phase === "member") {
    const { alpha, bravo } = JSON.parse(readFileSync(STATE, "utf8"));

    // Sign in with the code on a fresh device.
    const page = await newPage();
    await page.goto(`${BASE}/sign-in`);
    await page.getByLabel("Sign-in code").fill("ZZZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText(/didn't work/i).waitFor({ timeout: 20000 });
    check(true, "a wrong sign-in code is rejected");
    await page.getByLabel("Sign-in code").fill(alpha.toLowerCase().replace(/-/g, " "));
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 30000 });
    check(true, "approved member signs in with their code (lower-case, spaces)");

    // Home shows today's workout and next class.
    await page.getByText("E2E TEST WOD", { exact: false }).first().waitFor({ timeout: 20000 });
    check(true, "home shows today's published workout");
    check(await page.getByText("E2E Test Class").first().isVisible(), "home shows the next class");
    await page.screenshot({ path: ".smoke/live-home.png" });

    // RSVP from home.
    if (!(await page.getByText(/You're in/).count())) await page.getByRole("button", { name: "Reserve spot" }).click();
    await page.getByText(/You're in/).waitFor({ timeout: 20000 });
    check(true, "RSVP from home: Reserve spot -> You're in");

    // Schedule shows the booking.
    await page.goto(`${BASE}/schedule`);
    await page.getByRole("button", { name: /going/i }).first().waitFor({ timeout: 20000 });
    check(true, "schedule shows the class as Going");
    await page.getByRole("button", { name: /E2E Test Class/ }).click();
    await page.getByText("E2E Test Alpha").waitFor({ timeout: 20000 });
    check(true, "class sheet lists who's coming");
    await page.screenshot({ path: ".smoke/live-schedule.png" });
    await page.keyboard.press("Escape");

    // Workout detail + level toggle.
    await page.goto(`${BASE}/`);
    await page.getByRole("link", { name: /View workout/ }).click();
    await page.getByRole("tab", { name: /Level 1/ }).click();
    check(await page.getByText("400 m row").isVisible(), "Level 1 text shows after toggling");
    await page.getByRole("tab", { name: /Level 2/ }).click();
    check(await page.getByText("500 m row").isVisible(), "Level 2 text shows after toggling");
    await page.screenshot({ path: ".smoke/live-workout.png" });

    // Log a for-time result.
    await page.goto(`${BASE}/log`);
    await page.getByRole("link", { name: /E2E Metcon/ }).click();
    await page.getByLabel("Minutes").fill("12");
    await page.getByLabel("Seconds").fill("34");
    await page.getByRole("radio", { name: "RPE 8" }).click();
    await page.getByRole("button", { name: "Save result" }).click();
    await page.getByText("Result saved").waitFor({ timeout: 20000 });
    check(await page.getByText("12:34").first().isVisible(), "for-time result saves as 12:34");
    await page.screenshot({ path: ".smoke/live-logged.png" });

    // Log strength sets (two sessions to get a PR and a trend).
    await page.goto(`${BASE}/log`);
    await page.getByRole("link", { name: /E2E Back Squat/ }).click();
    for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Add set" }).click();
    for (let i = 1; i <= 3; i++) {
      await page.getByLabel(`Set ${i} reps`).fill("3");
      await page.getByLabel(`Set ${i} load in pounds`).fill(String(185 + i * 10));
    }
    await page.getByRole("button", { name: "Save result" }).click();
    await page.getByText("Result saved").waitFor({ timeout: 20000 });
    check(await page.getByText("215 lb").first().isVisible(), "strength sets save with top set 215 lb");

    // Free-form lift log on an earlier date -> PR detection on the class log is relative.
    await page.goto(`${BASE}/log/new`);
    await page.getByLabel("Movement").selectOption({ label: "Deadlift" });
    await page.getByLabel("Set 1 reps").fill("5");
    await page.getByLabel("Set 1 load in pounds").fill("225");
    await page.getByRole("button", { name: "Save result" }).click();
    await page.getByText("Result saved").waitFor({ timeout: 20000 });
    check(true, "free-form lift log saves");
    await page.goto(`${BASE}/log/new`);
    await page.getByLabel("Movement").selectOption({ label: "Deadlift" });
    await page.getByLabel("Set 1 reps").fill("5");
    await page.getByLabel("Set 1 load in pounds").fill("245");
    await page.getByRole("button", { name: "Save result" }).click();
    await page.getByText("New personal record").waitFor({ timeout: 20000 });
    check(true, "heavier lift is flagged as a new personal record");

    // Leaderboard.
    await page.goto(`${BASE}/leaderboard`);
    await page.getByText("E2E Test Alpha").first().waitFor({ timeout: 20000 });
    check(true, "leaderboard lists the member's score");
    await page.screenshot({ path: ".smoke/live-leaderboard.png" });

    // Progress.
    await page.goto(`${BASE}/progress`);
    await page.getByText("Personal records").waitFor({ timeout: 20000 });
    check(await page.getByText("History").isVisible(), "progress shows records and history");
    await page.screenshot({ path: ".smoke/live-progress.png", fullPage: true });

    // Privacy toggle: hide results.
    await page.goto(`${BASE}/account`);
    await page.getByText("Show my results to members").click();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("button", { name: "Saved" }).waitFor({ timeout: 20000 });
    check(true, "member can hide results in account settings");

    // Second member: class is full (capacity 1), Maybe allowed, hidden results not shown.
    const p2 = await newPage();
    await p2.goto(`${BASE}/sign-in`);
    await p2.getByLabel("Sign-in code").fill(bravo);
    await p2.getByRole("button", { name: "Sign in" }).click();
    await p2.waitForURL(`${BASE}/`, { timeout: 30000 });
    await p2.goto(`${BASE}/schedule`);
    await p2.getByRole("button", { name: /E2E Test Class/ }).click();
    const goingBtn = p2.getByRole("radio", { name: "Full" });
    check(await goingBtn.isDisabled(), "a full class blocks Going for another member");
    const saved = p2.waitForResponse((r) => r.request().method() === "POST", { timeout: 20000 });
    await p2.getByRole("radio", { name: "Maybe" }).click();
    check((await saved).ok(), "Maybe RSVP request succeeds");
    await p2.waitForTimeout(1500);
    await p2.getByRole("radio", { name: "Maybe", checked: true }).waitFor({ timeout: 20000 });
    check(true, "Maybe is allowed when the class is full");
    await p2.keyboard.press("Escape");
    await p2.goto(`${BASE}/leaderboard`);
    await p2.waitForLoadState("networkidle");
    check(!(await p2.getByText("E2E Test Alpha").count()), "hidden results are not shown to other members");
    await p2.goto(`${BASE}/admin`);
    await p2.waitForURL(`${BASE}/`, { timeout: 20000 });
    check(true, "a regular member is kept out of the admin area");

    // Sign out works.
    await page.goto(`${BASE}/account`);
    await page.getByRole("button", { name: /Sign out/ }).click();
    await page.waitForURL("**/welcome", { timeout: 20000 });
    check(true, "sign out returns to the welcome screen");
  }
} catch (err) {
  check(false, `unexpected failure: ${String(err).split("\n")[0]}`);
}

check(errors.length === 0, "no browser errors", errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
