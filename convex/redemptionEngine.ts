export type RedemptionOption = {
  optionKey: string;
  label: string;
  unitsPerReward: number;
  rupeesPerUnit: number;
  valueType: "guaranteed" | "estimated";
  assumption?: string;
  rulesSourceUrl: string;
  valueSourceUrl: string;
  valueSourceKind: "official" | "expert";
  checkedAt: number;
  validFrom?: number;
  validUntil?: number;
};

export type RedemptionProfile = {
  cardKey: string;
  rewardCurrency: string;
  version: number;
  status: "draft" | "approved" | "retired";
  options: RedemptionOption[];
};

export type ValuedRedemption = RedemptionOption & {
  partnerUnits: number;
  rupeeValue: number;
};

export type RewardValuation = {
  earnedAmount: number;
  earnedCurrency: string;
  best: ValuedRedemption;
  fallback?: ValuedRedemption;
  options: ValuedRedemption[];
};

const active = (option: RedemptionOption, now: number) =>
  (option.validFrom === undefined || option.validFrom <= now)
  && (option.validUntil === undefined || option.validUntil >= now);

export function valueRewards(earnedAmount: number, profile: RedemptionProfile, now: number): RewardValuation {
  if (!Number.isFinite(earnedAmount) || earnedAmount < 0) throw new Error("Invalid earned reward amount.");
  const options = profile.options
    .filter((option) => active(option, now))
    .map((option): ValuedRedemption => {
      if (option.unitsPerReward <= 0 || option.rupeesPerUnit < 0) throw new Error(`Invalid redemption option ${option.optionKey}.`);
      const partnerUnits = earnedAmount * option.unitsPerReward;
      return { ...option, partnerUnits, rupeeValue: partnerUnits * option.rupeesPerUnit };
    })
    .sort((left, right) => right.rupeeValue - left.rupeeValue || Number(left.valueType === "estimated") - Number(right.valueType === "estimated"));
  if (!options.length) throw new Error(`No supported redemption option for ${profile.cardKey} ${profile.rewardCurrency}.`);
  const best = options[0];
  const fallback = best.valueType === "estimated"
    ? options.find((option) => option.valueType === "guaranteed" && option.optionKey !== best.optionKey)
    : undefined;
  return { earnedAmount, earnedCurrency: profile.rewardCurrency, best, fallback, options };
}
