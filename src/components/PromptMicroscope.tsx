import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight, AlertTriangle, Cpu, Wrench, MessageSquare, Zap, ShieldCheck, Download, Search } from 'lucide-react';
import type { HarnessRun } from '../types';
import * as api from '../utils/api';
import { ROUTING_FEEDBACK_GUIDANCE, autoRouterClassifierLabel, autoRouterConfidenceCue, autoRouterDecisionLabel, autoRouterPolicyEvidence, autoRouterScoreMarginCue, candidateScoresUnavailableLabel, sortedCandidateScores } from '../utils/autoRouterTrace';
import { PROMPT_SECTION_FILTERS, buildPromptSectionFilterCounts, filterPromptMicroscopeSections, promptSectionFilterLabel, type PromptSectionFilter } from '../utils/promptMicroscopeSectionFilters';
import { buildPromptMicroscopeTraceIndex, buildPromptSectionEstimateKey, buildPromptSectionEstimateLookup, resolvePromptBuiltPreview, resolvePromptSectionPreview, type PromptMicroscopeSection } from '../utils/promptMicroscopeSections';
import { buildRouterExplanation } from '../utils/routerExplanation';
import { promptPluginRuntimeCostSummary } from '../utils/promptPluginRuntimeSummary';
import { createAutoRouterCandidateEvidenceBuilder, type AutoRouterCandidateEvidence } from '../utils/autoRouterCandidateEvidence';
import { createRouterLearningSummaryLoader } from '../utils/routerLearningSummaryCache';
import { computePromptBudget, type PromptBudgetState } from '../utils/promptBudget';
import { buildPromptCostSummary, type PromptCostSummary } from '../utils/promptCost';
import { formatModelRequestDurationDetail, formatModelRequestPatienceDetail, formatModelRequestTimeoutDetail } from '../utils/modelRequestTimeoutDisplay';
import { formatScoreDisplay } from '../utils/scoreDisplay';
import { RouteModeSection } from './PromptMicroscopeRouteMode';
import { RouteInputSummarySection } from './PromptMicroscopeRouteInputSummary';
import { RouterExplanationSection } from './PromptMicroscopeRouterExplanation';

const EMPTY_PROMPT_MICROSCOPE_SECTIONS: PromptMicroscopeSection[] = [];
const DEFAULT_EXPECTED_OUTPUT_TOKENS = 1_000;
const EMPTY_PROMPT_SECTION_ESTIMATE_LOOKUP = new Map<string, api.SectionEstimate>();
const EMPTY_PROMPT_SECTION_FILTER_COUNTS: Record<PromptSectionFilter, number> = {
  all: 0,
  redacted: 0,
  project: 0,
  runtime: 0,
  plugins: 0,
  tools: 0,
  'router-model': 0,
  output: 0,
};
const EMPTY_PROMPT_COST_SUMMARY: PromptCostSummary = {
  inputTokens: 0,
  expectedOutputTokens: DEFAULT_EXPECTED_OUTPUT_TOKENS,
  totalTokens: DEFAULT_EXPECTED_OUTPUT_TOKENS,
  budgetTokens: null,
  budgetRatio: null,
  budgetTone: 'unknown',
  budgetLabel: 'context budget unavailable',
  pricingKnown: false,
  costLabel: 'pricing unavailable',
  inputCost: null,
  outputCost: null,
  totalCost: null,
};
const EMPTY_PROMPT_ESTIMATE_SUMMARY: PromptEstimateSummary = {
  totalEstimatedInputTokens: 0,
  tokenBudgetHeaderInputTokens: 0,
  totalRedactions: 0,
  totalRedactionUnknown: 0,
};
const EMPTY_PROMPT_BUDGET: PromptBudgetState = {
  totalTokens: 0,
  sections: [],
  offenders: [],
  status: 'ok',
};
const routerLearningSummaryLoader = createRouterLearningSummaryLoader(() => api.getRouterLearning());

interface PromptSectionEstimateState {
  key: string;
  status: 'loading' | 'ready' | 'unavailable';
  estimates: api.SectionEstimate[] | null;
}

type PromptMicroscopeExportState = 'idle' | 'exporting' | 'exported' | 'failed';

interface PromptEstimateSummary {
  totalEstimatedInputTokens: number;
  tokenBudgetHeaderInputTokens: number;
  totalRedactions: number;
  totalRedactionUnknown: number;
}

interface AutoRouterCandidateRow {
  model: string;
  scoreLabel: string;
  decisionLabel: string;
  selected: boolean;
  candidateEvidence: AutoRouterCandidateEvidence | null;
  ariaLabel: string;
}

function buildPromptEstimateSummary({
  estimates,
  estimateStatus,
  fallbackInputTokens,
}: {
  estimates: api.SectionEstimate[] | null;
  estimateStatus: PromptSectionEstimateState['status'] | null;
  fallbackInputTokens: number;
}): PromptEstimateSummary {
  // Keep totals on the raw estimates array so duplicate IDs still count toward server accounting.
  const totalEstimatedInputTokens = estimates?.reduce((sum, s) => sum + s.tokens, 0) ?? 0;
  const totalRedactions = estimates?.reduce((sum, s) => sum + Math.max(0, s.redactedHits), 0) ?? 0;
  const totalRedactionUnknown = estimates?.filter((s) => s.redactedHits < 0).length ?? 0;
  return {
    totalEstimatedInputTokens,
    tokenBudgetHeaderInputTokens: estimateStatus === 'ready' ? totalEstimatedInputTokens : fallbackInputTokens,
    totalRedactions,
    totalRedactionUnknown,
  };
}

function buildAutoRouterCandidateRows({
  candidateScores,
  selectedModelId,
  candidateEvidenceByModel,
}: {
  candidateScores: Array<[string, number]>;
  selectedModelId: string | null;
  candidateEvidenceByModel: Map<string, AutoRouterCandidateEvidence | null>;
}): AutoRouterCandidateRow[] {
  return candidateScores.map(([model, score]) => {
    const scoreLabel = formatScoreDisplay(score);
    const selected = model === selectedModelId;
    const decisionLabel = selected ? 'Selected model' : 'Rejected alternative';
    const candidateEvidence = candidateEvidenceByModel.get(model) || null;
    return {
      model,
      scoreLabel,
      decisionLabel,
      selected,
      candidateEvidence,
      ariaLabel: `${decisionLabel} ${model}, classifier score ${scoreLabel}${candidateEvidence ? `. ${candidateEvidence.ariaLabel}` : ''}`,
    };
  });
}

function pluralizeManifestCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatRunDebugBundleManifestHint(manifest: api.RunDebugBundleManifest): string {
  return [
    pluralizeManifestCount(manifest.messageCount, 'message'),
    pluralizeManifestCount(manifest.routeDecisionCount, 'route decision'),
    pluralizeManifestCount(manifest.modelOutputCount, 'model output'),
    pluralizeManifestCount(manifest.artifactCount, 'artifact'),
    pluralizeManifestCount(manifest.errorCount, 'error'),
    pluralizeManifestCount(manifest.retryableErrorCount, 'retryable error'),
  ].join(' · ');
}

interface Props {
  runTrace: HarnessRun | undefined;
}

export function PromptMicroscope({ runTrace }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [redactionOn, setRedactionOn] = useState(true);
  const [sectionFilter, setSectionFilter] = useState<PromptSectionFilter>('all');
  const [sectionQuery, setSectionQuery] = useState('');
  const [estimateState, setEstimateState] = useState<PromptSectionEstimateState | null>(null);
  const [exportState, setExportState] = useState<PromptMicroscopeExportState>('idle');
  const [exportManifest, setExportManifest] = useState<api.RunDebugBundleManifest | null>(null);
  const [routerLearningSummary, setRouterLearningSummary] = useState<api.RouterLearningSummary | null>(null);
  const [routerLearningSummaryStatus, setRouterLearningSummaryStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const sectionFilterScopeRef = useRef<string | null>(null);

  const traceIndex = useMemo(() => buildPromptMicroscopeTraceIndex(runTrace, expanded), [runTrace, expanded]);
  const sections = traceIndex?.sections ?? EMPTY_PROMPT_MICROSCOPE_SECTIONS;
  const collapsedSummary = traceIndex?.collapsedSummary ?? null;
  const sectionEstimateKey = useMemo(() => buildPromptSectionEstimateKey(sections), [sections]);
  const estimates = estimateState?.key === sectionEstimateKey ? estimateState.estimates : null;
  const estimateStatus = estimateState?.key === sectionEstimateKey ? estimateState.status : (expanded && sections.length > 0 ? 'loading' : null);
  const estimateById = useMemo(() => (expanded ? buildPromptSectionEstimateLookup(estimates) : EMPTY_PROMPT_SECTION_ESTIMATE_LOOKUP), [estimates, expanded]);
  const sectionFilterCounts = useMemo(() => (expanded ? buildPromptSectionFilterCounts(sections, estimates) : EMPTY_PROMPT_SECTION_FILTER_COUNTS), [sections, estimates, expanded]);
  const visibleSections = useMemo(() => (expanded
    ? filterPromptMicroscopeSections(sections, estimates, sectionFilter, sectionQuery, redactionOn)
    : EMPTY_PROMPT_MICROSCOPE_SECTIONS
  ), [sections, estimates, sectionFilter, sectionQuery, redactionOn, expanded]);
  const promptCostSummary = useMemo(() => (expanded ? buildPromptCostSummary({
    modelId: runTrace?.effectiveModel || '',
    sections,
    estimates: estimates?.map((estimate) => ({ id: estimate.id, tokens: estimate.tokens })),
    expectedOutputTokens: DEFAULT_EXPECTED_OUTPUT_TOKENS,
    budgetTokens: runTrace?.context.budget || null,
  }) : EMPTY_PROMPT_COST_SUMMARY), [runTrace?.context.budget, runTrace?.effectiveModel, sections, estimates, expanded]);
  const promptEstimateSummary = useMemo(() => (expanded ? buildPromptEstimateSummary({
    estimates,
    estimateStatus,
    fallbackInputTokens: promptCostSummary.inputTokens,
  }) : EMPTY_PROMPT_ESTIMATE_SUMMARY), [estimateStatus, estimates, promptCostSummary.inputTokens, expanded]);
  const promptSectionBudget = Math.max(120, Math.ceil(promptCostSummary.inputTokens * 0.45));
  const promptBudget = useMemo(() => (expanded ? computePromptBudget({
    sections: sections.map((section) => {
      const estimate = estimateById.get(section.id);
      return {
        id: section.id,
        label: section.label,
        tokens: estimate?.tokens,
        chars: estimate ? undefined : section.text.length,
        budget: promptSectionBudget,
      };
    }),
  }) : EMPTY_PROMPT_BUDGET), [estimateById, promptSectionBudget, sections, expanded]);
  const hasActiveSectionFilters = sectionFilter !== 'all' || sectionQuery.trim().length > 0;

  useEffect(() => {
    if (!expanded || !runTrace?.id || !sectionEstimateKey) return;
    const sectionFilterScope = `${runTrace.id}:${sectionEstimateKey}`;
    if (sectionFilterScopeRef.current === sectionFilterScope) return;
    sectionFilterScopeRef.current = sectionFilterScope;
    setSectionFilter('all');
    setSectionQuery('');
  }, [expanded, runTrace?.id, sectionEstimateKey]);

  // Server-side redaction + token estimate.
  useEffect(() => {
    if (!expanded || sections.length === 0 || !sectionEstimateKey) {
      setEstimateState(null);
      return;
    }
    let cancelled = false;
    setEstimateState((current) => current?.key === sectionEstimateKey ? current : { key: sectionEstimateKey, status: 'loading', estimates: null });
    api.estimatePromptSections(sections).then((res) => {
      if (!cancelled) {
        setEstimateState({
          key: sectionEstimateKey,
          status: api.promptSectionEstimatesUnavailable(res, sections) ? 'unavailable' : 'ready',
          estimates: res,
        });
      }
    }).catch(() => {
      if (!cancelled) {
        setEstimateState({
          key: sectionEstimateKey,
          status: 'unavailable',
          estimates: api.buildPromptSectionUnavailableEstimates(sections),
        });
      }
    });
    return () => { cancelled = true; };
  }, [expanded, sections, sectionEstimateKey]);

  const handleExportDebugBundle = useCallback(async () => {
    if (!runTrace || exportState === 'exporting') return;
    setExportState('exporting');
    try {
      const manifest = await api.downloadRunDebugBundle(runTrace.id);
      setExportManifest(manifest);
      setExportState('exported');
      window.setTimeout(() => setExportState('idle'), 2000);
    } catch {
      setExportManifest(null);
      setExportState('failed');
      window.setTimeout(() => setExportState('idle'), 3000);
    }
  }, [exportState, runTrace]);

  const autoRouterStep = traceIndex?.autoRouterStep;
  const autoRouterDecision = autoRouterStep ? autoRouterDecisionLabel({
    fallback: autoRouterStep.fallback,
    cached: autoRouterStep.cached,
    modelSelectionPolicy: autoRouterStep.stages?.modelSelectionPolicy,
  }) : '';
  const autoRouterClassifier = autoRouterStep ? autoRouterClassifierLabel({
    classifierModel: autoRouterStep.classifierModel,
    fallback: autoRouterStep.fallback,
  }) : '';
  const autoRouterMarginCue = expanded && autoRouterStep ? autoRouterScoreMarginCue(autoRouterStep) : null;
  const autoRouterConfidence = expanded && autoRouterStep ? autoRouterConfidenceCue(autoRouterStep) : null;
  const autoRouterPolicyEvidenceRows = expanded && autoRouterStep ? autoRouterPolicyEvidence(autoRouterStep) : [];
  const autoRouterScoreLabel = autoRouterStep ? formatScoreDisplay(autoRouterStep.score) : '';
  const autoRouterScores = useMemo(() => (
    expanded ? sortedCandidateScores(autoRouterStep?.candidateScores) : []
  ), [autoRouterStep?.candidateScores, expanded]);
  const candidateEvidenceBuilder = useMemo(() => (
    autoRouterScores.length > 0 ? createAutoRouterCandidateEvidenceBuilder(routerLearningSummary) : null
  ), [autoRouterScores.length, routerLearningSummary]);
  const candidateEvidenceByModel = useMemo(() => {
    const byModel = new Map<string, AutoRouterCandidateEvidence | null>();
    if (!candidateEvidenceBuilder) return byModel;
    for (const [model] of autoRouterScores) {
      byModel.set(model, candidateEvidenceBuilder.forModel(model));
    }
    return byModel;
  }, [autoRouterScores, candidateEvidenceBuilder]);
  const autoRouterCandidateRows = useMemo(() => buildAutoRouterCandidateRows({
    candidateScores: autoRouterScores,
    selectedModelId: autoRouterStep?.modelId || null,
    candidateEvidenceByModel,
  }), [autoRouterScores, autoRouterStep?.modelId, candidateEvidenceByModel]);
  const routerExplanation = useMemo(() => (
    buildRouterExplanation(autoRouterStep, expanded)
  ), [autoRouterStep, expanded]);

  useEffect(() => {
    if (!expanded || !autoRouterStep || autoRouterScores.length === 0) {
      setRouterLearningSummary(null);
      setRouterLearningSummaryStatus('idle');
      return;
    }
    let cancelled = false;
    setRouterLearningSummaryStatus('loading');
    routerLearningSummaryLoader.load().then((summary) => {
      if (!cancelled) {
        setRouterLearningSummary(summary);
        setRouterLearningSummaryStatus('ready');
      }
    }).catch(() => {
      if (!cancelled) {
        setRouterLearningSummary(null);
        setRouterLearningSummaryStatus('unavailable');
      }
    });
    return () => { cancelled = true; };
  }, [autoRouterScores.length, autoRouterStep, expanded]);

  if (!runTrace || !traceIndex) return null;

  const {
    routeStep,
    promptStep,
    outputStyle,
    routeMode,
    promptPluginRuntime,
    promptPluginSections,
    orchestrationStep,
    errorSteps,
    modelRequests,
    toolCalls,
    worktreeIsolation,
    resultSummary,
  } = traceIndex;
  const promptBuiltPreview = promptStep ? resolvePromptBuiltPreview({ promptStep, redactionOn }) : null;
  const toggleAction = expanded ? 'Collapse' : 'Expand';
  const toggleAriaLabel = `${toggleAction} prompt microscope for route, prompt, tool, and model evidence${collapsedSummary ? `; ${collapsedSummary.ariaLabel}` : ''}`;
  const promptPluginRuntimeCost = promptPluginRuntime ? promptPluginRuntimeCostSummary(promptPluginRuntime) : '';
  const modelRequestTimeoutDetail = expanded ? modelRequests.map(formatModelRequestTimeoutDetail).find(Boolean) || '' : '';
  const exportButtonLabel = exportState === 'exporting'
    ? 'Exporting...'
    : exportState === 'exported'
      ? 'Exported'
      : exportState === 'failed'
        ? 'Export failed'
        : 'Export';
  const exportManifestHint = exportManifest ? formatRunDebugBundleManifestHint(exportManifest) : '';
  const estimateStatusLabel = estimateStatus === 'loading'
    ? 'Estimating redactions and tokens'
    : estimateStatus === 'ready'
      ? 'Server estimates ready'
      : estimateStatus === 'unavailable'
        ? 'Estimator unavailable; redaction status unknown'
        : null;
  const routerLearningEvidenceStatusLabel = routerLearningSummaryStatus === 'loading'
    ? 'Router learning evidence loading'
    : routerLearningSummaryStatus === 'unavailable'
      ? 'Router learning evidence unavailable'
      : null;

  return (
    <div className="prompt-microscope">
      <button className="pm-toggle" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={toggleAriaLabel}>
        {expanded ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
        <span>Prompt microscope</span>
        {collapsedSummary && (
          <span className="pm-toggle-summary" aria-hidden="true">
            {collapsedSummary.items.map((item) => (
              <span key={`${item.label}:${item.value}`} className={`pm-toggle-chip${item.tone === 'warning' ? ' pm-toggle-chip-warning' : ''}`}>
                {item.value}
              </span>
            ))}
          </span>
        )}
        {expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
        {promptEstimateSummary.totalRedactions > 0 && (
          <span className="pm-redact-pill" title={`${promptEstimateSummary.totalRedactions} secret(s) redacted`}>
            <ShieldCheck size={10} aria-hidden="true" /> {promptEstimateSummary.totalRedactions}
          </span>
        )}
        {promptEstimateSummary.totalRedactionUnknown > 0 && (
          <span className="pm-redact-pill pm-redact-pill-warning" title={`${promptEstimateSummary.totalRedactionUnknown} prompt section redaction estimate(s) unavailable`}>
            <AlertTriangle size={10} aria-hidden="true" /> {promptEstimateSummary.totalRedactionUnknown}
          </span>
        )}
      </button>

      {expanded && (
        <div className="pm-panel">
          {sections.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-header">
                <MessageSquare size={12} />
                <span>Token Budget (~{promptEstimateSummary.tokenBudgetHeaderInputTokens} estimated input tokens across {sections.length} sections)</span>
                <label className="pm-redact-toggle" title="Redact API keys and other secrets in the preview">
                  <input type="checkbox" checked={redactionOn} onChange={(e) => setRedactionOn(e.target.checked)} />
                  Redact secrets
                </label>
              </div>
              <div className="pm-section-body">
                <div className="pm-filter-bar" role="toolbar" aria-label="Prompt section filters">
                  <span className="pm-filter-summary">Showing {visibleSections.length} of {sections.length} sections</span>
                  <label className="pm-filter-search">
                    <Search size={12} aria-hidden="true" />
                    <input
                      type="search"
                      value={sectionQuery}
                      onChange={(event) => setSectionQuery(event.target.value)}
                      aria-label="Search prompt sections"
                      placeholder="Search"
                    />
                  </label>
                  {hasActiveSectionFilters && (
                    <button
                      type="button"
                      className="pm-filter-button"
                      aria-label="Clear prompt section filters and search"
                      onClick={() => { setSectionFilter('all'); setSectionQuery(''); }}
                    >
                      Clear
                    </button>
                  )}
                  {PROMPT_SECTION_FILTERS.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={`pm-filter-button${sectionFilter === filter ? ' active' : ''}`}
                      aria-pressed={sectionFilter === filter}
                      aria-label={`${sectionFilter === filter ? 'Showing' : 'Show'} ${promptSectionFilterLabel(filter).toLowerCase()} prompt sections (${sectionFilterCounts[filter]})`}
                      onClick={() => setSectionFilter(filter)}
                    >
                      {promptSectionFilterLabel(filter)} ({sectionFilterCounts[filter]})
                    </button>
                  ))}
                </div>
                <div
                  className={`pm-cost-readout pm-cost-readout-${promptCostSummary.budgetTone}`}
                  role="status"
                  aria-label={`Prompt cost estimate: ${promptCostSummary.inputTokens} input tokens, expected output ${promptCostSummary.expectedOutputTokens} tokens, ${promptCostSummary.budgetLabel}, ${promptCostSummary.costLabel}`}
                >
                  <span>Input {promptCostSummary.inputTokens} tokens</span>
                  <span>Expected output {promptCostSummary.expectedOutputTokens} tokens</span>
                  <span>{promptCostSummary.budgetLabel}</span>
                  <span>{promptCostSummary.costLabel}</span>
                </div>
                {estimateStatusLabel && (
                  <div
                    className={`pm-estimate-status pm-estimate-status-${estimateStatus}`}
                    role="status"
                    aria-label={`Prompt section estimator status: ${estimateStatusLabel}`}
                  >
                    {estimateStatusLabel}
                  </div>
                )}
                {promptBudget.status !== 'ok' && (
                  <div
                    className={`pm-budget-flags pm-budget-flags-${promptBudget.status}`}
                    role="status"
                    aria-label={`Prompt section budget ${promptBudget.status}: ${promptBudget.offenders.map((item) => `${item.label} uses ${Math.round((item.ratio || 0) * 100)} percent`).join(', ')}`}
                  >
                    <strong>{promptBudget.status === 'over' ? 'Section budget over' : 'Section budget warning'}</strong>
                    {promptBudget.offenders.slice(0, 3).map((item) => (
                      <span key={item.id} title={`${item.label}: ${item.used} tokens, ${Math.round((item.ratio || 0) * 100)}% of soft section budget`}>
                        {item.label.split(' · ')[0]} {Math.round((item.ratio || 0) * 100)}%
                      </span>
                    ))}
                  </div>
                )}
                {visibleSections.length === 0 ? (
                  <div className="pm-empty">
                    No prompt sections match the {promptSectionFilterLabel(sectionFilter).toLowerCase()} filter{sectionQuery.trim() ? ` for "${sectionQuery.trim()}"` : ''}.
                  </div>
                ) : visibleSections.map((s, i) => {
                  const est = estimateById.get(s.id);
                  const display = resolvePromptSectionPreview({ section: s, estimate: est, redactionOn });
                  return (
                    <div key={s.id + i} className="pm-row pm-row-block">
                      <span className="pm-key">{s.label} · {display.tokens} tokens{display.redactedHits < 0 ? ' · redaction unknown' : display.redactedHits > 0 ? ` · ${display.redactedHits} redacted` : ''}</span>
                      <pre className="pm-pre">{display.text}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Output style */}
          {outputStyle && (
            <div className="pm-section">
              <div className="pm-section-header">
                <ShieldCheck size={12} />
                <span>Output Style</span>
              </div>
              <div className="pm-section-body">
                <div className="pm-row">
                  <span className="pm-key">Style</span>
                  <span className="pm-value">{outputStyle.label}</span>
                </div>
                <div className="pm-row">
                  <span className="pm-key">Role</span>
                  <span className="pm-value">{outputStyle.role}</span>
                </div>
                <div className="pm-row">
                  <span className="pm-key">Source</span>
                  <span className="pm-value">{outputStyle.source}</span>
                </div>
                {outputStyle.mustHave.length > 0 && (
                  <div className="pm-row pm-row-block">
                    <span className="pm-key">Expected shape</span>
                    <div className="pm-score-list">
                      {outputStyle.mustHave.map((item) => (
                        <div key={item} className="pm-score-row">
                          <span className="pm-score-model">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pm-row pm-row-block">
                  <span className="pm-key">Contract</span>
                  <pre className="pm-pre">{outputStyle.contract}</pre>
                </div>
              </div>
            </div>
          )}

          <RouteModeSection routeMode={routeMode} />

          {/* Auto-router */}
          {autoRouterStep && (
            <div className="pm-section" role="group" aria-label={`Auto-Router decision: selected ${autoRouterStep.modelId}, score ${autoRouterScoreLabel}, ${autoRouterDecision}`}>
              <div className="pm-section-header">
                <Cpu size={12} aria-hidden="true" />
                <span>Auto-Router</span>
              </div>
              <div className="pm-section-body" role="list" aria-label="Auto-Router selected model and decision evidence">
                <div className="pm-row" role="listitem" aria-label={`Selected model ${autoRouterStep.modelId}`}>
                  <span className="pm-key">Selected model</span>
                  <span className="pm-value">{autoRouterStep.modelId}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Decision ${autoRouterDecision}`}>
                  <span className="pm-key">Decision</span>
                  <span className="pm-value">{autoRouterDecision}</span>
                </div>
                {autoRouterConfidence && (
                  <div className="pm-row" role="listitem" aria-label={autoRouterConfidence.ariaLabel}>
                    <span className="pm-key">Confidence</span>
                    <span className={`pm-value pm-router-confidence-cue pm-router-confidence-cue-${autoRouterConfidence.tone}`}>
                      {autoRouterConfidence.label}
                    </span>
                  </div>
                )}
                <div className="pm-row" role="listitem" aria-label={`Router reason: ${autoRouterStep.reason}`}>
                  <span className="pm-key">Reason</span>
                  <span className="pm-value">{autoRouterStep.reason}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Classifier model ${autoRouterClassifier}`}>
                  <span className="pm-key">Classifier</span>
                  <span className="pm-value">{autoRouterClassifier}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Selected score ${autoRouterScoreLabel}${autoRouterStep.cached ? ', cached' : ''}`}>
                  <span className="pm-key">Score</span>
                  <span className="pm-value">{autoRouterScoreLabel}{autoRouterStep.cached ? ' · cached' : ''}</span>
                </div>
                {autoRouterMarginCue && (
                  <div className="pm-row" role="listitem" aria-label={autoRouterMarginCue.ariaLabel}>
                    <span className="pm-key">Margin</span>
                    <span className={`pm-value pm-router-margin-cue pm-router-margin-cue-${autoRouterMarginCue.tone}`}>
                      {autoRouterMarginCue.label}
                    </span>
                  </div>
                )}
                {autoRouterStep.stages?.heuristic && (
                  <div className="pm-row" role="listitem" aria-label={`Heuristic route ${autoRouterStep.stages.heuristic.mode}, ${autoRouterStep.stages.heuristic.role}, ${autoRouterStep.stages.heuristic.complexity}`}>
                    <span className="pm-key">Heuristic route</span>
                    <span className="pm-value">
                      {autoRouterStep.stages.heuristic.mode} · {autoRouterStep.stages.heuristic.role} · {autoRouterStep.stages.heuristic.complexity}
                    </span>
                  </div>
                )}
                {autoRouterStep.stages?.policy && (
                  <div className="pm-row" role="listitem" aria-label={`Policy gate ${autoRouterStep.stages.policy}`}>
                    <span className="pm-key">Policy gate</span>
                    <span className="pm-value">{autoRouterStep.stages.policy}</span>
                  </div>
                )}
                {autoRouterPolicyEvidenceRows.length > 0 && (
                  <div className="pm-row pm-row-block" role="listitem" aria-label={`${autoRouterPolicyEvidenceRows.length} Auto-Router policy evidence row${autoRouterPolicyEvidenceRows.length === 1 ? '' : 's'}`}>
                    <span className="pm-key">Policy evidence</span>
                    <div className="pm-policy-evidence-list" role="list" aria-label="Auto-Router policy evidence">
                      {autoRouterPolicyEvidenceRows.map((row) => (
                        <div key={row.id} className="pm-policy-evidence-row" role="listitem" aria-label={`${row.label}: ${row.evidence}. ${row.impact}`}>
                          <span className="pm-policy-evidence-label">{row.label}</span>
                          <span className="pm-policy-evidence-detail">
                            <span>{row.evidence}</span>
                            <span className="pm-evidence-cue pm-evidence-cue-ok" aria-label={row.impact} title={row.impact} tabIndex={0}>
                              evidence
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <RouteInputSummarySection label="Route input summary" signal={autoRouterStep.stages?.signal} source="Auto-Router" />
                <div className="pm-row" role="listitem" aria-label={`Routing feedback guidance: ${ROUTING_FEEDBACK_GUIDANCE}`}>
                  <span className="pm-key">Feedback</span>
                  <span className="pm-value">{ROUTING_FEEDBACK_GUIDANCE}</span>
                </div>
                {routerLearningEvidenceStatusLabel && autoRouterScores.length > 0 && (
                  <div
                    className={`pm-router-learning-status pm-router-learning-status-${routerLearningSummaryStatus}`}
                    role="status"
                    aria-label={`Router learning evidence status: ${routerLearningEvidenceStatusLabel}`}
                  >
                    {routerLearningEvidenceStatusLabel}
                  </div>
                )}
                {autoRouterScores.length > 0 ? (
                  <div className="pm-row pm-row-block" role="listitem" aria-label={`${autoRouterScores.length} Auto-Router candidate scores, including selected model ${autoRouterStep.modelId}`}>
                    <span className="pm-key">Candidate scores</span>
                    <div className="pm-score-list" role="list" aria-label="Ranked Auto-Router selected model and rejected alternatives">
                      {autoRouterCandidateRows.map((row) => {
                        return (
                          <div key={row.model} className="pm-score-row" role="listitem" aria-label={row.ariaLabel}>
                            <span className="pm-score-model">{row.model}{row.selected ? ' · selected' : ''}</span>
                            <span className="pm-score-value pm-score-value-with-evidence">
                              <span>{row.scoreLabel}</span>
                              {row.candidateEvidence && (
                                <span
                                  className={`pm-evidence-cue pm-evidence-cue-${row.candidateEvidence.tone}${row.candidateEvidence.stale ? ' pm-evidence-cue-stale' : ''}`}
                                  aria-label={row.candidateEvidence.ariaLabel}
                                  title={row.candidateEvidence.ariaLabel}
                                  tabIndex={0}
                                >
                                  {row.candidateEvidence.text}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="pm-row" role="listitem" aria-label={`Candidate scores unavailable: ${candidateScoresUnavailableLabel({ fallback: autoRouterStep.fallback })}`}>
                    <span className="pm-key">Candidate scores</span>
                    <span className="pm-value">{candidateScoresUnavailableLabel({ fallback: autoRouterStep.fallback })}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <RouterExplanationSection explanation={routerExplanation} />

          {promptPluginRuntime && (
            <div className="pm-section" role="group" aria-label={`Prompt plugin selection: ${promptPluginRuntime.selectedPluginIds.length} plugin${promptPluginRuntime.selectedPluginIds.length === 1 ? '' : 's'}, ${promptPluginRuntime.selectedSectionCount} section${promptPluginRuntime.selectedSectionCount === 1 ? '' : 's'}, ${promptPluginRuntimeCost}`}>
              <div className="pm-section-header">
                <MessageSquare size={12} aria-hidden="true" />
                <span>Prompt plugin selection</span>
              </div>
              <div className="pm-section-body" role="list" aria-label="Prompt plugin selection and cache evidence">
                <div className="pm-row" role="listitem">
                  <span className="pm-key">Selected plugins</span>
                  <span className="pm-value">{promptPluginRuntime.selectedPluginIds.length > 0 ? promptPluginRuntime.selectedPluginIds.join(', ') : 'none'}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Prompt plugin runtime cost: ${promptPluginRuntimeCost}`}>
                  <span className="pm-key">Runtime cost</span>
                  <span className="pm-value">{promptPluginRuntimeCost}</span>
                </div>
                <div className="pm-row" role="listitem">
                  <span className="pm-key">Selected sections</span>
                  <span className="pm-value">{promptPluginRuntime.selectedSectionCount}</span>
                </div>
                <div className="pm-row" role="listitem">
                  <span className="pm-key">Selection duration</span>
                  <span className="pm-value">{promptPluginRuntime.selectionDurationMs}ms</span>
                </div>
                <div className="pm-row" role="listitem">
                  <span className="pm-key">Manifest files scanned</span>
                  <span className="pm-value">{promptPluginRuntime.manifestsScanned}</span>
                </div>
                <div className="pm-row" role="listitem">
                  <span className="pm-key">Cache</span>
                  <span className="pm-value">{promptPluginRuntime.cache.hits} hits / {promptPluginRuntime.cache.misses} misses · {promptPluginRuntime.cache.entries} entries</span>
                </div>
              </div>
            </div>
          )}

          {/* Route decision */}
          {routeStep && (
            <div className="pm-section" role="group" aria-label={`Route decision: ${routeStep.role} role uses ${routeStep.model}`}>
              <div className="pm-section-header">
                <Cpu size={12} aria-hidden="true" />
                <span>Route Decision</span>
              </div>
              <div className="pm-section-body" role="list" aria-label="Heuristic route decision evidence">
                <div className="pm-row" role="listitem" aria-label={`Role ${routeStep.role}`}>
                  <span className="pm-key">Role</span>
                  <span className="pm-value">{routeStep.role}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Route model ${routeStep.model}`}>
                  <span className="pm-key">Model</span>
                  <span className="pm-value">{routeStep.model}</span>
                </div>
                {routeStep.reason && (
                  <div className="pm-row" role="listitem" aria-label={`Route reason: ${routeStep.reason}`}>
                    <span className="pm-key">Reason</span>
                    <span className="pm-value">{routeStep.reason}</span>
                  </div>
                )}
                {routeStep.stages?.heuristic && (
                  <div className="pm-row" role="listitem" aria-label={`Heuristic route ${routeStep.stages.heuristic.mode}, ${routeStep.stages.heuristic.role}, ${routeStep.stages.heuristic.complexity}`}>
                    <span className="pm-key">Heuristic route</span>
                    <span className="pm-value">
                      {routeStep.stages.heuristic.mode} · {routeStep.stages.heuristic.role} · {routeStep.stages.heuristic.complexity}
                    </span>
                  </div>
                )}
                {routeStep.stages?.policy && (
                  <div className="pm-row" role="listitem" aria-label={`Policy gate ${routeStep.stages.policy}`}>
                    <span className="pm-key">Policy gate</span>
                    <span className="pm-value">{routeStep.stages.policy}</span>
                  </div>
                )}
                <RouteInputSummarySection label="Route input summary" signal={routeStep.stages?.signal} source="Heuristic router" />
              </div>
            </div>
          )}

          {/* Orchestration mode */}
          {orchestrationStep && (
            <div className="pm-section">
              <div className="pm-section-header">
                <Zap size={12} />
                <span>Orchestration</span>
              </div>
              <div className="pm-section-body">
                <div className="pm-row">
                  <span className="pm-key">Mode</span>
                  <span className="pm-value">{orchestrationStep.mode}</span>
                </div>
                <div className="pm-row">
                  <span className="pm-key">Label</span>
                  <span className="pm-value">{orchestrationStep.label}</span>
                </div>
                {orchestrationStep.detail && (
                  <div className="pm-row">
                    <span className="pm-key">Detail</span>
                    <span className="pm-value">{orchestrationStep.detail}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt build info */}
          {promptStep && (
            <div className="pm-section">
              <div className="pm-section-header">
                <MessageSquare size={12} />
                <span>Prompt Context</span>
              </div>
              <div className="pm-section-body">
                <div className="pm-row">
                  <span className="pm-key">Available tools</span>
                  <span className="pm-value">{promptStep.toolCount}</span>
                </div>
                {promptStep.assembly && (
                  <>
                    <div className="pm-row">
                      <span className="pm-key">Renderer</span>
                      <span className="pm-value">{promptStep.assembly.family} · {promptStep.assembly.style} · {promptStep.assembly.target}</span>
                    </div>
                    {promptStep.assembly.promptStrategy && (
                      <div className="pm-row pm-row-block">
                        <span className="pm-key">Prompt strategy</span>
                        <div className="pm-score-list" role="list" aria-label={`Prompt strategy ${promptStep.assembly.promptStrategy.id}; source-backed metadata is advisory prompt-contract evidence, not an automatic routing override`}>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Strategy</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.id}</span>
                          </div>
                          {promptStep.assembly.promptStrategy.modelMatch && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Model match</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.modelMatch.source} · {promptStep.assembly.promptStrategy.modelMatch.hint}</span>
                            </div>
                          )}
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Style</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.systemStyle}</span>
                          </div>
                          {promptStep.assembly.promptStrategy.variantId && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Variant</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.variantId}</span>
                            </div>
                          )}
                          {promptStep.assembly.promptStrategy.taskType && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Task type</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.taskType}</span>
                            </div>
                          )}
                          {promptStep.assembly.promptStrategy.role && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Role</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.role}</span>
                            </div>
                          )}
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Context</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.contextOrder}</span>
                          </div>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Examples</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.examplePolicy}</span>
                          </div>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Reasoning</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.reasoningPolicy}</span>
                          </div>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Tools</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.toolPolicy}</span>
                          </div>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Output</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.outputContract}</span>
                          </div>
                          {promptStep.assembly.promptStrategy.selectionReason && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Why</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.selectionReason}</span>
                            </div>
                          )}
                          {promptStep.assembly.promptStrategy.bestPractice && (
                            <>
                              <div className="pm-score-row" role="listitem">
                                <span className="pm-score-model">Provenance use</span>
                                <span className="pm-score-value">Advisory prompt-contract evidence, not an automatic routing override</span>
                              </div>
                              <div className="pm-score-row" role="listitem">
                                <span className="pm-score-model">Best practice</span>
                                <span className="pm-score-value">{promptStep.assembly.promptStrategy.bestPractice.guidance}</span>
                              </div>
                              <div className="pm-score-row" role="listitem">
                                <span className="pm-score-model">Eval cue</span>
                                <span className="pm-score-value">{promptStep.assembly.promptStrategy.bestPractice.evaluationCue}</span>
                              </div>
                              <div className="pm-score-row" role="listitem">
                                <span className="pm-score-model">Source</span>
                                <span className="pm-score-value">{promptStep.assembly.promptStrategy.bestPractice.sourceRef}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="pm-row">
                      <span className="pm-key">Assembly sections</span>
                      <span className="pm-value">{promptStep.assembly.sections.length} · {promptStep.assembly.totalTokenEstimate} estimated tokens</span>
                    </div>
                    {promptPluginSections.length > 0 && (
                      <div className="pm-row pm-row-block">
                        <span className="pm-key">Prompt plugins</span>
                        <div className="pm-score-list" role="list" aria-label={`${promptPluginSections.length} prompt plugin section${promptPluginSections.length === 1 ? '' : 's'} injected into this prompt`}>
                          {promptPluginSections.map((section) => (
                            <div className="pm-score-row" key={section.id} role="listitem">
                              <span className="pm-score-model">{section.pluginId}</span>
                              <span className="pm-score-value">{section.placement || section.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {promptStep.assembly.outputStyle && (
                      <div className="pm-row">
                        <span className="pm-key">Output style</span>
                        <span className="pm-value">{promptStep.assembly.outputStyle.label} · {promptStep.assembly.outputStyle.id}</span>
                      </div>
                    )}
                  </>
                )}
                {promptBuiltPreview && (
                  <div className="pm-row pm-row-block">
                    <span className="pm-key">System prompt preview</span>
                    <pre className="pm-pre">{promptBuiltPreview}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {resultSummary && (
            <div className="pm-section" role="group" aria-label={`Run result: final answer ${resultSummary.finalAnswerChars} chars, model output ${resultSummary.modelTextChars} chars across ${resultSummary.modelTextChunkCount} chunk${resultSummary.modelTextChunkCount === 1 ? '' : 's'}`}>
              <div className="pm-section-header">
                <MessageSquare size={12} aria-hidden="true" />
                <span>Run result</span>
              </div>
              <div className="pm-section-body" role="list" aria-label="Run result evidence">
                <div className="pm-row" role="listitem">
                  <span className="pm-key">Final answer chars</span>
                  <span className="pm-value">{resultSummary.finalAnswerChars}</span>
                </div>
                <div className="pm-row" role="listitem">
                  <span className="pm-key">Model output chars</span>
                  <span className="pm-value">{resultSummary.modelTextChars}</span>
                </div>
                <div className="pm-row" role="listitem">
                  <span className="pm-key">Model output chunks</span>
                  <span className="pm-value">{resultSummary.modelTextChunkCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* Model requests */}
          {modelRequests.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-header">
                <Cpu size={12} />
                <span>Model Requests ({modelRequests.length})</span>
              </div>
              <div className="pm-section-body">
                {modelRequests.map((req, i) => (
                  <div key={i} className="pm-row">
                    <span className="pm-key">Round {req.round}</span>
                    <span className="pm-value">
                      {[req.model, formatModelRequestTimeoutDetail(req), formatModelRequestPatienceDetail(req), formatModelRequestDurationDetail(req)].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool calls summary */}
          {toolCalls.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-header">
                <Wrench size={12} />
                <span>Tool Calls ({toolCalls.length})</span>
              </div>
              <div className="pm-section-body">
                {toolCalls.map((tc, i) => (
                  <div key={i} className="pm-row">
                    <span className="pm-key">{tc.name}</span>
                    <span className="pm-value">
                      {tc.durationMs != null ? `${tc.durationMs}ms` : 'running…'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {errorSteps.length > 0 && (
            <div className="pm-section pm-section-error">
              <div className="pm-section-header">
                <AlertTriangle size={12} style={{ color: '#ef4444' }} />
                <span>Errors ({errorSteps.length})</span>
              </div>
              <div className="pm-section-body">
                {errorSteps.map((err, i) => (
                  <div key={i} className="pm-error-msg">{err.message}</div>
                ))}
              </div>
            </div>
          )}

          {/* Run metadata */}
          <div className="pm-section">
              <div className="pm-section-body pm-meta">
                <div className="pm-row">
                  <span className="pm-key">Debug bundle</span>
                <button
                  className="pm-action-btn"
                  type="button"
                  onClick={handleExportDebugBundle}
                  disabled={exportState === 'exporting'}
                  title="Export this run's replay, prompts, routing, artifacts, and proof bundle"
                  aria-label={`Export this run's replay, prompts, routing, artifacts, and proof bundle for run ${runTrace.id.slice(0, 8)}`}
                >
                  <Download size={12} aria-hidden="true" />
                  <span>{exportButtonLabel}</span>
                </button>
                </div>
              {exportManifestHint && (
                <div className="pm-row">
                  <span className="pm-key">Bundle contents</span>
                  <span className="pm-value">{exportManifestHint}</span>
                </div>
              )}
              <div className="pm-row">
                <span className="pm-key">Run ID</span>
                <span className="pm-value pm-mono">{runTrace.id.slice(0, 8)}</span>
              </div>
              <div className="pm-row">
                <span className="pm-key">Requested model</span>
                <span className="pm-value">{runTrace.requestedModel}</span>
              </div>
              <div className="pm-row">
                <span className="pm-key">Effective model</span>
                <span className="pm-value">{runTrace.effectiveModel}</span>
              </div>
              <div className="pm-row">
                <span className="pm-key">Provider</span>
                <span className="pm-value">{runTrace.providerId}</span>
              </div>
              {modelRequestTimeoutDetail && (
                <div className="pm-row">
                  <span className="pm-key">Request timeout</span>
                  <span className="pm-value">{modelRequestTimeoutDetail}</span>
                </div>
              )}
              {worktreeIsolation && (
                <div className="pm-row">
                  <span className="pm-key">Worktree isolation</span>
                  <span className="pm-value">
                    {worktreeIsolation.status === 'ready'
                      ? `ready · ${worktreeIsolation.worktreeId || worktreeIsolation.branch || worktreeIsolation.path || worktreeIsolation.agent} · Safety > Worktrees`
                      : worktreeIsolation.status === 'preserved'
                        ? `preserved · ${worktreeIsolation.worktreeId || worktreeIsolation.branch || worktreeIsolation.path || worktreeIsolation.agent} · Safety > Worktrees`
                      : worktreeIsolation.status === 'auto_discarded'
                        ? `auto-discarded · ${worktreeIsolation.worktreeId || worktreeIsolation.branch || worktreeIsolation.path || worktreeIsolation.agent}`
                      : `${worktreeIsolation.status} · ${worktreeIsolation.error || worktreeIsolation.reason}`}
                  </span>
                </div>
              )}
              <div className="pm-row">
                <span className="pm-key">Tokens used</span>
                <span className="pm-value">{runTrace.context.tokensUsed || '—'}</span>
              </div>
              {runTrace.context.compressedCount > 0 && (
                <div className="pm-row">
                  <span className="pm-key">Context compressed</span>
                  <span className="pm-value" style={{ color: '#f59e0b' }}>{runTrace.context.compressedCount} time(s)</span>
                </div>
              )}
              {runTrace.completedAt && (
                <div className="pm-row">
                  <span className="pm-key">Duration</span>
                  <span className="pm-value">
                    {((new Date(runTrace.completedAt).getTime() - new Date(runTrace.startedAt).getTime()) / 1000).toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
