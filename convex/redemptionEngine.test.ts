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
  ],
};

describe("redemption valuation", () => {
  it("uses ATLAS Travel EDGE gross value without disputed partner uplift", () => {
    const result = valueRewards(2500, atlasProfile, 10);

    expect(result.earnedAmount).toBe(2500);
    expect(result.earnedCurrency).toBe("EDGE Miles");
    expect(result.best.label).toBe("Travel EDGE");
    expect(result.best.partnerUnits).toBe(2500);
    expect(result.best.rupeeValue).toBe(2500);
    expect(result.fallback).toBeUndefined();
  });

  it("excludes expired options before selecting the maximum", () => {
    const profile: RedemptionProfile = {
      ...atlasProfile,
      options: atlasProfile.options.map((option) => ({ ...option, validUntil: 9 })),
    };
    expect(() => valueRewards(2500, profile, 10)).toThrow("No supported redemption option");
  });

  it("keeps a lower estimated TravelOne transfer as the fallback", () => {
    const profile: RedemptionProfile = {
      cardKey: "hsbc-travelone", rewardCurrency: "Reward Points", version: 1, status: "approved",
      options: [
        { optionKey: "accor", label: "Accor transfer", unitsPerReward: 1, rupeesPerUnit: 1.8, valueType: "estimated", rulesSourceUrl: "https://www.hsbc.bank.in/travelone", valueSourceUrl: "https://www.cardexpert.in/travelone", valueSourceKind: "expert", checkedAt: 1 },
        { optionKey: "partner", label: "eligible 1:1 transfer", unitsPerReward: 1, rupeesPerUnit: 1, valueType: "estimated", rulesSourceUrl: "https://www.hsbc.bank.in/travelone", valueSourceUrl: "https://www.cardexpert.in/travelone", valueSourceKind: "expert", checkedAt: 1 },
      ],
    };
    const result = valueRewards(1000, profile, 10);
    expect(result.best.rupeeValue).toBe(1800);
    expect(result.fallback?.rupeeValue).toBe(1000);
  });

  it("fails closed when no supported redemption option is active", () => {
    expect(() => valueRewards(2500, { ...atlasProfile, options: [] }, 10)).toThrow("No supported redemption option");
  });
});
