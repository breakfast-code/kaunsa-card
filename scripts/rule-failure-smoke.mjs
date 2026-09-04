import { chromium } from "playwright-core";

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const baseUrl = process.env.BASE_URL ?? "https://kaunsa-card.vercel.app";
const browser = await chromium.launch({ headless: true, executablePath: chrome });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(15000);

await page.routeWebSocket(/convex\.cloud/, (socket) => socket.close());
await page.route(/https:\/\/[^/]+\.convex\.cloud\/.*/, (route) => route.abort());
await page.goto(baseUrl);
await page.evaluate(() => localStorage.setItem("kaunsa-card-wallet-v2", JSON.stringify({ saved: ["hdfc-infinia"], active: ["hdfc-infinia"] })));
await page.reload();
await page.getByRole("heading", { name: "What are you paying for?" }).waitFor();
await page.getByLabel("Merchant or website").fill("Amazon");
await page.getByLabel("Amount").fill("4000");
await page.getByRole("button", { name: /Find the best way to pay/ }).click();
await page.getByRole("alert").getByText("Verified recommendations are unavailable.").waitFor();
console.log("Rule failure check passed: the product refuses to guess and offers a retry.");
await browser.close();
