import { describe, expect, it } from "vitest";
import { estimatedValueLabel } from "./value-display";

describe("estimatedValueLabel", () => {
  it("does not show a bare rupee figure for a points rule with one stated value", () => {
    expect(estimatedValueLabel({ minValue: 100, maxValue: 100, pointsLabel: "400 Reward Points" }))
      .toBe("₹100 at the stated redemption");
  });

  it("shows the full range when redemption values differ", () => {
    expect(estimatedValueLabel({ minValue: 360, maxValue: 1440, pointsLabel: "1,440 Reward Points" }))
      .toBe("₹360–₹1,440");
  });
});
