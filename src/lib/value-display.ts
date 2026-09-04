const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

export function estimatedValueLabel(route: { minValue: number; maxValue: number; pointsLabel: string; bestValueLabel?: string }) {
  const min = Math.round(route.minValue);
  const max = Math.round(route.maxValue);
  if (route.bestValueLabel) return `${money(max)} via ${route.bestValueLabel}`;
  if (min !== max) return `${money(max)} best supported · ${money(min)} fallback`;
  return /point|mile|coin/i.test(route.pointsLabel)
    ? `${money(min)} at the stated redemption`
    : money(min);
}
