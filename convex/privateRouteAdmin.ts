import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const SOURCE_KEY = "hdfc-smartbuy-core-september-2026";
const SOURCE_URL = "https://offers.smartbuy.hdfc.bank.in/offer_details/smartbuy/15282";
const CHECKED_AT = 1788584400000;
const VALID_FROM = 1788201000000;
const VALID_UNTIL = 1790792999999;

// Human-approved publication of the September 2026 DCB Metal SmartBuy cap.
export const publishDcbSmartBuySeptember = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const card = await ctx.db.query("cardProducts").withIndex("by_cardKey", (q) => q.eq("cardKey", "hdfc-dcb-metal")).unique();
    const platform = await ctx.db.query("paymentPlatforms").withIndex("by_platformKey", (q) => q.eq("platformKey", "hdfc-smartbuy")).unique();
    if (!card || !platform) throw new Error("DCB Metal or HDFC SmartBuy identity is missing.");

    let source = await ctx.db.query("officialSources").withIndex("by_sourceKey", (q) => q.eq("sourceKey", SOURCE_KEY)).unique();
    if (!source) {
      const sourceId = await ctx.db.insert("officialSources", {
        sourceKey: SOURCE_KEY,
        publisher: "HDFC Bank SmartBuy",
        title: "SmartBuy September 2026 offer details",
        url: SOURCE_URL,
        kind: "terms-page",
        retrievedAt: CHECKED_AT,
      });
      source = await ctx.db.get(sourceId);
    }
    if (!source) throw new Error("Failed to create the SmartBuy source.");

    for (const item of [
      { routeKey: "dcb-smartbuy-flight", purchaseType: "flight" as const, multiplier: 5, evidence: "5X on flights; accelerated points capped at 10,000 per day and calendar month. Base points continue above the cap." },
      { routeKey: "dcb-smartbuy-hotel", purchaseType: "hotel" as const, multiplier: 10, evidence: "10X on hotels; accelerated points capped at 10,000 per day and calendar month. Base points continue above the cap. Hotel availability must be checked on SmartBuy." },
    ]) {
      const existingV2 = await ctx.db.query("routeRules").withIndex("by_routeKey_version", (q) => q.eq("routeKey", item.routeKey).eq("version", 2)).unique();
      if (existingV2) continue;
      const previous = await ctx.db.query("routeRules").withIndex("by_routeKey_version", (q) => q.eq("routeKey", item.routeKey).eq("version", 1)).unique();
      if (!previous) throw new Error(`Missing version 1 for ${item.routeKey}.`);
      await ctx.db.patch(previous._id, { status: "retired" });
      const { _id: _previousId, _creationTime: _previousCreationTime, ...base } = previous;
      void _previousId;
      void _previousCreationTime;
      await ctx.db.insert("routeRules", {
        ...base,
        sourceId: source._id,
        purchaseType: item.purchaseType,
        multiplier: item.multiplier,
        capValue: 10000,
        capPeriod: "month",
        capUnit: "accelerated points",
        capAppliesTo: "accelerated-only",
        evidence: item.evidence,
        checkedAt: CHECKED_AT,
        validFrom: VALID_FROM,
        validUntil: VALID_UNTIL,
        version: 2,
        status: "approved",
      });
    }
    return null;
  },
});
