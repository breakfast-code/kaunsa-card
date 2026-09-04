import { describe, expect, it } from "vitest";
import { valueRewards, type RedemptionProfile } from "./redemptionEngine";

const atlasProfile: RedemptionProfile = {
  cardKey: "axis-atlas",
  rewardCurrency: "EDGE Miles",
  version: 1,
  status: "approved",
  options: [
    {
      optionKey: "travel-edge",
      label: "Travel EDGE",
      unitsPerReward: 1,
      rupeesPerUnit: 1,
      valueType: "guaranteed",
      rulesSourceUrl: "https://www.axis.bank.in/atlas",
      valueSourceUrl: "https://www.axis.bank.in/atlas",
      valueSourceKind: "official",
      checkedAt: 1,
    },
    {
      optionKey: "eligible-partner-transfer",
      label: "eligible airline or hotel partner transfer",
      unitsPerReward: 2,
      rupeesPerUnit: 1,
      valueType: "estimated",
      assumption: "Assumes ₹1 value for each transferred partner point and award availability.",
      rulesSourceUrl: "https://www.axis.bank.in/atlas",
      valueSourceUrl: "https://www.cardexpert.in/axis-atlas-review/",
      valueSourceKind: "expert",
      checkedAt: 1,
    },
  ],
};

describe("redemption valuation", () => {
  it("separates exact rewards from the highest supported and guaranteed values", () => {
    const result = valueRewards(2500, atlasProfile, 10);

    expect(result.earnedAmount).toBe(2500);
    expect(result.earnedCurrency).toBe("EDGE Miles");
    expect(result.best.label).toBe("eligible airline or hotel partner transfer");
    expect(result.best.partnerUnits).toBe(5000);
    expect(result.best.rupeeValue).toBe(5000);
    expect(result.best.assumption).toContain("award availability");
    expect(result.fallback?.label).toBe("Travel EDGE");
    expect(result.fallback?.rupeeValue).toBe(2500);
  });

  it("excludes expired options before selecting the maximum", () => {
    const profile: RedemptionProfile = {
      ...atlasProfile,
      options: atlasProfile.options.map((option) => option.optionKey === "eligible-partner-transfer" ? { ...option, validUntil: 9 } : option),
    };

    const result = valueRewards(2500, profile, 10);
    expect(result.best.label).toBe("Travel EDGE");
    expect(result.fallback).toBeUndefined();
  });

  it("fails closed when no supported redemption option is active", () => {
    expect(() => valueRewards(2500, { ...atlasProfile, options: [] }, 10)).toThrow("No supported redemption option");
  });
});
