import { describe, expect, it } from "vitest";
import { calculateDirectRecommendations, calculateRecommendations, type PrivateDirectRule, type PrivateRouteRule } from "./recommendationEngine";
import type { RedemptionProfile } from "./redemptionEngine";

const cards = [
  { cardKey: "alpha", name: "Alpha", issuer: "Test Bank" },
  { cardKey: "beta", name: "Beta", issuer: "Test Bank" },
];

const rule = (overrides: Partial<PrivateDirectRule> = {}): PrivateDirectRule => ({
  ruleKey: "alpha-base-v1", cardKey: "alpha", priority: 1, purchaseTypes: ["shopping"], paymentModes: ["online"], merchantIncludes: [],
  outcome: "percentage", rate: 0.02, rewardCurrency: "cashback", pointValueMin: 1, pointValueMax: 1,
  matchedRule: "Eligible online purchase", sourceUrl: "https://bank.example/rules", checkedAt: 1, version: 1, status: "approved", ...overrides,
});

const route = (overrides: Partial<PrivateRouteRule> = {}): PrivateRouteRule => ({
  routeKey: "alpha-voucher", cardKey: "alpha", platformName: "Test Vouchers", merchantKey: "shop",
  sourceUrl: "https://bank.example/voucher", routeType: "voucher", purchaseType: "shopping", paymentMode: "online",
  baseSpend: 100, baseEarn: 1, multiplier: 5, rewardCurrency: "points", pointValueMin: 1, pointValueMax: 1,
  capValue: 10000, capUnit: "₹ voucher purchases", evidence: "Official test terms", checkedAt: 1,
  ...overrides,
});

const profile = (cardKey: string, rewardCurrency: string, rupeesPerUnit = 1): RedemptionProfile => ({
  cardKey, rewardCurrency, version: 1, status: "approved",
  options: [{
    optionKey: `${cardKey}-${rewardCurrency}`, label: "Test redemption", unitsPerReward: 1, rupeesPerUnit,
    valueType: "guaranteed", rulesSourceUrl: "https://bank.example/rules", valueSourceUrl: "https://bank.example/value",
    valueSourceKind: "official", checkedAt: 1,
  }],
});

const atlasProfile: RedemptionProfile = {
  cardKey: "axis-atlas", rewardCurrency: "EDGE Miles", version: 1, status: "approved",
  options: [
    {
      optionKey: "partner-transfer", label: "eligible partner transfer", unitsPerReward: 2, rupeesPerUnit: 1,
      valueType: "estimated", assumption: "Assumes an eligible 1:2 transfer partner and ₹1 value per partner point.",
      rulesSourceUrl: "https://www.axisbank.com/retail/cards/credit-card/axis-bank-atlas-credit-card",
      valueSourceUrl: "https://www.cardexpert.in/axis-bank-atlas-credit-card-review/", valueSourceKind: "expert", checkedAt: 1,
    },
    {
      optionKey: "travel-edge", label: "Travel EDGE redemption", unitsPerReward: 1, rupeesPerUnit: 1,
      valueType: "guaranteed", rulesSourceUrl: "https://www.axisbank.com/retail/cards/credit-card/axis-bank-atlas-credit-card",
      valueSourceUrl: "https://www.axisbank.com/retail/cards/credit-card/axis-bank-atlas-credit-card", valueSourceKind: "official", checkedAt: 1,
    },
  ],
};

const profiles = [
  profile("alpha", "points"), profile("alpha", "cashback"), profile("beta", "points"), profile("alpha", "Test Points"),
  atlasProfile, profile("hdfc-dcb-metal", "Reward Points", 0.3),
];

describe("private recommendation engine", () => {
  it("calculates and ranks percentage and points rules", () => {
    const results = calculateDirectRecommendations(cards, [
      rule(),
      rule({ ruleKey: "beta-base-v1", cardKey: "beta", outcome: "points", spendBlock: 100, earnPerBlock: 3, rewardCurrency: "points", pointValueMin: 1, pointValueMax: 1 }),
    ], { amount: 1000, merchant: "Shop", purchaseType: "shopping", paymentMode: "online", now: 10 }, profiles);
    expect(results.map((result) => [result.cardKey, result.minValue])).toEqual([["beta", 30], ["alpha", 20]]);
  });

  it("uses the highest-priority matching merchant rule", () => {
    const [result] = calculateDirectRecommendations([cards[0]], [
      rule(),
      rule({ ruleKey: "alpha-partner-v1", priority: 10, merchantIncludes: ["partner"], rate: 0.05, matchedRule: "Partner purchase" }),
    ], { amount: 1000, merchant: "Partner Store", purchaseType: "shopping", paymentMode: "online", now: 10 });
    expect(result.minValue).toBe(50);
    expect(result.matchedRule).toBe("Partner purchase");
  });

  it("applies exclusions and value caps", () => {
    const results = calculateDirectRecommendations(cards, [
      rule({ purchaseTypes: ["fuel"], priority: 20, outcome: "excluded", rate: undefined, matchedRule: "Fuel excluded" }),
      rule({ cardKey: "beta", ruleKey: "beta-cap-v1", purchaseTypes: ["fuel"], rate: 0.1, valueCap: 25 }),
    ], { amount: 1000, merchant: "Fuel Station", purchaseType: "fuel", paymentMode: "online", now: 10 });
    expect(results.find((result) => result.cardKey === "alpha")?.maxValue).toBe(0);
    expect(results.find((result) => result.cardKey === "beta")?.maxValue).toBe(25);
  });

  it("fails closed when no active rule covers the request", () => {
    const [result] = calculateDirectRecommendations([cards[0]], [rule()], { amount: 1000, merchant: "Shop", purchaseType: "hotel", paymentMode: "online", now: 10 });
    expect(result.minValue).toBe(0);
    expect(result.conditional).toBe(true);
    expect(result.matchedRule).toBe("Coverage not verified");
  });

  it("keeps migrated estimates visibly conditional", () => {
    const [result] = calculateDirectRecommendations([cards[0]], [rule({ status: "estimate" })], { amount: 1000, merchant: "Shop", purchaseType: "shopping", paymentMode: "online", now: 10 });
    expect(result.minValue).toBe(20);
    expect(result.conditional).toBe(true);
  });

  it("does not invent a rupee value when a points profile is missing", () => {
    const [result] = calculateDirectRecommendations([cards[0]], [rule({ outcome: "points", rate: undefined, spendBlock: 100, earnPerBlock: 2 })], { amount: 1000, merchant: "Shop", purchaseType: "shopping", paymentMode: "online", now: 10 });
    expect(result.pointsLabel).toBe("20 cashback");
    expect(result.maxValue).toBe(0);
    expect(result.caveat).toContain("redemption value has not been reviewed");
  });

  it("fails closed for HSBC TravelOne until its earning rules are reviewed", () => {
    const travelOne = { cardKey: "hsbc-travelone", name: "TravelOne Credit Card", issuer: "HSBC" };
    const [result] = calculateRecommendations(
      [travelOne],
      [],
      [],
      { amount: 50000, merchant: "Evolve Back", purchaseType: "hotel", paymentMode: "online", now: 10 },
    );
    expect(result.cardKey).toBe("hsbc-travelone");
    expect(result.pointsLabel).toBe("Not estimated");
    expect(result.maxValue).toBe(0);
    expect(result.matchedRule).toBe("Coverage not verified");
    expect(result.conditional).toBe(true);
  });
});

describe("private portal and voucher routes", () => {
  const input = { amount: 15000, merchant: "Shop", purchaseType: "shopping", paymentMode: "online" as const, now: 10 };

  it("applies voucher caps and direct rewards to the remainder", () => {
    const result = calculateRecommendations([cards[0]], [rule()], [route()], input, {}, profiles)
      .find((recommendation) => recommendation.kind === "voucher")!;
    expect(result.action).toContain("₹10,000");
    expect(result.action).toContain("remaining ₹5,000 directly");
    expect(result.pointsLabel).toContain("plus direct rewards on the remainder");
    expect(result.minValue).toBe(600);
  });

  it("uses remaining allowance and removes an exhausted voucher route", () => {
    const partial = calculateRecommendations([cards[0]], [rule()], [route()], { ...input, amount: 6000 }, { voucherSpendThisMonth: 7000 }, profiles)
      .find((recommendation) => recommendation.kind === "voucher")!;
    expect(partial.minValue).toBe(210);
    expect(partial.action).toContain("remaining ₹3,000 directly");

    const exhausted = calculateRecommendations([cards[0]], [rule()], [route()], { ...input, amount: 6000 }, { voucherSpendThisMonth: 10000 }, profiles);
    expect(exhausted.map((recommendation) => recommendation.kind)).toEqual(["direct"]);
  });

  it("caps accelerated points and excludes expired routes", () => {
    const portal = route({ routeKey: "hotel", merchantKey: undefined, routeType: "portal", purchaseType: "hotel", multiplier: 12, capValue: 18000, capUnit: "accelerated points" });
    const capped = calculateRecommendations([cards[0]], [rule({ purchaseTypes: ["hotel"] })], [portal], { ...input, amount: 500000, merchant: "Hotel", purchaseType: "hotel" }, {}, profiles)
      .find((recommendation) => recommendation.kind === "portal")!;
    expect(capped.pointsLabel).toContain("18,000");
    expect(capped.maxValue).toBe(18000);

    const expired = calculateRecommendations([cards[0]], [rule()], [route({ validUntil: 9 })], input, {}, profiles);
    expect(expired.map((recommendation) => recommendation.kind)).toEqual(["direct"]);
  });

  it("discloses portal fees without subtracting them and keeps reviewed routes unconditional", () => {
    const flight = route({ routeKey: "flight", merchantKey: undefined, routeType: "portal", purchaseType: "flight", multiplier: 6, domesticFeePerPassengerLeg: 300 });
    const result = calculateRecommendations([cards[0]], [rule({ purchaseTypes: ["flight"] })], [flight], { ...input, amount: 1800, merchant: "Airline", purchaseType: "flight" }, {}, profiles)
      .find((recommendation) => recommendation.kind === "portal")!;
    expect(result.minValue).toBe(108);
    expect(result.caveat).toContain("Portal fees are not included");
    expect(result.conditional).toBe(false);
  });

  it("applies the remaining SBI statement-cycle cashback allowance", () => {
    const sbi = { cardKey: "sbi-cashback", name: "Test Cashback Card", issuer: "Test Bank" };
    const sbiRule = rule({ cardKey: "sbi-cashback", ruleKey: "sbi-online", rate: 0.05 });
    const [result] = calculateRecommendations([sbi], [sbiRule], [], { ...input, amount: 10000 }, { sbiCashbackEarnedThisCycle: 1800 });
    expect(result.minValue).toBe(200);
    expect(result.maxValue).toBe(200);
    expect(result.caveat).toContain("leaving ₹200");
  });

  it("calculates a generic monthly spend tier and splits spend above its cap", () => {
    const tierRule = rule({
      outcome: "points", rate: undefined, spendBlock: 100, earnPerBlock: undefined,
      usageMetric: "monthly-category-spend", spendTierCap: 2000,
      earnPerBlockWithinTier: 5, earnPerBlockAboveTier: 2, earnPerBlockWhenUsageUnknown: 2,
      matchedRuleWithinTier: "Higher tier", matchedRuleSplitTier: "Split tier",
      matchedRuleUsageUnknown: "Conservative tier", caveatUsageKnown: "Usage supplied",
      caveatUsageUnknown: "Usage needed",
    });
    const [within] = calculateRecommendations([cards[0]], [tierRule], [], { ...input, amount: 500 }, { atlasTravelSpendThisMonth: 1000 }, profiles);
    expect(within.minValue).toBe(25);
    expect(within.matchedRule).toBe("Higher tier");
    expect(within.conditional).toBe(false);

    const [split] = calculateRecommendations([cards[0]], [tierRule], [], { ...input, amount: 1000 }, { atlasTravelSpendThisMonth: 1500 }, profiles);
    expect(split.minValue).toBe(35);
    expect(split.matchedRule).toBe("Split tier");
  });

  it("shows the higher capped rate with a disclaimer when monthly usage is unknown", () => {
    const tierRule = rule({
      outcome: "points", rate: undefined, spendBlock: 100, earnPerBlock: undefined,
      usageMetric: "monthly-category-spend", spendTierCap: 2000,
      earnPerBlockWithinTier: 5, earnPerBlockAboveTier: 2, earnPerBlockWhenUsageUnknown: 2,
      rewardCurrency: "Test Points",
      matchedRuleUsageUnknown: "Conservative tier", caveatUsageUnknown: "Usage needed",
    });
    const [result] = calculateRecommendations([cards[0]], [tierRule], [], { ...input, amount: 1000 }, { atlasTravelSpendThisMonth: null }, profiles);
    expect(result.minValue).toBe(50);
    expect(result.maxValue).toBe(50);
    expect(result.pointsLabel).toBe("50 Test Points");
    expect(result.matchedRule).toBe("Conservative tier");
    expect(result.caveat).toBe("Usage needed");
    expect(result.conditional).toBe(true);
  });

  it("ranks the highest supported redemption value and keeps the cash-like fallback", () => {
    const atlas = { cardKey: "axis-atlas", name: "ATLAS Credit Card", issuer: "Axis Bank" };
    const dcb = { cardKey: "hdfc-dcb-metal", name: "Diners Club Black Metal", issuer: "HDFC Bank" };
    const atlasHotel = rule({
      cardKey: atlas.cardKey, ruleKey: "atlas-direct-hotel", purchaseTypes: ["hotel"], outcome: "points",
      rate: undefined, spendBlock: 100, earnPerBlock: undefined, usageMetric: "monthly-category-spend",
      spendTierCap: 200000, earnPerBlockWithinTier: 5, earnPerBlockAboveTier: 2,
      earnPerBlockWhenUsageUnknown: 2, rewardCurrency: "EDGE Miles",
      matchedRuleUsageUnknown: "5 miles within the monthly cap", caveatUsageUnknown: "Assumes monthly cap remains",
    });
    const dcbHotel = route({
      routeKey: "dcb-smartbuy-hotel", cardKey: dcb.cardKey, platformName: "HDFC SmartBuy", merchantKey: undefined,
      routeType: "portal", purchaseType: "hotel", baseSpend: 150, baseEarn: 5, multiplier: 10,
      rewardCurrency: "Reward Points", pointValueMin: 0.3, pointValueMax: 0.3,
    });
    const results = calculateRecommendations(
      [atlas, dcb],
      [atlasHotel, rule({ cardKey: dcb.cardKey, ruleKey: "dcb-hotel", purchaseTypes: ["hotel"], rate: 0.01 })],
      [dcbHotel],
      { amount: 50000, merchant: "Evolve Back", purchaseType: "hotel", paymentMode: "online", now: 10 },
      {}, profiles,
    );

    expect(results[0].cardKey).toBe(atlas.cardKey);
    expect(results[0].kind).toBe("direct");
    expect(results[0].maxValue).toBe(5000);
    expect(results[0].fallbackValue).toBe(2500);
    expect(results[0].bestValueCalculation).toContain("2,500 × 2 eligible partner transfer × ₹1 each = ₹5,000");
    const atlasResult = results.find((result) => result.cardKey === atlas.cardKey)!;
    expect(atlasResult.pointsLabel).toBe("2,500 EDGE Miles");
    expect(atlasResult.minValue).toBe(2500);
    expect(atlasResult.maxValue).toBe(5000);
    expect(atlasResult.caveat).toContain("Assumes monthly cap remains");
    expect(atlasResult.caveat).toContain("eligible 1:2 transfer partner");
  });
});
