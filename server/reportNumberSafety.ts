export function finiteNumber(value: unknown, options: { min?: number; max?: number } = {}): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (options.min !== undefined && value < options.min) return null;
  if (options.max !== undefined && value > options.max) return null;
  return value;
}

export function averageFinite(values: unknown[], options: { min?: number; max?: number } = {}): number | null {
  const finite = values
    .map((value) => finiteNumber(value, options))
    .filter((value): value is number => value !== null);
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

export function countFinite(values: unknown[], options: { min?: number; max?: number } = {}): number {
  return values.filter((value) => finiteNumber(value, options) !== null).length;
}

export function roundFinite(value: unknown, decimals: number, fallback = 0): number {
  const finite = finiteNumber(value);
  if (finite === null) return fallback;
  const factor = 10 ** decimals;
  return Math.round(finite * factor) / factor;
}

export function formatFiniteNumber(value: unknown, decimals: number): string {
  const finite = finiteNumber(value);
  if (finite === null) return 'unavailable';
  return decimals === 0 ? String(Math.round(finite)) : finite.toFixed(decimals);
}

export function formatReportScore(value: unknown, denominator = 10): string {
  const finite = finiteNumber(value);
  if (finite === null) return 'unavailable';
  return `${roundFinite(finite, 1)}/${denominator}`;
}

export function formatLatencyMs(value: unknown): string {
  const finite = finiteNumber(value, { min: 0 });
  if (finite === null) return 'unavailable';
  return `${(finite / 1000).toFixed(1)}s`;
}

export function formatCost(value: unknown): string {
  const finite = finiteNumber(value, { min: 0 });
  if (finite === null) return 'unavailable';
  return `$${finite.toFixed(6)}`;
}
