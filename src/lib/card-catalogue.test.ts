import { describe, expect, it } from "vitest";
import { cardCatalogue } from "./card-catalogue";

describe("public card catalogue", () => {
  it("contains 20 unique public card identities", () => {
    expect(cardCatalogue).toHaveLength(20);
    expect(new Set(cardCatalogue.map((card) => card.id)).size).toBe(20);
    expect(cardCatalogue.some((card) => card.id === "hdfc-tata-neu-infinity")).toBe(true);
    expect(cardCatalogue.some((card) => card.id === "hdfc-tata-neu-plus")).toBe(true);
  });
});
