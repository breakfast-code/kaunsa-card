import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
  },
});

export const saveFirstUse = mutation({
  args: {
    savedCardIds: v.array(v.string()),
    activeCardIds: v.array(v.string()),
    merchant: v.string(),
    purchaseType: v.string(),
    winningRoute: v.string(),
  },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in before saving your wallet.");
    const now = Date.now();
    const existing = await ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    const savedCardIds = [...new Set(args.savedCardIds)].slice(0, 50);
    const values = {
      clerkUserId: identity.subject,
      email: identity.email ?? existing?.email,
      name: identity.name,
      savedCardIds,
      activeCardIds: [...new Set(args.activeCardIds)].filter((id) => savedCardIds.includes(id)).slice(0, 50),
      lastSeenAt: now,
      lastMerchant: args.merchant.trim().slice(0, 120),
      lastPurchaseType: args.purchaseType.slice(0, 40),
      lastWinningRoute: args.winningRoute.slice(0, 160),
    };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return { created: false };
    }
    await ctx.db.insert("users", { tokenIdentifier: identity.tokenIdentifier, ...values, firstUseAt: now });
    return { created: true };
  },
});

export const signupSummary = internalQuery({
  args: {},
  handler: async (ctx) => ({ signupsWithFirstUse: (await ctx.db.query("users").collect()).length }),
});
