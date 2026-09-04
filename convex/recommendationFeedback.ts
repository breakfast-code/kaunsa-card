import { v } from "convex/values";
import { internalQuery, mutation } from "./_generated/server";

export const submit = mutation({
  args: {
    firstName: v.string(),
    merchant: v.string(),
    amount: v.number(),
    purchaseType: v.string(),
    paymentMode: v.string(),
    winningRouteId: v.string(),
    winningRouteTitle: v.string(),
    winningCard: v.string(),
    verdict: v.union(v.literal("useful"), v.literal("unsure"), v.literal("wrong")),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const firstName = args.firstName.trim().slice(0, 80);
    if (firstName.length < 2) throw new Error("Please enter your first name.");
    if (!Number.isFinite(args.amount) || args.amount <= 0 || args.amount > 100000000) throw new Error("Invalid purchase amount.");
    if (args.merchant.length > 120 || args.purchaseType.length > 40 || args.paymentMode.length > 20) throw new Error("Invalid purchase details.");
    if (args.winningRouteId.length > 160 || args.winningRouteTitle.length > 200 || args.winningCard.length > 160) throw new Error("Invalid recommendation details.");
    if ((args.note?.length ?? 0) > 500) throw new Error("Feedback is too long.");
    await ctx.db.insert("recommendationFeedback", {
      ...args,
      firstName,
      merchant: args.merchant.trim().slice(0, 120),
      note: args.note?.trim().slice(0, 500) || undefined,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const summary = internalQuery({
  args: {},
  returns: v.object({ total: v.number(), useful: v.number(), unsure: v.number(), wrong: v.number() }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("recommendationFeedback").collect();
    return {
      total: rows.length,
      useful: rows.filter((row) => row.verdict === "useful").length,
      unsure: rows.filter((row) => row.verdict === "unsure").length,
      wrong: rows.filter((row) => row.verdict === "wrong").length,
    };
  },
});
