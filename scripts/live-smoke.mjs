import { chromium } from "playwright-core";

const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ headless: true, executablePath: chrome });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(10000);
const failures = [];

async function wallet(ids) {
  await page.goto("https://kaunsa-card.vercel.app");
  await page.evaluate((cardIds) => localStorage.setItem("kaunsa-card-wallet-v2", JSON.stringify({ saved: cardIds, active: cardIds })), ids);
  await page.reload();
  await page.waitForURL(/step=ask/);
}

async function expectText(label, text) {
  const body = await page.locator("body").innerText();
  if (!body.includes(text)) failures.push(`${label}: missing “${text}”`);
}

async function findRecommendation() {
  await page.getByRole("button", { name: /Find the best way to pay/ }).click();
  await page.getByRole("heading", { name: /BEST (WAY TO PAY|AVAILABLE ESTIMATE)/ }).waitFor();
}

await wallet(["hdfc-infinia", "hdfc-dcb-metal"]);
console.log("Checking Amazon cap and split…");
await page.getByLabel("Merchant or website").fill("Amazon");
await page.getByLabel("Amount").fill("15000");
await findRecommendation();
await expectText("Amazon cap", "₹10,000 Amazon Shopping Voucher");
await expectText("Amazon split", "remaining ₹5,000 directly");
await page.goBack();
console.log("Checking browser back and exhausted allowance…");
await page.getByRole("heading", { name: "What are you paying for?" }).waitFor();
await page.getByLabel("Merchant or website").fill("Amazon");
await page.getByLabel("Amount").fill("15000");
await page.getByLabel("Amazon vouchers bought this month").fill("10000");
await findRecommendation();
await expectText("Exhausted voucher allowance", "Pay Amazon directly");

await wallet(["hsbc-premier", "axis-atlas"]);
console.log("Checking fee-sensitive flight…");
await page.getByLabel("Merchant or website").fill("IndiGo");
await page.getByLabel("Amount").fill("1800");
await page.getByRole("button", { name: "Flight" }).click();
await findRecommendation();
await expectText("Fee-sensitive flight winner", "Pay IndiGo directly");
await expectText("Flight card", "ATLAS Credit Card");

await wallet(["sbi-cashback"]);
console.log("Checking SBI exclusion…");
await page.getByLabel("Merchant or website").fill("Electricity board");
await page.getByLabel("Amount").fill("10000");
await page.getByLabel("More specific category").selectOption("utility");
await findRecommendation();
await expectText("SBI exclusion", "This category is excluded");
await expectText("SBI excluded value", "₹0 estimated value");

await wallet(["icici-amazon-pay"]);
console.log("Checking Amazon gift-card rate…");
await page.getByLabel("Merchant or website").fill("Amazon");
await page.getByLabel("Amount").fill("4000");
await page.getByLabel("More specific category").selectOption("gift-card");
await findRecommendation();
await expectText("Amazon gift-card rule", "2% Amazon Pay balance");
await expectText("Amazon gift-card value", "₹80 estimated value");

await wallet(["axis-atlas"]);
console.log("Checking Atlas online-travel-agent rate…");
await page.getByLabel("Merchant or website").fill("MakeMyTrip");
await page.getByLabel("Amount").fill("18000");
await page.getByRole("button", { name: "Flight" }).click();
await findRecommendation();
await expectText("Atlas OTA base rate", "360 EDGE Miles");

console.log("Checking jewellery merchant classification…");
await page.goto("https://kaunsa-card.vercel.app/?m=kalyan-jewellers&amt=6000&type=general&mode=store");
await page.getByRole("heading", { name: /BEST (WAY TO PAY|AVAILABLE ESTIMATE)/ }).waitFor();
await expectText("Kalyan classification", "This category is excluded from ATLAS EDGE Miles");
await expectText("Kalyan excluded value", "₹0 estimated value");

await wallet(["amex-plat-travel"]);
console.log("Checking Amex insurance exclusion…");
await page.getByLabel("Merchant or website").fill("Insurance company");
await page.getByLabel("Amount").fill("10000");
await page.getByLabel("More specific category").selectOption("insurance");
await findRecommendation();
await expectText("Amex insurance exclusion", "This category is excluded");
await expectText("Amex insurance value", "₹0 estimated value");

await wallet(["scapia-visa"]);
console.log("Checking Scapia gift-card exclusion…");
await page.getByLabel("Merchant or website").fill("Gift card shop");
await page.getByLabel("Amount").fill("10000");
await page.getByLabel("More specific category").selectOption("gift-card");
await findRecommendation();
await expectText("Scapia gift-card exclusion", "Gift cards are excluded");
await expectText("Scapia gift-card value", "₹0 estimated value");
await page.getByText("Was this useful?").waitFor();
await page.getByRole("button", { name: "Yes" }).click();
if (await page.getByRole("button", { name: "Send feedback" }).isEnabled()) failures.push("Feedback: Send feedback was enabled without a first name");

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Live checks passed: eight purchase and navigation scenarios.");
