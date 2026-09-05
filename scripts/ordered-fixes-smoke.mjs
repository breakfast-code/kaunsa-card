import { chromium } from "playwright-core";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({ headless: true, executablePath: chrome });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.setItem("kaunsa-card-wallet-v2", JSON.stringify({
    saved: ["hdfc-infinia", "icici-amazon-pay"],
    active: ["hdfc-infinia", "icici-amazon-pay"],
  })));
  await page.reload();
  await page.getByRole("heading", { name: "What are you paying for?" }).waitFor();
  await page.getByLabel("Merchant or website").fill("Amazon");
  await page.getByLabel("Amount").fill("4000");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: /Find the best way to pay/ }).click();
  const winner = page.getByRole("heading", { name: "BEST WAY TO PAY" });
  await winner.waitFor();
  await page.waitForFunction(() => window.scrollY === 0);
  if (!(await winner.isVisible())) throw new Error("BEST WAY TO PAY is not visible");
  console.log("PASS 1: result opens at scrollY 0 and BEST WAY TO PAY is visible at 390px.");

  const allCards = [
    "hdfc-dcb-metal", "hdfc-infinia", "hdfc-regalia-gold", "hdfc-millennia",
    "icici-amazon-pay", "icici-epm", "icici-sapphiro", "axis-atlas", "axis-ace",
    "axis-flipkart", "amex-plat-travel", "amex-mrcc", "amex-gold", "sbi-cashback",
    "sbi-simplyclick", "hsbc-premier", "hsbc-travelone", "hsbc-live-plus", "scapia-visa",
  ];
  await page.goto(baseUrl);
  await page.evaluate((ids) => localStorage.setItem("kaunsa-card-wallet-v2", JSON.stringify({ saved: ids, active: ids })), allCards);
  await page.reload();
  await page.getByRole("heading", { name: "What are you paying for?" }).waitFor();
  await page.getByLabel("Merchant or website").fill("Taj Hotels");
  await page.getByLabel("Amount").fill("4000");
  await page.getByRole("button", { name: "Hotel" }).click();
  await page.getByRole("button", { name: /Find the best way to pay/ }).click();
  await page.getByText("₹360–₹1,440").waitFor();
  const winningRoute = await page.locator(".route-callout").innerText();
  if (!winningRoute.includes("SmartBuy")) throw new Error(`Expected conservative re-ranking to SmartBuy; got ${winningRoute}`);
  console.log("PASS 2: HSBC shows ₹360–₹1,440 and SmartBuy wins on the conservative value.");

  async function atlasFlight(merchant) {
    await page.goto(baseUrl);
    await page.evaluate(() => localStorage.setItem("kaunsa-card-wallet-v2", JSON.stringify({ saved: ["axis-atlas"], active: ["axis-atlas"] })));
    await page.reload();
    await page.getByRole("heading", { name: "What are you paying for?" }).waitFor();
    await page.getByLabel("Merchant or website").fill(merchant);
    await page.getByLabel("Amount").fill("4000");
    await page.getByRole("button", { name: "Flight" }).click();
    await page.getByRole("button", { name: /Find the best way to pay/ }).click();
    return {
      points: await page.locator(".points-first strong").innerText(),
      unknown: await page.getByText("Using general card rates for this merchant.").count(),
    };
  }
  const makeMyTrip = await atlasFlight("MakeMyTrip");
  const invented = await atlasFlight("A Shop I Invented");
  if (makeMyTrip.unknown !== 0 || invented.unknown !== 1) throw new Error("Unknown-merchant honesty message is incorrect");
  console.log(`PASS 4: MakeMyTrip is recognized; an unknown merchant shows the honesty message.`);

  await page.goto(baseUrl);
  await page.evaluate((ids) => localStorage.setItem("kaunsa-card-wallet-v2", JSON.stringify({ saved: ids, active: ids })), allCards);
  await page.reload();
  await page.getByRole("heading", { name: "What are you paying for?" }).waitFor();
  await page.getByLabel("Merchant or website").fill("Amazon");
  await page.getByLabel("Amount").fill("4000");
  await page.getByRole("button", { name: /Find the best way to pay/ }).click();
  await page.getByRole("heading", { name: /BEST (WAY TO PAY|AVAILABLE ESTIMATE)/ }).waitFor();
  await page.locator(".result a[href]").first().waitFor();
  const shownRoutes = 1 + await page.locator(".route-option").count();
  const sourceLinks = page.locator(".result a[href]");
  const linkCount = await sourceLinks.count();
  if (shownRoutes !== linkCount) throw new Error(`Expected ${shownRoutes} source links, found ${linkCount}`);
  for (let index = 0; index < linkCount; index += 1) {
    if (!/checked 30 Aug 2026/i.test(await sourceLinks.nth(index).innerText())) throw new Error(`Source link ${index + 1} lacks its checked date`);
  }
  console.log(`PASS 5: all ${shownRoutes} shown routes have a source link and checked date.`);

  await page.evaluate(() => localStorage.setItem("kaunsa-card-wallet-v2", JSON.stringify({ saved: ["axis-atlas"], active: ["axis-atlas"] })));
  await page.goto(`${baseUrl}/?m=air-india&amt=4000&type=flight&mode=online`);
  await page.getByRole("heading", { name: /BEST (WAY TO PAY|AVAILABLE ESTIMATE)/ }).waitFor();
  await page.getByText("Pay Air India directly", { exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: /BEST (WAY TO PAY|AVAILABLE ESTIMATE)/ }).waitFor();
  if (!page.url().includes("m=air-india&amt=4000&type=flight&mode=online")) throw new Error(`Purchase query was lost: ${page.url()}`);
  console.log("PASS 6: the direct purchase URL opens and survives refresh on the result page.");

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(baseUrl);
  const sample = await desktop.locator(".proof-demo").boundingBox();
  if (!sample || sample.x < 0 || sample.y < 0 || sample.x + sample.width > 1440 || sample.y + sample.height > 900) {
    throw new Error(`Landing sample is out of bounds: ${JSON.stringify(sample)}`);
  }
  await desktop.screenshot({ path: "/tmp/kaunsa-fix-7-1440x900.png" });
  await desktop.close();
  console.log("PASS 7: the full sample card is within the 1440×900 viewport; screenshot saved in /tmp.");

  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const landingTargets = await page.locator(".logo, footer a").evaluateAll((elements) => elements.map((element) => ({ label: element.textContent?.trim(), height: element.getBoundingClientRect().height })));
  for (const target of landingTargets) if (target.height < 44) throw new Error(`${target.label} tap target is ${target.height}px tall`);
  const coverageStyle = await page.locator(".coverage-note").evaluate((element) => {
    const style = getComputedStyle(element);
    return { border: style.borderStyle, background: style.backgroundColor };
  });
  if (coverageStyle.border !== "none" || coverageStyle.background !== "rgba(0, 0, 0, 0)") throw new Error(`Coverage label still looks interactive: ${JSON.stringify(coverageStyle)}`);

  await page.evaluate(() => localStorage.setItem("kaunsa-card-wallet-v2", JSON.stringify({ saved: ["axis-atlas"], active: ["axis-atlas"] })));
  await page.reload();
  await page.getByRole("button", { name: /My Wallet/ }).click();
  await page.getByPlaceholder("Search card name or bank").fill("No Such Card");
  await page.getByText("Nothing matched", { exact: true }).waitFor();
  const emptyY = await page.getByText("Nothing matched", { exact: true }).evaluate((element) => element.getBoundingClientRect().top);
  const requestY = await page.getByRole("button", { name: /Request it/ }).evaluate((element) => element.getBoundingClientRect().top);
  if (emptyY >= requestY) throw new Error("Nothing matched is not above the request link");

  await page.goto(`${baseUrl}/?m=air-india&amt=4000&type=flight&mode=online`);
  await page.getByRole("heading", { name: /BEST (WAY TO PAY|AVAILABLE ESTIMATE)/ }).waitFor();
  const resultLinkHeight = await page.locator(".math a").evaluate((element) => element.getBoundingClientRect().height);
  if (resultLinkHeight < 44) throw new Error(`Official terms tap target is ${resultLinkHeight}px tall`);
  console.log("PASS 8: empty search, 44px tap targets and plain coverage label all pass.");
} finally {
  await browser.close();
}
