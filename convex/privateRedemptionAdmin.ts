import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const option = v.object({
  optionKey: v.string(),
  label: v.string(),
  unitsPerReward: v.number(),
  rupeesPerUnit: v.number(),
  valueType: v.union(v.literal("guaranteed"), v.literal("estimated")),
  assumption: v.optional(v.string()),
  rulesSourceUrl: v.string(),
  valueSourceUrl: v.string(),
  valueSourceKind: v.union(v.literal("official"), v.literal("expert")),
  checkedAt: v.number(),
  validFrom: v.optional(v.number()),
  validUntil: v.optional(v.number()),
});

const profile = v.object({
  profileKey: v.string(),
  cardKey: v.string(),
  rewardCurrency: v.string(),
  version: v.number(),
  checkedAt: v.number(),
  options: v.array(option),
});

export const ensureCard = internalMutation({
  args: {
    cardKey: v.string(), bankKey: v.string(), name: v.string(), shortName: v.string(),
    productUrl: v.string(), rewardCurrency: v.string(), checkedAt: v.number(),
  },
  returns: v.object({ inserted: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("cardProducts").withIndex("by_cardKey", (q) => q.eq("cardKey", args.cardKey)).unique();
    if (existing) return { inserted: false };
    const bank = await ctx.db.query("banks").withIndex("by_bankKey", (q) => q.eq("bankKey", args.bankKey)).unique();
    if (!bank) throw new Error(`Unknown bank ${args.bankKey}.`);
    if (!args.productUrl.startsWith("https://")) throw new Error("Invalid product URL.");
    await ctx.db.insert("cardProducts", {
      cardKey: args.cardKey, bankId: bank._id, name: args.name, shortName: args.shortName,
      productUrl: args.productUrl, rewardCurrency: args.rewardCurrency,
      coverage: "direct-rules", status: "active", checkedAt: args.checkedAt,
    });
    return { inserted: true };
  },
});

// Operator-only import. Payloads come from an ignored local review packet.
export const importProfiles = internalMutation({
  args: { profiles: v.array(profile) },
  returns: v.object({ inserted: v.number(), unchanged: v.number() }),
  handler: async (ctx, args) => {
    if (!args.profiles.length || args.profiles.length > 30) throw new Error("Import must contain between 1 and 30 profiles.");
    let inserted = 0;
    let unchanged = 0;
    for (const item of args.profiles) {
      if (!/^[a-z0-9-]{2,100}$/.test(item.profileKey) || !/^[a-z0-9-]{2,80}$/.test(item.cardKey) || item.version < 1) throw new Error("Invalid profile identity.");
      if (!item.options.length || item.options.length > 20) throw new Error(`Invalid options for ${item.profileKey}.`);
      const card = await ctx.db.query("cardProducts").withIndex("by_cardKey", (q) => q.eq("cardKey", item.cardKey)).unique();
      if (!card) throw new Error(`Unknown card ${item.cardKey}.`);
      for (const value of item.options) {
        if (value.unitsPerReward <= 0 || value.rupeesPerUnit < 0) throw new Error(`Invalid value for ${value.optionKey}.`);
        if (![value.rulesSourceUrl, value.valueSourceUrl].every((url) => url.startsWith("https://"))) throw new Error(`Invalid source for ${value.optionKey}.`);
      }
      const existing = await ctx.db.query("redemptionProfiles")
        .withIndex("by_profileKey_and_version", (q) => q.eq("profileKey", item.profileKey).eq("version", item.version))
        .unique();
      if (existing) {
        unchanged += 1;
        continue;
      }
      const profileId = await ctx.db.insert("redemptionProfiles", {
        profileKey: item.profileKey,
        cardKey: item.cardKey,
        rewardCurrency: item.rewardCurrency,
        version: item.version,
        status: "approved",
        checkedAt: item.checkedAt,
      });
      for (const value of item.options) await ctx.db.insert("redemptionOptions", { profileId, ...value });
      inserted += 1;
    }
    return { inserted, unchanged };
  },
});
