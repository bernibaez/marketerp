/**
 * Format a number with thousands separators using a fixed locale (en-US)
 * to prevent SSR/client hydration mismatches caused by locale-dependent formatting.
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}
