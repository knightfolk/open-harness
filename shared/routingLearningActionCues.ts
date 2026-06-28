export type RoutingLearningActionCueStatus = 'actionable' | 'learning' | 'context';
export type RoutingLearningActionCueConfidence = 'high' | 'limited' | 'learning' | 'weak';
export type RoutingActionCueConfidenceFilter = 'all' | RoutingLearningActionCueConfidence;
export const ROUTING_LEARNING_STALE_DECISION_DAYS = 30;
const ROUTING_LEARNING_STALE_DECISION_MS = ROUTING_LEARNING_STALE_DECISION_DAYS * 24 * 60 * 60 * 1000;

export interface RoutingLearningActionCueInput {
  taskType: string;
  model: string;
  total: number;
  success: number;
  rate: number;
  sampleCount?: number;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
}

export interface RoutingLearningActionCue {
  taskType: string;
  model: string;
  total: number;
  success: number;
  rate: number;
  sampleCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  status: RoutingLearningActionCueStatus;
  confidence: RoutingLearningActionCueConfidence;
  confidenceLabel: string;
  confidenceDetail: string;
  decisionFreshnessLabel: string;
  freshnessDetail: string;
  stale: boolean;
  staleLabel: string;
  staleDetail: string;
  label: string;
  detail: string;
  ariaLabel: string;
}

const ACTIONABLE_MIN_REVIEWED = 5;
const ACTIONABLE_CONFIDENT_MIN_REVIEWED = 10;
const ACTIONABLE_MIN_RATE = 0.8;
export const ROUTING_ACTION_CUE_CONFIDENCE_FILTERS: RoutingActionCueConfidenceFilter[] = ['all', 'high', 'limited', 'learning', 'weak'];

export function formatRoutingLearningCuePercentDisplay(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

export function formatRoutingLearningCueDecisionDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function isRoutingLearningCueStale(
  cue: Pick<RoutingLearningActionCueInput, 'lastSeenAt'>,
  nowMs: number = Date.now(),
): boolean {
  if (!cue.lastSeenAt) return false;
  const lastSeenMs = Date.parse(cue.lastSeenAt);
  if (!Number.isFinite(lastSeenMs)) return false;
  return nowMs - lastSeenMs > ROUTING_LEARNING_STALE_DECISION_MS;
}

function buildDecisionFreshness(row: RoutingLearningActionCueInput): {
  sampleCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  decisionFreshnessLabel: string;
  freshnessDetail: string;
} {
  const sampleCount = Number.isFinite(row.sampleCount) && (row.sampleCount || 0) > 0
    ? Math.round(row.sampleCount || 0)
    : row.total;
  const firstSeenAt = row.firstSeenAt || null;
  const lastSeenAt = row.lastSeenAt || null;
  const firstDate = formatRoutingLearningCueDecisionDate(firstSeenAt);
  const lastDate = formatRoutingLearningCueDecisionDate(lastSeenAt);
  if (!firstDate || !lastDate) {
    return {
      sampleCount,
      firstSeenAt,
      lastSeenAt,
      decisionFreshnessLabel: '',
      freshnessDetail: '',
    };
  }
  return {
    sampleCount,
    firstSeenAt,
    lastSeenAt,
    decisionFreshnessLabel: `Last routed ${lastDate}`,
    freshnessDetail: `Decision freshness: ${sampleCount} reviewed routing decisions; first routed ${firstDate}, most recent routed ${lastDate}. This is routing-decision age, not outcome-review age.`,
  };
}

export function buildRoutingLearningActionCues(rows: RoutingLearningActionCueInput[], nowMs: number = Date.now()): RoutingLearningActionCue[] {
  return rows.map((row) => {
    const rateLabel = formatRoutingLearningCuePercentDisplay(row.rate);
    const freshness = buildDecisionFreshness(row);
    let status: RoutingLearningActionCueStatus = 'context';
    let confidence: RoutingLearningActionCueConfidence = 'weak';
    let confidenceLabel = 'Weak signal';
    let confidenceDetail = `${rateLabel} is below the ${formatRoutingLearningCuePercentDisplay(ACTIONABLE_MIN_RATE)} action bar for ${row.taskType}.`;
    let label = 'Context only';
    let detail = `${row.model} is the current ${row.taskType} winner, but ${rateLabel} is below the ${formatRoutingLearningCuePercentDisplay(ACTIONABLE_MIN_RATE)} action bar.`;

    if (row.total < ACTIONABLE_MIN_REVIEWED) {
      status = 'learning';
      confidence = 'learning';
      confidenceLabel = 'Learning';
      confidenceDetail = `${row.total} reviewed ${row.taskType} outcomes is below the ${ACTIONABLE_MIN_REVIEWED}-outcome action bar.`;
      label = 'Needs more outcomes';
      detail = `Collect ${ACTIONABLE_MIN_REVIEWED - row.total} more reviewed ${row.taskType} outcomes before using ${row.model} as routing-card evidence.`;
    } else if (row.rate >= ACTIONABLE_MIN_RATE) {
      status = 'actionable';
      label = 'Candidate card cue';
      if (row.total < ACTIONABLE_CONFIDENT_MIN_REVIEWED) {
        confidence = 'limited';
        confidenceLabel = 'Limited sample';
        confidenceDetail = `Only ${row.total} reviewed ${row.taskType} outcomes support this cue.`;
      } else {
        confidence = 'high';
        confidenceLabel = 'High confidence';
        confidenceDetail = `${row.total} reviewed ${row.taskType} outcomes support this cue.`;
      }
      detail = `Use as advisory routing-card evidence: ${row.model} handled ${row.taskType} at ${rateLabel} across ${row.total} reviewed outcomes.`;
      if (confidence === 'limited') {
        detail += ' Confidence: limited sample; review before relying on this cue.';
      }
    }
    const stale = isRoutingLearningCueStale({ lastSeenAt: freshness.lastSeenAt }, nowMs);
    const staleDate = formatRoutingLearningCueDecisionDate(freshness.lastSeenAt);
    const staleLabel = stale ? `Stale (>${ROUTING_LEARNING_STALE_DECISION_DAYS}d)` : '';
    const staleDetail = stale && staleDate
      ? `No routing decisions recorded in the last ${ROUTING_LEARNING_STALE_DECISION_DAYS} days; most recent routed ${staleDate}.`
      : '';
    if (stale) {
      label += ' · stale';
      detail += ` ${staleDetail} Refresh recent outcomes before using this as routing-card evidence.`;
    }

    return {
      taskType: row.taskType,
      model: row.model,
      total: row.total,
      success: row.success,
      rate: row.rate,
      sampleCount: freshness.sampleCount,
      firstSeenAt: freshness.firstSeenAt,
      lastSeenAt: freshness.lastSeenAt,
      status,
      confidence,
      confidenceLabel,
      confidenceDetail,
      decisionFreshnessLabel: freshness.decisionFreshnessLabel,
      freshnessDetail: freshness.freshnessDetail,
      stale,
      staleLabel,
      staleDetail,
      label,
      detail,
      ariaLabel: `${label} for ${row.taskType}: ${detail} ${confidenceLabel}: ${confidenceDetail}${freshness.freshnessDetail ? ` ${freshness.freshnessDetail}` : ''}${staleDetail ? ` ${staleDetail}` : ''}`,
    };
  });
}

export function routingLearningActionCueFilterLabel(filter: RoutingActionCueConfidenceFilter): string {
  if (filter === 'all') return 'All';
  if (filter === 'high') return 'High';
  if (filter === 'limited') return 'Limited';
  if (filter === 'learning') return 'Learning';
  return 'Weak';
}

export function filterRoutingLearningActionCues(
  cues: RoutingLearningActionCue[],
  filter: RoutingActionCueConfidenceFilter,
): RoutingLearningActionCue[] {
  if (filter === 'all') return cues;
  return cues.filter((cue) => cue.confidence === filter);
}
