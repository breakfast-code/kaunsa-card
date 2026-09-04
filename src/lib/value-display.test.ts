import { describe, expect, it } from "vitest";
import { estimatedValueLabel } from "./value-display";

describe("estimatedValueLabel", () => {
  it("does not show a bare rupee figure for a points rule with one stated value", () => {
    expect(estimatedValueLabel({ minValue: 100, maxValue: 100, pointsLabel: "400 Reward Points" }))
      .toBe("₹100 at the stated redemption");
  });

  it("shows the highest supported value before the fallback", () => {
    expect(estimatedValueLabel({ minValue: 360, maxValue: 1440, pointsLabel: "1,440 Reward Points" }))
      .toBe("₹1,440 best supported · ₹360 fallback");
  });

  it("names the redemption route used for the displayed value", () => {
    expect(estimatedValueLabel({ minValue: 2500, maxValue: 5000, pointsLabel: "2,500 EDGE Miles", bestValueLabel: "eligible partner transfer" }))
      .toBe("₹5,000 via eligible partner transfer");
  });
});
