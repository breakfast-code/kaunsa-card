const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

export function estimatedValueLabel(route: { minValue: number; maxValue: number; pointsLabel: string }) {
  const min = Math.round(route.minValue);
  const max = Math.round(route.maxValue);
  if (min !== max) return `${money(min)}–${money(max)}`;
  return /point|mile|coin/i.test(route.pointsLabel)
    ? `${money(min)} at the stated redemption`
    : money(min);
}
