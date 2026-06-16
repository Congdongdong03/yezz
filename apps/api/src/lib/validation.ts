/**
 * Safely parse a value into a positive integer.
 * Returns fallback if value is not a number, NaN, or <= 0.
 */
export function parsePositiveInt(value: unknown, fallback: number): number {
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) {
    return fallback;
  }
  return num;
}
