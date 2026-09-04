import { query } from "./_generated/server";

const adminIds = () => new Set((process.env.ADMIN_CLERK_USER_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { access: "signed-out" as const };
    if (!adminIds().has(identity.subject)) return { access: "denied" as const };

    const [banks, cards, directRules, platforms, merchants, sources, routes, legacyRules, proposals, coverage] = await Promise.all([
      ctx.db.query("banks").collect(), ctx.db.query("cardProducts").collect(), ctx.db.query("directRewardRules").collect(),
      ctx.db.query("paymentPlatforms").collect(), ctx.db.query("merchants").collect(), ctx.db.query("officialSources").collect(),
      ctx.db.query("routeRules").collect(), ctx.db.query("rewardRules").collect(), ctx.db.query("ruleProposals").collect(),
      ctx.db.query("cardRuleCoverage").collect(),
    ]);
    const bankById = new Map(banks.map((item) => [item._id, item]));
    const cardById = new Map(cards.map((item) => [item._id, item]));
    const platformById = new Map(platforms.map((item) => [item._id, item]));
    const merchantById = new Map(merchants.map((item) => [item._id, item]));
    const sourceById = new Map(sources.map((item) => [item._id, item]));

    return {
      access: "granted" as const, generatedAt: Date.now(),
      counts: { banks: banks.length, cards: cards.length, directRules: directRules.length, routes: routes.length, sources: sources.length, proposals: proposals.length, coverageCells: coverage.length, legacyRules: legacyRules.length },
      cards: cards.map((card) => ({ cardKey: card.cardKey, name: card.name, bank: bankById.get(card.bankId)?.name ?? "Unknown bank", coverage: card.coverage, status: card.status, checkedAt: card.checkedAt, directRuleCount: directRules.filter((rule) => rule.cardKey === card.cardKey).length, routeCount: routes.filter((route) => route.cardId === card._id).length })).sort((a, b) => a.bank.localeCompare(b.bank) || a.name.localeCompare(b.name)),
      directRules: directRules.map((rule) => ({ ruleKey: rule.ruleKey, cardKey: rule.cardKey, status: rule.status, version: rule.version, priority: rule.priority, purchaseTypes: rule.purchaseTypes, paymentModes: rule.paymentModes, outcome: rule.outcome, rewardCurrency: rule.rewardCurrency, matchedRule: rule.matchedRule, caveat: rule.caveat ?? rule.caveatUsageUnknown, sourceUrl: rule.sourceUrl, checkedAt: rule.checkedAt })).sort((a, b) => a.cardKey.localeCompare(b.cardKey) || b.priority - a.priority || b.version - a.version),
      routes: routes.map((route) => ({ routeKey: route.routeKey, card: cardById.get(route.cardId)?.name ?? "Unknown card", platform: platformById.get(route.platformId)?.name ?? "Unknown platform", merchant: route.merchantId ? merchantById.get(route.merchantId)?.name : undefined, sourceUrl: sourceById.get(route.sourceId)?.url, routeType: route.routeType, purchaseType: route.purchaseType, paymentMode: route.paymentMode, status: route.status, version: route.version, evidence: route.evidence, checkedAt: route.checkedAt })).sort((a, b) => a.card.localeCompare(b.card) || a.routeKey.localeCompare(b.routeKey)),
      sources: sources.map((source) => ({ sourceKey: source.sourceKey, publisher: source.publisher, title: source.title, kind: source.kind, url: source.url, retrievedAt: source.retrievedAt, hasFingerprint: Boolean(source.contentHash) })).sort((a, b) => a.publisher.localeCompare(b.publisher) || a.title.localeCompare(b.title)),
    };
  },
});
