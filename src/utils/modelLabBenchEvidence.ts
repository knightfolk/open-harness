import type { BenchRunResult, PromptStrategyTrace } from './api';

export type BenchResultStatusFilter =
  | 'all'
  | 'attention'
  | 'resolved'
  | 'assisted'
  | 'partial'
  | 'unresolved'
  | 'error'
  | 'timeout'
  | 'validation-failed';

function compactParts(parts: Array<string | number | boolean | null | undefined>): string {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').join(' ');
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

function benchResultSearchText(result: BenchRunResult): string {
  const weakestSignal = result.scores.breakdown?.weakestSignal;
  return compactParts([
    result.taskId,
    result.taskName,
    result.modelId,
    result.providerId,
    result.status,
    result.error,
    result.prompt,
    result.response,
    result.responseLength,
    result.validationPassed ? 'validation-pass' : 'validation-fail',
    result.wallMs,
    result.scores.resolvedStatus,
    result.scores.overallScore,
    result.scores.validationScore,
    result.scores.styleScore,
    result.scores.stepCount,
    result.scores.tokenCount,
    result.scores.costEstimate,
    result.scores.assistedByFallback ? 'assisted-fallback' : '',
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
    result.scores.rubricCoverage?.items.map((item) => compactParts([
      item.id,
      item.points,
      item.passed ? 'rubric-passed' : 'rubric-failed',
      item.evidence,
    ])).join(' '),
    result.toolCalls.map((tool) => `${tool.name} ${tool.status}`).join(' '),
    result.validationResults.map((validation) => compactParts([
      validation.command,
      validation.exitCode,
      validation.stdout,
      validation.stderr,
      validation.findings.join(' '),
      validation.passed ? 'validation-passed' : 'validation-failed',
    ])).join(' '),
    result.traceProof?.mode,
    result.traceProof?.role,
    result.traceProof?.complexity,
    result.traceProof?.routeSource,
    result.traceProof?.selectedModel,
    result.traceProof?.providerId,
    result.traceProof?.summary,
    result.traceProof?.warnings.join(' '),
    promptStrategySearchText(result.promptStrategy),
  ]).toLowerCase();
}

function needsAttention(result: BenchRunResult): boolean {
  return result.status !== 'ok' || !result.validationPassed || result.scores.resolvedStatus !== 'resolved';
}

function matchesStatusFilter(result: BenchRunResult, statusFilter: BenchResultStatusFilter): boolean {
  if (statusFilter === 'all') return true;
  if (statusFilter === 'attention') return needsAttention(result);
  if (statusFilter === 'resolved') {
    return result.status === 'ok' && result.validationPassed && result.scores.resolvedStatus === 'resolved';
  }
  if (statusFilter === 'error' || statusFilter === 'timeout' || statusFilter === 'validation-failed') {
    return result.status === statusFilter;
  }
  return result.scores.resolvedStatus === statusFilter;
}

function benchResultPriority(result: BenchRunResult): number {
  if (result.status !== 'ok') return 0;
  if (!result.validationPassed || result.scores.breakdown?.weakestSignal?.passed === false) return 1;
  if (result.scores.resolvedStatus !== 'resolved') return 2;
  return 3;
}

interface IndexedModelLabBenchResult<T extends BenchRunResult> {
  result: T;
  index: number;
  priority: number;
  searchText?: string;
}

export interface ModelLabBenchResultIndexOptions<T extends BenchRunResult> {
  getSearchText?: (result: T) => string;
}

export interface ModelLabBenchResultWindow<T extends BenchRunResult> {
  rows: T[];
  matchCount: number;
}

export interface ModelLabBenchResultIndex<T extends BenchRunResult> {
  getVisibleResultWindow(maxItems: number, query: string, statusFilter: BenchResultStatusFilter): ModelLabBenchResultWindow<T>;
  getVisibleResults(maxItems: number, query: string, statusFilter: BenchResultStatusFilter): T[];
}

export function createModelLabBenchResultIndex<T extends BenchRunResult>(
  results: readonly T[],
  options: ModelLabBenchResultIndexOptions<T> = {},
): ModelLabBenchResultIndex<T> {
  const getSearchText = options.getSearchText || benchResultSearchText;
  const indexedResults = results.map<IndexedModelLabBenchResult<T>>((result, index) => ({
    result,
    index,
    priority: benchResultPriority(result),
  }));

  const getVisibleResultWindow = (
    maxItems: number,
    query: string,
    statusFilter: BenchResultStatusFilter,
  ): ModelLabBenchResultWindow<T> => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = indexedResults.filter((item) => {
      if (!matchesStatusFilter(item.result, statusFilter)) return false;
      if (terms.length === 0) return true;
      item.searchText ??= getSearchText(item.result).toLowerCase();
      const searchText = item.searchText;
      return terms.every((term) => searchText.includes(term));
    });

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
    getVisibleResults(maxItems: number, query: string, statusFilter: BenchResultStatusFilter): T[] {
      return getVisibleResultWindow(maxItems, query, statusFilter).rows;
    },
  };
}

export function getVisibleModelLabBenchResults<T extends BenchRunResult>(
  results: readonly T[],
  maxItems: number,
  query: string,
  statusFilter: BenchResultStatusFilter,
): T[] {
  if (maxItems <= 0) return [];

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = results.filter((result) => {
    if (!matchesStatusFilter(result, statusFilter)) return false;
    if (terms.length === 0) return true;
    const haystack = benchResultSearchText(result);
    return terms.every((term) => haystack.includes(term));
  });

  return filtered
    .map((result, index) => ({ result, index }))
    .sort((a, b) => benchResultPriority(a.result) - benchResultPriority(b.result) || a.index - b.index)
    .slice(0, maxItems)
    .map((item) => item.result);
}
