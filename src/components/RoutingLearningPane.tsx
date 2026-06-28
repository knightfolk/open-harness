import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Check, ChevronDown, CircleHelp, Copy, Download, FlaskConical, Lightbulb, RefreshCw, ShieldCheck, Upload, XCircle } from 'lucide-react';
import * as api from '../utils/api';
import { ROUTING_FEEDBACK_GUIDANCE, candidateScoresUnavailableLabel, routingOutcomeHelp, routingOutcomeLabel } from '../utils/autoRouterTrace';
import { getModelLabEvidenceGate, routingDecisionToModelLabEvidenceScope, type ModelLabEvidenceScope } from '../utils/modelLabResultEvidence';
import { formatRouteLearningSignalSummary } from '../utils/routeLearningSignalSummary';
import { MAX_RECENT_EVENT_DISPLAY_LIMIT, RECENT_EVENT_BATCH_SIZE, buildRoutingDecisionScanCards, buildRoutingEventDisplayWindow, buildRoutingEventEvidenceView, buildRoutingLearningRecentDecisionState, routeEventTimeLabelAt as routeEventTimeLabel, type RoutingDecisionScanFilterTarget, type RoutingEventEvidenceView } from '../utils/routingLearningRecentDecisions';
import { ROUTING_POLICY_FILTERS, routingPolicyFilterLabel, type RoutingPolicyFilter } from '../utils/routingLearningPolicyFilter';
import { computeRoutingTrend } from '../utils/routingTrend';
import {
  ROUTING_ACTION_CUE_CONFIDENCE_FILTERS,
  buildRoutingLearningActionCues,
  filterRoutingLearningActionCues,
  routingLearningActionCueFilterLabel,
  type RoutingActionCueConfidenceFilter,
} from '../utils/routingLearningActionCues';
import { formatPercentDisplay, formatScoreDisplay } from '../utils/scoreDisplay';
import { buildModelRequestDurationEvidence, modelRequestDurationEvidenceLines, sortModelRequestDurationRows } from '../utils/modelRequestDurationEvidence';
import { PROVIDER_FAILURE_SCOPE_NOTE, buildProviderFailureRows, buildProviderFailureStrategyBreakdown, buildProviderFailureStrategyEvidence, deriveProviderFailureRoutingHint, formatProviderFailureDistinctStrategyLabel, formatProviderFailureStrategyFailureShareWidth, summarizeProviderFailureAdherence } from '../utils/routingAdherenceDisplay';
import { RoutingLearningSignalChips } from './RoutingLearningSignalChips';

const PROVIDER_FAILURE_ADHERENCE_PHASE = 'provider-stream';
const PROVIDER_FAILURE_ADHERENCE_EVENT_LIMIT = 8;
const PROVIDER_FAILURE_ADHERENCE_ROW_LIMIT = 5;
const UNKNOWN_ROUTING_CONTEXT_VALUE = '\u2014';

interface EnabledModelRef {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
}

interface Props {
  enabledModels?: EnabledModelRef[];
  onApplyRoleRecommendation?: (roleId: string, modelId: string) => void;
  onOpenModelLabEvidence?: (scope: ModelLabEvidenceScope) => void;
}

interface RoutingMetricCardProps {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  tone?: string;
  ariaLabel: string;
}

type ToolReliabilityRow = [string, api.ToolReliabilityBucket];
type ModelRequestDurationRow = [string, { samples: number; avgMs: number; slow: boolean; thresholdMs: number }];

interface ToolReliabilityTopRows {
  byModel: ToolReliabilityRow[];
  byTool: ToolReliabilityRow[];
  byModelTool: ToolReliabilityRow[];
  byPromptStrategyVariant: ToolReliabilityRow[];
}

interface ModelRequestDurationRows {
  byModel: ModelRequestDurationRow[];
  byTaskType: ModelRequestDurationRow[];
}

const EMPTY_TOOL_RELIABILITY_TOP_ROWS: ToolReliabilityTopRows = {
  byModel: [],
  byTool: [],
  byModelTool: [],
  byPromptStrategyVariant: [],
};

const EMPTY_MODEL_REQUEST_DURATION_ROWS: ModelRequestDurationRows = {
  byModel: [],
  byTaskType: [],
};

function normalizeModelId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function modelIdVariants(model: EnabledModelRef): string[] {
  return [
    model.id,
    `${model.providerId}:${model.id}`,
    model.name,
    `${model.providerName}:${model.name}`,
  ].map(normalizeModelId).filter(Boolean);
}

function modelKeyMatches(a: string, b: string): boolean {
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function RoutingMetricCard({ label, value, detail, tone, ariaLabel }: RoutingMetricCardProps) {
  return (
    <div className={['routing-metric-card', tone].filter(Boolean).join(' ')} role="listitem" aria-label={ariaLabel}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function pct(value: unknown): string {
  return formatPercentDisplay(value);
}

function ms(value: number): string {
  if (!value) return '0ms';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${value}ms`;
}

function toolReliabilityRows(data?: Record<string, api.ToolReliabilityBucket>) {
  return Object.entries(data || {})
    .sort(([, a], [, b]) => (b.error - a.error) || (b.total - a.total))
    .slice(0, 6);
}

function modelRequestDurationRows(data?: Record<string, { samples: number; avgMs: number; slow: boolean; thresholdMs: number }>): ModelRequestDurationRow[] {
  return sortModelRequestDurationRows(Object.entries(data || {})
    .filter(([, item]) => item.samples > 0 && Number.isFinite(item.avgMs))
  )
    .slice(0, 5);
}

function buildToolReliabilityTopRows(toolReliability: api.ToolReliabilitySummary | undefined): ToolReliabilityTopRows {
  if (!toolReliability) return EMPTY_TOOL_RELIABILITY_TOP_ROWS;
  return {
    byModel: toolReliabilityRows(toolReliability.byModel),
    byTool: toolReliabilityRows(toolReliability.byTool),
    byModelTool: toolReliabilityRows(toolReliability.byModelTool),
    byPromptStrategyVariant: toolReliabilityRows(toolReliability.byPromptStrategyVariant),
  };
}

function buildModelRequestDurationRows(summary: api.RouterLearningSummary['modelRequestDuration'] | undefined): ModelRequestDurationRows {
  if (!summary) return EMPTY_MODEL_REQUEST_DURATION_ROWS;
  return {
    byModel: modelRequestDurationRows(summary.byModel),
    byTaskType: modelRequestDurationRows(summary.byTaskType),
  };
}

function formatProviderFailureCauseCounts(causeCounts: Record<string, number | undefined>): string {
  const entries = Object.entries(causeCounts)
    .filter(([, count]) => typeof count === 'number' && count > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries.length > 0 ? entries.map(([cause, count]) => `${cause}=${count}`).join(', ') : 'none';
}

function sampleLabel(total: number): string {
  if (total === 0) return 'No reviewed outcomes yet';
  if (total < 5) return 'Very low confidence';
  if (total < 20) return 'Early signal';
  return 'Enough signal to trust trends';
}

function sampleTone(total: number): 'empty' | 'low' | 'ok' {
  if (total === 0) return 'empty';
  if (total < 20) return 'low';
  return 'ok';
}

function toolErrorLedgerStatusLabel(status: api.ToolErrorLiveEvidenceStatus | undefined): string {
  if (status === 'available') return 'Live evidence available';
  if (status === 'empty') return 'Ledger empty';
  return 'Missing ledger';
}

function toolErrorLedgerStatusHelp(summary: api.ToolErrorLedgerSummary | undefined): string {
  if (!summary) return 'Raw tool-error ledger status is unavailable.';
  if (summary.liveEvidenceStatus === 'available') {
    return `${summary.persistedEventCount} persisted and ${summary.logTraceEventCount} log-derived tool-error row${summary.persistedEventCount + summary.logTraceEventCount === 1 ? '' : 's'} available.`;
  }
  if (summary.liveEvidenceStatus === 'empty') {
    return 'The persisted tool-error ledger exists, but no matching recovery rows are available yet.';
  }
  return 'No persisted live tool-error ledger exists yet; run a real tool-error recovery scenario before treating recovery memory as closed.';
}

function toolReliabilityTuningActionCue(action: api.ToolReliabilityTuningAction): { label: string; detail: string; tone: 'actionable' | 'review' | 'context' } {
  switch (action) {
    case 'tune_local_router':
      return { label: 'Actionable', detail: 'Local saved evidence can inform router tuning after normal review.', tone: 'actionable' };
    case 'review_before_tuning':
      return { label: 'Review first', detail: 'Review this evidence source before changing routing behavior.', tone: 'review' };
    case 'context_only':
      return { label: 'Context only', detail: 'Use this evidence source as diagnostic context, not as a routing override.', tone: 'context' };
  }
}

function eventStatus(event: api.RoutingEvent) {
  if (event.outcome === 'success') return { label: routingOutcomeLabel(event.outcome), icon: CheckCircle2, tone: 'success' };
  if (event.outcome === 'failure') return { label: routingOutcomeLabel(event.outcome), icon: XCircle, tone: 'error' };
  if (event.outcome === 'ambiguous') return { label: routingOutcomeLabel(event.outcome), icon: CircleHelp, tone: 'muted' };
  return { label: routingOutcomeLabel(event.outcome), icon: CircleHelp, tone: 'warning' };
}

function routeEventExactTime(timestamp: string): string {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return 'unknown timestamp';
  return new Date(time).toISOString();
}

function routeEventPromptBestPractice(
  event: api.RoutingEvent,
  strategies: api.PromptStrategyProfile[],
): string {
  if (!event.promptStrategyId) return '';
  const strategy = strategies.find((item) => item.id === event.promptStrategyId);
  const note = strategy?.bestPracticeNotes?.[0];
  if (!note) return '';
  return ` Prompt eval cue: ${note.evaluationCue}; source: ${note.sourceRef}.`;
}

function activeFilterLabel(showUnratedOnly: boolean, showUnexplainedOnly: boolean, showStaleOnly: boolean, showFallbackOnly: boolean, showBenchmarkOnly: boolean, showEvidenceGapsOnly: boolean, policyFilter: RoutingPolicyFilter): string {
  let base = 'All recent decisions';
  if (showUnratedOnly) base = 'Needs outcome';
  else if (showUnexplainedOnly) base = 'Needs notes';
  else if (showStaleOnly) base = 'Stale only';
  else if (showFallbackOnly) base = 'Fallbacks';
  else if (showBenchmarkOnly) base = 'Benchmarks';
  else if (showEvidenceGapsOnly) base = 'Evidence gaps';
  return policyFilter === 'all' ? base : `${base} + ${routingPolicyFilterLabel(policyFilter)}`;
}

function routingEventEvidenceExportRow(eventEvidence: RoutingEventEvidenceView) {
  return {
    ...eventEvidence.event,
    outcomeNote: eventEvidence.outcomeNote,
    traceSummary: eventEvidence.traceSummary,
    traceChips: eventEvidence.traceChips,
    scoreEvidenceKey: eventEvidence.scoreEvidenceKey,
    scoreEvidenceReadiness: eventEvidence.scoreEvidenceReadiness,
  };
}

function buildRoutingLearningReviewExportState({
  events,
  outcomeNotes,
  latestEvent,
  latestEventIsStale,
  activeFilter,
  visibleRecentEventCount,
}: {
  events: api.RoutingEvent[];
  outcomeNotes: Record<string, string>;
  latestEvent: api.RoutingEvent | null;
  latestEventIsStale: boolean;
  activeFilter: string;
  visibleRecentEventCount: number;
}) {
  const reviewedEvents = events.filter((event) => event.outcome !== null);
  const unratedEvents = events.filter((event) => event.outcome === null);
  const notedEventCount = events.filter((event) => (outcomeNotes[event.id] || event.outcomeNote || '').trim().length > 0).length;
  return {
    activeFilter,
    visibleRecentEventCount,
    reviewedEvents,
    unratedEvents,
    notedEventCount,
    latestEvidenceTimestamp: latestEvent ? routeEventExactTime(latestEvent.timestamp) : null,
    latestEvidenceAge: latestEvent ? routeEventTimeLabel(latestEvent.timestamp) : null,
    freshnessWarning: latestEventIsStale
      ? 'Refresh with newer route outcomes before trusting trends.'
      : 'Recent routing evidence is loaded.',
    freshnessWarningBrief: latestEventIsStale
      ? 'refresh with newer route outcomes before trusting trends'
      : 'recent routing evidence is loaded',
  };
}

function evalProofStatusLabel(rec: api.EvalRecommendation): string {
  if (rec.proofReviewStatus === 'approved') return 'proof approved';
  if (rec.proofReviewStatus === 'needs-attention') return 'proof needs attention';
  return 'proof unreviewed';
}

function evalProofStatusDetail(rec: api.EvalRecommendation): string {
  if (rec.proofReviewStatus === 'approved') return 'Human review approved the Model Lab proof for this recommendation.';
  if (rec.proofReviewStatus === 'needs-attention') return 'Human review flagged this proof; do not apply until the review is resolved.';
  return 'Review the Model Lab proof before applying this recommendation.';
}

function countRecommendationProofStates(recommendations: api.EvalRecommendation[]) {
  return recommendations.reduce((counts, rec) => {
    counts[rec.proofReviewStatus] = (counts[rec.proofReviewStatus] || 0) + 1;
    return counts;
  }, { approved: 0, unreviewed: 0, 'needs-attention': 0 } as Record<api.EvalRecommendation['proofReviewStatus'], number>);
}

export function RoutingLearningPane({ enabledModels = [], onApplyRoleRecommendation, onOpenModelLabEvidence }: Props) {
  const [summary, setSummary] = useState<api.RouterLearningSummary | null>(null);
  const [events, setEvents] = useState<api.RoutingEvent[]>([]);
  const [recommendations, setRecommendations] = useState<api.EvalRecommendation[]>([]);
  const [promptStrategies, setPromptStrategies] = useState<api.PromptStrategyProfile[]>([]);
  const [adherenceEvents, setAdherenceEvents] = useState<api.RoutingAdherenceEvent[]>([]);
  const [adherenceLoadError, setAdherenceLoadError] = useState<string | null>(null);
  const [thresholdSuggestion, setThresholdSuggestion] = useState<{ suggestedThreshold: number; reason: string; dataPoints: number } | null>(null);
  const [routerState, setRouterState] = useState<api.AutoRouterState | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState<Record<string, string>>({});
  const [showUnratedOnly, setShowUnratedOnly] = useState(false);
  const [showUnexplainedOnly, setShowUnexplainedOnly] = useState(false);
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [showFallbackOnly, setShowFallbackOnly] = useState(false);
  const [showBenchmarkOnly, setShowBenchmarkOnly] = useState(false);
  const [showEvidenceGapsOnly, setShowEvidenceGapsOnly] = useState(false);
  const [policyFilter, setPolicyFilter] = useState<RoutingPolicyFilter>('all');
  const [routingActionCueFilter, setRoutingActionCueFilter] = useState<RoutingActionCueConfidenceFilter>('all');
  const [importAsBenchmark, setImportAsBenchmark] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeDecisionNowMs, setRouteDecisionNowMs] = useState(() => Date.now());
  const [recentEventDisplayLimit, setRecentEventDisplayLimit] = useState(RECENT_EVENT_BATCH_SIZE);
  const [copiedProviderFailureRowId, setCopiedProviderFailureRowId] = useState<string | null>(null);
  const [copiedProviderFailureStrategyId, setCopiedProviderFailureStrategyId] = useState<string | null>(null);
  const [providerFailureStrategyFilter, setProviderFailureStrategyFilter] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const enabledModelKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const model of enabledModels) {
      for (const key of modelIdVariants(model)) keys.add(key);
    }
    return keys;
  }, [enabledModels]);

  const isRecommendationEnabled = useCallback((rec: api.EvalRecommendation) => {
    const recKey = normalizeModelId(rec.modelId);
    for (const key of enabledModelKeys) {
      if (modelKeyMatches(recKey, key)) return true;
    }
    return false;
  }, [enabledModelKeys]);

  const loadData = useCallback(async () => {
    const [s, e, r, routerState, strategies, adherence] = await Promise.all([
      api.getRouterLearning(),
      api.getRouterLearningEvents(undefined, 100),
      api.getEvalRecommendations(),
      api.getRouterState(),
      api.getPromptStrategies().catch(() => []),
      api.getRouterAdherenceEvents(PROVIDER_FAILURE_ADHERENCE_EVENT_LIMIT, PROVIDER_FAILURE_ADHERENCE_PHASE)
        .then((items) => {
          setAdherenceLoadError(null);
          return items;
        })
        .catch(() => {
          setAdherenceLoadError('Could not load provider failure adherence');
          return [] as api.RoutingAdherenceEvent[];
        }),
    ]);
    const t = await api.suggestRouterThreshold(routerState.threshold);
    setRouterState(routerState);
    setSummary(s);
    setEvents(e);
    setRecommendations(r);
    setPromptStrategies(strategies);
    setAdherenceEvents(adherence);
    setThresholdSuggestion(t);
    setOutcomeNotes((prev) => {
      const next = { ...prev };
      for (const event of e) {
        if (next[event.id] == null) next[event.id] = event.outcomeNote || '';
      }
      return next;
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch {
        setSaving('Could not load routing learning data');
      }
      setLoading(false);
    })();
  }, [loadData]);

  useEffect(() => {
    const refreshRouteDecisionClock = () => setRouteDecisionNowMs(Date.now());
    refreshRouteDecisionClock();
    const intervalId = window.setInterval(refreshRouteDecisionClock, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setRecentEventDisplayLimit(RECENT_EVENT_BATCH_SIZE);
  }, [showUnratedOnly, showUnexplainedOnly, showStaleOnly, showFallbackOnly, showBenchmarkOnly, showEvidenceGapsOnly, policyFilter]);

  const accessibleRecommendations = useMemo(
    () => recommendations.filter(isRecommendationEnabled),
    [isRecommendationEnabled, recommendations],
  );

  const unavailableRecommendations = useMemo(
    () => recommendations.filter((rec) => !isRecommendationEnabled(rec)),
    [isRecommendationEnabled, recommendations],
  );

  const trustedAccessibleRecommendations = useMemo(
    () => accessibleRecommendations.filter((rec) => rec.proofTrusted),
    [accessibleRecommendations],
  );

  const promptStrategyIds = useMemo(
    () => new Set(promptStrategies.map((strategy) => strategy.id)),
    [promptStrategies],
  );

  const modelList = useMemo(
    () => Object.entries(summary?.models || {}).sort(([, a]: any, [, b]: any) => b.total - a.total),
    [summary],
  );
  const recentDecisionState = useMemo(() => buildRoutingLearningRecentDecisionState({
    events,
    outcomeNotes,
    nowMs: routeDecisionNowMs,
    filters: {
      showUnratedOnly,
      showUnexplainedOnly,
      showStaleOnly,
      showFallbackOnly,
      showBenchmarkOnly,
      showEvidenceGapsOnly,
      policyFilter,
    },
  }), [
    events,
    outcomeNotes,
    showUnratedOnly,
    showUnexplainedOnly,
    showStaleOnly,
    showFallbackOnly,
    showBenchmarkOnly,
    showEvidenceGapsOnly,
    policyFilter,
    routeDecisionNowMs,
  ]);
  const {
    latestEvent,
    latestScores,
    fallbackEvents,
    ratedFallbackEvents,
    notedEventCount,
    latestEventAge,
    latestEventIsStale,
    unexplainedEventCount,
    unratedEventCount,
    staleEventCount,
    benchmarkEventCount,
    productionEventCount,
    replayGapEventCount,
    policyFilterCounts,
    visibleRecentEvents,
  } = recentDecisionState;
  const decisionScanCards = useMemo(() => buildRoutingDecisionScanCards(recentDecisionState), [recentDecisionState]);
  const routingEventEvidenceViews = useMemo(
    () => events.map((event) => buildRoutingEventEvidenceView(event, routeDecisionNowMs, outcomeNotes[event.id] || event.outcomeNote)),
    [events, outcomeNotes, routeDecisionNowMs],
  );
  const routingEventEvidenceById = useMemo(
    () => new Map(routingEventEvidenceViews.map((eventEvidence) => [eventEvidence.event.id, eventEvidence])),
    [routingEventEvidenceViews],
  );
  const visibleRecentEventEvidenceViews = useMemo(
    () => visibleRecentEvents
      .map((event) => routingEventEvidenceById.get(event.id))
      .filter((eventEvidence): eventEvidence is RoutingEventEvidenceView => Boolean(eventEvidence)),
    [routingEventEvidenceById, visibleRecentEvents],
  );
  const recentEventDisplayWindow = useMemo(() => buildRoutingEventDisplayWindow(visibleRecentEventEvidenceViews, recentEventDisplayLimit), [visibleRecentEventEvidenceViews, recentEventDisplayLimit]);
  const displayedRecentEventViews = recentEventDisplayWindow.events;
  const displayedRecentEvents = displayedRecentEventViews.map((eventEvidence) => eventEvidence.event);
  const hiddenRecentEventCount = recentEventDisplayWindow.hiddenCount;
  const showRecentEventSliceControls = hiddenRecentEventCount > 0 || recentEventDisplayWindow.canShowFewer;
  const routingTrend = useMemo(() => computeRoutingTrend(events, 12), [events]);
  const providerFailureRows = useMemo(() => buildProviderFailureRows(adherenceEvents, PROVIDER_FAILURE_ADHERENCE_ROW_LIMIT, events), [adherenceEvents, events]);
  const providerFailureSummary = useMemo(() => summarizeProviderFailureAdherence(providerFailureRows), [providerFailureRows]);
  const providerFailureHint = useMemo(() => deriveProviderFailureRoutingHint(providerFailureSummary), [providerFailureSummary]);
  const providerFailureDistinctStrategyLabel = useMemo(() => formatProviderFailureDistinctStrategyLabel(providerFailureSummary), [providerFailureSummary]);
  const providerFailureStrategyBreakdown = useMemo(() => buildProviderFailureStrategyBreakdown(providerFailureRows), [providerFailureRows]);
  const maxProviderFailureStrategyFailureCount = useMemo(() => Math.max(0, ...providerFailureStrategyBreakdown.map((item) => item.failureCount)), [providerFailureStrategyBreakdown]);
  const visibleProviderFailureRows = useMemo(() => providerFailureStrategyFilter
    ? providerFailureRows.filter((row) => row.routingContext?.promptStrategyId === providerFailureStrategyFilter)
    : providerFailureRows, [providerFailureRows, providerFailureStrategyFilter]);
  const toolReliabilityTopRows = useMemo(() => buildToolReliabilityTopRows(summary?.toolReliability), [summary?.toolReliability]);
  const modelRequestDurationRows = useMemo(() => buildModelRequestDurationRows(summary?.modelRequestDuration), [summary?.modelRequestDuration]);
  const modelRequestDurationEvidence = useMemo(() => buildModelRequestDurationEvidence(modelRequestDurationRows), [modelRequestDurationRows]);
  const routingActionCues = useMemo(() => buildRoutingLearningActionCues(summary?.bestByTaskType || []), [summary?.bestByTaskType]);
  const visibleRoutingActionCues = useMemo(() => filterRoutingLearningActionCues(routingActionCues, routingActionCueFilter), [routingActionCues, routingActionCueFilter]);
  const reviewExportState = useMemo(() => buildRoutingLearningReviewExportState({
    events,
    outcomeNotes,
    latestEvent,
    latestEventIsStale,
    activeFilter: activeFilterLabel(showUnratedOnly, showUnexplainedOnly, showStaleOnly, showFallbackOnly, showBenchmarkOnly, showEvidenceGapsOnly, policyFilter),
    visibleRecentEventCount: visibleRecentEvents.length,
  }), [
    events,
    outcomeNotes,
    latestEvent,
    latestEventIsStale,
    policyFilter,
    showBenchmarkOnly,
    showEvidenceGapsOnly,
    showFallbackOnly,
    showStaleOnly,
    showUnexplainedOnly,
    showUnratedOnly,
    visibleRecentEvents.length,
  ]);

  useEffect(() => {
    if (!providerFailureStrategyFilter) return;
    if (!providerFailureRows.some((row) => row.routingContext?.promptStrategyId === providerFailureStrategyFilter)) {
      setProviderFailureStrategyFilter(null);
    }
  }, [providerFailureRows, providerFailureStrategyFilter]);
  const routingDecisionScanCardPressed = (filterTarget: RoutingDecisionScanFilterTarget | null): boolean => {
    if (filterTarget === 'needs-outcome') return showUnratedOnly;
    if (filterTarget === 'fallbacks') return showFallbackOnly;
    if (filterTarget === 'evidence-gaps') return showEvidenceGapsOnly;
    if (filterTarget === 'stale') return showStaleOnly;
    return false;
  };
  const handleRoutingDecisionScanCard = (filterTarget: RoutingDecisionScanFilterTarget) => {
    const shouldClear = routingDecisionScanCardPressed(filterTarget);
    setShowUnratedOnly(!shouldClear && filterTarget === 'needs-outcome');
    setShowFallbackOnly(!shouldClear && filterTarget === 'fallbacks');
    setShowEvidenceGapsOnly(!shouldClear && filterTarget === 'evidence-gaps');
    setShowStaleOnly(!shouldClear && filterTarget === 'stale');
    setShowUnexplainedOnly(false);
    setShowBenchmarkOnly(false);
  };

  const handleApplyRecommendation = (roleId: string, modelId: string) => {
    if (!onApplyRoleRecommendation) return;
    onApplyRoleRecommendation(roleId, modelId);
    setSaving(`Applied ${modelId} to ${roleId}`);
    setTimeout(() => setSaving(null), 1200);
    loadData().catch(() => {});
  };

  const handleApplyAll = () => {
    if (!onApplyRoleRecommendation || trustedAccessibleRecommendations.length === 0) return;
    for (const rec of trustedAccessibleRecommendations) onApplyRoleRecommendation(rec.role, rec.modelId);
    setSaving(`Applied ${trustedAccessibleRecommendations.length} trusted recommendation${trustedAccessibleRecommendations.length === 1 ? '' : 's'}; skipped ${accessibleRecommendations.length - trustedAccessibleRecommendations.length} awaiting approved proof`);
    setTimeout(() => setSaving(null), 1200);
    loadData().catch(() => {});
  };

  const handleMarkOutcome = async (eventId: string, outcome: 'success' | 'failure' | 'ambiguous') => {
    const note = outcomeNotes[eventId]?.trim();
    const ok = await api.recordRoutingOutcome(eventId, outcome, note || undefined);
    if (ok) {
      await loadData();
      return;
    }
    setSaving('Failed to record outcome');
    setTimeout(() => setSaving(null), 1200);
  };

  const handleSaveOutcomeNote = async (event: api.RoutingEvent) => {
    if (!event.outcome) {
      setSaving('Pick Worked, Failed, or Unclear before saving a note');
      setTimeout(() => setSaving(null), 1600);
      return;
    }
    const note = outcomeNotes[event.id]?.trim();
    const ok = await api.recordRoutingOutcome(event.id, event.outcome, note || undefined);
    if (ok) {
      await loadData();
      setSaving(note ? 'Saved routing outcome note' : 'Cleared routing outcome note');
      setTimeout(() => setSaving(null), 1200);
      return;
    }
    setSaving('Failed to save outcome note');
    setTimeout(() => setSaving(null), 1200);
  };

  const handleCopyProviderFailureRow = async (row: ReturnType<typeof buildProviderFailureRows>[number]) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
      setCopiedProviderFailureRowId(row.id);
      setTimeout(() => setCopiedProviderFailureRowId(null), 1600);
    } catch {
      setSaving('Could not copy provider failure row');
      setTimeout(() => setSaving(null), 1600);
    }
  };

  const handleCopyProviderFailureStrategyEvidence = async (strategyId: string) => {
    try {
      const payload = buildProviderFailureStrategyEvidence(providerFailureRows, strategyId);
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedProviderFailureStrategyId(strategyId);
      setTimeout(() => setCopiedProviderFailureStrategyId(null), 1600);
    } catch {
      setSaving('Could not copy provider failure strategy evidence');
      setTimeout(() => setSaving(null), 1600);
    }
  };

  const handleExportEvidence = async () => {
    const generatedAt = new Date().toISOString();
    const byEvidenceSource = summary?.toolReliability?.byEvidenceSource || [];
    try {
      const fullExport = await api.getRouterLearningExport();
      const payload = {
        schemaVersion: 1,
        generatedAt,
        activeFilter: reviewExportState.activeFilter,
        activeFilterMatchCount: reviewExportState.visibleRecentEventCount,
        fullExportDatasetCounts: {
          production: fullExport.productionEventCount ?? fullExport.events.filter((event) => event.datasetKind !== 'benchmark').length,
          benchmark: fullExport.benchmarkEventCount ?? fullExport.events.filter((event) => event.datasetKind === 'benchmark').length,
        },
        routerEvidenceFreshness: {
          enabled: routerState?.enabled ?? false,
          candidateEvidenceRefreshedAt: routerState?.candidateEvidenceRefreshedAt ?? null,
          candidateEvidenceRefreshCount: routerState?.candidateEvidenceRefreshCount ?? 0,
          thresholdAdvice: routerState?.thresholdAdvice ?? null,
          configuredCandidateCount: routerState?.configuredCandidateCount ?? 0,
          activeCandidateCount: routerState?.candidateCount ?? 0,
        },
        fullExport,
        summary,
        modelRequestDurationEvidence,
        thresholdSuggestion,
        recommendations: {
          available: accessibleRecommendations,
          unavailable: unavailableRecommendations,
          proofReviewCounts: countRecommendationProofStates(recommendations),
        },
        evidenceSourceSummary: byEvidenceSource.map((item) => ({
          source: item.source,
          outcomeRuns: item.outcomeRuns,
          recoveredRuns: item.recoveredRuns,
          unrecoveredRuns: item.unrecoveredRuns,
          retryReductionRecommendations: item.retryReductionRecommendations,
          avgRetryDistance: item.avgRetryDistance,
          tuningAction: item.tuningAction,
          latestTimestamp: item.latestTimestamp,
        })),
        providerFailureAdherence: {
          scope: 'rolling-tail',
          scopeNote: PROVIDER_FAILURE_SCOPE_NOTE,
          source: {
            phase: PROVIDER_FAILURE_ADHERENCE_PHASE,
            requestedEventLimit: PROVIDER_FAILURE_ADHERENCE_EVENT_LIMIT,
            renderedRowLimit: PROVIDER_FAILURE_ADHERENCE_ROW_LIMIT,
            loadedEventCount: adherenceEvents.length,
            renderedRowCount: providerFailureRows.length,
          },
          summary: providerFailureSummary,
          strategyBreakdown: providerFailureStrategyBreakdown,
          rowScope: {
            fullRows: 'rows',
            filteredRows: providerFailureStrategyFilter ? 'filteredRows contains rows after appliedStrategyFilter' : 'filteredRows is null because no strategy filter is active',
          },
          appliedStrategyFilter: providerFailureStrategyFilter,
          filteredRows: providerFailureStrategyFilter ? visibleProviderFailureRows : null,
          hint: providerFailureHint,
          rows: providerFailureRows,
        },
        recentEvents: routingEventEvidenceViews.map(routingEventEvidenceExportRow),
        filteredRecentEvents: visibleRecentEventEvidenceViews.map(routingEventEvidenceExportRow),
        reviewState: {
          reviewedEventCount: reviewExportState.reviewedEvents.length,
          unratedEventCount: reviewExportState.unratedEvents.length,
          fallbackEventCount: fallbackEvents.length,
          ratedFallbackEventCount: ratedFallbackEvents.length,
          notedEventCount: reviewExportState.notedEventCount,
          latestEvidenceTimestamp: reviewExportState.latestEvidenceTimestamp,
          latestEvidenceAge: reviewExportState.latestEvidenceAge,
          stale: latestEventIsStale,
          freshnessWarning: reviewExportState.freshnessWarning,
        },
        notes: [
          'schemaVersion=1 records the Routing Learning evidence export format used by this bundle.',
          'fullExport.events contains every persisted routing event returned by the server.',
          'recentEvents contains the loaded Settings review window.',
          'filteredRecentEvents contains the currently visible review subset.',
          'Only marked outcomes should influence trust in success rates.',
          'Eval recommendations are manual until applied to role assignments, and proofReviewStatus records whether Model Lab proof was approved, unreviewed, or needs attention.',
          'Auto-Router candidates remain separate from role recommendations.',
          'Tool reliability is derived from saved run traces and should be treated as factual runtime evidence, not human outcome review.',
          'scoreEvidenceKey is derived from task hashes, routing metadata, and redacted prompt snapshot metadata; it does not contain prompt text.',
        ],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `openharness-routing-learning-${generatedAt.replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSaving(`Downloaded routing learning evidence (${fullExport.eventCount} total events)`);
      setTimeout(() => setSaving(null), 1200);
    } catch {
      setSaving('Could not download full routing evidence');
      setTimeout(() => setSaving(null), 1600);
    }
  };

  const handleExportBrief = () => {
    const generatedAt = new Date().toISOString();
    const byEvidenceSource = toolReliability?.byEvidenceSource || [];
    const evidenceSourcesPresent = byEvidenceSource.length > 0
      ? byEvidenceSource.map((source) => source.source).join(', ')
      : 'none';
    const providerFailureCauseCountsLabel = formatProviderFailureCauseCounts(providerFailureSummary.causeCounts);
    const lines = [
      '# OpenHarness Routing Learning Evidence Brief',
      '',
      `Generated: ${generatedAt}`,
      '',
      '## Review State',
      '',
      `- Active filter at export: ${reviewExportState.activeFilter}`,
      `- Active filter matching events loaded: ${reviewExportState.visibleRecentEventCount}`,
      `- Reviewed outcomes: ${summary?.totalEvents || 0}`,
      `- Observed success: ${pct(summary?.successRate || 0)}`,
      `- Recent reviewed events loaded: ${reviewExportState.reviewedEvents.length}`,
      `- Recent unrated events loaded: ${reviewExportState.unratedEvents.length}`,
      `- Recent fallback events loaded: ${fallbackEvents.length}`,
      `- Rated fallback events loaded: ${ratedFallbackEvents.length}`,
      `- Loaded production events: ${productionEventCount}`,
      `- Loaded benchmark events: ${benchmarkEventCount}`,
      `- Score evidence gaps: ${replayGapEventCount} of ${events.length} loaded decisions`,
      '- Score evidence keys: derived from task hashes, routing metadata, and redacted prompt snapshot metadata; no prompt text is stored in the key.',
      `- Recent events with reviewer notes: ${reviewExportState.notedEventCount}`,
      `- Latest route evidence: ${reviewExportState.latestEvidenceTimestamp ? `${reviewExportState.latestEvidenceTimestamp} (${reviewExportState.latestEvidenceAge})` : 'none loaded'}`,
      `- Freshness warning: ${reviewExportState.freshnessWarningBrief}`,
      `- Confidence: ${sampleLabel(summary?.totalEvents || 0)}`,
      `- Evidence source coverage: ${evidenceSourcesPresent}`,
      `- Candidate evidence refreshed: ${routerState?.candidateEvidenceRefreshedAt ? `${routerState.candidateEvidenceRefreshedAt} (${routerState.candidateEvidenceRefreshCount ?? 0} refresh${(routerState.candidateEvidenceRefreshCount ?? 0) === 1 ? '' : 'es'})` : 'not available'}`,
      `- Runtime threshold advice: ${routerState?.thresholdAdvice ? routerState.thresholdAdvice.reason : 'not available'}`,
      `- Provider failure adherence scope: ${PROVIDER_FAILURE_SCOPE_NOTE}`,
      ...(routerState?.thresholdAdvice ? [
        `- Configured threshold: ${formatScoreDisplay(routerState.thresholdAdvice.configuredThreshold)}`,
        `- Active threshold: ${formatScoreDisplay(routerState.thresholdAdvice.activeThreshold)}`,
        `- Suggested threshold: ${formatScoreDisplay(routerState.thresholdAdvice.suggestedThreshold)}`,
        `- Applied to runtime: ${routerState.thresholdAdvice.applied ? 'yes' : 'no'}`,
        `- Threshold advice data points: ${routerState.thresholdAdvice.dataPoints}`,
        ...(routerState.thresholdAdvice.slowTimingContext ? [
          `- Slow timing threshold context: ${routerState.thresholdAdvice.slowTimingContext.note}`,
        ] : []),
      ] : []),
      ...(providerFailureSummary.rowCount > 0 ? [
        '',
        '### Provider Failure Adherence',
        '',
        `- Hint: ${providerFailureHint}`,
        `- Full rows: ${providerFailureSummary.rowCount} (complete rolling-tail rows; details omitted; see JSON export)`,
        `- Terminal providers: ${providerFailureSummary.terminalProviderCount}`,
        `- Attempt paths: ${providerFailureSummary.distinctAttemptPathCount}`,
        `- Dominant cause: ${providerFailureSummary.dominantCause || 'none'}`,
        `- Cause counts: ${providerFailureCauseCountsLabel}`,
        `- Prompt hashes: ${providerFailureSummary.promptHashedFailureCount}`,
        `- Distinct prompt hashes: ${providerFailureSummary.distinctPromptHashCount}`,
        `- Strategy-linked rows: ${providerFailureSummary.routingContextLinkedCount}`,
        `- Unmatched run ids: ${providerFailureSummary.routingContextUnmatchedRunCount}`,
        `- Active strategy filter: ${providerFailureStrategyFilter || 'none'}`,
        `- Filtered rows: ${visibleProviderFailureRows.length}${providerFailureStrategyFilter ? ` (${visibleProviderFailureRows.length} of ${providerFailureSummary.rowCount} shown)` : ' (all)'}`,
        ...(providerFailureDistinctStrategyLabel ? [
          `- Distinct prompt strategies: ${providerFailureSummary.distinctPromptStrategyCount}`,
          '',
          '#### Provider Failures By Prompt Strategy',
          '',
          ...providerFailureStrategyBreakdown.map((item) => `- ${item.strategyId}: ${item.failureCount} failure${item.failureCount === 1 ? '' : 's'}; ${item.selectedModelCount} selected model${item.selectedModelCount === 1 ? '' : 's'}; dominant cause ${item.dominantCause || 'none'}; models ${item.modelCounts.map((modelCount) => `${modelCount.model}: ${modelCount.count}`).join(', ')}`),
        ] : []),
      ] : [
        '- Provider failure adherence: no rolling-tail provider-stream failures.',
      ]),
      '',
      '## Threshold Advice',
      '',
      thresholdSuggestion
        ? `- Suggested threshold: ${formatScoreDisplay(thresholdSuggestion.suggestedThreshold)}`
        : '- Suggested threshold: unavailable',
      thresholdSuggestion
        ? `- Reason: ${thresholdSuggestion.reason}`
        : '- Reason: no threshold suggestion loaded',
      thresholdSuggestion
        ? `- Data points: ${thresholdSuggestion.dataPoints}`
        : '- Data points: 0',
      '',
      '## Tool Reliability',
      '',
      toolReliability
        ? `- Traced tool calls: ${toolReliability.totalToolCalls}`
        : '- Traced tool calls: 0',
      toolReliability
        ? `- Tool-call errors: ${toolReliability.errorToolCalls} (${toolReliability.totalToolCalls ? pct(toolReliability.errorToolCalls / toolReliability.totalToolCalls) : '0%'})`
        : '- Tool-call errors: 0',
      toolReliability
        ? `- Runs with tool errors: ${toolReliability.runsWithToolErrors}`
        : '- Runs with tool errors: 0',
      toolReliability
        ? `- Recovered tool-error runs: ${toolReliability.recoveredRunsWithToolErrors}${toolReliability.runsWithToolErrors ? ` (${pct(toolReliability.recoveredRunsWithToolErrors / toolReliability.runsWithToolErrors)})` : ''}`
        : '- Recovered tool-error runs: 0',
      toolReliability
        ? `- First-call error runs: ${toolReliability.firstCallErrorRuns}/${toolReliability.runsWithToolCalls} (${toolReliability.runsWithToolCalls ? pct(toolReliability.firstCallErrorRuns / toolReliability.runsWithToolCalls) : '0%'})`
        : '- First-call error runs: 0',
      toolReliability
        ? `- Average recovery rounds after first tool error: ${toolReliability.avgRecoveryRounds}`
        : '- Average recovery rounds after first tool error: 0',
      summary?.toolErrorLedger
        ? `- Live tool-error ledger status: ${summary.toolErrorLedger.liveEvidenceStatus}; persisted ledger exists ${summary.toolErrorLedger.persistedLedgerExists}; persisted rows ${summary.toolErrorLedger.persistedEventCount}; log-derived rows ${summary.toolErrorLedger.logTraceEventCount}. ${toolErrorLedgerStatusHelp(summary.toolErrorLedger)}`
        : '- Live tool-error ledger status: unavailable.',
      ...(modelRequestDurationRows.byModel.length || modelRequestDurationRows.byTaskType.length
        ? [
            '',
            '## Model Request Duration',
            '',
            ...modelRequestDurationEvidenceLines(modelRequestDurationRows),
          ]
        : ['- Model request duration: no measured samples yet.']),
      ...(toolReliability?.recoveryPatterns?.length
        ? [
            '- Recurring recovery patterns:',
            ...toolReliability.recoveryPatterns.slice(0, 5).map((item) => `- ${item.failedModel}/${item.failedTool} failed, then ${item.recoveredByModel}/${item.recoveredByTool} worked in ${item.runs} run${item.runs === 1 ? '' : 's'}; avg recovery rounds ${item.avgRecoveryRounds}; sessions ${item.exampleSessionIds?.join(', ') || 'none'}; runs ${item.exampleRunIds.join(', ') || 'none'}`),
          ]
        : ['- Recurring recovery patterns: none captured yet.']),
      ...(toolReliability?.failureMemory?.length
        ? [
            '- Model failure memory:',
            ...toolReliability.failureMemory.slice(0, 5).map((item) => {
              const fixedBy = item.fixedBy.length
                ? item.fixedBy.map((fix) => `${fix.model}/${fix.tool} (${fix.runs})`).join(', ')
                : 'no recovered fix captured';
              const strategy = item.promptStrategyVariants.length
                ? `; variants ${item.promptStrategyVariants.map((variant) => `${variant.id} (${variant.runs})`).join(', ')}`
                : item.promptStrategies.length
                  ? `; strategies ${item.promptStrategies.map((strategyItem) => `${strategyItem.id} (${strategyItem.runs})`).join(', ')}`
                  : '';
              return `- ${item.model}/${item.tool}: ${item.errorRuns} error runs, ${item.recoveredRuns} recovered, ${item.unrecoveredRuns} unrecovered, fallback helped ${item.fallbackRecoveryRuns}${strategy}; fixed by ${fixedBy}; evidence sources ${item.exampleEvidenceSources?.join(', ') || 'unknown'}; sessions ${item.exampleSessionIds?.join(', ') || 'none'}; runs ${item.exampleRunIds.join(', ') || 'none'}`;
            }),
          ]
        : ['- Model failure memory: no tool failures captured yet.']),
      ...(toolReliability?.errorSignatures?.length
        ? [
            '- Normalized tool-error signatures:',
            ...toolReliability.errorSignatures.slice(0, 5).map((item) => {
              const workedBy = item.workedBy.length
                ? item.workedBy.map((worked) => `${worked.model}/${worked.tool} (${worked.runs}, avg retry ${worked.avgRetryDistance})`).join(', ')
                : 'no working follow-up captured';
              const strategy = item.promptStrategyVariants.length
                ? `; variants ${item.promptStrategyVariants.map((variant) => `${variant.id} (${variant.runs})`).join(', ')}`
                : item.promptStrategies.length
                  ? `; strategies ${item.promptStrategies.map((strategyItem) => `${strategyItem.id} (${strategyItem.runs})`).join(', ')}`
                  : '';
              return `- ${item.model}/${item.tool} "${item.signature}": ${item.runs} runs, ${item.recoveredRuns} recovered, ${item.unrecoveredRuns} unrecovered, fallback helped ${item.fallbackRecoveryRuns}${strategy}; worked by ${workedBy}; evidence sources ${item.exampleEvidenceSources?.join(', ') || 'unknown'}; sessions ${item.exampleSessionIds?.join(', ') || 'none'}; runs ${item.exampleRunIds.join(', ') || 'none'}`;
            }),
          ]
        : ['- Normalized tool-error signatures: none captured yet.']),
      ...(toolReliability?.byEvidenceSource?.length
        ? [
            '- Tool-error evidence sources:',
            ...toolReliability.byEvidenceSource.map((item) =>
              `- ${item.source}: ${item.outcomeRuns} outcome runs, ${item.recoveredRuns} recovered, ${item.unrecoveredRuns} unrecovered, ${item.retryReductionRecommendations} retry recommendations, avg retry distance ${item.avgRetryDistance}, tuning action ${item.tuningAction}`
            ),
          ]
        : ['- Tool-error evidence sources: none captured yet.']),
      '',
      '## Evidence source recommendations',
      '',
      ...(byEvidenceSource.length > 0
        ? [
            '- Evidence-source summary:',
            ...byEvidenceSource.map((item) => `- ${item.source}: ${item.retryReductionRecommendations} recommendation${item.retryReductionRecommendations === 1 ? '' : 's'} from ${item.outcomeRuns} runs (recovered ${item.recoveredRuns}, unrecovered ${item.unrecoveredRuns}); tuning ${item.tuningAction}; avg retry distance ${item.avgRetryDistance}`),
          ]
        : ['- Evidence-source summary: no evidence-source rows yet.']),
      ...(toolReliability?.retryReductionRecommendations?.length
        ? [
            '- Retry-reduction recommendations:',
            ...toolReliability.retryReductionRecommendations.slice(0, 5).map((item) =>
              `- first failed ${item.failedProviderId || 'unknown'}:${item.avoidPath}, recovered ${item.preferPath}, prefer after ${item.retryDistance} rounds, avg recovery distance ${item.avgRetryDistance}; evidence ${item.evidenceSource}; confidence ${item.evidenceConfidence} from ${item.supportRunCount} run${item.supportRunCount === 1 ? '' : 's'}; supporting sessions ${(item.supportSessionIds || []).join(', ') || item.sessionId}; supporting runs ${(item.supportRunIds || []).join(', ') || item.runId}; tuning action ${item.tuningAction}; ${item.tuningGuidance}; provider path avoid ${item.avoidProviderPath}; provider path prefer ${item.preferProviderPath}`
            ),
          ]
        : ['- Retry-reduction recommendations: none captured yet.']),
      ...(toolReliability?.outcomeExamples?.length
        ? [
            '- Session outcomes after tool-call errors:',
            ...toolReliability.outcomeExamples.slice(0, 5).map((item) => {
              const workedBy = item.workedBy
                ? `${item.workedBy.model}/${item.workedBy.tool}`
                : item.finalAnswerCaptured ? 'final answer without later complete tool call' : item.finalStatus;
              return `- ${item.failedModel}/${item.failedTool}: ${item.outcome}; worked via ${workedBy}; retry distance ${item.retryDistance}; evidence source ${item.evidenceSource}; session ${item.sessionId}; run ${item.runId}`;
            }),
          ]
        : ['- Session outcomes after tool-call errors: none captured yet.']),
      ...(toolReliability?.recoveryExamples?.length
        ? [
            '- Recent recovery paths:',
            ...toolReliability.recoveryExamples.slice(0, 5).map((item) => {
              const recoveredBy = item.recoveredBy.length
                ? item.recoveredBy.map((step) => `${step.model}/${step.tool}`).join(' -> ')
                : 'final answer without a later complete tool call';
              const strategy = item.promptStrategyVariantId || item.promptStrategyId || 'unknown';
              return `- ${item.firstError.model}/${item.firstError.tool} failed, then ${recoveredBy} worked in ${item.recoveryRounds} round${item.recoveryRounds === 1 ? '' : 's'}; strategy ${strategy}; evidence source ${item.evidenceSource}; session ${item.sessionId}; run ${item.runId}`;
            }),
          ]
        : ['- Recent recovery paths: none captured yet.']),
      ...(toolReliabilityTopRows.byModel.length
        ? toolReliabilityTopRows.byModel.map(([model, stats]) => `- Model ${model}: ${stats.error}/${stats.total} tool errors, ${stats.firstCallErrors}/${stats.runs} first-call failures, ${stats.recoveredRuns}/${stats.affectedRuns} recovered error runs`)
        : ['- No per-model tool reliability rows yet.']),
      ...(toolReliabilityTopRows.byTool.length
        ? toolReliabilityTopRows.byTool.map(([tool, stats]) => `- Tool ${tool}: ${stats.error}/${stats.total} tool errors, ${pct(stats.errorRate)} error rate`)
        : ['- No per-tool reliability rows yet.']),
      ...(toolReliabilityTopRows.byModelTool.length
        ? [
            '- Highest-risk model/tool pairs:',
            ...toolReliabilityTopRows.byModelTool.map(([pair, stats]) => `- ${pair}: ${stats.error}/${stats.total} tool errors, ${stats.firstCallErrors}/${stats.runs} first-call failures, ${stats.recoveredRuns}/${stats.affectedRuns} recovered error runs`),
          ]
        : ['- No per-model/tool reliability rows yet.']),
      ...(toolReliabilityTopRows.byPromptStrategyVariant.length
        ? [
            '- Prompt strategy tool reliability:',
            ...toolReliabilityTopRows.byPromptStrategyVariant.map(([strategy, stats]) => `- ${strategy}: ${stats.error}/${stats.total} tool errors, ${stats.firstCallErrors}/${stats.runs} first-call failures, ${stats.recoveredRuns}/${stats.affectedRuns} recovered error runs`),
          ]
        : ['- No prompt-strategy tool reliability rows yet.']),
      ...(toolReliability?.toolHeavyAdvice?.length
        ? [
            '',
            '### Retry-reduction advice',
            ...toolReliability.toolHeavyAdvice.map((item) => `- ${item.tone.toUpperCase()} ${item.scope} ${item.key}: ${item.detail}`),
          ]
        : ['- Tool-heavy routing advice: no advisory rows yet.']),
      '',
      '## Best Signals By Task Type',
      '',
      ...(summary?.bestByTaskType.length
        ? summary.bestByTaskType.map((row) => `- ${row.taskType}: ${row.model} at ${pct(row.rate)} from ${row.total} reviewed`)
        : ['- No reviewed task-type winners yet.']),
      ...(routingActionCues.length
        ? [
            '',
            '### Routing Action Cues',
            '',
            '- Advisory only; these do not change live routing.',
            ...routingActionCues.map((cue) => `- ${cue.taskType}: ${cue.label}; ${cue.detail}`),
          ]
        : []),
      '',
      '## Prompt Strategy Variants',
      '',
      ...(Object.keys(summary?.byPromptStrategyVariant || {}).length
        ? Object.entries(summary?.byPromptStrategyVariant || {})
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 12)
            .map(([strategyVariant, stats]) => `- ${strategyVariant}: ${stats.success}/${stats.total} worked (${pct(stats.rate)}) across ${Object.keys(stats.byModel).length} model${Object.keys(stats.byModel).length === 1 ? '' : 's'}`)
        : ['- No reviewed prompt strategy variant outcomes yet.']),
      ...(summary?.bestPromptStrategyVariants?.length
        ? [
            '',
            '### Best prompt strategy variant signals',
            ...summary.bestPromptStrategyVariants.map((row) => `- ${row.strategyVariant}: ${row.model} at ${pct(row.rate)} from ${row.total} reviewed`),
          ]
        : []),
      '',
      '## Eval Recommendations',
      '',
      `- Available recommendations: ${accessibleRecommendations.length}`,
      `- Unavailable recommendations: ${unavailableRecommendations.length}`,
      `- Proof approved: ${countRecommendationProofStates(recommendations).approved}`,
      `- Proof unreviewed: ${countRecommendationProofStates(recommendations).unreviewed}`,
      `- Proof needs attention: ${countRecommendationProofStates(recommendations)['needs-attention']}`,
      ...(accessibleRecommendations.length
        ? accessibleRecommendations.map((rec) => `- ${rec.role}: ${rec.modelId} — ${evalProofStatusLabel(rec)} — ${rec.reason}`)
        : ['- No available eval-backed role recommendations for enabled models.']),
      '',
      '## Recent Routing Decisions',
      '',
      ...(hiddenRecentEventCount > 0
        ? [`Showing ${displayedRecentEvents.length} of ${visibleRecentEvents.length} matching decisions; ${hiddenRecentEventCount} more match the current filters.`]
        : []),
      ...(visibleRecentEventEvidenceViews.length
        ? displayedRecentEventViews.map((eventEvidence) => {
            const event = eventEvidence.event;
            const note = (eventEvidence.outcomeNote || '').trim();
            const strategy = event.promptStrategyVariantId
              ? `${event.promptStrategyId || 'unknown'}:${event.promptStrategyVariantId}`
              : event.promptStrategyId || 'unknown strategy';
            const promptCue = routeEventPromptBestPractice(event, promptStrategies);
            const signalSummary = formatRouteLearningSignalSummary(event.routeSignal);
            return `- ${routeEventExactTime(event.timestamp)} (${routeEventTimeLabel(event.timestamp)}) — ${event.selectedModel} (${event.taskType || 'unknown'} / ${event.role || 'unknown'} / ${event.complexity || 'unknown'} / ${strategy}): ${eventEvidence.marginSummary} Trace: ${eventEvidence.traceSummary}.${signalSummary ? ` Signal: ${signalSummary}.` : ''} Outcome: ${routingOutcomeLabel(event.outcome)}.${promptCue}${note ? ` Note: ${note}` : ''}`;
          })
        : ['- No recent routing decisions matched the active filter.']),
      '',
      '## Review Notes',
      '',
      `- Tool-error evidence source coverage: ${evidenceSourcesPresent}`,
      '- Only marked outcomes should influence trust in success rates.',
      '- Eval recommendations are manual until applied to role assignments; do not treat unreviewed or attention-needed proof as approved evidence.',
      '- Auto-Router candidates remain separate from role recommendations.',
      '',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `openharness-routing-learning-brief-${generatedAt.replace(/[:.]/g, '-')}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSaving('Downloaded routing learning brief');
    setTimeout(() => setSaving(null), 1200);
  };

  const handleExportToolFailureTrainingData = async () => {
    try {
      const payload = await api.getToolFailureTrainingExport(500);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `openharness-tool-failure-training-${payload.generatedAt.replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSaving(`Downloaded safe failure export (${payload.recordCount} rows, no prompts)`);
      setTimeout(() => setSaving(null), 1600);
    } catch {
      setSaving('Could not download safe failure export');
      setTimeout(() => setSaving(null), 1600);
    }
  };

  const handleImportEvidenceFile = async (file: File | null) => {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const datasetKind = importAsBenchmark ? 'benchmark' : 'production';
      const preview = await api.importRouterLearning(payload, { dryRun: true, datasetKind });
      const schemaSupportLabel = preview.schemaVersion == null
        ? 'unknown schema, recognized event fields will be previewed'
        : preview.schemaSupported === false
          ? 'unsupported schema, recognized event fields only'
          : 'supported schema';
      const toolReliabilityPreview = preview.toolReliabilityPreview
        ? `\nTool reliability summary: ${preview.toolReliabilityPreview.evidenceSource}; outcomes ${preview.toolReliabilityPreview.outcomeExamples}; recovery paths ${preview.toolReliabilityPreview.recoveryExamples}; patterns ${preview.toolReliabilityPreview.recoveryPatterns}; failure memory ${preview.toolReliabilityPreview.failureMemory}; signatures ${preview.toolReliabilityPreview.errorSignatures}; retry recommendations ${preview.toolReliabilityPreview.retryReductionRecommendations}; source rows ${preview.toolReliabilityPreview.evidenceSourceRows}\nNote: ${preview.toolReliabilityPreview.note}`
        : '';
      const promptBestPracticePreview = preview.promptBestPracticePreview
        ? `\nPrompt best practices: ${preview.promptBestPracticePreview.strategyCount} strategies, ${preview.promptBestPracticePreview.bestPracticeNoteCount} notes, sources ${preview.promptBestPracticePreview.sourceRefs.join(', ') || 'none'}\nNote: ${preview.promptBestPracticePreview.note}`
        : '';
      const providerFailureAdherencePreview = preview.providerFailureAdherencePreview
        ? `\nProvider failure adherence: ${preview.providerFailureAdherencePreview.rowCount} full rows${preview.providerFailureAdherencePreview.filteredRowCount == null ? '' : `, ${preview.providerFailureAdherencePreview.filteredRowCount} filtered rows`}; ${preview.providerFailureAdherencePreview.strategyCount} strategies; scope ${preview.providerFailureAdherencePreview.scope || 'unknown'}; filter ${preview.providerFailureAdherencePreview.appliedStrategyFilter || 'none'}; full-row sample ${preview.providerFailureAdherencePreview.sampleRowCount}${preview.providerFailureAdherencePreview.sampleRowsCapped ? ` of ${preview.providerFailureAdherencePreview.rowCount} shown (cap ${preview.providerFailureAdherencePreview.sampleRowLimit})` : ' rows'}${preview.providerFailureAdherencePreview.appliedStrategyFilter ? '; sample is not filtered' : ''}\nNote: ${preview.providerFailureAdherencePreview.note}`
        : '';
      const approved = window.confirm(
        `Import routing evidence from ${file.name}?\n\nSource: ${preview.importSource || 'unknown'}\nSchema: ${preview.schemaVersion ?? 'unknown'} (${schemaSupportLabel})\nDataset: ${preview.datasetKind || datasetKind}${preview.warnings?.length ? `\nWarning: ${preview.warnings.join(' ')}` : ''}${toolReliabilityPreview}${promptBestPracticePreview}${providerFailureAdherencePreview}\nNew events: ${preview.imported}\nAlready present: ${preview.skippedExisting}\nRejected: ${preview.rejected}`,
      );
      if (!approved) {
        setSaving('Routing import cancelled');
        setTimeout(() => setSaving(null), 1200);
        return;
      }
      const result = await api.importRouterLearning(payload, { datasetKind });
      await loadData();
      const importedToolSummary = result.toolReliabilityPreview
        ? `Tool-reliability summary was previewed as ${result.toolReliabilityPreview.evidenceSource} only and was not merged into local routing state. Note: not merged into local routing learning state.`
        : '';
      const importedPromptSummary = result.promptBestPracticePreview
        ? ` Prompt best-practice metadata was previewed as context-only evidence and was not merged into local prompt strategy profiles.`
        : '';
      const importedProviderFailureSummary = result.providerFailureAdherencePreview
        ? ` Provider failure adherence was previewed as context-only evidence (${result.providerFailureAdherencePreview.rowCount} full rows) and was not merged into local routing state.`
        : '';
      setSaving(`Imported ${result.imported}; skipped ${result.skippedExisting}; rejected ${result.rejected}.${importedToolSummary}${importedPromptSummary}${importedProviderFailureSummary}`);
      setTimeout(() => setSaving(null), 1800);
    } catch {
      setSaving('Could not import routing learning JSON');
      setTimeout(() => setSaving(null), 1800);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="routing-learning-pane">
        <div className="settings-pane-title">Routing Learning</div>
        <div className="settings-pane-desc">Loading routing statistics...</div>
      </div>
    );
  }

  const totalEvents = summary?.totalEvents || 0;
  const successRate = summary?.successRate ?? 0;
  const byTaskType = summary?.byTaskType || {};
  const byRole = summary?.byRole || {};
  const byComplexity = summary?.byComplexity || {};
  const byPromptStrategy = summary?.byPromptStrategy || {};
  const byPromptStrategyFamily = summary?.byPromptStrategyFamily || {};
  const byPromptStrategyVariant = summary?.byPromptStrategyVariant || {};
  const toolReliability = summary?.toolReliability;
  const toolErrorLedger = summary?.toolErrorLedger;
  const toolRecoveryRate = toolReliability && toolReliability.runsWithToolErrors > 0
    ? toolReliability.recoveredRunsWithToolErrors / toolReliability.runsWithToolErrors
    : 0;
  const bestLearningSignal = summary?.bestByTaskType[0] || null;
  const bestPromptVariantSignal = summary?.bestPromptStrategyVariants?.[0] || null;
  const recommendationProofCounts = countRecommendationProofStates(recommendations);
  const untrustedRecommendationCount = recommendationProofCounts.unreviewed + recommendationProofCounts['needs-attention'];
  const candidateEvidenceAge = routerState?.candidateEvidenceRefreshedAt
    ? routeEventTimeLabel(routerState.candidateEvidenceRefreshedAt)
    : 'Not available';
  const runtimeThresholdAdvice = routerState?.thresholdAdvice ?? null;
  const thresholdSignalReason = runtimeThresholdAdvice?.reason || thresholdSuggestion?.reason || '';
  return (
    <div className="routing-learning-pane">
      <div className="routing-learning-header">
        <div>
          <div className="settings-pane-title">Routing Learning</div>
          <div className="settings-pane-desc">
            Learns from marked routing outcomes and eval reports. It does not change routing by itself until you apply a recommendation.
          </div>
        </div>
        <div className="routing-header-actions">
          <button
            type="button"
            className="settings-mini-button"
            onClick={handleExportBrief}
            aria-label="Export Routing Learning Markdown evidence brief"
            title="Export a human-readable Routing Learning evidence brief"
          >
            <Download size={12} aria-hidden="true" /> Export brief
          </button>
          <button
            type="button"
            className="settings-mini-button"
            onClick={handleExportToolFailureTrainingData}
            aria-label="Export safe tool failure training data without prompts"
            title="Export only failure messages, failed model/tool, and captured workaround. No prompts, responses, artifacts, file contents, or raw tool output."
          >
            <Download size={12} aria-hidden="true" /> Export failures
          </button>
          <button
            type="button"
            className="settings-mini-button"
            onClick={handleExportEvidence}
            aria-label="Export Routing Learning JSON evidence bundle"
            title="Export the full Routing Learning JSON evidence bundle"
          >
            <Download size={12} aria-hidden="true" /> Export evidence
          </button>
          <button
            type="button"
            className="settings-mini-button"
            onClick={() => importInputRef.current?.click()}
            aria-label="Import Routing Learning JSON evidence"
            title="Preview and import a Routing Learning JSON evidence file"
          >
            <Upload size={12} aria-hidden="true" /> Import evidence
          </button>
          <button
            type="button"
            className={`settings-mini-button ${importAsBenchmark ? 'active' : ''}`}
            onClick={() => setImportAsBenchmark((value) => !value)}
            aria-pressed={importAsBenchmark}
            aria-label={`${importAsBenchmark ? 'Disable' : 'Enable'} benchmark import mode for Routing Learning evidence`}
            title="Imported benchmark events are preserved but excluded from production learning summaries"
          >
            Benchmark import
          </button>
          <button
            type="button"
            className="settings-mini-button"
            onClick={() => loadData().catch(() => {})}
            aria-label="Refresh Routing Learning evidence"
            title="Reload Routing Learning summaries, events, and recommendations"
          >
            <RefreshCw size={12} aria-hidden="true" /> Refresh
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(event) => handleImportEvidenceFile(event.target.files?.[0] || null)}
          />
        </div>
      </div>

      {saving && <div className="routing-learning-toast">{saving}</div>}

      <section className="routing-explain">
        <div className="routing-explain-item">
          <BarChart3 size={15} aria-hidden="true" />
          <div>
            <strong>Observed outcomes</strong>
            <span>Only decisions marked worked, failed, or unclear count toward success rates.</span>
          </div>
        </div>
        <div className="routing-explain-item">
          <Lightbulb size={15} aria-hidden="true" />
          <div>
            <strong>Recommendations</strong>
            <span>Eval suggestions are filtered to models enabled in your Providers settings.</span>
          </div>
        </div>
        <div className="routing-explain-item">
          <ShieldCheck size={15} aria-hidden="true" />
          <div>
            <strong>Manual apply</strong>
            <span>Use Apply to update an agent role. Auto-Router candidates stay separate.</span>
          </div>
        </div>
      </section>

      <section className="routing-metrics" role="list" aria-label={`Routing Learning trust metrics: ${totalEvents} reviewed outcomes, ${pct(successRate)} observed success, ${notedEventCount} notes attached, latest evidence ${latestEventAge}, ${recommendationProofCounts.approved} approved eval proof recommendation${recommendationProofCounts.approved === 1 ? '' : 's'}`}>
        <RoutingMetricCard
          label="Reviewed outcomes"
          value={totalEvents}
          detail={sampleLabel(totalEvents)}
          ariaLabel={`Reviewed outcomes: ${totalEvents}. ${sampleLabel(totalEvents)}`}
        />
        <RoutingMetricCard
          label="Observed success"
          value={pct(successRate)}
          detail="Based on marked outcomes only"
          ariaLabel={`Observed success: ${pct(successRate)}. Based on marked outcomes only`}
        />
        <RoutingMetricCard
          label="Confidence"
          value={totalEvents < 20 ? 'Learning' : 'Stable'}
          detail={totalEvents < 20 ? 'Mark more recent events before trusting winners' : 'Enough samples for trend checks'}
          tone={sampleTone(totalEvents)}
          ariaLabel={`Confidence: ${totalEvents < 20 ? 'Learning' : 'Stable'}. ${totalEvents < 20 ? 'Mark more recent events before trusting winners' : 'Enough samples for trend checks'}`}
        />
        <RoutingMetricCard
          label="Notes attached"
          value={notedEventCount}
          detail={notedEventCount === 0 ? 'Add notes to explain wins, misses, and fallbacks' : 'Reviewer context included in exports'}
          tone={notedEventCount === 0 ? 'low' : 'ok'}
          ariaLabel={`Notes attached: ${notedEventCount}. ${notedEventCount === 0 ? 'Add notes to explain wins, misses, and fallbacks' : 'Reviewer context included in exports'}`}
        />
        <RoutingMetricCard
          label="Data age"
          value={latestEventAge}
          detail={latestEventIsStale ? 'Refresh with newer route outcomes before trusting trends' : 'Recent routing evidence is loaded'}
          tone={latestEventIsStale ? 'low' : 'ok'}
          ariaLabel={`Data age: ${latestEventAge}. ${latestEventIsStale ? 'Refresh with newer route outcomes before trusting trends' : 'Recent routing evidence is loaded'}`}
        />
        <RoutingMetricCard
          label="Dataset mix"
          value={benchmarkEventCount}
          detail={benchmarkEventCount > 0 ? `${productionEventCount} production in loaded window` : `${productionEventCount} production, no benchmark imports loaded`}
          tone={benchmarkEventCount > 0 ? 'low' : 'ok'}
          ariaLabel={`Dataset mix: ${benchmarkEventCount}. ${benchmarkEventCount > 0 ? `${productionEventCount} production in loaded window` : `${productionEventCount} production, no benchmark imports loaded`}`}
        />
        <RoutingMetricCard
          label="Eval proof review"
          value={recommendationProofCounts.approved}
          detail={untrustedRecommendationCount > 0 ? `${untrustedRecommendationCount} unapproved recommendation${untrustedRecommendationCount === 1 ? '' : 's'}` : 'All loaded recommendations approved'}
          tone={untrustedRecommendationCount > 0 ? 'low' : 'ok'}
          ariaLabel={`Eval proof review: ${recommendationProofCounts.approved}. ${untrustedRecommendationCount > 0 ? `${untrustedRecommendationCount} unapproved recommendation${untrustedRecommendationCount === 1 ? '' : 's'}` : 'All loaded recommendations approved'}`}
        />
        <RoutingMetricCard
          label="Candidate evidence"
          value={routerState?.candidateEvidenceRefreshCount ?? 0}
          detail={routerState?.candidateEvidenceRefreshedAt ? `Refreshed ${candidateEvidenceAge}` : 'No router refresh metadata loaded'}
          tone={routerState?.candidateEvidenceRefreshedAt ? 'ok' : 'low'}
          ariaLabel={`Candidate evidence: ${routerState?.candidateEvidenceRefreshCount ?? 0}. ${routerState?.candidateEvidenceRefreshedAt ? `Refreshed ${candidateEvidenceAge}` : 'No router refresh metadata loaded'}`}
        />
        <RoutingMetricCard
          label="Runtime threshold"
          value={runtimeThresholdAdvice ? formatScoreDisplay(runtimeThresholdAdvice.activeThreshold) : '--'}
          detail={runtimeThresholdAdvice
            ? `${runtimeThresholdAdvice.applied ? 'Applied learned advice' : 'Advisory only'} · ${runtimeThresholdAdvice.dataPoints} rated outcome${runtimeThresholdAdvice.dataPoints === 1 ? '' : 's'}${runtimeThresholdAdvice.slowTimingContext ? ` · ${runtimeThresholdAdvice.slowTimingContext.slowRowCount} slow timing row${runtimeThresholdAdvice.slowTimingContext.slowRowCount === 1 ? '' : 's'} advisory` : ''}`
            : 'No runtime threshold advice loaded'}
          tone={runtimeThresholdAdvice?.applied ? 'ok' : runtimeThresholdAdvice ? 'low' : ''}
          ariaLabel={`Runtime threshold: ${runtimeThresholdAdvice ? formatScoreDisplay(runtimeThresholdAdvice.activeThreshold) : '--'}. ${runtimeThresholdAdvice ? `${runtimeThresholdAdvice.applied ? 'Applied learned advice' : 'Advisory only'} · ${runtimeThresholdAdvice.dataPoints} rated outcome${runtimeThresholdAdvice.dataPoints === 1 ? '' : 's'}${runtimeThresholdAdvice.slowTimingContext ? ` · ${runtimeThresholdAdvice.slowTimingContext.note}` : ''}` : 'No runtime threshold advice loaded'}`}
        />
        <RoutingMetricCard
          label="Tool-call errors"
          value={toolReliability?.errorToolCalls || 0}
          detail={toolReliability?.totalToolCalls ? `${pct((toolReliability.errorToolCalls || 0) / toolReliability.totalToolCalls)} of ${toolReliability.totalToolCalls} traced calls` : 'No traced tool calls yet'}
          tone={(toolReliability?.errorToolCalls || 0) > 0 ? 'low' : 'ok'}
          ariaLabel={`Tool-call errors: ${toolReliability?.errorToolCalls || 0}. ${toolReliability?.totalToolCalls ? `${pct((toolReliability.errorToolCalls || 0) / toolReliability.totalToolCalls)} of ${toolReliability.totalToolCalls} traced calls` : 'No traced tool calls yet'}`}
        />
        <RoutingMetricCard
          label="Tool recovery"
          value={toolReliability?.recoveredRunsWithToolErrors || 0}
          detail={toolReliability?.runsWithToolErrors ? `${pct(toolRecoveryRate)} of ${toolReliability.runsWithToolErrors} error runs reached final answer` : 'No tool-error recovery data yet'}
          tone={(toolReliability?.runsWithToolErrors || 0) > 0 ? 'low' : 'ok'}
          ariaLabel={`Tool recovery: ${toolReliability?.recoveredRunsWithToolErrors || 0}. ${toolReliability?.runsWithToolErrors ? `${pct(toolRecoveryRate)} of ${toolReliability.runsWithToolErrors} error runs reached final answer` : 'No tool-error recovery data yet'}`}
        />
        <RoutingMetricCard
          label="Live tool-error ledger"
          value={toolErrorLedgerStatusLabel(toolErrorLedger?.liveEvidenceStatus)}
          detail={toolErrorLedgerStatusHelp(toolErrorLedger)}
          tone={toolErrorLedger?.liveEvidenceStatus === 'available' ? 'ok' : 'low'}
          ariaLabel={`Live tool-error ledger: ${toolErrorLedgerStatusLabel(toolErrorLedger?.liveEvidenceStatus)}. ${toolErrorLedgerStatusHelp(toolErrorLedger)}`}
        />
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Route Debug Loop</h3>
            <p>Candidate scores explain one route, marked outcomes shape learning summaries, and eval recommendations stay manual until applied.</p>
          </div>
        </div>
        <div className="routing-debug-grid">
          <div className="routing-debug-card">
            <span>Latest candidate scores</span>
            <strong>{latestEvent ? latestEvent.selectedModel : 'No route yet'}</strong>
            {latestEvent && latestScores.length > 0 ? (
              <div className="routing-score-chips" role="list" aria-label={`Latest candidate scores for ${latestEvent.selectedModel}`}>
                {latestScores.map(([model, score]) => (
                  <span key={model} role="listitem" title={`${model}: ${formatScoreDisplay(score)}`}>{model} {formatScoreDisplay(score)}</span>
                ))}
              </div>
            ) : (
              <small>{candidateScoresUnavailableLabel({ fallback: latestEvent?.wasFallback })}</small>
            )}
          </div>
          <div className="routing-debug-card">
            <span>Fallback outcomes</span>
            <strong>{fallbackEvents.length} recent</strong>
            <small>{ratedFallbackEvents.length} marked as {routingOutcomeLabel('success')}, {routingOutcomeLabel('failure')}, or {routingOutcomeLabel('ambiguous')}</small>
          </div>
          <div className="routing-debug-card">
            <span>Learning influence</span>
            <strong>{bestLearningSignal ? bestLearningSignal.model : 'No winner yet'}</strong>
            <small>
              {bestLearningSignal
                ? `${bestLearningSignal.taskType} · ${pct(bestLearningSignal.rate)} from ${bestLearningSignal.total} reviewed`
                : thresholdSuggestion?.reason || 'Mark outcomes before trusting summaries'}
            </small>
          </div>
          <div className="routing-debug-card">
            <span>Prompt contract signal</span>
            <strong>{bestPromptVariantSignal ? bestPromptVariantSignal.strategyVariant : 'No variant yet'}</strong>
            <small>
              {bestPromptVariantSignal
                ? `${bestPromptVariantSignal.model} · ${pct(bestPromptVariantSignal.rate)} from ${bestPromptVariantSignal.total} reviewed`
                : 'Mark outcomes to compare role/task prompt variants'}
            </small>
          </div>
          <div className="routing-debug-card">
            <span>Eval recommendations</span>
            <strong>{accessibleRecommendations.length} available</strong>
            <small>
              {recommendationProofCounts.approved} approved · {recommendationProofCounts.unreviewed} unreviewed · {recommendationProofCounts['needs-attention']} need attention
            </small>
          </div>
        </div>
        {(runtimeThresholdAdvice || thresholdSuggestion) && (
          <div className="routing-debug-note">
            {runtimeThresholdAdvice?.applied
              ? `Runtime threshold advice applied: ${runtimeThresholdAdvice.reason}`
              : `Runtime threshold advice is advisory: ${thresholdSignalReason}`}
          </div>
        )}
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Provider Failure Adherence</h3>
            <p>Router decisions stay separate from execution failures; this shows the provider attempt path when fallback actually ran.</p>
            <p>{PROVIDER_FAILURE_SCOPE_NOTE}</p>
            <div className="provider-failure-summary" aria-label={`Provider failure adherence summary: ${providerFailureSummary.rowCount} rows, ${providerFailureSummary.terminalProviderCount} terminal providers, ${providerFailureSummary.distinctAttemptPathCount} attempt paths, ${providerFailureSummary.distinctErrorCount} error messages, ${providerFailureSummary.promptHashedFailureCount} prompt hashes, ${providerFailureSummary.distinctPromptHashCount} distinct prompt hashes, ${providerFailureSummary.routingContextLinkedCount} strategy-linked rows, ${providerFailureSummary.routingContextUnmatchedRunCount} unmatched run ids${providerFailureDistinctStrategyLabel ? `, ${providerFailureDistinctStrategyLabel}` : ''}, dominant cause ${providerFailureSummary.dominantCause || 'none'}, routing hint ${providerFailureHint}`}>
              <span><strong>{providerFailureSummary.rowCount}</strong> rows</span>
              <span><strong>{providerFailureSummary.terminalProviderCount}</strong> terminal providers</span>
              <span><strong>{providerFailureSummary.distinctAttemptPathCount}</strong> paths</span>
              <span><strong>{providerFailureSummary.distinctErrorCount}</strong> errors</span>
              <span><strong>{providerFailureSummary.promptHashedFailureCount}</strong> prompt hashes</span>
              <span><strong>{providerFailureSummary.distinctPromptHashCount}</strong> distinct prompts</span>
              <span><strong>{providerFailureSummary.routingContextLinkedCount}</strong> strategy-linked</span>
              <span><strong>{providerFailureSummary.routingContextUnmatchedRunCount}</strong> unmatched runs</span>
              {providerFailureDistinctStrategyLabel && (
                <span><strong>{providerFailureSummary.distinctPromptStrategyCount}</strong> prompt strategies</span>
              )}
              <span><strong>{providerFailureSummary.dominantCause || 'none'}</strong> Dominant cause</span>
            </div>
            <div className="provider-failure-hint" role="note">{providerFailureHint}</div>
            {providerFailureDistinctStrategyLabel && providerFailureStrategyBreakdown.length > 1 && (
              <div className="provider-failure-strategy-breakdown" role="list" aria-label="Provider failures by prompt strategy">
                {providerFailureStrategyBreakdown.map((item) => (
                  <div
                    key={item.strategyId}
                    role="listitem"
                    aria-label={`${item.strategyId}: ${item.failureCount} provider failure${item.failureCount === 1 ? '' : 's'}, ${item.selectedModelCount} selected model${item.selectedModelCount === 1 ? '' : 's'}, dominant cause ${item.dominantCause || 'none'}`}
                  >
                    <strong title={item.strategyId}>{item.strategyId}</strong>
                    <span className="provider-failure-strategy-failure">
                      <span className="provider-failure-strategy-bar" aria-hidden="true">
                        <span style={{ width: formatProviderFailureStrategyFailureShareWidth(item.failureCount, maxProviderFailureStrategyFailureCount) }} />
                      </span>
                      <span>{item.failureCount} failure{item.failureCount === 1 ? '' : 's'}</span>
                    </span>
                    <span>{item.selectedModelCount} model{item.selectedModelCount === 1 ? '' : 's'}</span>
                    <span>cause {item.dominantCause || 'none'}</span>
                    <button
                      type="button"
                      className={`settings-mini-button provider-failure-strategy-filter${providerFailureStrategyFilter === item.strategyId ? ' active' : ''}`}
                      aria-label={`Filter provider failures to ${item.strategyId}`}
                      aria-pressed={providerFailureStrategyFilter === item.strategyId}
                      title={providerFailureStrategyFilter === item.strategyId ? 'Clear this prompt strategy filter' : 'Show only provider failures for this prompt strategy'}
                      onClick={() => setProviderFailureStrategyFilter((value) => value === item.strategyId ? null : item.strategyId)}
                    >
                      {providerFailureStrategyFilter === item.strategyId ? 'Focused' : 'Focus'}
                    </button>
                    <button
                      type="button"
                      className="settings-mini-button provider-failure-strategy-copy"
                      aria-label={`${copiedProviderFailureStrategyId === item.strategyId ? 'Copied' : 'Copy evidence'} for ${item.strategyId}`}
                      title="Copy this prompt strategy failure evidence as JSON"
                      onClick={() => handleCopyProviderFailureStrategyEvidence(item.strategyId)}
                    >
                      {copiedProviderFailureStrategyId === item.strategyId ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                      {copiedProviderFailureStrategyId === item.strategyId ? 'Copied' : 'Copy evidence'}
                    </button>
                    <small>{item.modelCounts.map((modelCount) => `${modelCount.model}: ${modelCount.count}`).join(', ')}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="settings-mini-button"
            aria-label="Refresh provider failure adherence"
            onClick={() => {
              api.getRouterAdherenceEvents(PROVIDER_FAILURE_ADHERENCE_EVENT_LIMIT, PROVIDER_FAILURE_ADHERENCE_PHASE)
                .then((items) => {
                  setAdherenceEvents(items);
                  setAdherenceLoadError(null);
                })
                .catch(() => setAdherenceLoadError('Could not load provider failure adherence'));
            }}
          >
            <RefreshCw size={13} aria-hidden="true" />
            Refresh
          </button>
        </div>
        {adherenceLoadError ? (
          <div className="routing-empty">{adherenceLoadError}</div>
        ) : providerFailureRows.length === 0 ? (
          <div className="routing-empty">No provider failure adherence events loaded yet.</div>
        ) : (
          <>
            {providerFailureStrategyFilter && (
              <div className="provider-failure-filter-note" role="status">
                <span>Showing {visibleProviderFailureRows.length} provider failure{visibleProviderFailureRows.length === 1 ? '' : 's'} for {providerFailureStrategyFilter}.</span>
                <button
                  type="button"
                  className="settings-mini-button"
                  aria-label="Clear provider failure strategy filter"
                  onClick={() => setProviderFailureStrategyFilter(null)}
                >
                  Clear filter
                </button>
              </div>
            )}
          <div className="routing-debug-grid" role="list" aria-label="Provider failure adherence events">
            {visibleProviderFailureRows.map((row) => (
              <div key={row.id} className="routing-debug-card" role="listitem" title={row.error}>
                <span>{row.createdAt}</span>
                <strong>{row.title}</strong>
                <small>{row.detail}</small>
                <div className="routing-score-chips" role="list" aria-label={`Provider attempt path for ${row.title}`}>
                  <span role="listitem">{row.attemptPath}</span>
                  <span role="listitem">{row.terminalProvider}</span>
                  <span role="listitem">{row.terminalTimeout}</span>
                  <span role="listitem">{row.cause}</span>
                  {row.promptHash && (
                    <span role="listitem" title={row.promptHash}>prompt {row.promptHash.slice(0, 8)}</span>
                  )}
                  <span role="listitem" title={row.routingContext ? row.routingContext.promptStrategySelectionReason : 'No loaded routing decision matched this provider failure run id'}>
                    {row.routingContext?.promptStrategyId || 'strategy unknown'}
                  </span>
                </div>
                <details className="provider-failure-details">
                  <summary aria-label={`Toggle provider failure details for ${row.title}`}>
                    <ChevronDown size={13} aria-hidden="true" />
                    Details
                  </summary>
                  <button
                    type="button"
                    className="settings-mini-button provider-failure-copy"
                    aria-label={`${copiedProviderFailureRowId === row.id ? 'Copied' : 'Copy'} provider failure JSON for ${row.title}`}
                    title="Copy this provider failure row as JSON"
                    onClick={() => handleCopyProviderFailureRow(row)}
                  >
                    {copiedProviderFailureRowId === row.id ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                    {copiedProviderFailureRowId === row.id ? 'Copied' : 'Copy JSON'}
                  </button>
                  <dl>
                    <div>
                      <dt>Error</dt>
                      <dd>{row.error}</dd>
                    </div>
                    <div>
                      <dt>Attempt path</dt>
                      <dd>{row.attemptPath}</dd>
                    </div>
                    <div>
                      <dt>Terminal provider</dt>
                      <dd>{row.terminalProvider}</dd>
                    </div>
                    <div>
                      <dt>Terminal timeout</dt>
                      <dd>{row.terminalTimeout}</dd>
                    </div>
                    <div>
                      <dt>Routing strategy</dt>
                      <dd>
                        {row.routingContext ? (
                          <>
                            {row.routingContext.promptStrategyId || 'unknown strategy'}
                            {row.routingContext.promptStrategyVariantId ? ` / ${row.routingContext.promptStrategyVariantId}` : ''}
                          </>
                        ) : 'unknown - no loaded routing decision matched this run id'}
                      </dd>
                    </div>
                    <div>
                      <dt>Routing model</dt>
                      <dd>{row.routingContext ? row.routingContext.selectedModel : UNKNOWN_ROUTING_CONTEXT_VALUE}</dd>
                    </div>
                    <div>
                      <dt>Routing role/task</dt>
                      <dd>{row.routingContext ? `${row.routingContext.role} / ${row.routingContext.taskType}` : UNKNOWN_ROUTING_CONTEXT_VALUE}</dd>
                    </div>
                    <div>
                      <dt>Selection reason</dt>
                      <dd title={row.routingContext?.promptStrategySelectionReason || undefined}>
                        {row.routingContext ? row.routingContext.promptStrategySelectionReason || 'unknown' : UNKNOWN_ROUTING_CONTEXT_VALUE}
                      </dd>
                    </div>
                  </dl>
                </details>
              </div>
            ))}
          </div>
          </>
        )}
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Recommended Role Updates</h3>
            <p>Safe actions from eval reports that match enabled provider models. Bulk apply only uses approved proof.</p>
          </div>
          <button
            className="settings-mini-button"
            onClick={handleApplyAll}
            disabled={trustedAccessibleRecommendations.length === 0}
            title={trustedAccessibleRecommendations.length === 0 ? 'No enabled recommendations have approved Model Lab proof yet.' : 'Apply only recommendations with approved Model Lab proof.'}
            aria-label={`Apply ${trustedAccessibleRecommendations.length} trusted approved-proof recommendation${trustedAccessibleRecommendations.length === 1 ? '' : 's'}; ${accessibleRecommendations.length - trustedAccessibleRecommendations.length} unapproved recommendation${accessibleRecommendations.length - trustedAccessibleRecommendations.length === 1 ? '' : 's'} will be skipped`}
          >
            Apply trusted ({trustedAccessibleRecommendations.length})
          </button>
        </div>

        {accessibleRecommendations.length === 0 ? (
          <div className="routing-empty">
            No applicable recommendations for your enabled models. Enable the recommended model in Providers, or run evals against models you already use.
          </div>
        ) : (
          <div className="routing-recommendation-list">
            {trustedAccessibleRecommendations.length === 0 && (
              <div className="routing-empty">
                Recommendations are available, but none have approved proof yet. Review Model Lab proof before bulk applying changes.
              </div>
            )}
            {accessibleRecommendations.map((rec) => (
              <div
                key={`${rec.reportId}:${rec.role}:${rec.modelId}`}
                className="routing-recommendation-card"
                role="group"
                aria-label={`Role recommendation ${rec.role} to ${rec.modelId}. Report ${rec.reportName}. Proof ${evalProofStatusLabel(rec)}. ${rec.proofTrusted ? 'Trusted evidence may be applied.' : 'Not trusted until Model Lab proof is approved.'}`}
              >
                <div>
                  <div className="routing-rec-title">{rec.role} {'->'} {rec.modelId}</div>
                  <div className="routing-rec-reason">{rec.reason}</div>
                  <div className="routing-rec-source">{rec.reportName} · {evalProofStatusLabel(rec)}</div>
                  <div className={`routing-rec-source eval-proof-status ${rec.proofReviewStatus}`}>{evalProofStatusDetail(rec)}</div>
                </div>
                <button
                  className="settings-mini-button"
                  onClick={() => handleApplyRecommendation(rec.role, rec.modelId)}
                  disabled={rec.proofReviewStatus === 'needs-attention'}
                  aria-label={`${rec.proofTrusted ? 'Apply approved-proof' : rec.proofReviewStatus === 'needs-attention' ? 'Blocked needs-attention proof for' : 'Apply manually after reviewing unapproved proof for'} ${rec.role}: ${rec.modelId}`}
                  title={rec.proofReviewStatus === 'needs-attention' ? 'Resolve the Model Lab proof review before applying this recommendation.' : evalProofStatusDetail(rec)}
                >
                  {rec.proofTrusted ? 'Apply' : 'Apply manually'}
                </button>
              </div>
            ))}
          </div>
        )}

        {unavailableRecommendations.length > 0 && (
          <details className="routing-unavailable">
            <summary>
              <AlertTriangle size={13} />
              {unavailableRecommendations.length} recommendation{unavailableRecommendations.length === 1 ? '' : 's'} for models you do not have enabled
            </summary>
            {unavailableRecommendations.map((rec) => (
              <div key={`${rec.reportId}:${rec.role}:${rec.modelId}:unavailable`} className="routing-unavailable-row">
                <span>{rec.role} {'->'} {rec.modelId}</span>
                <span>{rec.reportName}</span>
              </div>
            ))}
          </details>
        )}
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Observed Performance</h3>
            <p>Historical routing decisions after you mark whether they worked.</p>
          </div>
        </div>

        {modelList.length === 0 ? (
          <div className="routing-empty">No marked routing outcomes yet. Review recent events below to start teaching the router.</div>
        ) : (
          <div className="routing-model-list">
            {modelList.map(([model, stats]: [string, any]) => (
              <div key={model} className="routing-model-row">
                <div className="routing-model-name">{model}</div>
                <div className="routing-model-meta">{stats.total} reviewed</div>
                <div className={`routing-rate ${stats.rate > 0.8 ? 'good' : stats.rate > 0.6 ? 'warn' : 'bad'}`}>{pct(stats.rate)}</div>
                <div className="routing-rate-track">
                  <div style={{ width: pct(stats.rate) }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!!summary?.bestByTaskType.length && (
          <div className="routing-mini-grid">
            {summary.bestByTaskType.map((row) => (
              <div key={row.taskType} className="routing-mini-card">
                <span>{row.taskType}</span>
                <strong>{row.model}</strong>
                <small>{pct(row.rate)} from {row.total} reviewed</small>
              </div>
            ))}
          </div>
        )}

        {routingActionCues.length > 0 && (
          <div className="routing-action-cues" aria-label="Routing Action Cues">
            <div className="routing-action-cues-header">
              <strong>Routing Action Cues</strong>
              <span>Use these as advisory candidate-card context; they do not change live routing.</span>
            </div>
            <div className="routing-action-cue-filters" role="group" aria-label="Filter Routing Action Cues by confidence">
              {ROUTING_ACTION_CUE_CONFIDENCE_FILTERS.map((filter) => {
                const count = filterRoutingLearningActionCues(routingActionCues, filter).length;
                const label = routingLearningActionCueFilterLabel(filter);
                return (
                  <button
                    key={filter}
                    type="button"
                    className={`routing-action-cue-filter ${routingActionCueFilter === filter ? 'active' : ''}`}
                    aria-pressed={routingActionCueFilter === filter}
                    aria-label={`${routingActionCueFilter === filter ? 'Showing' : 'Show'} ${label.toLowerCase()} Routing Action Cues (${count})`}
                    onClick={() => setRoutingActionCueFilter(filter)}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
            <div className="routing-action-cue-list">
              {visibleRoutingActionCues.map((cue) => (
                <div key={`${cue.taskType}:${cue.model}`} className={`routing-action-cue ${cue.status} ${cue.stale ? 'stale' : ''}`} aria-label={cue.ariaLabel}>
                  <span>{cue.label}</span>
                  <strong>{cue.taskType} · {cue.model}</strong>
                  <small>{cue.detail}</small>
                  {cue.decisionFreshnessLabel && <small>{cue.decisionFreshnessLabel}</small>}
                  {cue.freshnessDetail && <small>{cue.freshnessDetail}</small>}
                  {cue.staleLabel && <small>{cue.staleLabel}</small>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {(modelRequestDurationRows.byModel.length > 0 || modelRequestDurationRows.byTaskType.length > 0) && (
        <section className="routing-section">
          <div className="routing-section-header">
            <div>
              <h3>Model Request Duration</h3>
              <p>Average measured model request time from routing events with explicit run-trace duration. Missing samples are not counted.</p>
              {modelRequestDurationEvidence.summary.thresholdMs != null && (
                <p>
                  {modelRequestDurationEvidence.summary.slowRowCount} slow row{modelRequestDurationEvidence.summary.slowRowCount === 1 ? '' : 's'} · threshold {ms(modelRequestDurationEvidence.summary.thresholdMs)}
                </p>
              )}
            </div>
          </div>
          <div className="routing-breakdown-grid">
            <ModelRequestDurationColumn title="By model" rows={modelRequestDurationRows.byModel} />
            <ModelRequestDurationColumn title="By task" rows={modelRequestDurationRows.byTaskType} />
          </div>
        </section>
      )}

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Tool Reliability</h3>
            <p>Derived from saved run traces. Use this to spot models, providers, or tools that cause avoidable retries before a final answer.</p>
          </div>
        </div>

        {!toolReliability || toolReliability.totalToolCalls === 0 ? (
          <div className="routing-empty">No persisted tool-call trace data yet. Run a tool-using request to start collecting reliability evidence.</div>
        ) : (
          <>
            <div className="routing-debug-grid">
              {toolErrorLedger && (
                <div className={`routing-debug-card ${toolErrorLedger.liveEvidenceStatus === 'available' ? '' : 'low'}`} aria-label={`Live tool-error ledger status: ${toolErrorLedger.liveEvidenceStatus}; persisted rows ${toolErrorLedger.persistedEventCount}; log-derived rows ${toolErrorLedger.logTraceEventCount}`}>
                  <span>Live ledger status</span>
                  <strong>{toolErrorLedgerStatusLabel(toolErrorLedger.liveEvidenceStatus)}</strong>
                  <small>{toolErrorLedgerStatusHelp(toolErrorLedger)}</small>
                </div>
              )}
              <div className="routing-debug-card">
                <span>Traced tool calls</span>
                <strong>{toolReliability.totalToolCalls}</strong>
                <small>{toolReliability.completedToolCalls} complete · {toolReliability.skippedToolCalls} skipped · {toolReliability.runningToolCalls} running</small>
              </div>
              <div className="routing-debug-card">
                <span>Errored calls</span>
                <strong>{toolReliability.errorToolCalls}</strong>
                <small>{pct(toolReliability.errorToolCalls / toolReliability.totalToolCalls)} call error rate</small>
              </div>
              <div className="routing-debug-card">
                <span>Recovered error runs</span>
                <strong>{toolReliability.recoveredRunsWithToolErrors}</strong>
                <small>{toolReliability.runsWithToolErrors ? `${pct(toolRecoveryRate)} recovery from ${toolReliability.runsWithToolErrors} run${toolReliability.runsWithToolErrors === 1 ? '' : 's'}` : 'No tool-error runs'}</small>
              </div>
              <div className="routing-debug-card">
                <span>Recent error examples</span>
                <strong>{toolReliability.recentErrors.length}</strong>
                <small>Latest persisted tool failures available for inspection</small>
              </div>
              <div className="routing-debug-card">
                <span>First-call failures</span>
                <strong>{toolReliability.firstCallErrorRuns}</strong>
                <small>{toolReliability.runsWithToolCalls ? `${pct(toolReliability.firstCallErrorRuns / toolReliability.runsWithToolCalls)} of ${toolReliability.runsWithToolCalls} tool-using runs` : 'No tool-using runs'}</small>
              </div>
              <div className="routing-debug-card">
                <span>Recovery rounds</span>
                <strong>{toolReliability.avgRecoveryRounds}</strong>
                <small>Average rounds after first tool error before recovered final answer</small>
              </div>
            </div>

            {toolReliability.byEvidenceSource.length > 0 && (
              <div className="routing-model-list" aria-label="Tool-error evidence source summary">
                {toolReliability.byEvidenceSource.map((item) => {
                  const tuningCue = toolReliabilityTuningActionCue(item.tuningAction);
                  return (
                    <div key={item.source} className="routing-model-row">
                      <div className="routing-model-name">{item.source}</div>
                      <div className="routing-model-meta">
                        {item.outcomeRuns} outcome run{item.outcomeRuns === 1 ? '' : 's'} · {item.recoveredRuns} recovered · {item.unrecoveredRuns} unrecovered · avg retry distance {item.avgRetryDistance}
                      </div>
                      <div className={`routing-rate ${item.unrecoveredRuns > 0 ? 'warn' : 'good'}`}>
                        {item.retryReductionRecommendations} rec{item.retryReductionRecommendations === 1 ? '' : 's'}
                      </div>
                      <small>
                        <span
                          className={`routing-evidence-action-cue routing-evidence-action-cue-${tuningCue.tone}`}
                          aria-label={`Evidence source ${item.source} tuning action ${item.tuningAction}: ${tuningCue.detail}`}
                          title={`Raw tuning action ${item.tuningAction}. ${tuningCue.detail}`}
                        >
                          {tuningCue.label}
                        </span>
                        {' '}Latest evidence {item.latestTimestamp}
                      </small>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="routing-breakdown-grid">
              <ToolReliabilityColumn title="By model" rows={toolReliabilityTopRows.byModel} />
              <ToolReliabilityColumn title="By provider" rows={toolReliabilityRows(toolReliability.byProvider)} />
              <ToolReliabilityColumn title="By tool" rows={toolReliabilityTopRows.byTool} />
              <ToolReliabilityColumn title="By model/tool pair" rows={toolReliabilityTopRows.byModelTool} />
              <ToolReliabilityColumn title="By prompt strategy" rows={toolReliabilityRows(toolReliability.byPromptStrategy)} />
              <ToolReliabilityColumn title="By strategy variant" rows={toolReliabilityTopRows.byPromptStrategyVariant} />
            </div>

            {toolReliability.toolHeavyAdvice.length > 0 && (
              <div className="routing-model-list" aria-label="Retry-reduction advice from tool-call history">
                {toolReliability.toolHeavyAdvice.map((item) => (
                  <div key={`${item.scope}:${item.key}`} className="routing-model-row">
                    <div className="routing-model-name">{item.title}</div>
                    <div className="routing-model-meta">{item.scope} · {item.total} traced calls · first-call {pct(item.firstCallErrorRate)} · recovery {pct(item.recoveryRate)} · avg retry rounds {item.avgRecoveryRounds}</div>
                    <div className={`routing-rate ${item.tone === 'good' ? 'good' : item.tone === 'caution' ? 'warn' : 'bad'}`}>
                      {pct(item.errorRate)}
                    </div>
                    <small>{item.detail}</small>
                  </div>
                ))}
              </div>
            )}

            {toolReliability.retryReductionRecommendations.length > 0 && (
              <div className="routing-model-list" aria-label="Tool-call retry-reduction recommendations">
                {toolReliability.retryReductionRecommendations.slice(0, 5).map((item) => (
                  <div key={`${item.runId}:${item.failedTool}:${item.timestamp}:retry-reduction`} className="routing-model-row">
                    <div className="routing-model-name">
                      first failed {item.failedProviderId || 'unknown'}:{item.avoidPath}
                    </div>
                    <div className="routing-model-meta">
                      recovered {item.preferPath} · prefer after {item.retryDistance} rounds · avg recovery distance {item.avgRetryDistance} · confidence {item.evidenceConfidence} from {item.supportRunCount} run{item.supportRunCount === 1 ? '' : 's'} · {item.outcome.replace(/_/g, ' ')}
                    </div>
                    <div className={`routing-rate ${item.outcome === 'unrecovered_error' ? 'bad' : 'good'}`}>reduce</div>
                    <small>
                      {item.recommendation} {item.tuningGuidance} Source {item.evidenceSource} · tuning {item.tuningAction} · supporting sessions {item.supportSessionIds?.join(', ') || item.sessionId} · supporting runs {item.supportRunIds?.join(', ') || item.runId} · strategy {item.promptStrategyVariantId || item.promptStrategyId || 'unknown'} · provider path avoid {item.avoidProviderPath} · provider path prefer {item.preferProviderPath}
                    </small>
                  </div>
                ))}
              </div>
            )}

            {toolReliability.failureMemory.length > 0 && (
              <div className="routing-model-list" aria-label="Model failure memory">
                {toolReliability.failureMemory.slice(0, 5).map((item) => {
                  const fixedBy = item.fixedBy.length
                    ? item.fixedBy.map((fix) => `${fix.model} / ${fix.tool} (${fix.runs})`).join(', ')
                    : 'No recovered fix path captured yet';
                  const strategyLabel = item.promptStrategyVariants.length
                    ? `Variants: ${item.promptStrategyVariants.map((variant) => `${variant.id} (${variant.runs})`).join(', ')}`
                    : item.promptStrategies.length
                      ? `Strategies: ${item.promptStrategies.map((strategy) => `${strategy.id} (${strategy.runs})`).join(', ')}`
                      : 'No prompt strategy recorded';
                  return (
                    <div key={`${item.model}:${item.providerId}:${item.tool}`} className="routing-model-row">
                      <div className="routing-model-name">{item.model} / {item.tool}</div>
                      <div className="routing-model-meta">
                        {item.errorRuns} error run{item.errorRuns === 1 ? '' : 's'} · {item.recoveredRuns} recovered · {item.unrecoveredRuns} unrecovered · fallback helped {item.fallbackRecoveryRuns}
                      </div>
                      <div className={`routing-rate ${item.unrecoveredRuns > 0 ? 'bad' : 'good'}`}>memory</div>
                      <small title={item.latestError || 'No error text captured'}>{strategyLabel}. Fixed by: {fixedBy}. Sessions: {item.exampleSessionIds?.join(', ') || 'none'}. Runs: {item.exampleRunIds.join(', ') || 'none'}. Latest: {item.latestError || 'No error text captured'}</small>
                    </div>
                  );
                })}
              </div>
            )}

            {(toolReliability.errorSignatures || []).length > 0 && (
              <div className="routing-model-list" aria-label="Normalized tool-error signatures">
                {toolReliability.errorSignatures.slice(0, 5).map((item) => {
                  const workedBy = item.workedBy.length
                    ? item.workedBy.map((worked) => `${worked.model} / ${worked.tool} (${worked.runs}, avg retry ${worked.avgRetryDistance})`).join(', ')
                    : 'No working follow-up captured yet';
                  const strategyLabel = item.promptStrategyVariants.length
                    ? `Variants: ${item.promptStrategyVariants.map((variant) => `${variant.id} (${variant.runs})`).join(', ')}`
                    : item.promptStrategies.length
                      ? `Strategies: ${item.promptStrategies.map((strategy) => `${strategy.id} (${strategy.runs})`).join(', ')}`
                      : 'No prompt strategy recorded';
                  return (
                    <div key={`${item.model}:${item.providerId}:${item.tool}:${item.signature}`} className="routing-model-row">
                      <div className="routing-model-name">{item.model} / {item.tool}</div>
                      <div className="routing-model-meta">
                        {item.signature} · {item.runs} run{item.runs === 1 ? '' : 's'} · {item.recoveredRuns} recovered · {item.unrecoveredRuns} unrecovered · fallback helped {item.fallbackRecoveryRuns}
                      </div>
                      <div className={`routing-rate ${item.unrecoveredRuns > 0 ? 'bad' : 'good'}`}>signature</div>
                      <small title={item.sampleError || 'No sample error captured'}>
                        {strategyLabel}. Worked by: {workedBy}. Sessions: {item.exampleSessionIds?.join(', ') || 'none'}. Runs: {item.exampleRunIds.join(', ') || 'none'}.
                      </small>
                    </div>
                  );
                })}
              </div>
            )}

            {toolReliability.outcomeExamples.length > 0 && (
              <div className="routing-model-list" aria-label="Session outcomes after tool-call errors">
                {toolReliability.outcomeExamples.slice(0, 5).map((item) => {
                  const workedBy = item.workedBy
                    ? `${item.workedBy.model} / ${item.workedBy.tool}`
                    : item.finalAnswerCaptured ? 'final answer without later completed tool call' : item.finalStatus;
                  return (
                    <div key={`${item.runId}:${item.failedTool}:${item.timestamp}:outcome`} className="routing-model-row">
                      <div className="routing-model-name">{item.failedModel} / {item.failedTool}</div>
                      <div className="routing-model-meta">
                        {item.outcome.replace(/_/g, ' ')} · worked via {workedBy} · retry distance {item.retryDistance}
                      </div>
                      <div className={`routing-rate ${item.outcome === 'unrecovered_error' ? 'bad' : 'good'}`}>outcome</div>
                      <small title={item.error || 'No error text captured'}>
                        Strategy {item.promptStrategyVariantId || item.promptStrategyId || 'unknown'} · source {item.evidenceSource} · session {item.sessionId} · run {item.runId} · final {item.finalAnswerCaptured ? 'captured' : item.finalStatus}
                      </small>
                    </div>
                  );
                })}
              </div>
            )}

            {toolReliability.recoveryPatterns.length > 0 && (
              <div className="routing-model-list" aria-label="Recurring tool-call recovery patterns">
                {toolReliability.recoveryPatterns.slice(0, 5).map((item) => (
                  <div key={`${item.failedModel}:${item.failedTool}:${item.recoveredByModel}:${item.recoveredByTool}`} className="routing-model-row">
                    <div className="routing-model-name">{item.failedModel} / {item.failedTool}</div>
                    <div className="routing-model-meta">
                      recovered via {item.recoveredByModel} / {item.recoveredByTool} · {item.runs} run{item.runs === 1 ? '' : 's'} · final answer {item.finalAnswerRuns}/{item.runs}
                    </div>
                    <div className="routing-rate good">pattern</div>
                    <small>Average recovery rounds {item.avgRecoveryRounds}; sources {item.exampleEvidenceSources?.join(', ') || 'unknown'}; sessions {item.exampleSessionIds?.join(', ') || 'none'}; runs {item.exampleRunIds.join(', ') || 'none'}</small>
                  </div>
                ))}
              </div>
            )}

            {toolReliability.recoveryExamples.length > 0 && (
              <div className="routing-model-list" aria-label="Tool-call recovery paths">
                {toolReliability.recoveryExamples.slice(0, 5).map((item) => {
                  const recoveredBy = item.recoveredBy.length
                    ? item.recoveredBy.map((step) => `${step.model} / ${step.tool}`).join(' -> ')
                    : 'final answer without later completed tool call';
                  return (
                    <div key={`${item.runId}:${item.firstError.tool}:${item.timestamp}`} className="routing-model-row">
                      <div className="routing-model-name">{item.firstError.model} recovered after {item.firstError.tool}</div>
                      <div className="routing-model-meta">
                        worked via {recoveredBy} · {item.recoveryRounds} recovery round{item.recoveryRounds === 1 ? '' : 's'} · strategy {item.promptStrategyVariantId || item.promptStrategyId || 'unknown'} · final {item.finalAnswerCaptured ? 'captured' : item.finalStatus}
                      </div>
                      <div className="routing-rate good">path</div>
                      <small title={item.firstError.error || 'No error text captured'}>Source {item.evidenceSource} · session {item.sessionId} · run {item.runId} · {item.firstError.error || 'No error text captured'}</small>
                    </div>
                  );
                })}
              </div>
            )}

            {toolReliability.recentErrors.length > 0 && (
              <div className="routing-model-list" aria-label="Recent tool-call errors">
                {toolReliability.recentErrors.slice(0, 5).map((item) => (
                  <div key={`${item.runId}:${item.tool}:${item.timestamp}`} className="routing-model-row">
                    <div className="routing-model-name">{item.model}</div>
                    <div className="routing-model-meta">{item.tool} · {item.providerId} · round {item.round ?? 'unknown'} · source {item.evidenceSource} · session {item.sessionId} · run {item.runId}</div>
                    <div className="routing-rate bad">error</div>
                    <small title={item.error || 'No error text captured'}>{item.error || 'No error text captured'}</small>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Breakdowns</h3>
            <p>Use this to spot whether a model is only good for a role, task type, or complexity.</p>
          </div>
        </div>
        <div className="routing-breakdown-grid">
          <BreakdownColumn title="Task type" data={byTaskType} />
          <BreakdownColumn title="Role" data={byRole} />
          <BreakdownColumn title="Complexity" data={byComplexity} />
          <BreakdownColumn title="Prompt strategy" data={byPromptStrategy} />
          <BreakdownColumn title="Strategy variant" data={byPromptStrategyVariant} />
          <BreakdownColumn title="Strategy family" data={byPromptStrategyFamily} />
        </div>
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Recent Routing Decisions</h3>
            <p>{ROUTING_FEEDBACK_GUIDANCE} Showing {visibleRecentEvents.length} of {events.length} loaded decisions.</p>
          </div>
          <button
            type="button"
            className={`settings-mini-button ${showUnratedOnly ? 'active' : ''}`}
            aria-pressed={showUnratedOnly}
            aria-label={`${showUnratedOnly ? 'Disable' : 'Enable'} needs-outcome Routing Learning filter with ${unratedEventCount} matching decision${unratedEventCount === 1 ? '' : 's'}`}
            onClick={() => {
              setShowUnratedOnly((value) => !value);
              setShowUnexplainedOnly(false);
              setShowStaleOnly(false);
              setShowFallbackOnly(false);
              setShowBenchmarkOnly(false);
              setShowEvidenceGapsOnly(false);
            }}
          >
            {showUnratedOnly ? 'Show all' : `Needs outcome (${unratedEventCount})`}
          </button>
          <button
            type="button"
            className={`settings-mini-button ${showUnexplainedOnly ? 'active' : ''}`}
            aria-pressed={showUnexplainedOnly}
            aria-label={`${showUnexplainedOnly ? 'Disable' : 'Enable'} needs-notes Routing Learning filter with ${unexplainedEventCount} matching decision${unexplainedEventCount === 1 ? '' : 's'}`}
            onClick={() => {
              setShowUnexplainedOnly((value) => !value);
              setShowUnratedOnly(false);
              setShowStaleOnly(false);
              setShowFallbackOnly(false);
              setShowBenchmarkOnly(false);
              setShowEvidenceGapsOnly(false);
            }}
          >
            {showUnexplainedOnly ? 'Show all' : `Needs notes (${unexplainedEventCount})`}
          </button>
          <button
            type="button"
            className={`settings-mini-button ${showStaleOnly ? 'active' : ''}`}
            aria-pressed={showStaleOnly}
            aria-label={`${showStaleOnly ? 'Disable' : 'Enable'} stale-only Routing Learning filter with ${staleEventCount} matching decision${staleEventCount === 1 ? '' : 's'}`}
            onClick={() => {
              setShowStaleOnly((value) => !value);
              setShowUnratedOnly(false);
              setShowUnexplainedOnly(false);
              setShowFallbackOnly(false);
              setShowBenchmarkOnly(false);
              setShowEvidenceGapsOnly(false);
            }}
          >
            {showStaleOnly ? 'Show all' : `Stale only (${staleEventCount})`}
          </button>
          <button
            type="button"
            className={`settings-mini-button ${showFallbackOnly ? 'active' : ''}`}
            aria-pressed={showFallbackOnly}
            aria-label={`${showFallbackOnly ? 'Disable' : 'Enable'} fallback Routing Learning filter with ${fallbackEvents.length} matching decision${fallbackEvents.length === 1 ? '' : 's'}`}
            onClick={() => {
              setShowFallbackOnly((value) => !value);
              setShowUnratedOnly(false);
              setShowUnexplainedOnly(false);
              setShowStaleOnly(false);
              setShowBenchmarkOnly(false);
              setShowEvidenceGapsOnly(false);
            }}
          >
            {showFallbackOnly ? 'Show all' : `Fallbacks (${fallbackEvents.length})`}
          </button>
          <button
            type="button"
            className={`settings-mini-button ${showBenchmarkOnly ? 'active' : ''}`}
            aria-pressed={showBenchmarkOnly}
            aria-label={`${showBenchmarkOnly ? 'Disable' : 'Enable'} benchmark Routing Learning filter with ${benchmarkEventCount} matching decision${benchmarkEventCount === 1 ? '' : 's'}`}
            onClick={() => {
              setShowBenchmarkOnly((value) => !value);
              setShowUnratedOnly(false);
              setShowUnexplainedOnly(false);
              setShowStaleOnly(false);
              setShowFallbackOnly(false);
              setShowEvidenceGapsOnly(false);
            }}
          >
            {showBenchmarkOnly ? 'Show all' : `Benchmarks (${benchmarkEventCount})`}
          </button>
          {ROUTING_POLICY_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`settings-mini-button ${policyFilter === filter ? 'active' : ''}`}
              aria-pressed={policyFilter === filter}
              aria-label={`${policyFilter === filter ? 'Disable' : 'Enable'} ${routingPolicyFilterLabel(filter)} Routing Learning policy filter with ${policyFilterCounts[filter]} matching decision${policyFilterCounts[filter] === 1 ? '' : 's'}`}
              onClick={() => setPolicyFilter((value) => value === filter ? 'all' : filter)}
            >
              {policyFilter === filter ? 'All policies' : `${routingPolicyFilterLabel(filter)} (${policyFilterCounts[filter]})`}
            </button>
          ))}
          {(showUnratedOnly || showUnexplainedOnly || showStaleOnly || showFallbackOnly || showBenchmarkOnly || showEvidenceGapsOnly || policyFilter !== 'all') && (
            <button
              type="button"
              className="settings-mini-button"
              aria-label="Clear Routing Learning recent-decision filters"
              onClick={() => {
                setShowUnratedOnly(false);
                setShowUnexplainedOnly(false);
                setShowStaleOnly(false);
                setShowFallbackOnly(false);
                setShowBenchmarkOnly(false);
                setShowEvidenceGapsOnly(false);
                setPolicyFilter('all');
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <div
          className="routing-trend-rollup"
          role="group"
          aria-label={`Routing trend across ${routingTrend.recentCount} recent decision${routingTrend.recentCount === 1 ? '' : 's'}: ${pct(routingTrend.winRate)} worked${routingTrend.dominantPolicy ? `, dominant policy ${routingTrend.dominantPolicy}` : ''}`}
        >
          <span><strong>{routingTrend.recentCount}</strong> recent</span>
          <span><strong>{pct(routingTrend.winRate)}</strong> worked</span>
          <span><strong>{routingTrend.dominantPolicy || 'none'}</strong> dominant policy</span>
          {routingTrend.topSignals.slice(0, 5).map((item) => (
            <span key={item.signal} title={`${item.count} recent decision${item.count === 1 ? '' : 's'}`}>
              {item.signal} {item.count}
            </span>
          ))}
        </div>

        <div className="routing-decision-scan" role="list" aria-label="Routing decision scan summary">
          {decisionScanCards.map((card) => {
            const scanCardClassName = `routing-scan-card ${card.tone}`;
            const scanCardPressed = routingDecisionScanCardPressed(card.filterTarget);
            const scanCardFilterTarget = card.filterTarget;
            return (
              <div key={card.id} className="routing-scan-card-shell" role="listitem">
                {scanCardFilterTarget ? (
                  <button
                    type="button"
                    className={`${scanCardClassName} actionable${scanCardPressed ? ' active' : ''}`}
                    aria-pressed={scanCardPressed}
                    aria-label={`${scanCardPressed ? 'Clear' : 'Show'} ${card.label.toLowerCase()} routing decisions. ${card.detail}`}
                    title={card.detail}
                    onClick={() => handleRoutingDecisionScanCard(scanCardFilterTarget)}
                  >
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </button>
                ) : (
                  <div className={scanCardClassName} title={card.detail}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <small>{card.detail}</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {events.length === 0 ? (
          <div className="routing-empty">No routing events recorded yet.</div>
        ) : visibleRecentEvents.length === 0 ? (
          <div className="routing-empty">
            {showUnratedOnly
              ? 'All loaded routing events have outcomes.'
              : showStaleOnly
              ? 'No loaded routing events are stale.'
              : showFallbackOnly
                ? 'No loaded routing events used fallback routing.'
                  : showBenchmarkOnly
                    ? 'No loaded routing events are marked as benchmark data.'
                  : showEvidenceGapsOnly
                    ? 'All loaded routing events have the score evidence needed for routing evidence review.'
                  : showUnexplainedOnly
                    ? 'All loaded routing events have reviewer notes.'
                    : policyFilter !== 'all'
                      ? `No loaded routing events match the ${routingPolicyFilterLabel(policyFilter).toLowerCase()} policy filter.`
                      : 'No routing events match the current filter.'}
          </div>
        ) : (
          <div className="routing-event-list">
            {showRecentEventSliceControls && (
              <div className="routing-event-slice-note" role="status" aria-live="polite">
                <span>
                  {hiddenRecentEventCount > 0
                    ? <>Showing {displayedRecentEvents.length} of {visibleRecentEvents.length} matching decisions; {hiddenRecentEventCount} more match the current filters.</>
                    : <>Showing all {visibleRecentEvents.length} matching decisions.</>}
                  {recentEventDisplayWindow.reachedLimit && (
                    <> Review window cap reached at {MAX_RECENT_EVENT_DISPLAY_LIMIT} decisions.</>
                  )}
                </span>
                <span className="routing-event-slice-actions">
                  {recentEventDisplayWindow.canShowMore && (
                    <button
                      type="button"
                      className="settings-mini-button"
                      aria-label={`Show ${recentEventDisplayWindow.nextCount} more matching routing decisions`}
                      onClick={() => setRecentEventDisplayLimit((limit) => Math.min(visibleRecentEvents.length, limit + RECENT_EVENT_BATCH_SIZE))}
                    >
                      Show {recentEventDisplayWindow.nextCount} more
                    </button>
                  )}
                  {recentEventDisplayWindow.canShowFewer && (
                    <button
                      type="button"
                      className="settings-mini-button"
                      aria-label="Show fewer matching routing decisions"
                      onClick={() => setRecentEventDisplayLimit(RECENT_EVENT_BATCH_SIZE)}
                    >
                      Show fewer
                    </button>
                  )}
                </span>
              </div>
            )}
            {displayedRecentEventViews.map((eventEvidence) => {
              const event = eventEvidence.event;
              const status = eventStatus(event);
              const Icon = status.icon;
              const { topScores, traceChips, decisionExplanation, marginSummary } = eventEvidence;
              const evidenceGate = getModelLabEvidenceGate(event, promptStrategyIds);
              const replayReadiness = eventEvidence.scoreEvidenceReadiness;
              const scoreEvidenceKey = eventEvidence.scoreEvidenceKey;
              return (
                <div key={event.id} className="routing-event-row" role="group" aria-label={`Routing decision for ${event.selectedModel}: ${status.label}`}>
                  <div className={`routing-event-status ${status.tone}`}>
                    <Icon size={13} aria-hidden="true" />
                    {status.label}
                  </div>
                  <div className="routing-event-main" role="group" aria-label={`Route summary for ${event.selectedModel}: ${event.taskType || 'unknown'} task, ${event.role || 'unknown'} role, ${event.complexity || 'unknown'} complexity, score ${formatScoreDisplay(event.score)}`}>
                    <div>{event.selectedModel}</div>
                    <span>
                      {event.taskType || 'unknown'} / {event.role || 'unknown'} / {event.complexity || 'unknown'} / score {formatScoreDisplay(event.score)}
                    </span>
                    <div className="routing-event-trace" role="group" aria-label={`Route trace context for ${event.selectedModel}: ${traceChips.map((chip) => chip.label).join(', ')}`}>
                      {traceChips.map((chip) => (
                        <span key={`${event.id}:${chip.label}`} title={chip.title}>
                          {chip.label}
                        </span>
                      ))}
                    </div>
                    <RoutingLearningSignalChips signal={event.routeSignal} selectedModel={event.selectedModel} />
                    <div className="routing-event-decision-explanation" role="group" aria-label={`Route decision explanation for ${event.selectedModel}: ${decisionExplanation.detail}`}>
                      <strong>{decisionExplanation.reason}</strong>
                      <span>{decisionExplanation.detail}</span>
                      {decisionExplanation.contributors.length > 0 && (
                        <div className="routing-event-explanation-chips" role="list" aria-label={`Decision contributors for ${event.selectedModel}`}>
                          {decisionExplanation.contributors.map((chip) => (
                            <span key={`${event.id}:${chip.label}`} role="listitem" title={chip.title}>
                              {chip.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="routing-event-margin" aria-label={`Route margin summary for ${event.selectedModel}`}>
                      {marginSummary}
                    </div>
                    <div
                      className={`routing-evidence-provenance ${replayReadiness.status}`}
                      title={replayReadiness.detail}
                      aria-label={`Route score evidence for ${event.selectedModel}: ${replayReadiness.detail} Evidence key ${scoreEvidenceKey.id}. ${scoreEvidenceKey.detail}`}
                    >
                      Score evidence: {replayReadiness.label}
                      <span title={scoreEvidenceKey.detail}>Evidence key: {scoreEvidenceKey.id}</span>
                      {replayReadiness.missing.length > 0 && (
                        <span>Missing: {replayReadiness.missing.join(', ')}</span>
                      )}
                    </div>
                    <div className="routing-score-chips" role="list" aria-label={`Candidate scores for ${event.selectedModel}`}>
                      {topScores.length > 0 ? (
                        topScores.map(([model, score]) => (
                          <span key={model} role="listitem" title={`${model}: ${formatScoreDisplay(score)}`}>
                            {model} {formatScoreDisplay(score)}
                          </span>
                        ))
                      ) : (
                        <span className="muted" role="listitem">{candidateScoresUnavailableLabel({ fallback: event.wasFallback })}</span>
                      )}
                    </div>
                    <div className="routing-evidence-provenance" title={evidenceGate.reason || `Prompt strategy ${evidenceGate.strategyLabel} can be opened in Model Lab evidence.`}>
                      Evidence strategy: {evidenceGate.strategyLabel}
                      {!evidenceGate.enabled && (
                        <span>Evidence unavailable: {evidenceGate.reason}</span>
                      )}
                    </div>
                    <div className="routing-event-help">{routingOutcomeHelp(event.outcome)}</div>
                    <div role="group" aria-label={`Routing outcome note controls for ${event.selectedModel}`}>
                      <input
                        className="routing-event-note-input"
                        value={outcomeNotes[event.id] || ''}
                        onChange={(changeEvent) => setOutcomeNotes((prev) => ({ ...prev, [event.id]: changeEvent.target.value }))}
                        placeholder="Optional note: why this route worked, failed, or was unclear"
                        aria-label={`Routing outcome note for ${event.selectedModel}`}
                      />
                      <button
                        type="button"
                        title="Save the note for the current outcome"
                        aria-label={`Save routing outcome note for ${event.selectedModel}`}
                        onClick={() => handleSaveOutcomeNote(event)}
                        disabled={!event.outcome}
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                  <div className="routing-event-actions" role="group" aria-label={`Routing outcome actions for ${event.selectedModel}`}>
                    {onOpenModelLabEvidence && (
                      <button
                        type="button"
                        aria-label={evidenceGate.enabled ? `Open Model Lab evidence for ${event.selectedModel} route` : `${event.selectedModel} route evidence unavailable: ${evidenceGate.reason}`}
                        title={evidenceGate.reason || "Open Model Lab evidence filtered to this route's model and prompt strategy"}
                        onClick={() => {
                          if (!evidenceGate.enabled) return;
                          onOpenModelLabEvidence(routingDecisionToModelLabEvidenceScope(event));
                        }}
                        disabled={!evidenceGate.enabled}
                      >
                        <FlaskConical size={13} aria-hidden="true" />
                        Evidence
                      </button>
                    )}
                    <button type="button" aria-label={`Mark ${event.selectedModel} route as ${routingOutcomeLabel('success')}`} title={routingOutcomeHelp('success')} onClick={() => handleMarkOutcome(event.id, 'success')} disabled={event.outcome === 'success'}>{routingOutcomeLabel('success')}</button>
                    <button type="button" aria-label={`Mark ${event.selectedModel} route as ${routingOutcomeLabel('failure')}`} title={routingOutcomeHelp('failure')} onClick={() => handleMarkOutcome(event.id, 'failure')} disabled={event.outcome === 'failure'}>{routingOutcomeLabel('failure')}</button>
                    <button type="button" aria-label={`Mark ${event.selectedModel} route as ${routingOutcomeLabel('ambiguous')}`} title={routingOutcomeHelp('ambiguous')} onClick={() => handleMarkOutcome(event.id, 'ambiguous')} disabled={event.outcome === 'ambiguous'}>{routingOutcomeLabel('ambiguous')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function BreakdownColumn({
  title,
  data,
}: {
  title: string;
  data: Record<string, { total: number; success: number; rate: number; byModel: Record<string, { total: number; success: number; rate: number }> }>;
}) {
  const rows = Object.entries(data).sort(([, a], [, b]) => b.total - a.total);
  return (
    <div className="routing-breakdown-card">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <div className="routing-empty compact">No reviewed data</div>
      ) : (
        rows.map(([label, item]) => (
          <details key={`${title}:${label}`} className="routing-breakdown-detail">
            <summary>
              <span>{label}</span>
              <span>{item.total} / {pct(item.rate)}</span>
            </summary>
            {Object.entries(item.byModel).map(([model, stats]) => (
              <div key={`${label}:${model}`} className="routing-breakdown-model">
                <span>{model}</span>
                <span>{stats.success}/{stats.total}</span>
              </div>
            ))}
          </details>
        ))
      )}
    </div>
  );
}

function ToolReliabilityColumn({
  title,
  rows,
}: {
  title: string;
  rows: ToolReliabilityRow[];
}) {
  return (
    <div className="routing-breakdown-card">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <div className="routing-empty compact">No tool data</div>
      ) : (
        rows.map(([label, item]) => (
          <details key={`${title}:${label}`} className="routing-breakdown-detail">
            <summary>
              <span>{label}</span>
              <span>{item.error}/{item.total} errors</span>
            </summary>
            <div className="routing-breakdown-model">
              <span>Recovered runs</span>
              <span>{item.recoveredRuns}/{item.affectedRuns}</span>
            </div>
            <div className="routing-breakdown-model">
              <span>First-call failures</span>
              <span>{item.firstCallErrors}/{item.runs}</span>
            </div>
            <div className="routing-breakdown-model">
              <span>Error rate</span>
              <span>{pct(item.errorRate)}</span>
            </div>
            <div className="routing-breakdown-model">
              <span>Recovery rounds</span>
              <span>{item.avgRecoveryRounds}</span>
            </div>
            <div className="routing-breakdown-model">
              <span>Average duration</span>
              <span>{ms(item.avgDurationMs)}</span>
            </div>
            <div className="routing-breakdown-model">
              <span>Skipped/running</span>
              <span>{item.skipped}/{item.running}</span>
            </div>
          </details>
        ))
      )}
    </div>
  );
}

function ModelRequestDurationColumn({
  title,
  rows,
}: {
  title: string;
  rows: ModelRequestDurationRow[];
}) {
  return (
    <div className="routing-breakdown-card">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <div className="routing-empty compact">No request duration data</div>
      ) : (
        rows.map(([label, item]) => (
          <div key={`${title}:${label}`} className={item.slow ? 'routing-duration-slow' : undefined}>
            <span>{label}</span>
            <span>
              {ms(item.avgMs)} avg · {item.samples} sample{item.samples === 1 ? '' : 's'}
              {item.slow ? ` · slow > ${ms(item.thresholdMs)}` : ''}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
