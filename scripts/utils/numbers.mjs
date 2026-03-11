/**
 * Format a probability/price (0–1 range) as percentage with 1 decimal.
 * e.g. 0.65 → "65.0%"
 */
export function fmtProb(n) {
  if (n == null) return '—';
  return (Number(n) * 100).toFixed(1) + '%';
}

/**
 * Format a dollar amount.
 * e.g. 12345.6 → "$12,345.60"
 */
export function fmtUsd(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format a price (Polymarket prices are 0–1 representing $0–$1 per share).
 * Shows as cents: 0.65 → "$0.65"
 */
export function fmtPrice(n) {
  if (n == null) return '—';
  return '$' + Number(n).toFixed(4);
}

/**
 * Format a number with given decimal places.
 */
export function fmtNum(n, decimals = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Format a change with sign.
 * e.g. 0.05 → "+5.00%", -0.03 → "-3.00%"
 */
export function fmtChange(n) {
  if (n == null) return '—';
  const pct = Number(n) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Abbreviate large numbers: 1_200_000 → "1.2M", 45_000 → "45K"
 */
export function fmtCompact(n) {
  if (n == null) return '—';
  const num = Number(n);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toFixed(2);
}
