import { chromium } from "playwright-core";

const baseUrl = process.env.BASE_URL ?? "https://kaunsa-card.vercel.app";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ headless: true, executablePath: chrome });

async function check(viewport, screenshot) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(10000);
  await page.goto(baseUrl);
  await page.getByText("21 cards supported", { exact: true }).waitFor();
  await page.getByText("₹156 more value", { exact: true }).waitFor({ timeout: 12000 });
  await page.getByRole("button", { name: "Pause example" }).click();
  await page.getByRole("button", { name: "Play example" }).waitFor();
  await page.screenshot({ path: screenshot, fullPage: true });
  await page.getByRole("button", { name: /Check my cards/ }).click();
  await page.getByRole("heading", { name: /What’s in your wallet/ }).waitFor();
  await page.close();
}

await check({ width: 1440, height: 900 }, "/tmp/kaunsa-home-desktop.png");
await check({ width: 390, height: 844 }, "/tmp/kaunsa-home-mobile.png");
await browser.close();
console.log("Homepage checks passed on desktop and phone. Screenshots saved in /tmp.");
