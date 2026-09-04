import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const request = mutation({
  args: { cardName: v.string() },
  returns: v.id("cardRequests"),
  handler: async (ctx, args) => {
    const cardName = args.cardName.trim();
    if (cardName.length < 3 || cardName.length > 100) {
      throw new Error("Enter a card name between 3 and 100 characters.");
    }
    const normalizedName = cardName.toLowerCase().replace(/\s+/g, " ");
    const existing = await ctx.db.query("cardRequests").withIndex("by_normalizedName", (q) => q.eq("normalizedName", normalizedName)).unique();
    if (existing) return existing._id;
    return await ctx.db.insert("cardRequests", { cardName, normalizedName, requestedAt: Date.now() });
  },
});
