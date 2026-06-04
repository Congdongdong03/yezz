const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
};

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? currency;
}

/** Parse mock/legacy strings like "¥68 - ¥128" or "¥198/person". */
export function parsePriceRangeString(
  priceRange: string | null | undefined,
): { min: number | null; max: number | null } {
  if (!priceRange?.trim()) return { min: null, max: null };

  const numbers = priceRange.match(/\d+(?:\.\d+)?/g)?.map((n) => Number.parseFloat(n)) ?? [];
  if (numbers.length === 0) return { min: null, max: null };
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

export function formatPriceDisplay(options: {
  min: number | null;
  max: number | null;
  currency?: string;
  priceRangeOverride?: string | null;
}): string | null {
  const { min, max, currency = "CNY", priceRangeOverride } = options;
  if (priceRangeOverride?.trim()) return priceRangeOverride.trim();

  const symbol = currencySymbol(currency);
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) {
    return `${symbol}${formatAmount(min)} - ${symbol}${formatAmount(max)}`;
  }
  const value = min ?? max;
  if (value == null) return null;
  return `${symbol}${formatAmount(value)}`;
}

export function formatStylePrice(
  price: string | null | undefined,
  currency = "CNY",
): string | null {
  if (!price?.trim()) return null;
  const trimmed = price.trim();
  if (/[¥$€]/.test(trimmed)) return trimmed;
  const numeric = Number.parseFloat(trimmed.replace(/[^\d.]/g, ""));
  if (Number.isNaN(numeric)) return trimmed;
  return `${currencySymbol(currency)}${formatAmount(numeric)}`;
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function resolveProjectPricing(project: {
  priceRange: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string | null;
}) {
  const currency = project.priceCurrency ?? "CNY";
  let min = project.priceMin;
  let max = project.priceMax;
  if (min == null && max == null && project.priceRange) {
    const parsed = parsePriceRangeString(project.priceRange);
    min = parsed.min;
    max = parsed.max;
  }
  return {
    priceMin: min,
    priceMax: max,
    priceCurrency: currency,
    priceDisplay: formatPriceDisplay({
      min,
      max,
      currency,
      priceRangeOverride: project.priceRange,
    }),
  };
}
