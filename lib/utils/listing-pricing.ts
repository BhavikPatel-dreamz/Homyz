export function clampWeekendPremium(value: number | null | undefined, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Number(value)));
}

export function computeWeekendPrice(basePriceCents: number | null | undefined, premiumPercent: number | null | undefined) {
  const basePrice = Number.isFinite(basePriceCents) && Number(basePriceCents) > 0 ? Number(basePriceCents) : 0;
  const premium = clampWeekendPremium(premiumPercent);
  return Math.round(basePrice * (1 + premium / 100));
}

export function deriveWeekendPremium(basePriceCents: number | null | undefined, weekendPriceCents: number | null | undefined) {
  const basePrice = Number.isFinite(basePriceCents) && Number(basePriceCents) > 0 ? Number(basePriceCents) : 0;
  const weekendPrice = Number.isFinite(weekendPriceCents) && Number(weekendPriceCents) > 0 ? Number(weekendPriceCents) : 0;

  if (basePrice <= 0 || weekendPrice <= 0) return 0;
  if (weekendPrice <= basePrice) return 0;

  return clampWeekendPremium(Math.round(((weekendPrice / basePrice) - 1) * 100));
}
