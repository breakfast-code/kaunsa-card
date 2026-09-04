import { describe, expect, it } from "vitest";
import { calculateDirectRecommendations, calculateRecommendations, type PrivateDirectRule, type PrivateRouteRule } from "./recommendationEngine";

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

describe("private recommendation engine", () => {
  it("calculates and ranks percentage and points rules", () => {
    const results = calculateDirectRecommendations(cards, [
      rule(),
      rule({ ruleKey: "beta-base-v1", cardKey: "beta", outcome: "points", spendBlock: 100, earnPerBlock: 3, rewardCurrency: "points", pointValueMin: 1, pointValueMax: 1 }),
    ], { amount: 1000, merchant: "Shop", purchaseType: "shopping", paymentMode: "online", now: 10 });
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
});

describe("private portal and voucher routes", () => {
  const input = { amount: 15000, merchant: "Shop", purchaseType: "shopping", paymentMode: "online" as const, now: 10 };

  it("applies voucher caps and direct rewards to the remainder", () => {
    const result = calculateRecommendations([cards[0]], [rule()], [route()], input)
      .find((recommendation) => recommendation.kind === "voucher")!;
    expect(result.action).toContain("₹10,000");
    expect(result.action).toContain("remaining ₹5,000 directly");
    expect(result.pointsLabel).toContain("plus direct rewards on the remainder");
    expect(result.minValue).toBe(600);
  });

  it("uses remaining allowance and removes an exhausted voucher route", () => {
    const partial = calculateRecommendations([cards[0]], [rule()], [route()], { ...input, amount: 6000 }, { voucherSpendThisMonth: 7000 })
      .find((recommendation) => recommendation.kind === "voucher")!;
    expect(partial.minValue).toBe(210);
    expect(partial.action).toContain("remaining ₹3,000 directly");

    const exhausted = calculateRecommendations([cards[0]], [rule()], [route()], { ...input, amount: 6000 }, { voucherSpendThisMonth: 10000 });
    expect(exhausted.map((recommendation) => recommendation.kind)).toEqual(["direct"]);
  });

  it("caps accelerated points and excludes expired routes", () => {
    const portal = route({ routeKey: "hotel", merchantKey: undefined, routeType: "portal", purchaseType: "hotel", multiplier: 12, capValue: 18000, capUnit: "accelerated points" });
    const capped = calculateRecommendations([cards[0]], [rule({ purchaseTypes: ["hotel"] })], [portal], { ...input, amount: 500000, merchant: "Hotel", purchaseType: "hotel" })
      .find((recommendation) => recommendation.kind === "portal")!;
    expect(capped.pointsLabel).toContain("18,000");
    expect(capped.maxValue).toBe(18000);

    const expired = calculateRecommendations([cards[0]], [rule()], [route({ validUntil: 9 })], input);
    expect(expired.map((recommendation) => recommendation.kind)).toEqual(["direct"]);
  });

  it("discloses portal fees without subtracting them and keeps reviewed routes unconditional", () => {
    const flight = route({ routeKey: "flight", merchantKey: undefined, routeType: "portal", purchaseType: "flight", multiplier: 6, domesticFeePerPassengerLeg: 300 });
    const result = calculateRecommendations([cards[0]], [rule({ purchaseTypes: ["flight"] })], [flight], { ...input, amount: 1800, merchant: "Airline", purchaseType: "flight" })
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
    const [within] = calculateRecommendations([cards[0]], [tierRule], [], { ...input, amount: 500 }, { atlasTravelSpendThisMonth: 1000 });
    expect(within.minValue).toBe(25);
    expect(within.matchedRule).toBe("Higher tier");
    expect(within.conditional).toBe(false);

    const [split] = calculateRecommendations([cards[0]], [tierRule], [], { ...input, amount: 1000 }, { atlasTravelSpendThisMonth: 1500 });
    expect(split.minValue).toBe(35);
    expect(split.matchedRule).toBe("Split tier");
  });

  it("uses a conservative tier and stays conditional when monthly usage is unknown", () => {
    const tierRule = rule({
      outcome: "points", rate: undefined, spendBlock: 100, earnPerBlock: undefined,
      usageMetric: "monthly-category-spend", spendTierCap: 2000,
      earnPerBlockWithinTier: 5, earnPerBlockAboveTier: 2, earnPerBlockWhenUsageUnknown: 2,
      matchedRuleUsageUnknown: "Conservative tier", caveatUsageUnknown: "Usage needed",
    });
    const [result] = calculateRecommendations([cards[0]], [tierRule], [], { ...input, amount: 1000 }, { atlasTravelSpendThisMonth: null });
    expect(result.minValue).toBe(20);
    expect(result.matchedRule).toBe("Conservative tier");
    expect(result.caveat).toBe("Usage needed");
    expect(result.conditional).toBe(true);
  });
});
