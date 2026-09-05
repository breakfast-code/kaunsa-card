import { v } from "convex/values";
import { query } from "./_generated/server";
import { calculateRecommendations, type PrivateDirectRule, type PrivateRouteRule } from "./recommendationEngine";
import type { RedemptionProfile } from "./redemptionEngine";

const purchaseType = v.union(
  v.literal("shopping"), v.literal("flight"), v.literal("hotel"), v.literal("dining"),
  v.literal("utility"), v.literal("insurance"), v.literal("fuel"), v.literal("rent"),
  v.literal("education"), v.literal("jewellery"), v.literal("railway"), v.literal("government"),
  v.literal("gaming"), v.literal("toll"), v.literal("gift-card"), v.literal("emi"), v.literal("general"),
);

const recommendation = v.object({
  id: v.string(),
  cardKey: v.string(),
  cardName: v.string(),
  issuer: v.string(),
  kind: v.union(v.literal("direct"), v.literal("portal"), v.literal("voucher")),
  title: v.string(),
  action: v.string(),
  pointsLabel: v.string(),
  minValue: v.number(),
  maxValue: v.number(),
  bestValueLabel: v.optional(v.string()),
  bestValueCalculation: v.optional(v.string()),
  bestValueSourceUrl: v.optional(v.string()),
  fallbackValue: v.optional(v.number()),
  fallbackValueLabel: v.optional(v.string()),
  fallbackValueCalculation: v.optional(v.string()),
  fallbackValueSourceUrl: v.optional(v.string()),
  matchedRule: v.string(),
  caveat: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  checkedAt: v.optional(v.number()),
  conditional: v.boolean(),
});

export const get = query({
  args: {
    amount: v.number(),
    merchant: v.string(),
    purchaseType,
    paymentMode: v.union(v.literal("online"), v.literal("store")),
    cardIds: v.array(v.string()),
    now: v.number(),
    includePortals: v.optional(v.boolean()),
    voucherSpendThisMonth: v.optional(v.number()),
    sbiCashbackEarnedThisCycle: v.optional(v.number()),
    atlasTravelSpendThisMonth: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.array(recommendation),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.amount) || args.amount <= 0 || args.amount > 100_000_000) throw new Error("Invalid purchase amount.");
    const merchant = args.merchant.trim();
    if (!merchant || merchant.length > 120) throw new Error("Invalid merchant.");
    const cardIds = [...new Set(args.cardIds)];
    if (!cardIds.length || cardIds.length > 21 || cardIds.some((id) => !/^[a-z0-9-]{2,80}$/.test(id))) throw new Error("Select between 1 and 21 valid cards.");
    if (!Number.isSafeInteger(args.now) || args.now < 0) throw new Error("Invalid request time.");
    if (args.voucherSpendThisMonth !== undefined && (!Number.isFinite(args.voucherSpendThisMonth) || args.voucherSpendThisMonth < 0)) throw new Error("Invalid voucher usage.");
    if (args.sbiCashbackEarnedThisCycle !== undefined && (!Number.isFinite(args.sbiCashbackEarnedThisCycle) || args.sbiCashbackEarnedThisCycle < 0)) throw new Error("Invalid SBI cashback usage.");
    if (args.atlasTravelSpendThisMonth !== undefined && args.atlasTravelSpendThisMonth !== null && (!Number.isFinite(args.atlasTravelSpendThisMonth) || args.atlasTravelSpendThisMonth < 0)) throw new Error("Invalid ATLAS travel usage.");

    const cards = await Promise.all(cardIds.map((cardKey) => ctx.db.query("cardProducts").withIndex("by_cardKey", (q) => q.eq("cardKey", cardKey)).unique()));
    const publicCards = await Promise.all(cards.filter((card) => card !== null).map(async (card) => {
      const bank = await ctx.db.get(card.bankId);
      return { cardKey: card.cardKey, name: card.name, issuer: bank?.name ?? "Unknown issuer" };
    }));
    const ruleGroups = await Promise.all(cardIds.map((cardKey) => ctx.db.query("directRewardRules").withIndex("by_card", (q) => q.eq("cardKey", cardKey)).collect()));
    const routeGroups = await Promise.all(cards.filter((card) => card !== null).map((card) => ctx.db.query("routeRules").withIndex("by_card", (q) => q.eq("cardId", card._id)).collect()));
    const redemptionProfileGroups = await Promise.all(cardIds.map((cardKey) =>
      ctx.db.query("redemptionProfiles").withIndex("by_cardKey_and_rewardCurrency", (q) => q.eq("cardKey", cardKey)).take(20),
    ));
    const approvedProfiles = redemptionProfileGroups.flat().filter((profile) => profile.status === "approved");
    const redemptionProfiles = await Promise.all(approvedProfiles.map(async (profile): Promise<RedemptionProfile> => {
      const options = await ctx.db.query("redemptionOptions").withIndex("by_profileId", (q) => q.eq("profileId", profile._id)).take(20);
      return {
        cardKey: profile.cardKey,
        rewardCurrency: profile.rewardCurrency,
        version: profile.version,
        status: profile.status,
        options: options.map((option) => ({
          optionKey: option.optionKey,
          label: option.label,
          unitsPerReward: option.unitsPerReward,
          rupeesPerUnit: option.rupeesPerUnit,
          valueType: option.valueType,
          assumption: option.assumption,
          rulesSourceUrl: option.rulesSourceUrl,
          valueSourceUrl: option.valueSourceUrl,
          valueSourceKind: option.valueSourceKind,
          checkedAt: option.checkedAt,
          validFrom: option.validFrom,
          validUntil: option.validUntil,
        })),
      };
    }));
    const approvedRoutes = routeGroups.flat().filter((route) => route.status === "approved" && route.routeType !== "direct");
    const routeRules = await Promise.all(approvedRoutes.map(async (route): Promise<PrivateRouteRule | null> => {
      const [card, platform, merchant, source] = await Promise.all([
        ctx.db.get(route.cardId),
        ctx.db.get(route.platformId),
        route.merchantId ? ctx.db.get(route.merchantId) : null,
        ctx.db.get(route.sourceId),
      ]);
      if (!card || !platform || !source) return null;
      return {
        routeKey: route.routeKey, cardKey: card.cardKey, platformName: platform.name,
        merchantKey: merchant?.merchantKey, sourceUrl: source.url, routeType: route.routeType as "portal" | "voucher",
        purchaseType: route.purchaseType, paymentMode: route.paymentMode, baseSpend: route.baseSpend,
        baseEarn: route.baseEarn, multiplier: route.multiplier, rewardCurrency: route.rewardCurrency,
        pointValueMin: route.pointValueMin, pointValueMax: route.pointValueMax, capValue: route.capValue,
        capUnit: route.capUnit, capAppliesTo: route.capAppliesTo, evidence: route.evidence, checkedAt: route.checkedAt,
        validFrom: route.validFrom, validUntil: route.validUntil,
        domesticFeePerPassengerLeg: route.domesticFeePerPassengerLeg,
        internationalFeePerPassengerLeg: route.internationalFeePerPassengerLeg,
      };
    }));
    return calculateRecommendations(publicCards, ruleGroups.flat() as PrivateDirectRule[], routeRules.filter((rule): rule is PrivateRouteRule => rule !== null), {
      amount: args.amount,
      merchant,
      purchaseType: args.purchaseType,
      paymentMode: args.paymentMode,
      now: args.now,
    }, {
      includePortals: args.includePortals,
      voucherSpendThisMonth: args.voucherSpendThisMonth,
      sbiCashbackEarnedThisCycle: args.sbiCashbackEarnedThisCycle,
      atlasTravelSpendThisMonth: args.atlasTravelSpendThisMonth,
    }, redemptionProfiles);
  },
});
