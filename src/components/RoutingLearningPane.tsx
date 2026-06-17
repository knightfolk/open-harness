import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, CircleHelp, Download, Lightbulb, RefreshCw, ShieldCheck, Upload, XCircle } from 'lucide-react';
import * as api from '../utils/api';
import { ROUTING_FEEDBACK_GUIDANCE, candidateScoresUnavailableLabel, routingEventDecisionLabel, routingOutcomeHelp, routingOutcomeLabel, sortedCandidateScores } from '../utils/autoRouterTrace';

interface EnabledModelRef {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
}

interface Props {
  enabledModels?: EnabledModelRef[];
  onApplyRoleRecommendation?: (roleId: string, modelId: string) => void;
}

function normalizeModelId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
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

function eventStatus(event: api.RoutingEvent) {
  if (event.outcome === 'success') return { label: routingOutcomeLabel(event.outcome), icon: CheckCircle2, tone: 'success' };
  if (event.outcome === 'failure') return { label: routingOutcomeLabel(event.outcome), icon: XCircle, tone: 'error' };
  if (event.outcome === 'ambiguous') return { label: routingOutcomeLabel(event.outcome), icon: CircleHelp, tone: 'muted' };
  return { label: routingOutcomeLabel(event.outcome), icon: CircleHelp, tone: 'warning' };
}

function routeMarginSummary(event: api.RoutingEvent): string {
  const scores = sortedCandidateScores(event.candidateScores, 4);
  if (scores.length === 0) return candidateScoresUnavailableLabel({ fallback: event.wasFallback });
  const selectedScore = event.candidateScores?.[event.selectedModel] ?? event.score;
  const competitors = scores.filter(([model]) => model !== event.selectedModel);
  const closest = competitors[0];
  if (!closest) return `Selected ${event.selectedModel} with no scored alternatives.`;
  const [altModel, altScore] = closest;
  const margin = selectedScore - altScore;
  if (margin >= 0) return `Selected by ${margin.toFixed(2)} over ${altModel}.`;
  return `Fallback selected ${event.selectedModel}; top scored alternative was ${altModel} at ${altScore.toFixed(2)}.`;
}

function routeEventTimeLabel(timestamp: string): string {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return 'time unknown';
  const elapsedMs = Date.now() - time;
  if (elapsedMs < 0) return new Date(time).toLocaleString();
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return `${elapsedDays}d ago`;
  return new Date(time).toLocaleDateString();
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

function routeEventIsStale(timestamp: string): boolean {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time)) return true;
  return Date.now() - time > 7 * 24 * 60 * 60 * 1000;
}

function activeFilterLabel(showUnexplainedOnly: boolean, showStaleOnly: boolean, showFallbackOnly: boolean, showBenchmarkOnly: boolean): string {
  if (showUnexplainedOnly) return 'Needs notes';
  if (showStaleOnly) return 'Stale only';
  if (showFallbackOnly) return 'Fallbacks';
  if (showBenchmarkOnly) return 'Benchmarks';
  return 'All recent decisions';
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

export function RoutingLearningPane({ enabledModels = [], onApplyRoleRecommendation }: Props) {
  const [summary, setSummary] = useState<api.RouterLearningSummary | null>(null);
  const [events, setEvents] = useState<api.RoutingEvent[]>([]);
  const [recommendations, setRecommendations] = useState<api.EvalRecommendation[]>([]);
  const [promptStrategies, setPromptStrategies] = useState<api.PromptStrategyProfile[]>([]);
  const [thresholdSuggestion, setThresholdSuggestion] = useState<{ suggestedThreshold: number; reason: string; dataPoints: number } | null>(null);
  const [routerState, setRouterState] = useState<api.AutoRouterState | null>(null);
  const [outcomeNotes, setOutcomeNotes] = useState<Record<string, string>>({});
  const [showUnexplainedOnly, setShowUnexplainedOnly] = useState(false);
  const [showStaleOnly, setShowStaleOnly] = useState(false);
  const [showFallbackOnly, setShowFallbackOnly] = useState(false);
  const [showBenchmarkOnly, setShowBenchmarkOnly] = useState(false);
  const [importAsBenchmark, setImportAsBenchmark] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  const enabledModelKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const model of enabledModels) {
      keys.add(normalizeModelId(model.id));
      keys.add(normalizeModelId(`${model.providerId}:${model.id}`));
      keys.add(normalizeModelId(model.name));
    }
    return keys;
  }, [enabledModels]);

  const loadData = useCallback(async () => {
    const [s, e, r, routerState, strategies] = await Promise.all([
      api.getRouterLearning(),
      api.getRouterLearningEvents(undefined, 100),
      api.getEvalRecommendations(),
      api.getRouterState(),
      api.getPromptStrategies().catch(() => []),
    ]);
    const t = await api.suggestRouterThreshold(routerState.threshold);
    setRouterState(routerState);
    setSummary(s);
    setEvents(e);
    setRecommendations(r);
    setPromptStrategies(strategies);
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

  const accessibleRecommendations = useMemo(
    () => recommendations.filter((rec) => enabledModelKeys.has(normalizeModelId(rec.modelId))),
    [enabledModelKeys, recommendations],
  );

  const unavailableRecommendations = useMemo(
    () => recommendations.filter((rec) => !enabledModelKeys.has(normalizeModelId(rec.modelId))),
    [enabledModelKeys, recommendations],
  );

  const trustedAccessibleRecommendations = useMemo(
    () => accessibleRecommendations.filter((rec) => rec.proofTrusted),
    [accessibleRecommendations],
  );

  const modelList = useMemo(
    () => Object.entries(summary?.models || {}).sort(([, a]: any, [, b]: any) => b.total - a.total),
    [summary],
  );

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

  const handleExportEvidence = async () => {
    const generatedAt = new Date().toISOString();
    const reviewedEvents = events.filter((event) => event.outcome !== null);
    const unratedEvents = events.filter((event) => event.outcome === null);
    const byEvidenceSource = summary?.toolReliability?.byEvidenceSource || [];
    try {
      const fullExport = await api.getRouterLearningExport();
      const payload = {
        schemaVersion: 1,
        generatedAt,
        activeFilter: activeFilterLabel(showUnexplainedOnly, showStaleOnly, showFallbackOnly, showBenchmarkOnly),
        activeFilterMatchCount: visibleRecentEvents.length,
        fullExportDatasetCounts: {
          production: fullExport.productionEventCount ?? fullExport.events.filter((event) => event.datasetKind !== 'benchmark').length,
          benchmark: fullExport.benchmarkEventCount ?? fullExport.events.filter((event) => event.datasetKind === 'benchmark').length,
        },
        routerEvidenceFreshness: {
          enabled: routerState?.enabled ?? false,
          candidateEvidenceRefreshedAt: routerState?.candidateEvidenceRefreshedAt ?? null,
          candidateEvidenceRefreshCount: routerState?.candidateEvidenceRefreshCount ?? 0,
          configuredCandidateCount: routerState?.configuredCandidateCount ?? 0,
          activeCandidateCount: routerState?.candidateCount ?? 0,
        },
        fullExport,
        summary,
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
        recentEvents: events.map((event) => ({
          ...event,
          outcomeNote: outcomeNotes[event.id] || event.outcomeNote,
        })),
        filteredRecentEvents: visibleRecentEvents.map((event) => ({
          ...event,
          outcomeNote: outcomeNotes[event.id] || event.outcomeNote,
        })),
        reviewState: {
          reviewedEventCount: reviewedEvents.length,
          unratedEventCount: unratedEvents.length,
          fallbackEventCount: fallbackEvents.length,
          ratedFallbackEventCount: ratedFallbackEvents.length,
          notedEventCount: events.filter((event) => (outcomeNotes[event.id] || event.outcomeNote || '').trim().length > 0).length,
          latestEvidenceTimestamp: latestEvent ? routeEventExactTime(latestEvent.timestamp) : null,
          latestEvidenceAge: latestEvent ? routeEventTimeLabel(latestEvent.timestamp) : null,
          stale: latestEventIsStale,
          freshnessWarning: latestEventIsStale
            ? 'Refresh with newer route outcomes before trusting trends.'
            : 'Recent routing evidence is loaded.',
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
    const reviewedEvents = events.filter((event) => event.outcome !== null);
    const unratedEvents = events.filter((event) => event.outcome === null);
    const benchmarkEventCount = events.filter((event) => event.datasetKind === 'benchmark').length;
    const productionEventCount = events.length - benchmarkEventCount;
    const byEvidenceSource = toolReliability?.byEvidenceSource || [];
    const evidenceSourcesPresent = byEvidenceSource.length > 0
      ? byEvidenceSource.map((source) => source.source).join(', ')
      : 'none';
    const lines = [
      '# OpenHarness Routing Learning Evidence Brief',
      '',
      `Generated: ${generatedAt}`,
      '',
      '## Review State',
      '',
      `- Active filter at export: ${activeFilterLabel(showUnexplainedOnly, showStaleOnly, showFallbackOnly, showBenchmarkOnly)}`,
      `- Active filter matching events loaded: ${visibleRecentEvents.length}`,
      `- Reviewed outcomes: ${summary?.totalEvents || 0}`,
      `- Observed success: ${pct(summary?.successRate || 0)}`,
      `- Recent reviewed events loaded: ${reviewedEvents.length}`,
      `- Recent unrated events loaded: ${unratedEvents.length}`,
      `- Recent fallback events loaded: ${fallbackEvents.length}`,
      `- Rated fallback events loaded: ${ratedFallbackEvents.length}`,
      `- Loaded production events: ${productionEventCount}`,
      `- Loaded benchmark events: ${benchmarkEventCount}`,
      `- Recent events with reviewer notes: ${events.filter((event) => (outcomeNotes[event.id] || event.outcomeNote || '').trim().length > 0).length}`,
      `- Latest route evidence: ${latestEvent ? `${routeEventExactTime(latestEvent.timestamp)} (${routeEventTimeLabel(latestEvent.timestamp)})` : 'none loaded'}`,
      `- Freshness warning: ${latestEventIsStale ? 'refresh with newer route outcomes before trusting trends' : 'recent routing evidence is loaded'}`,
      `- Confidence: ${sampleLabel(summary?.totalEvents || 0)}`,
      `- Evidence source coverage: ${evidenceSourcesPresent}`,
      `- Candidate evidence refreshed: ${routerState?.candidateEvidenceRefreshedAt ? `${routerState.candidateEvidenceRefreshedAt} (${routerState.candidateEvidenceRefreshCount ?? 0} refresh${(routerState.candidateEvidenceRefreshCount ?? 0) === 1 ? '' : 'es'})` : 'not available'}`,
      '',
      '## Threshold Advice',
      '',
      thresholdSuggestion
        ? `- Suggested threshold: ${thresholdSuggestion.suggestedThreshold.toFixed(2)}`
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
      ...(toolReliabilityRows(toolReliability?.byModel).length
        ? toolReliabilityRows(toolReliability?.byModel).map(([model, stats]) => `- Model ${model}: ${stats.error}/${stats.total} tool errors, ${stats.firstCallErrors}/${stats.runs} first-call failures, ${stats.recoveredRuns}/${stats.affectedRuns} recovered error runs`)
        : ['- No per-model tool reliability rows yet.']),
      ...(toolReliabilityRows(toolReliability?.byTool).length
        ? toolReliabilityRows(toolReliability?.byTool).map(([tool, stats]) => `- Tool ${tool}: ${stats.error}/${stats.total} tool errors, ${pct(stats.errorRate)} error rate`)
        : ['- No per-tool reliability rows yet.']),
      ...(toolReliabilityRows(toolReliability?.byModelTool).length
        ? [
            '- Highest-risk model/tool pairs:',
            ...toolReliabilityRows(toolReliability?.byModelTool).map(([pair, stats]) => `- ${pair}: ${stats.error}/${stats.total} tool errors, ${stats.firstCallErrors}/${stats.runs} first-call failures, ${stats.recoveredRuns}/${stats.affectedRuns} recovered error runs`),
          ]
        : ['- No per-model/tool reliability rows yet.']),
      ...(toolReliabilityRows(toolReliability?.byPromptStrategyVariant).length
        ? [
            '- Prompt strategy tool reliability:',
            ...toolReliabilityRows(toolReliability?.byPromptStrategyVariant).map(([strategy, stats]) => `- ${strategy}: ${stats.error}/${stats.total} tool errors, ${stats.firstCallErrors}/${stats.runs} first-call failures, ${stats.recoveredRuns}/${stats.affectedRuns} recovered error runs`),
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
      ...(visibleRecentEvents.length
        ? visibleRecentEvents.slice(0, 12).map((event) => {
            const note = (outcomeNotes[event.id] || event.outcomeNote || '').trim();
            const strategy = event.promptStrategyVariantId
              ? `${event.promptStrategyId || 'unknown'}:${event.promptStrategyVariantId}`
              : event.promptStrategyId || 'unknown strategy';
            const promptCue = routeEventPromptBestPractice(event, promptStrategies);
            return `- ${routeEventExactTime(event.timestamp)} (${routeEventTimeLabel(event.timestamp)}) — ${event.selectedModel} (${event.taskType || 'unknown'} / ${event.role || 'unknown'} / ${event.complexity || 'unknown'} / ${strategy}): ${routeMarginSummary(event)} Outcome: ${routingOutcomeLabel(event.outcome)}.${promptCue}${note ? ` Note: ${note}` : ''}`;
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
      const approved = window.confirm(
        `Import routing evidence from ${file.name}?\n\nSource: ${preview.importSource || 'unknown'}\nSchema: ${preview.schemaVersion ?? 'unknown'} (${schemaSupportLabel})\nDataset: ${preview.datasetKind || datasetKind}${preview.warnings?.length ? `\nWarning: ${preview.warnings.join(' ')}` : ''}${toolReliabilityPreview}${promptBestPracticePreview}\nNew events: ${preview.imported}\nAlready present: ${preview.skippedExisting}\nRejected: ${preview.rejected}`,
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
      setSaving(`Imported ${result.imported}; skipped ${result.skippedExisting}; rejected ${result.rejected}.${importedToolSummary}${importedPromptSummary}`);
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
  const successRate = summary?.successRate || 0;
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
  const latestEvent = events[0] || null;
  const latestScores = sortedCandidateScores(latestEvent?.candidateScores, 3);
  const fallbackEvents = events.filter((event) => event.wasFallback);
  const ratedFallbackEvents = fallbackEvents.filter((event) => event.outcome !== null);
  const bestLearningSignal = summary?.bestByTaskType[0] || null;
  const bestPromptVariantSignal = summary?.bestPromptStrategyVariants?.[0] || null;
  const notedEventCount = events.filter((event) => (outcomeNotes[event.id] || event.outcomeNote || '').trim().length > 0).length;
  const latestEventAge = latestEvent ? routeEventTimeLabel(latestEvent.timestamp) : 'No route yet';
  const latestEventIsStale = !latestEvent || routeEventIsStale(latestEvent.timestamp);
  const unexplainedEventCount = events.filter((event) => (outcomeNotes[event.id] || event.outcomeNote || '').trim().length === 0).length;
  const staleEventCount = events.filter((event) => routeEventIsStale(event.timestamp)).length;
  const benchmarkEventCount = events.filter((event) => event.datasetKind === 'benchmark').length;
  const productionEventCount = events.length - benchmarkEventCount;
  const recommendationProofCounts = countRecommendationProofStates(recommendations);
  const untrustedRecommendationCount = recommendationProofCounts.unreviewed + recommendationProofCounts['needs-attention'];
  const candidateEvidenceAge = routerState?.candidateEvidenceRefreshedAt
    ? routeEventTimeLabel(routerState.candidateEvidenceRefreshedAt)
    : 'Not available';
  const visibleRecentEvents = events.filter((event) => {
    const matchesUnexplained = !showUnexplainedOnly || (outcomeNotes[event.id] || event.outcomeNote || '').trim().length === 0;
    const matchesStale = !showStaleOnly || routeEventIsStale(event.timestamp);
    const matchesFallback = !showFallbackOnly || event.wasFallback;
    const matchesBenchmark = !showBenchmarkOnly || event.datasetKind === 'benchmark';
    return matchesUnexplained && matchesStale && matchesFallback && matchesBenchmark;
  });

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

      <section className="routing-metrics" aria-label={`Routing Learning trust metrics: ${totalEvents} reviewed outcomes, ${pct(successRate)} observed success, ${notedEventCount} notes attached, latest evidence ${latestEventAge}, ${recommendationProofCounts.approved} approved eval proof recommendation${recommendationProofCounts.approved === 1 ? '' : 's'}`}>
        <div className="routing-metric-card">
          <span>Reviewed outcomes</span>
          <strong>{totalEvents}</strong>
          <small>{sampleLabel(totalEvents)}</small>
        </div>
        <div className="routing-metric-card">
          <span>Observed success</span>
          <strong>{pct(successRate)}</strong>
          <small>Based on marked outcomes only</small>
        </div>
        <div className={`routing-metric-card ${sampleTone(totalEvents)}`}>
          <span>Confidence</span>
          <strong>{totalEvents < 20 ? 'Learning' : 'Stable'}</strong>
          <small>{totalEvents < 20 ? 'Mark more recent events before trusting winners' : 'Enough samples for trend checks'}</small>
        </div>
        <div className={`routing-metric-card ${notedEventCount === 0 ? 'low' : 'ok'}`}>
          <span>Notes attached</span>
          <strong>{notedEventCount}</strong>
          <small>{notedEventCount === 0 ? 'Add notes to explain wins, misses, and fallbacks' : 'Reviewer context included in exports'}</small>
        </div>
        <div className={`routing-metric-card ${latestEventIsStale ? 'low' : 'ok'}`}>
          <span>Data age</span>
          <strong>{latestEventAge}</strong>
          <small>{latestEventIsStale ? 'Refresh with newer route outcomes before trusting trends' : 'Recent routing evidence is loaded'}</small>
        </div>
        <div className={`routing-metric-card ${benchmarkEventCount > 0 ? 'low' : 'ok'}`}>
          <span>Dataset mix</span>
          <strong>{benchmarkEventCount}</strong>
          <small>{benchmarkEventCount > 0 ? `${productionEventCount} production in loaded window` : `${productionEventCount} production, no benchmark imports loaded`}</small>
        </div>
        <div className={`routing-metric-card ${untrustedRecommendationCount > 0 ? 'low' : 'ok'}`}>
          <span>Eval proof review</span>
          <strong>{recommendationProofCounts.approved}</strong>
          <small>{untrustedRecommendationCount > 0 ? `${untrustedRecommendationCount} unapproved recommendation${untrustedRecommendationCount === 1 ? '' : 's'}` : 'All loaded recommendations approved'}</small>
        </div>
        <div className={`routing-metric-card ${routerState?.candidateEvidenceRefreshedAt ? 'ok' : 'low'}`}>
          <span>Candidate evidence</span>
          <strong>{routerState?.candidateEvidenceRefreshCount ?? 0}</strong>
          <small>{routerState?.candidateEvidenceRefreshedAt ? `Refreshed ${candidateEvidenceAge}` : 'No router refresh metadata loaded'}</small>
        </div>
        <div className={`routing-metric-card ${(toolReliability?.errorToolCalls || 0) > 0 ? 'low' : 'ok'}`}>
          <span>Tool-call errors</span>
          <strong>{toolReliability?.errorToolCalls || 0}</strong>
          <small>{toolReliability?.totalToolCalls ? `${pct((toolReliability.errorToolCalls || 0) / toolReliability.totalToolCalls)} of ${toolReliability.totalToolCalls} traced calls` : 'No traced tool calls yet'}</small>
        </div>
        <div className={`routing-metric-card ${(toolReliability?.runsWithToolErrors || 0) > 0 ? 'low' : 'ok'}`}>
          <span>Tool recovery</span>
          <strong>{toolReliability?.recoveredRunsWithToolErrors || 0}</strong>
          <small>{toolReliability?.runsWithToolErrors ? `${pct(toolRecoveryRate)} of ${toolReliability.runsWithToolErrors} error runs reached final answer` : 'No tool-error recovery data yet'}</small>
        </div>
        <div className={`routing-metric-card ${toolErrorLedger?.liveEvidenceStatus === 'available' ? 'ok' : 'low'}`}>
          <span>Live tool-error ledger</span>
          <strong>{toolErrorLedgerStatusLabel(toolErrorLedger?.liveEvidenceStatus)}</strong>
          <small>{toolErrorLedgerStatusHelp(toolErrorLedger)}</small>
        </div>
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
            {latestScores.length > 0 ? (
              <div className="routing-score-chips" role="list" aria-label={`Latest candidate scores for ${latestEvent.selectedModel}`}>
                {latestScores.map(([model, score]) => (
                  <span key={model} role="listitem" title={`${model}: ${score.toFixed(2)}`}>{model} {score.toFixed(2)}</span>
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
        {thresholdSuggestion && (
          <div className="routing-debug-note">
            Threshold signal: {thresholdSuggestion.reason}. This is advisory and does not change routing until a config action applies it.
          </div>
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
      </section>

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
                {toolReliability.byEvidenceSource.map((item) => (
                  <div key={item.source} className="routing-model-row">
                    <div className="routing-model-name">{item.source}</div>
                    <div className="routing-model-meta">
                      {item.outcomeRuns} outcome run{item.outcomeRuns === 1 ? '' : 's'} · {item.recoveredRuns} recovered · {item.unrecoveredRuns} unrecovered · avg retry distance {item.avgRetryDistance}
                    </div>
                    <div className={`routing-rate ${item.unrecoveredRuns > 0 ? 'warn' : 'good'}`}>
                      {item.retryReductionRecommendations} rec{item.retryReductionRecommendations === 1 ? '' : 's'}
                    </div>
                    <small>Tuning action {item.tuningAction}; latest evidence {item.latestTimestamp}</small>
                  </div>
                ))}
              </div>
            )}

            <div className="routing-breakdown-grid">
              <ToolReliabilityColumn title="By model" data={toolReliability.byModel} />
              <ToolReliabilityColumn title="By provider" data={toolReliability.byProvider} />
              <ToolReliabilityColumn title="By tool" data={toolReliability.byTool} />
              <ToolReliabilityColumn title="By model/tool pair" data={toolReliability.byModelTool} />
              <ToolReliabilityColumn title="By prompt strategy" data={toolReliability.byPromptStrategy} />
              <ToolReliabilityColumn title="By strategy variant" data={toolReliability.byPromptStrategyVariant} />
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
            className={`settings-mini-button ${showUnexplainedOnly ? 'active' : ''}`}
            aria-pressed={showUnexplainedOnly}
            aria-label={`${showUnexplainedOnly ? 'Disable' : 'Enable'} needs-notes Routing Learning filter with ${unexplainedEventCount} matching decision${unexplainedEventCount === 1 ? '' : 's'}`}
            onClick={() => {
              setShowUnexplainedOnly((value) => !value);
              setShowStaleOnly(false);
              setShowFallbackOnly(false);
              setShowBenchmarkOnly(false);
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
              setShowUnexplainedOnly(false);
              setShowFallbackOnly(false);
              setShowBenchmarkOnly(false);
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
              setShowUnexplainedOnly(false);
              setShowStaleOnly(false);
              setShowBenchmarkOnly(false);
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
              setShowUnexplainedOnly(false);
              setShowStaleOnly(false);
              setShowFallbackOnly(false);
            }}
          >
            {showBenchmarkOnly ? 'Show all' : `Benchmarks (${benchmarkEventCount})`}
          </button>
          {(showUnexplainedOnly || showStaleOnly || showFallbackOnly || showBenchmarkOnly) && (
            <button
              type="button"
              className="settings-mini-button"
              aria-label="Clear Routing Learning recent-decision filters"
              onClick={() => {
                setShowUnexplainedOnly(false);
                setShowStaleOnly(false);
                setShowFallbackOnly(false);
                setShowBenchmarkOnly(false);
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {events.length === 0 ? (
          <div className="routing-empty">No routing events recorded yet.</div>
        ) : visibleRecentEvents.length === 0 ? (
          <div className="routing-empty">
            {showStaleOnly
              ? 'No loaded routing events are stale.'
              : showFallbackOnly
                ? 'No loaded routing events used fallback routing.'
                : showBenchmarkOnly
                  ? 'No loaded routing events are marked as benchmark data.'
                  : showUnexplainedOnly
                    ? 'All loaded routing events have reviewer notes.'
                    : 'No routing events match the current filter.'}
          </div>
        ) : (
          <div className="routing-event-list">
            {visibleRecentEvents.slice(0, 12).map((event) => {
              const status = eventStatus(event);
              const Icon = status.icon;
              const topScores = sortedCandidateScores(event.candidateScores, 4);
              return (
                <div key={event.id} className="routing-event-row" role="group" aria-label={`Routing decision for ${event.selectedModel}: ${status.label}`}>
                  <div className={`routing-event-status ${status.tone}`}>
                    <Icon size={13} aria-hidden="true" />
                    {status.label}
                  </div>
                  <div className="routing-event-main" role="group" aria-label={`Route summary for ${event.selectedModel}: ${event.taskType || 'unknown'} task, ${event.role || 'unknown'} role, ${event.complexity || 'unknown'} complexity, score ${event.score.toFixed(2)}`}>
                    <div>{event.selectedModel}</div>
                    <span>
                      {event.taskType || 'unknown'} / {event.role || 'unknown'} / {event.complexity || 'unknown'} / score {event.score.toFixed(2)}
                    </span>
                  <div className="routing-event-trace" role="group" aria-label={`Route trace context for ${event.selectedModel}`}>
                    <span>{routingEventDecisionLabel(event)}</span>
                  {event.classifierModel && <span>classifier: {event.classifierModel}</span>}
                  {event.wasCached && <span>cached</span>}
                  {event.wasFallback && <span>fallback used</span>}
                  <span title={event.datasetKind === 'benchmark' ? 'Benchmark events are preserved but excluded from production learning summaries.' : 'Production routing event.'}>
                    {event.datasetKind === 'benchmark' ? 'benchmark data' : 'production data'}
                  </span>
                  <span title={routeEventExactTime(event.timestamp)}>{routeEventTimeLabel(event.timestamp)}</span>
                </div>
                  <div className="routing-event-margin" aria-label={`Route margin summary for ${event.selectedModel}`}>
                    {routeMarginSummary(event)}
                  </div>
                  <div className="routing-score-chips" role="list" aria-label={`Candidate scores for ${event.selectedModel}`}>
                    {topScores.length > 0 ? (
                        topScores.map(([model, score]) => (
                          <span key={model} role="listitem" title={`${model}: ${score.toFixed(2)}`}>
                            {model} {score.toFixed(2)}
                          </span>
                        ))
                      ) : (
                        <span className="muted" role="listitem">{candidateScoresUnavailableLabel({ fallback: event.wasFallback })}</span>
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
  data,
}: {
  title: string;
  data: Record<string, api.ToolReliabilityBucket>;
}) {
  const rows = toolReliabilityRows(data);
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
