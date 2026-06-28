import type { EvalResult, PromptStrategyTrace } from './api';

export interface ModelLabEvidenceScope {
  id: string;
  decisionId?: string;
  label: string;
  resultFilter: string;
  modelId: string;
  promptStrategyId: string;
  promptStrategyVariantId?: string;
}

interface RoutingDecisionEvidenceSource {
  id?: string;
  selectedModel: string;
  promptStrategyId?: string;
  promptStrategyVariantId?: string;
  promptStrategyFamily?: string;
  promptStrategyStyle?: string;
}

interface ModelLabEvidenceGateSource {
  selectedModel?: string;
  promptStrategyId?: string;
}

const MODEL_LAB_EVIDENCE_SAMPLE_LIMIT = 2;
const MODEL_LAB_EVIDENCE_SAMPLE_LABEL_MAX_LENGTH = 80;

export interface ModelLabEvidenceGate {
  enabled: boolean;
  reason: string | null;
  strategyLabel: string;
}

function compactParts(parts: Array<string | number | boolean | null | undefined>): string {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').join(' ');
}

function uniqueSearchTerms(parts: Array<string | null | undefined>): string[] {
  const terms = new Set<string>();
  for (const part of parts) {
    const term = part?.trim();
    if (term) terms.add(term);
  }
  return [...terms];
}

export function getModelLabEvidenceGate(source: ModelLabEvidenceGateSource, promptStrategyIds: Set<string>): ModelLabEvidenceGate {
  const modelId = source.selectedModel?.trim() || '';
  const promptStrategyId = source.promptStrategyId?.trim() || '';
  const strategyLabel = promptStrategyId || 'none';
  if (!modelId) {
    return {
      enabled: false,
      reason: 'Select a model before opening Model Lab evidence.',
      strategyLabel,
    };
  }
  if (!promptStrategyId) {
    return {
      enabled: false,
      reason: 'No prompt-strategy provenance for this route.',
      strategyLabel,
    };
  }
  if (!promptStrategyIds.has(promptStrategyId)) {
    return {
      enabled: false,
      reason: `Prompt strategy ${promptStrategyId} is not in the loaded Model Lab registry.`,
      strategyLabel,
    };
  }
  return {
    enabled: true,
    reason: null,
    strategyLabel,
  };
}

export function routingDecisionToModelLabEvidenceScope(decision: RoutingDecisionEvidenceSource): ModelLabEvidenceScope {
  const modelId = decision.selectedModel.trim();
  if (!modelId) {
    throw new Error('Cannot open Model Lab evidence without a selected model.');
  }
  const promptStrategyId = decision.promptStrategyId?.trim();
  if (!promptStrategyId) {
    throw new Error('Cannot open Model Lab evidence without prompt-strategy provenance.');
  }

  const resultFilter = uniqueSearchTerms([
    modelId,
    promptStrategyId,
    decision.promptStrategyVariantId,
    decision.promptStrategyFamily,
    decision.promptStrategyStyle,
  ]).join(' ');

  if (!resultFilter) {
    throw new Error('Cannot open Model Lab evidence without searchable result terms.');
  }

  return {
    id: decision.id ? `routing-decision:${decision.id}` : `routing-decision:${modelId}`,
    decisionId: decision.id,
    label: `Model Lab evidence for ${modelId}`,
    resultFilter,
    modelId,
    promptStrategyId,
    promptStrategyVariantId: decision.promptStrategyVariantId,
  };
}

function isModelLabEvidenceScope(value: string | ModelLabEvidenceScope): value is ModelLabEvidenceScope {
  return typeof value !== 'string';
}

function promptStrategySearchText(strategy?: PromptStrategyTrace): string {
  if (!strategy) return '';
  return compactParts([
    strategy.id,
    strategy.family,
    strategy.modelMatch?.source,
    strategy.modelMatch?.hint,
    strategy.systemStyle,
    strategy.contextOrder,
    strategy.examplePolicy,
    strategy.reasoningPolicy,
    strategy.toolPolicy,
    strategy.outputContract,
    strategy.variantId,
    strategy.role,
    strategy.taskType,
    strategy.selectionReason,
    strategy.bestPractice?.guidance,
    strategy.bestPractice?.rationale,
    strategy.bestPractice?.evaluationCue,
    strategy.bestPractice?.sourceRef,
    strategy.updatedAt,
  ]);
}

function resultSearchText(result: EvalResult): string {
  const weakestSignal = result.scores.breakdown?.weakestSignal;
  return compactParts([
    result.modelId,
    result.promptId,
    result.promptName,
    result.status,
    result.response,
    result.responseLength,
    result.toolCallCount,
    result.wallMs,
    result.scores.overallScore,
    result.scores.usedTools ? 'used-tools' : 'no-tools',
    result.scores.answeredUser ? 'answered-user' : 'missing-answer',
    result.scores.referencedRealFiles ? 'real-files' : 'no-real-files',
    result.scores.avoidedHallucinatedPaths ? 'avoided-hallucinated-paths' : 'hallucinated-paths',
    result.scores.producedSummary ? 'summary' : 'no-summary',
    result.scores.validationPassed ? 'validation-pass' : 'validation-fail',
    result.scores.validationScore,
    weakestSignal?.id,
    weakestSignal?.label,
    weakestSignal?.category,
    weakestSignal?.passed ? 'weakest-passed' : 'weakest-failed',
    weakestSignal?.score,
    weakestSignal?.maxScore,
    result.scores.breakdown?.signals.map((signal) => compactParts([
      signal.id,
      signal.label,
      signal.category,
      signal.passed ? 'passed' : 'failed',
      signal.score,
      signal.maxScore,
    ])).join(' '),
    result.toolCalls.map((tool) => `${tool.name} ${tool.status}`).join(' '),
    promptStrategySearchText(result.promptStrategy),
  ]).toLowerCase();
}

function resultPriority(result: EvalResult): number {
  if (result.status !== 'ok') return 0;
  if (result.scores.breakdown?.weakestSignal?.passed === false) return 1;
  return 2;
}

interface IndexedModelLabResult<T extends EvalResult> {
  result: T;
  index: number;
  priority: number;
  searchText?: string;
}

export interface ModelLabResultIndexOptions<T extends EvalResult> {
  getSearchText?: (result: T) => string;
}

export interface ModelLabResultWindow<T extends EvalResult> {
  rows: T[];
  matchCount: number;
}

export interface ModelLabResultIndex<T extends EvalResult> {
  getVisibleResultWindow(maxItems: number, query: string | ModelLabEvidenceScope): ModelLabResultWindow<T>;
  getVisibleResults(maxItems: number, query: string | ModelLabEvidenceScope): T[];
}

export type ModelLabEvidenceSummaryStatus = 'matched' | 'no-match' | 'no-report';

export interface ModelLabEvidenceReportSource<T extends EvalResult = EvalResult> {
  id: string;
  name: string;
  status?: string;
  createdAt?: string;
  completedAt?: string;
  results: readonly T[];
}

export interface ModelLabEvidenceSummary {
  status: ModelLabEvidenceSummaryStatus;
  modelId: string;
  promptStrategyId: string;
  reportId: string | null;
  reportName: string | null;
  matchCount: number;
  totalRows: number;
}

export interface ModelLabEvidenceReportMatch {
  reportId: string;
  reportName: string;
  reportStatus?: string;
  createdAt?: string;
  completedAt?: string;
  matchCount: number;
  totalRows: number;
  samplePromptLabels?: string[];
  sampleOverflowCount?: number;
}

export interface ModelLabEvidenceReportMatchOptions {
  maxMatches?: number;
  excludeReportId?: string | null;
  candidateReportCount?: number;
  failedReportCount?: number;
  stoppedAtMatchLimit?: boolean;
}

export type ModelLabEvidenceReportStatusTone = 'success' | 'warning' | 'error' | 'neutral';

export interface ModelLabEvidenceReportMatchDisplay {
  statusLabel: string;
  statusTone: ModelLabEvidenceReportStatusTone;
  timestampLabel: string;
  suffixLabel: string;
  sampleLabel: string | null;
  accessibleLabel: string;
}

export interface ModelLabEvidenceSearchDiagnostics {
  checkedReportCount: number;
  candidateReportCount?: number;
  failedReportCount?: number;
  exactReportCount: number;
  modelOnlyReportCount: number;
  strategyOnlyReportCount: number;
  splitReportCount: number;
  neitherReportCount: number;
  stoppedAtMatchLimit?: boolean;
}

export interface ModelLabEvidenceSearchDiagnosticsDisplay {
  coverageLabel: string | null;
  summaryLabel: string | null;
  warningLabel: string | null;
  accessibleLabel: string | null;
}

export interface ModelLabEvidenceReportSearchSummary {
  matches: ModelLabEvidenceReportMatch[];
  diagnostics: ModelLabEvidenceSearchDiagnostics;
}

export function createModelLabResultIndex<T extends EvalResult>(
  results: readonly T[],
  options: ModelLabResultIndexOptions<T> = {},
): ModelLabResultIndex<T> {
  const getSearchText = options.getSearchText || resultSearchText;
  // Snapshot row membership here. Rebuild the index when source results change;
  // filter and evidence-scope changes can reuse this instance's lazy search cache.
  const indexedResults = results.map<IndexedModelLabResult<T>>((result, index) => ({
    result,
    index,
    priority: resultPriority(result),
  }));

  const getVisibleResultWindow = (
    maxItems: number,
    query: string | ModelLabEvidenceScope,
  ): ModelLabResultWindow<T> => {
    let filtered: readonly IndexedModelLabResult<T>[];
    if (isModelLabEvidenceScope(query)) {
      filtered = indexedResults.filter((item) => (
        item.result.modelId === query.modelId
        && item.result.promptStrategy?.id === query.promptStrategyId
      ));
    } else {
      const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      filtered = terms.length === 0
        ? indexedResults
        : indexedResults.filter((item) => {
          item.searchText ??= getSearchText(item.result).toLowerCase();
          const searchText = item.searchText;
          return terms.every((term) => searchText.includes(term));
        });
    }

    const rows = maxItems <= 0
      ? []
      : [...filtered]
        .sort((a, b) => a.priority - b.priority || a.index - b.index)
        .slice(0, maxItems)
        .map((item) => item.result);

    return {
      rows,
      matchCount: filtered.length,
    };
  };

  return {
    getVisibleResultWindow,
    getVisibleResults(maxItems: number, query: string | ModelLabEvidenceScope): T[] {
      return getVisibleResultWindow(maxItems, query).rows;
    },
  };
}

function formatDateLabel(raw?: string): string | null {
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function reportStatusDisplay(status?: string): { label: string; tone: ModelLabEvidenceReportStatusTone; terminal: boolean } {
  switch ((status || '').toLowerCase()) {
    case 'complete':
      return { label: 'Complete', tone: 'success', terminal: true };
    case 'running':
      return { label: 'Running', tone: 'warning', terminal: false };
    case 'error':
      return { label: 'Error', tone: 'error', terminal: true };
    default:
      return { label: 'Status unknown', tone: 'neutral', terminal: false };
  }
}

function reportTimestamp(report: ModelLabEvidenceReportSource): number {
  const parsed = Date.parse(report.completedAt || report.createdAt || '');
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function emptyEvidenceSearchDiagnostics(): ModelLabEvidenceSearchDiagnostics {
  return {
    checkedReportCount: 0,
    exactReportCount: 0,
    modelOnlyReportCount: 0,
    strategyOnlyReportCount: 0,
    splitReportCount: 0,
    neitherReportCount: 0,
  };
}

type EvidenceReportBucket = 'exact' | 'model-only' | 'strategy-only' | 'split' | 'neither';

function classifyEvidenceReport<T extends EvalResult>(
  scope: ModelLabEvidenceScope,
  report: ModelLabEvidenceReportSource<T>,
): { bucket: EvidenceReportBucket; matchedResults: T[] } {
  const matchedResults = createModelLabResultIndex(report.results).getVisibleResults(Number.MAX_SAFE_INTEGER, scope);
  if (matchedResults.length > 0) return { bucket: 'exact', matchedResults };

  let hasModel = false;
  let hasStrategy = false;
  for (const result of report.results) {
    if (result.modelId === scope.modelId) hasModel = true;
    if (result.promptStrategy?.id === scope.promptStrategyId) hasStrategy = true;
    if (hasModel && hasStrategy) return { bucket: 'split', matchedResults };
  }
  if (hasModel) return { bucket: 'model-only', matchedResults };
  if (hasStrategy) return { bucket: 'strategy-only', matchedResults };
  return { bucket: 'neither', matchedResults };
}

function incrementEvidenceSearchDiagnostics(diagnostics: ModelLabEvidenceSearchDiagnostics, bucket: EvidenceReportBucket): void {
  diagnostics.checkedReportCount += 1;
  if (bucket === 'exact') diagnostics.exactReportCount += 1;
  if (bucket === 'model-only') diagnostics.modelOnlyReportCount += 1;
  if (bucket === 'strategy-only') diagnostics.strategyOnlyReportCount += 1;
  if (bucket === 'split') diagnostics.splitReportCount += 1;
  if (bucket === 'neither') diagnostics.neitherReportCount += 1;
}

function evidenceSampleLabel(result: EvalResult): string {
  return result.promptName.trim() || result.promptId.trim();
}

function collectEvidenceSamples<T extends EvalResult>(results: readonly T[]): Pick<ModelLabEvidenceReportMatch, 'samplePromptLabels' | 'sampleOverflowCount'> {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const label = evidenceSampleLabel(result);
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (labels.length < MODEL_LAB_EVIDENCE_SAMPLE_LIMIT) {
      labels.push(label);
    }
  }

  return {
    samplePromptLabels: labels,
    sampleOverflowCount: Math.max(0, results.length - labels.length),
  };
}

function formatSampleText(rawLabel: string): string {
  const label = rawLabel.replace(/\s+/g, ' ').trim();
  if (label.length <= MODEL_LAB_EVIDENCE_SAMPLE_LABEL_MAX_LENGTH) return label;
  return `${label.slice(0, MODEL_LAB_EVIDENCE_SAMPLE_LABEL_MAX_LENGTH - 3).trimEnd()}...`;
}

function formatEvidenceSample(match: ModelLabEvidenceReportMatch): { sampleLabel: string | null; accessiblePart: string | null } {
  const sampleLabels = (match.samplePromptLabels || [])
    .map(formatSampleText)
    .filter(Boolean)
    .slice(0, MODEL_LAB_EVIDENCE_SAMPLE_LIMIT);
  if (sampleLabels.length === 0) return { sampleLabel: null, accessiblePart: null };

  const joinedSamples = sampleLabels.join('; ');
  const overflowCount = match.sampleOverflowCount ?? Math.max(0, match.matchCount - sampleLabels.length);
  if (overflowCount <= 0) {
    return {
      sampleLabel: `Sample matches: ${joinedSamples}`,
      accessiblePart: `sample matches ${joinedSamples}`,
    };
  }

  const rowNoun = overflowCount === 1 ? 'row' : 'rows';
  return {
    sampleLabel: `Sample matches: ${joinedSamples} (+${overflowCount} more)`,
    accessiblePart: `sample matches ${joinedSamples}, plus ${overflowCount} more exact ${rowNoun}`,
  };
}

export function summarizeModelLabEvidenceScope<T extends EvalResult>(
  scope: ModelLabEvidenceScope,
  report: ModelLabEvidenceReportSource<T> | null,
  resultIndex?: ModelLabResultIndex<T> | null,
): ModelLabEvidenceSummary {
  if (!report) {
    return {
      status: 'no-report',
      modelId: scope.modelId,
      promptStrategyId: scope.promptStrategyId,
      reportId: null,
      reportName: null,
      matchCount: 0,
      totalRows: 0,
    };
  }

  const index = resultIndex || createModelLabResultIndex(report.results);
  const matchCount = index.getVisibleResults(Number.MAX_SAFE_INTEGER, scope).length;
  return {
    status: matchCount > 0 ? 'matched' : 'no-match',
    modelId: scope.modelId,
    promptStrategyId: scope.promptStrategyId,
    reportId: report.id,
    reportName: report.name,
    matchCount,
    totalRows: report.results.length,
  };
}

export function findModelLabEvidenceReportMatches<T extends EvalResult>(
  scope: ModelLabEvidenceScope,
  reports: readonly ModelLabEvidenceReportSource<T>[],
  options: ModelLabEvidenceReportMatchOptions = {},
): ModelLabEvidenceReportMatch[] {
  return summarizeModelLabEvidenceReportSearch(scope, reports, options).matches;
}

export function summarizeModelLabEvidenceReportSearch<T extends EvalResult>(
  scope: ModelLabEvidenceScope,
  reports: readonly ModelLabEvidenceReportSource<T>[],
  options: ModelLabEvidenceReportMatchOptions = {},
): ModelLabEvidenceReportSearchSummary {
  const maxMatches = options.maxMatches ?? reports.length;
  const diagnostics: ModelLabEvidenceSearchDiagnostics = {
    ...emptyEvidenceSearchDiagnostics(),
    ...(options.candidateReportCount !== undefined ? { candidateReportCount: options.candidateReportCount } : {}),
    ...(options.failedReportCount !== undefined ? { failedReportCount: options.failedReportCount } : {}),
    ...(options.stoppedAtMatchLimit !== undefined ? { stoppedAtMatchLimit: options.stoppedAtMatchLimit } : {}),
  };
  const classifiedReports = reports
    .filter((report) => report.id !== options.excludeReportId)
    .map((report) => {
      const classified = classifyEvidenceReport(scope, report);
      incrementEvidenceSearchDiagnostics(diagnostics, classified.bucket);
      return {
        report,
        ...classified,
      };
    });

  const matches = maxMatches <= 0 ? [] : classifiedReports
    .filter(({ matchedResults }) => matchedResults.length > 0)
    .sort((a, b) => {
      const timeDelta = reportTimestamp(b.report) - reportTimestamp(a.report);
      if (timeDelta !== 0) return timeDelta;
      const idDelta = b.report.id.localeCompare(a.report.id);
      if (idDelta !== 0) return idDelta;
      return b.report.name.localeCompare(a.report.name);
    })
    .slice(0, maxMatches)
    .map(({ report, matchedResults }) => ({
      reportId: report.id,
      reportName: report.name,
      reportStatus: report.status,
      createdAt: report.createdAt,
      completedAt: report.completedAt,
      matchCount: matchedResults.length,
      totalRows: report.results.length,
      ...collectEvidenceSamples(matchedResults),
    }));

  return { matches, diagnostics };
}

function reportNoun(count: number): string {
  return count === 1 ? 'report' : 'reports';
}

function matchReportNoun(count: number): string {
  return count === 1 ? 'matching report' : 'matching reports';
}

function joinAccessibleParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] || '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function formatModelLabEvidenceSearchDiagnostics(
  diagnostics: ModelLabEvidenceSearchDiagnostics,
  source: Pick<ModelLabEvidenceScope, 'modelId' | 'promptStrategyId'>,
): ModelLabEvidenceSearchDiagnosticsDisplay {
  if (diagnostics.checkedReportCount <= 0) {
    return { coverageLabel: null, summaryLabel: null, warningLabel: null, accessibleLabel: null };
  }

  const candidateReportCount = diagnostics.candidateReportCount;
  const failedReportCount = diagnostics.failedReportCount ?? 0;
  const shouldShowCoverage = candidateReportCount !== undefined
    && (
      candidateReportCount !== diagnostics.checkedReportCount
      || failedReportCount > 0
      || diagnostics.stoppedAtMatchLimit === true
    );
  const coverageLabel = shouldShowCoverage
    ? [
      `Checked ${diagnostics.checkedReportCount} of ${candidateReportCount} recent ${reportNoun(candidateReportCount)}`,
      diagnostics.stoppedAtMatchLimit && diagnostics.exactReportCount > 0
        ? `showing first ${diagnostics.exactReportCount} ${matchReportNoun(diagnostics.exactReportCount)}`
        : null,
    ].filter(Boolean).join('; ') + '.'
    : null;
  const warningLabel = failedReportCount > 0
    ? `${failedReportCount} ${reportNoun(failedReportCount)} could not be loaded.`
    : null;

  const summaryParts = [
    diagnostics.exactReportCount > 0 ? `${diagnostics.exactReportCount} exact` : null,
    diagnostics.modelOnlyReportCount > 0 ? `${diagnostics.modelOnlyReportCount} with ${source.modelId} on other strategies` : null,
    diagnostics.strategyOnlyReportCount > 0 ? `${diagnostics.strategyOnlyReportCount} with ${source.promptStrategyId} on other models` : null,
    diagnostics.splitReportCount > 0 ? `${diagnostics.splitReportCount} split across rows` : null,
    diagnostics.neitherReportCount > 0 ? `${diagnostics.neitherReportCount} with neither` : null,
  ].filter((part): part is string => Boolean(part));

  const accessibleParts = [
    diagnostics.exactReportCount > 0 ? `${diagnostics.exactReportCount} exact ${reportNoun(diagnostics.exactReportCount)}` : null,
    diagnostics.modelOnlyReportCount > 0 ? `${diagnostics.modelOnlyReportCount} ${reportNoun(diagnostics.modelOnlyReportCount)} with ${source.modelId} on other prompt strategies` : null,
    diagnostics.strategyOnlyReportCount > 0 ? `${diagnostics.strategyOnlyReportCount} ${reportNoun(diagnostics.strategyOnlyReportCount)} with ${source.promptStrategyId} on other models` : null,
    diagnostics.splitReportCount > 0 ? `${diagnostics.splitReportCount} ${reportNoun(diagnostics.splitReportCount)} with model and strategy split across rows` : null,
    diagnostics.neitherReportCount > 0 ? `${diagnostics.neitherReportCount} ${reportNoun(diagnostics.neitherReportCount)} with neither` : null,
  ].filter((part): part is string => Boolean(part));

  const coverageAccessible = coverageLabel && candidateReportCount !== undefined
    ? `Recent evidence search checked ${diagnostics.checkedReportCount} of ${candidateReportCount} reports${diagnostics.stoppedAtMatchLimit && diagnostics.exactReportCount > 0 ? ` and is showing the first ${diagnostics.exactReportCount} ${matchReportNoun(diagnostics.exactReportCount)}` : ''}. `
    : `Recent evidence search checked ${diagnostics.checkedReportCount} ${reportNoun(diagnostics.checkedReportCount)}: `;
  const warningAccessible = warningLabel ? `${warningLabel} ` : '';
  const bucketPrefix = coverageLabel ? 'Buckets: ' : '';

  return {
    coverageLabel,
    summaryLabel: `Checked ${diagnostics.checkedReportCount} recent ${reportNoun(diagnostics.checkedReportCount)}: ${summaryParts.join(', ')}.`,
    warningLabel,
    accessibleLabel: `${coverageAccessible}${warningAccessible}${bucketPrefix}${joinAccessibleParts(accessibleParts)}.`,
  };
}

export function formatModelLabEvidenceReportMatch(match: ModelLabEvidenceReportMatch): ModelLabEvidenceReportMatchDisplay {
  const status = reportStatusDisplay(match.reportStatus);
  const timestampSource = status.terminal ? (match.completedAt || match.createdAt) : match.createdAt;
  const timestampKind = status.terminal && match.completedAt ? 'Completed' : 'Started';
  const timestampValue = formatDateLabel(timestampSource);
  const timestampLabel = timestampValue ? `${timestampKind} ${timestampValue}` : 'Time unknown';
  const matchNoun = match.matchCount === 1 ? 'match' : 'matches';
  const rowNoun = match.totalRows === 1 ? 'row' : 'rows';
  const sample = formatEvidenceSample(match);
  const sampleAccessiblePart = sample.accessiblePart ? `, ${sample.accessiblePart}` : '';
  return {
    statusLabel: status.label,
    statusTone: status.tone,
    timestampLabel,
    suffixLabel: `${status.label} · ${timestampLabel}`,
    sampleLabel: sample.sampleLabel,
    accessibleLabel: `Open matching report ${match.reportName}, ${status.label}, ${timestampLabel}, ${match.matchCount} exact ${matchNoun} of ${match.totalRows} ${rowNoun}${sampleAccessiblePart}`,
  };
}

export function getVisibleModelLabResults<T extends EvalResult>(
  results: readonly T[],
  maxItems: number,
  query: string | ModelLabEvidenceScope,
): T[] {
  return createModelLabResultIndex(results).getVisibleResults(maxItems, query);
}
