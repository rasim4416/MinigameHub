import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Run against the running development app. Supply a system Chromium path if needed.
const browser = await chromium.launch({
  headless: true,
  ...(process.argv[2] ? { executablePath: process.argv[2] } : {}),
  args: ["--no-sandbox"],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (error) => errors.push(error.message));
const base = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "http://127.0.0.1:5000";
const go = () => page.goto(`${base}/minigames/chess`);
const next = () => page.getByRole("button", { name: "Continue", exact: true });
const square = (r, c) => page.locator('div.grid[style*="grid-template-columns"]').first().locator(":scope > div").nth(r * 8 + c);
async function continueUntilAction() {
  for (let i = 0; i < 25 && await next().isVisible(); i++) {
    await next().click();
    await page.waitForTimeout(100);
  }
}
try {
  await go();
  await page.getByRole("heading", { name: "Chess Augmented", exact: true }).waitFor();
  await page.getByRole("button", { name: /Augment guide/ }).click();
  const search = page.getByPlaceholder(/Search/i);
  await search.fill("Necromancer");
  assert.equal(await page.locator("article").count(), 3, "all three resurrection augments are searchable");
  await search.fill("not-an-augment");
  assert.equal(await page.locator("article").count(), 0);
  await go();
  await page.getByRole("button", { name: /Tutorial Learn/ }).click();
  await continueUntilAction();
  await square(6, 3).click();
  await square(5, 3).click();
  await continueUntilAction();
  // The closed shop retains its rows in the DOM for its height transition;
  // use the tutorial's actionable card rather than an offscreen duplicate.
  await page.locator('[data-tutorial-id="tutorial-augment-what"]').click();
  await continueUntilAction();
  await page.locator('[data-tutorial-id="spell-what"]').click();
  await square(5, 3).click();
  await square(5, 2).click();
  await continueUntilAction();
  await page.locator('[data-tutorial-id="shop-buy-miner"]').click();
  await continueUntilAction();
  await page.getByRole("heading", { name: "Chess Augmented", exact: true }).waitFor({ timeout: 10000 });
  console.log("PASS: guide search and full interactive tutorial complete");

  await page.setViewportSize({ width: 390, height: 844 });
  await go();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile menu fits viewport");
  await page.getByRole("button", { name: "TR", exact: true }).click();
  await page.getByRole("button", { name: /Eğitim/ }).click();
  await page.getByRole("button", { name: "Devam et", exact: true }).waitFor();
  await page.waitForTimeout(400); // Allow the tutorial panel's entrance transition to finish.
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile tutorial fits viewport");
  await page.screenshot({ path: "/tmp/chess-tutorial-mobile.png" });
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log("PASS: Turkish tutorial, mobile layout, no runtime errors");
} catch (error) {
  await page.screenshot({ path: "/tmp/chess-ui-failure.png" });
  console.error((await page.locator("body").innerText()).slice(-2200));
  throw error;
} finally {
  await browser.close();
}