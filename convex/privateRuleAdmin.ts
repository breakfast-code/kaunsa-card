import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const rule = v.object({
  ruleKey: v.string(), cardKey: v.string(), priority: v.number(), purchaseTypes: v.array(v.string()),
  paymentModes: v.array(v.union(v.literal("online"), v.literal("store"))), merchantIncludes: v.array(v.string()),
  outcome: v.union(v.literal("percentage"), v.literal("points"), v.literal("excluded")), rate: v.optional(v.number()),
  spendBlock: v.optional(v.number()), earnPerBlock: v.optional(v.number()), rewardCurrency: v.string(),
  usageMetric: v.optional(v.literal("monthly-category-spend")), spendTierCap: v.optional(v.number()),
  earnPerBlockWithinTier: v.optional(v.number()), earnPerBlockAboveTier: v.optional(v.number()),
  earnPerBlockWhenUsageUnknown: v.optional(v.number()),
  pointValueMin: v.number(), pointValueMax: v.number(), valueCap: v.optional(v.number()), matchedRule: v.string(),
  matchedRuleWithinTier: v.optional(v.string()), matchedRuleSplitTier: v.optional(v.string()),
  matchedRuleUsageUnknown: v.optional(v.string()),
  caveat: v.optional(v.string()), sourceUrl: v.string(), checkedAt: v.number(), validFrom: v.optional(v.number()),
  caveatUsageKnown: v.optional(v.string()), caveatUsageUnknown: v.optional(v.string()),
  validUntil: v.optional(v.number()), version: v.number(), status: v.union(v.literal("estimate"), v.literal("approved")),
});

// This internal-only function is callable by deployment operators, not browsers.
// Rule payloads are supplied from an ignored local file and never live in Git.
export const importRules = internalMutation({
  args: { rules: v.array(rule) },
  returns: v.object({ inserted: v.number(), unchanged: v.number() }),
  handler: async (ctx, args) => {
    if (!args.rules.length || args.rules.length > 500) throw new Error("Import must contain between 1 and 500 rules.");
    let inserted = 0;
    let unchanged = 0;
    for (const item of args.rules) {
      if (!item.ruleKey || !item.cardKey || item.priority < 0 || item.version < 1) throw new Error("Invalid rule identity.");
      if (!item.sourceUrl.startsWith("https://") || item.pointValueMin < 0 || item.pointValueMax < item.pointValueMin) throw new Error(`Invalid values for ${item.ruleKey}.`);
      if (item.usageMetric === "monthly-category-spend") {
        const tierValues = [item.spendBlock, item.spendTierCap, item.earnPerBlockWithinTier, item.earnPerBlockAboveTier, item.earnPerBlockWhenUsageUnknown];
        if (item.outcome !== "points" || tierValues.some((value) => value === undefined || value < 0) || !item.spendBlock) throw new Error(`Invalid monthly spend tier for ${item.ruleKey}.`);
      }
      const card = await ctx.db.query("cardProducts").withIndex("by_cardKey", (q) => q.eq("cardKey", item.cardKey)).unique();
      if (!card) throw new Error(`Unknown card ${item.cardKey}.`);
      const existing = await ctx.db.query("directRewardRules").withIndex("by_ruleKey_version", (q) => q.eq("ruleKey", item.ruleKey).eq("version", item.version)).unique();
      if (existing) {
        unchanged += 1;
        continue;
      }
      await ctx.db.insert("directRewardRules", item);
      inserted += 1;
    }
    return { inserted, unchanged };
  },
});
