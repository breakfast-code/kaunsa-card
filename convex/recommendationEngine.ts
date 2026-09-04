import { valueRewards, type RedemptionProfile } from "./redemptionEngine";

export type PrivateDirectRule = {
  ruleKey: string;
  cardKey: string;
  priority: number;
  purchaseTypes: string[];
  paymentModes: Array<"online" | "store">;
  merchantIncludes: string[];
  outcome: "percentage" | "points" | "excluded";
  rate?: number;
  spendBlock?: number;
  earnPerBlock?: number;
  usageMetric?: "monthly-category-spend";
  spendTierCap?: number;
  earnPerBlockWithinTier?: number;
  earnPerBlockAboveTier?: number;
  earnPerBlockWhenUsageUnknown?: number;
  rewardCurrency: string;
  pointValueMin: number;
  pointValueMax: number;
  valueCap?: number;
  matchedRule: string;
  matchedRuleWithinTier?: string;
  matchedRuleSplitTier?: string;
  matchedRuleUsageUnknown?: string;
  caveat?: string;
  caveatUsageKnown?: string;
  caveatUsageUnknown?: string;
  sourceUrl: string;
  checkedAt: number;
  validFrom?: number;
  validUntil?: number;
  version: number;
  status: "draft" | "estimate" | "approved" | "retired";
};

export type PublicCard = { cardKey: string; name: string; issuer: string };

export type RecommendationInput = {
  amount: number;
  merchant: string;
  purchaseType: string;
  paymentMode: "online" | "store";
  now: number;
  contextualSpendThisMonth?: number | null;
};

export type DirectRecommendation = {
  id: string;
  cardKey: string;
  cardName: string;
  issuer: string;
  kind: "direct";
  title: string;
  action: string;
  pointsLabel: string;
  minValue: number;
  maxValue: number;
  bestValueLabel?: string;
  bestValueCalculation?: string;
  bestValueSourceUrl?: string;
  fallbackValue?: number;
  fallbackValueLabel?: string;
  fallbackValueCalculation?: string;
  fallbackValueSourceUrl?: string;
  matchedRule: string;
  caveat?: string;
  sourceUrl?: string;
  checkedAt?: number;
  conditional: boolean;
};

export type PrivateRouteRule = {
  routeKey: string;
  cardKey: string;
  platformName: string;
  merchantKey?: string;
  sourceUrl: string;
  routeType: "portal" | "voucher";
  purchaseType: string;
  paymentMode: "online" | "store" | "both";
  baseSpend: number;
  baseEarn: number;
  multiplier: number;
  rewardCurrency: string;
  pointValueMin: number;
  pointValueMax: number;
  capValue?: number;
  capUnit?: string;
  evidence: string;
  checkedAt: number;
  validFrom?: number;
  validUntil?: number;
  domesticFeePerPassengerLeg?: number;
  internationalFeePerPassengerLeg?: number;
};

export type RoutedRecommendation = Omit<DirectRecommendation, "kind"> & {
  kind: "portal" | "voucher";
};

export type RouteUsage = {
  includePortals?: boolean;
  voucherSpendThisMonth?: number;
  sbiCashbackEarnedThisCycle?: number;
  atlasTravelSpendThisMonth?: number | null;
};

const active = (rule: PrivateDirectRule, now: number) => (rule.status === "approved" || rule.status === "estimate")
  && (rule.validFrom === undefined || rule.validFrom <= now)
  && (rule.validUntil === undefined || rule.validUntil >= now);

const matches = (rule: PrivateDirectRule, input: RecommendationInput) => {
  if (!active(rule, input.now)) return false;
  if (!rule.purchaseTypes.includes(input.purchaseType)) return false;
  if (!rule.paymentModes.includes(input.paymentMode)) return false;
  if (!rule.merchantIncludes.length) return true;
  const merchant = input.merchant.toLowerCase();
  return rule.merchantIncludes.some((name) => merchant.includes(name.toLowerCase()));
};

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const profileFor = (profiles: RedemptionProfile[], cardKey: string, rewardCurrency: string) => profiles
  .filter((profile) => profile.cardKey === cardKey && profile.rewardCurrency === rewardCurrency && profile.status === "approved")
  .sort((left, right) => right.version - left.version)[0];

const valuationFields = (earned: number, profile: RedemptionProfile, now: number) => {
  const valuation = valueRewards(earned, profile, now);
  const describe = (option: typeof valuation.best) =>
    `${earned.toLocaleString("en-IN")} × ${option.unitsPerReward.toLocaleString("en-IN")} ${option.label} × ${money(option.rupeesPerUnit)} each = ${money(option.rupeeValue)}`;
  return {
    minValue: valuation.fallback?.rupeeValue ?? valuation.best.rupeeValue,
    maxValue: valuation.best.rupeeValue,
    bestValueLabel: valuation.best.label,
    bestValueCalculation: describe(valuation.best),
    bestValueSourceUrl: valuation.best.valueSourceUrl,
    fallbackValue: valuation.fallback?.rupeeValue,
    fallbackValueLabel: valuation.fallback?.label,
    fallbackValueCalculation: valuation.fallback ? describe(valuation.fallback) : undefined,
    fallbackValueSourceUrl: valuation.fallback?.valueSourceUrl,
    valuationConditional: valuation.best.valueType === "estimated",
    valuationAssumption: valuation.best.assumption,
  };
};

export function calculateDirectRecommendations(cards: PublicCard[], rules: PrivateDirectRule[], input: RecommendationInput, redemptionProfiles: RedemptionProfile[] = []): DirectRecommendation[] {
  const results = cards.map((card): DirectRecommendation => {
    const rule = rules
      .filter((candidate) => candidate.cardKey === card.cardKey && matches(candidate, input))
      .sort((left, right) => right.priority - left.priority || right.version - left.version)[0];
    const base = {
      id: `${card.cardKey}-direct-${input.amount}`,
      cardKey: card.cardKey,
      cardName: card.name,
      issuer: card.issuer,
      kind: "direct" as const,
      title: `Pay ${input.merchant.trim()} directly`,
      action: `Pay ${money(input.amount)} directly with ${card.name}.`,
    };
    if (!rule) return {
      ...base,
      pointsLabel: "Not estimated",
      minValue: 0,
      maxValue: 0,
      matchedRule: "Coverage not verified",
      caveat: "No approved rule covers this purchase.",
      conditional: true,
    };

    let earned = 0;
    let matchedRule = rule.matchedRule;
    let caveat = rule.caveat;
    let usageConditional = false;
    if (rule.outcome === "percentage") earned = input.amount * (rule.rate ?? 0);
    if (rule.outcome === "points" && rule.usageMetric === "monthly-category-spend" && rule.spendBlock) {
      const priorSpend = input.contextualSpendThisMonth;
      if (priorSpend === undefined || priorSpend === null) {
        const possibleWithinTier = Math.min(input.amount, rule.spendTierCap ?? 0);
        const possibleAboveTier = input.amount - possibleWithinTier;
        earned = Math.floor(possibleWithinTier / rule.spendBlock) * (rule.earnPerBlockWithinTier ?? 0)
          + Math.floor(possibleAboveTier / rule.spendBlock) * (rule.earnPerBlockAboveTier ?? 0);
        matchedRule = rule.matchedRuleUsageUnknown ?? matchedRule;
        caveat = rule.caveatUsageUnknown ?? caveat;
        usageConditional = true;
      } else {
        const withinTier = Math.min(input.amount, Math.max(0, (rule.spendTierCap ?? 0) - priorSpend));
        const aboveTier = input.amount - withinTier;
        earned = Math.floor(withinTier / rule.spendBlock) * (rule.earnPerBlockWithinTier ?? 0)
          + Math.floor(aboveTier / rule.spendBlock) * (rule.earnPerBlockAboveTier ?? 0);
        matchedRule = aboveTier > 0 ? (rule.matchedRuleSplitTier ?? matchedRule) : (rule.matchedRuleWithinTier ?? matchedRule);
        caveat = rule.caveatUsageKnown ?? caveat;
      }
    } else if (rule.outcome === "points" && rule.spendBlock && rule.earnPerBlock !== undefined) {
      earned = Math.floor(input.amount / rule.spendBlock) * rule.earnPerBlock;
    }
    const profile = rule.outcome === "points" ? profileFor(redemptionProfiles, card.cardKey, rule.rewardCurrency) : undefined;
    if (rule.outcome === "points" && !profile) return {
      ...base,
      pointsLabel: `${earned.toLocaleString("en-IN")} ${rule.rewardCurrency}`,
      minValue: 0,
      maxValue: 0,
      matchedRule,
      caveat: "Rewards were calculated, but their redemption value has not been reviewed yet.",
      sourceUrl: rule.sourceUrl,
      checkedAt: rule.checkedAt,
      conditional: true,
    };
    const valuation = profile ? valuationFields(earned, profile, input.now) : undefined;
    const minValue = valuation?.minValue ?? earned;
    const maxValue = valuation?.maxValue ?? earned;
    const cappedMin = rule.valueCap === undefined ? minValue : Math.min(minValue, rule.valueCap);
    const cappedMax = rule.valueCap === undefined ? maxValue : Math.min(maxValue, rule.valueCap);
    const pointsLabel = rule.outcome === "excluded"
      ? "No rewards"
      : rule.outcome === "percentage"
        ? `${((rule.rate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% ${rule.rewardCurrency}`
        : `${earned.toLocaleString("en-IN")} ${rule.rewardCurrency}`;
    return {
      ...base,
      pointsLabel,
      minValue: cappedMin,
      maxValue: cappedMax,
      bestValueLabel: valuation?.bestValueLabel,
      bestValueCalculation: valuation?.bestValueCalculation,
      bestValueSourceUrl: valuation?.bestValueSourceUrl,
      fallbackValue: valuation?.fallbackValue,
      fallbackValueLabel: valuation?.fallbackValueLabel,
      fallbackValueCalculation: valuation?.fallbackValueCalculation,
      fallbackValueSourceUrl: valuation?.fallbackValueSourceUrl,
      matchedRule,
      caveat: [caveat, valuation?.valuationAssumption].filter(Boolean).join(" ") || undefined,
      sourceUrl: rule.sourceUrl,
      checkedAt: rule.checkedAt,
      conditional: rule.status !== "approved" || usageConditional || Boolean(valuation?.valuationConditional),
    };
  });
  return results.sort((left, right) => right.maxValue - left.maxValue || Number(left.conditional) - Number(right.conditional) || right.minValue - left.minValue);
}

const compareRecommendations = (left: DirectRecommendation | RoutedRecommendation, right: DirectRecommendation | RoutedRecommendation) =>
  right.maxValue - left.maxValue || Number(left.conditional) - Number(right.conditional) || right.minValue - left.minValue;

const routeMatches = (rule: PrivateRouteRule, input: RecommendationInput) => {
  if (rule.purchaseType !== input.purchaseType) return false;
  if (rule.paymentMode !== "both" && rule.paymentMode !== input.paymentMode) return false;
  if (rule.merchantKey && !input.merchant.toLowerCase().includes(rule.merchantKey.toLowerCase())) return false;
  return (rule.validFrom === undefined || rule.validFrom <= input.now)
    && (rule.validUntil === undefined || rule.validUntil >= input.now);
};

export function calculateRecommendations(
  cards: PublicCard[],
  directRules: PrivateDirectRule[],
  routeRules: PrivateRouteRule[],
  input: RecommendationInput,
  usage: RouteUsage = {},
  redemptionProfiles: RedemptionProfile[] = [],
): Array<DirectRecommendation | RoutedRecommendation> {
  const contextualInput = { ...input, contextualSpendThisMonth: usage.atlasTravelSpendThisMonth };
  const direct = calculateDirectRecommendations(cards, directRules, contextualInput, redemptionProfiles).map((recommendation) => {
    if (recommendation.cardKey !== "sbi-cashback" || recommendation.maxValue <= 0) return recommendation;
    const earnedThisCycle = usage.sbiCashbackEarnedThisCycle ?? 0;
    const remaining = Math.max(0, 2000 - earnedThisCycle);
    const cappedValue = Math.min(recommendation.minValue, remaining);
    return {
      ...recommendation,
      minValue: cappedValue,
      maxValue: cappedValue,
      matchedRule: `${recommendation.matchedRule}; remaining statement-cycle allowance applied`,
      caveat: `${recommendation.caveat ?? ""} You entered ${money(earnedThisCycle)} already earned, leaving ${money(remaining)} in this channel.`.trim(),
    };
  });
  if (usage.includePortals === false) return direct;

  const routed = cards.flatMap((card) => routeRules
    .filter((rule) => rule.cardKey === card.cardKey && routeMatches(rule, input))
    .map((rule): RoutedRecommendation | null => {
      const voucherCap = rule.routeType === "voucher" && rule.capValue !== undefined && rule.capUnit === "₹ voucher purchases";
      const availableVoucherCap = voucherCap ? Math.max(0, rule.capValue! - (usage.voucherSpendThisMonth ?? 0)) : input.amount;
      const eligibleAmount = voucherCap ? Math.min(input.amount, availableVoucherCap) : input.amount;
      if (rule.routeType === "voucher" && eligibleAmount <= 0) return null;

      const remainder = input.amount - eligibleAmount;
      const rawEarned = Math.floor(eligibleAmount / rule.baseSpend) * rule.baseEarn * rule.multiplier;
      const earned = rule.capUnit === "accelerated points" && rule.capValue !== undefined
        ? Math.min(rawEarned, rule.capValue)
        : rawEarned;
      const remainderRecommendation = remainder > 0
        ? calculateDirectRecommendations([card], directRules, { ...contextualInput, amount: remainder }, redemptionProfiles)[0]
        : undefined;
      const profile = profileFor(redemptionProfiles, card.cardKey, rule.rewardCurrency);
      if (!profile) return null;
      const valuation = valuationFields(earned, profile, input.now);
      const grossMin = valuation.minValue + (remainderRecommendation?.minValue ?? 0);
      const grossMax = valuation.maxValue + (remainderRecommendation?.maxValue ?? 0);
      const split = remainder > 0
        ? ` Buy ${money(eligibleAmount)} as a voucher, then pay the remaining ${money(remainder)} directly with ${card.name}.`
        : "";
      const feeCaveat = input.purchaseType === "flight" && rule.routeType === "portal"
        ? " Portal fees are not included in this estimate."
        : "";
      const allowanceCaveat = remainder > 0 && rule.capValue !== undefined
        ? ` The remaining monthly voucher allowance of ${money(availableVoucherCap)} was applied.`
        : "";
      const pointsCapCaveat = earned < rawEarned
        ? ` Rewards were capped at ${earned.toLocaleString("en-IN")} points.`
        : "";

      return {
        id: `${card.cardKey}-${rule.routeKey}`,
        cardKey: card.cardKey,
        cardName: card.name,
        issuer: card.issuer,
        kind: rule.routeType,
        title: rule.routeType === "voucher"
          ? `Buy a ${money(eligibleAmount)} Amazon Shopping Voucher first`
          : input.purchaseType === "hotel"
            ? `Book through ${rule.platformName} if available`
            : `Book through ${rule.platformName}`,
        action: rule.routeType === "voucher"
          ? `Open ${rule.platformName} and buy the voucher with ${card.name}.${split}`
          : input.purchaseType === "hotel"
            ? `Search ${rule.platformName} for this hotel. If it is not listed, use the best direct option below.`
            : `Open ${rule.platformName}, choose Flights, and pay with ${card.name}.`,
        pointsLabel: `${earned.toLocaleString("en-IN")} ${rule.rewardCurrency}${remainderRecommendation ? " plus direct rewards on the remainder" : ""}`,
        minValue: grossMin,
        maxValue: grossMax,
        bestValueLabel: valuation.bestValueLabel,
        bestValueCalculation: valuation.bestValueCalculation,
        bestValueSourceUrl: valuation.bestValueSourceUrl,
        fallbackValue: valuation.fallbackValue,
        fallbackValueLabel: valuation.fallbackValueLabel,
        fallbackValueCalculation: valuation.fallbackValueCalculation,
        fallbackValueSourceUrl: valuation.fallbackValueSourceUrl,
        matchedRule: `${rule.multiplier}X through ${rule.platformName} on ${money(eligibleAmount)}`,
        caveat: `${rule.evidence}${feeCaveat}${allowanceCaveat}${pointsCapCaveat}${valuation.valuationAssumption ? ` ${valuation.valuationAssumption}` : ""}`,
        sourceUrl: rule.sourceUrl,
        checkedAt: rule.checkedAt,
        conditional: valuation.valuationConditional,
      };
    })
    .filter((route): route is RoutedRecommendation => route !== null));

  return [...direct, ...routed].sort(compareRecommendations);
}
