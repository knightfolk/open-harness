export function formatScoreDisplay(value: unknown, digits = 2, fallback = 'unavailable'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const normalized = Object.is(value, -0) ? 0 : value;
  const safeDigits = Math.min(10, Math.max(0, Math.trunc(Number.isFinite(digits) ? digits : 2)));
  return normalized.toFixed(safeDigits);
}

interface ModelLabBreakdownLike {
  structural?: unknown;
  runtime?: unknown;
  style?: unknown;
}

export interface ModelLabBreakdownDisplaySegment {
  key: 'structural' | 'runtime' | 'style';
  label: 'Structural' | 'Runtime' | 'Style';
  valueLabel: string;
  maxLabel: string;
  widthPercent: number;
  width: string;
  title: string;
}

interface ModelLabRubricCoverageLike {
  passedPoints?: unknown;
  totalPoints?: unknown;
  ratio?: unknown;
}

const MODEL_LAB_BREAKDOWN_SEGMENTS = [
  { key: 'structural', label: 'Structural', maxLabel: '4.5' },
  { key: 'runtime', label: 'Runtime', maxLabel: '3.5' },
  { key: 'style', label: 'Style', maxLabel: '2' },
] as const;

function safeModelLabBreakdownValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function safeModelLabMetricValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Object.is(value, -0) ? 0 : value;
}

function safeModelLabMetricRatioValue(value: unknown, maxValue: unknown): number | null {
  const safeValue = safeModelLabMetricValue(value);
  const safeMax = safeModelLabMetricValue(maxValue);
  if (safeValue == null || safeMax == null || safeMax <= 0) return null;
  return safeValue / safeMax;
}

function safeModelLabRubricCoverage(coverage?: unknown): { passed: number; total: number; ratio: number } | null {
  if (!coverage || typeof coverage !== 'object') return null;
  const { passedPoints, totalPoints, ratio } = coverage as ModelLabRubricCoverageLike;
  const passed = safeModelLabMetricValue(passedPoints);
  const total = safeModelLabMetricValue(totalPoints);
  const safeRatio = typeof ratio === 'number' && Number.isFinite(ratio) ? ratio : null;
  if (passed == null || total == null || total <= 0 || safeRatio == null || safeRatio < 0 || safeRatio > 1) return null;
  return { passed, total, ratio: safeRatio };
}

function hasModelLabMetricSamples(sampleCount: unknown): boolean {
  if (sampleCount === undefined) return true;
  return typeof sampleCount === 'number' && Number.isFinite(sampleCount) && sampleCount > 0;
}

export function formatModelLabMetricValue(value: unknown): string {
  const safeValue = safeModelLabMetricValue(value);
  return safeValue == null ? 'unavailable' : String(safeValue);
}

export function formatModelLabMetricValueForSamples(value: unknown, sampleCount?: unknown): string {
  return hasModelLabMetricSamples(sampleCount) ? formatModelLabMetricValue(value) : 'unavailable';
}

export function formatModelLabMetricRatio(value: unknown, maxValue: unknown): string {
  const safeValue = safeModelLabMetricValue(value);
  const safeMax = safeModelLabMetricValue(maxValue);
  if (safeMax != null && safeMax <= 0) return 'unavailable';
  if (safeValue == null || safeMax == null) return 'unavailable';
  return `${safeValue}/${safeMax}`;
}

export function formatModelLabMetricRatioForSamples(value: unknown, maxValue: unknown, sampleCount?: unknown): string {
  return hasModelLabMetricSamples(sampleCount) ? formatModelLabMetricRatio(value, maxValue) : 'unavailable';
}

export function modelLabScoreColor(value: unknown): string {
  const safeValue = safeModelLabMetricValue(value);
  if (safeValue == null) return 'var(--text-tertiary)';
  if (safeValue >= 7) return 'var(--accent-success)';
  if (safeValue >= 4) return 'var(--accent-warning)';
  return 'var(--accent-error)';
}

export function modelLabScoreColorForSamples(value: unknown, sampleCount?: unknown): string {
  return hasModelLabMetricSamples(sampleCount) ? modelLabScoreColor(value) : 'var(--text-tertiary)';
}

export function formatModelLabDurationMs(value: unknown): string {
  const safeValue = safeModelLabMetricValue(value);
  return safeValue == null ? 'unavailable' : `${(safeValue / 1000).toFixed(1)}s`;
}

export function formatModelLabLatencyMs(value: unknown): string {
  const safeValue = safeModelLabMetricValue(value);
  return safeValue == null ? 'unavailable' : `${Math.round(safeValue)}ms`;
}

export function modelLabTimestampMs(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'string' || value.trim() === '') return null;
  const timestampMs = Date.parse(value);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

export function formatModelLabTimestamp(value: unknown): string {
  const timestampMs = modelLabTimestampMs(value);
  return timestampMs == null ? 'unavailable' : new Date(timestampMs).toLocaleString();
}

export function formatModelLabDurationMsForSamples(value: unknown, sampleCount?: unknown): string {
  return hasModelLabMetricSamples(sampleCount) ? formatModelLabDurationMs(value) : 'unavailable';
}

export function formatModelLabCost(value: unknown): string {
  const safeValue = safeModelLabMetricValue(value);
  return safeValue == null ? 'unavailable' : `$${safeValue.toFixed(6)}`;
}

export function formatModelLabCostForSamples(value: unknown, sampleCount?: unknown): string {
  return hasModelLabMetricSamples(sampleCount) ? formatModelLabCost(value) : 'unavailable';
}

export function formatModelLabPercent(value: unknown): string {
  const safeValue = safeModelLabMetricValue(value);
  return safeValue == null ? 'unavailable' : `${Math.round(safeValue * 100)}%`;
}

function roundDisplayPercent(value: number): number {
  const scaled = value * 100;
  const magnitude = Math.abs(scaled);
  const roundedMagnitude = Math.round(magnitude + Number.EPSILON * Math.max(1, magnitude));
  return Math.sign(scaled) * roundedMagnitude;
}

// Deliberately preserves finite out-of-range values so telemetry bugs stay visible.
export function formatPercentDisplay(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'unavailable';
  const percent = roundDisplayPercent(value);
  return `${Object.is(percent, -0) ? 0 : percent}%`;
}

export function formatModelLabRubricCoverage(coverage?: unknown): string {
  if (!coverage || typeof coverage !== 'object') return '—';
  const totalPoints = (coverage as ModelLabRubricCoverageLike).totalPoints;
  if (typeof totalPoints === 'number' && Number.isFinite(totalPoints) && totalPoints <= 0) return '—';
  const safeCoverage = safeModelLabRubricCoverage(coverage);
  if (!safeCoverage) return 'unavailable';
  return `${formatModelLabMetricValue(averageModelLabMetricValues([safeCoverage.passed]))}/${formatModelLabMetricValue(averageModelLabMetricValues([safeCoverage.total]))} pts · ${formatModelLabPercent(safeCoverage.ratio)}`;
}

export function modelLabRubricCoverageColor(coverage?: unknown): string {
  const safeCoverage = safeModelLabRubricCoverage(coverage);
  if (!safeCoverage) return 'var(--text-tertiary)';
  if (safeCoverage.ratio >= 0.7) return 'var(--accent-success)';
  if (safeCoverage.ratio >= 0.4) return '#f59e0b';
  return 'var(--accent-error)';
}

export function formatModelLabSignedDelta(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const normalized = Object.is(value, -0) ? 0 : value;
  return `${normalized >= 0 ? '+' : ''}${normalized}`;
}

export function modelLabDeltaColor(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'var(--text-tertiary)';
  return value >= 0 ? 'var(--accent-success)' : 'var(--accent-error)';
}

export function compareModelLabMetricValues(a: unknown, b: unknown): number {
  const safeA = safeModelLabMetricValue(a);
  const safeB = safeModelLabMetricValue(b);
  if (safeA == null && safeB == null) return 0;
  if (safeA == null) return 1;
  if (safeB == null) return -1;
  return safeA - safeB;
}

export function isMalformedModelLabMetricRatio(value: unknown, maxValue: unknown): boolean {
  return safeModelLabMetricRatioValue(value, maxValue) == null;
}

export function compareModelLabMetricRatios(aValue: unknown, aMaxValue: unknown, bValue: unknown, bMaxValue: unknown): number {
  const safeA = safeModelLabMetricRatioValue(aValue, aMaxValue);
  const safeB = safeModelLabMetricRatioValue(bValue, bMaxValue);
  if (safeA == null && safeB == null) return 0;
  if (safeA == null) return 1;
  if (safeB == null) return -1;
  return safeA - safeB;
}

export function averageModelLabMetricValues(values: unknown[], digits: unknown = 1): number | null {
  const safeValues = values
    .map((value) => safeModelLabMetricValue(value))
    .filter((value): value is number => value != null);
  if (safeValues.length === 0) return null;
  const safeDigits = Math.min(10, Math.max(0, Math.trunc(Number.isFinite(digits) ? Number(digits) : 1)));
  const scale = 10 ** safeDigits;
  const average = safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
  return Object.is(average, -0) ? 0 : Math.round(average * scale) / scale;
}

export function buildModelLabBreakdownDisplaySegments(breakdown?: ModelLabBreakdownLike | null): ModelLabBreakdownDisplaySegment[] {
  if (!breakdown) return [];
  const values = MODEL_LAB_BREAKDOWN_SEGMENTS.map((segment) => ({
    ...segment,
    value: safeModelLabBreakdownValue(breakdown[segment.key]),
  }));
  const total = Math.max(10, values.reduce((sum, segment) => sum + segment.value, 0));
  return values.map(({ value, ...segment }) => {
    const widthPercent = (value / total) * 100;
    const valueLabel = String(value);
    return {
      ...segment,
      valueLabel,
      widthPercent,
      width: `${widthPercent}%`,
      title: `${segment.label} ${valueLabel}/${segment.maxLabel}`,
    };
  });
}
