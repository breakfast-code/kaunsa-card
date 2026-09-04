import { describe, expect, it } from "vitest";
import { resolveMerchant } from "./merchants";

describe("merchant classification", () => {
  it("classifies major jewellery merchants as jewellery", () => {
    expect(resolveMerchant("Kalyan Jewellers")?.defaultType).toBe("jewellery");
    expect(resolveMerchant("Tanishq store")?.defaultType).toBe("jewellery");
    expect(resolveMerchant("Malabar Gold")?.defaultType).toBe("jewellery");
  });
});
