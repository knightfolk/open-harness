export interface RouterLearningImportPreview {
  importSource: 'raw-array' | 'events' | 'fullExport.events' | 'recentEvents' | 'none';
  schemaVersion: number | null;
  schemaSupported: boolean;
  warnings: string[];
  events: unknown[];
  toolReliabilityPreview?: RouterLearningToolReliabilityImportPreview;
  promptBestPracticePreview?: RouterLearningPromptBestPracticeImportPreview;
  providerFailureAdherencePreview?: RouterLearningProviderFailureAdherenceImportPreview;
}

export interface RouterLearningToolReliabilityImportPreview {
  evidenceSource: 'imported_trace';
  outcomeExamples: number;
  recoveryExamples: number;
  recoveryPatterns: number;
  failureMemory: number;
  errorSignatures: number;
  retryReductionRecommendations: number;
  evidenceSourceRows: number;
  note: string;
}

export interface RouterLearningPromptBestPracticeImportPreview {
  strategyCount: number;
  bestPracticeNoteCount: number;
  sourceRefs: string[];
  note: string;
}

export interface RouterLearningProviderFailureAdherenceImportPreview {
  evidenceSource: 'provider_failure_adherence';
  contextOnly: true;
  scope: string | null;
  scopeNote: string | null;
  loadedEventCount: number;
  renderedRowCount: number;
  rowCount: number;
  filteredRowCount: number | null;
  appliedStrategyFilter: string | null;
  strategyCount: number;
  rowScope: {
    fullRows: string | null;
    filteredRows: string | null;
  };
  hint: string | null;
  sampleRowLimit: number;
  sampleRowCount: number;
  sampleRowsCapped: boolean;
  sampleSource: 'fullRows' | 'filteredRows';
  sampleRows: unknown[];
  note: string;
}

const PROVIDER_FAILURE_PREVIEW_SAMPLE_ROW_LIMIT = 20;

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function toolReliabilitySummaryFromImport(input: Record<string, any>): Record<string, any> | null {
  const summary = input.fullExport?.summary?.toolReliability
    || input.summary?.toolReliability
    || input.toolReliability;
  return summary && typeof summary === 'object' ? summary : null;
}

function buildToolReliabilityImportPreview(input: Record<string, any>): RouterLearningToolReliabilityImportPreview | undefined {
  const summary = toolReliabilitySummaryFromImport(input);
  if (!summary) return undefined;
  const preview = {
    evidenceSource: 'imported_trace' as const,
    outcomeExamples: arrayLength(summary.outcomeExamples),
    recoveryExamples: arrayLength(summary.recoveryExamples),
    recoveryPatterns: arrayLength(summary.recoveryPatterns),
    failureMemory: arrayLength(summary.failureMemory),
    errorSignatures: arrayLength(summary.errorSignatures),
    retryReductionRecommendations: arrayLength(summary.retryReductionRecommendations),
    evidenceSourceRows: arrayLength(summary.byEvidenceSource),
    note: 'Tool-reliability summaries are previewed as imported_trace evidence and are not merged into local routing learning state by this event import.',
  };
  const totalEvidence = preview.outcomeExamples
    + preview.recoveryExamples
    + preview.recoveryPatterns
    + preview.failureMemory
    + preview.errorSignatures
    + preview.retryReductionRecommendations
    + preview.evidenceSourceRows;
  return totalEvidence > 0 ? preview : undefined;
}

function promptBestPracticesFromImport(input: Record<string, any>): unknown[] {
  const strategies = input.fullExport?.promptStrategyBestPractices
    || input.promptStrategyBestPractices;
  return Array.isArray(strategies) ? strategies : [];
}

function buildPromptBestPracticeImportPreview(input: Record<string, any>): RouterLearningPromptBestPracticeImportPreview | undefined {
  const strategies = promptBestPracticesFromImport(input);
  if (strategies.length === 0) return undefined;
  const sourceRefs = new Set<string>();
  let bestPracticeNoteCount = 0;
  for (const strategy of strategies) {
    if (!strategy || typeof strategy !== 'object') continue;
    const record = strategy as Record<string, any>;
    for (const source of record.sourceRefs || []) {
      if (typeof source === 'string') sourceRefs.add(source);
    }
    const notes = Array.isArray(record.bestPracticeNotes) ? record.bestPracticeNotes : [];
    bestPracticeNoteCount += notes.length;
    for (const note of notes) {
      if (note && typeof note === 'object' && typeof (note as Record<string, any>).sourceRef === 'string') {
        sourceRefs.add((note as Record<string, any>).sourceRef);
      }
    }
  }
  if (bestPracticeNoteCount === 0 && sourceRefs.size === 0) return undefined;
  return {
    strategyCount: strategies.length,
    bestPracticeNoteCount,
    sourceRefs: Array.from(sourceRefs).slice(0, 8),
    note: 'Prompt best-practice metadata is previewed as context-only evidence and is not merged into local prompt strategy profiles by this event import.',
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function providerFailureAdherenceFromImport(input: Record<string, any>): Record<string, any> | null {
  const adherence = input.providerFailureAdherence
    || input.fullExport?.providerFailureAdherence;
  return adherence && typeof adherence === 'object' ? adherence : null;
}

function buildProviderFailureAdherenceImportPreview(input: Record<string, any>): RouterLearningProviderFailureAdherenceImportPreview | undefined {
  const adherence = providerFailureAdherenceFromImport(input);
  if (!adherence) return undefined;
  const rows = Array.isArray(adherence.rows) ? adherence.rows : [];
  const filteredRows = Array.isArray(adherence.filteredRows) ? adherence.filteredRows : null;
  const strategyBreakdown = Array.isArray(adherence.strategyBreakdown) ? adherence.strategyBreakdown : [];
  const source = adherence.source && typeof adherence.source === 'object' ? adherence.source as Record<string, any> : {};
  const summary = adherence.summary && typeof adherence.summary === 'object' ? adherence.summary as Record<string, any> : {};
  const rowScope = adherence.rowScope && typeof adherence.rowScope === 'object' ? adherence.rowScope as Record<string, any> : {};
  const sampleRows = rows.slice(0, PROVIDER_FAILURE_PREVIEW_SAMPLE_ROW_LIMIT);
  return {
    evidenceSource: 'provider_failure_adherence',
    contextOnly: true,
    scope: stringOrNull(adherence.scope),
    scopeNote: stringOrNull(adherence.scopeNote),
    loadedEventCount: typeof source.loadedEventCount === 'number' ? source.loadedEventCount : 0,
    renderedRowCount: typeof source.renderedRowCount === 'number' ? source.renderedRowCount : rows.length,
    rowCount: typeof summary.rowCount === 'number' ? summary.rowCount : rows.length,
    filteredRowCount: filteredRows ? filteredRows.length : null,
    appliedStrategyFilter: stringOrNull(adherence.appliedStrategyFilter),
    strategyCount: strategyBreakdown.length,
    rowScope: {
      fullRows: stringOrNull(rowScope.fullRows),
      filteredRows: stringOrNull(rowScope.filteredRows),
    },
    hint: stringOrNull(adherence.hint),
    sampleRowLimit: PROVIDER_FAILURE_PREVIEW_SAMPLE_ROW_LIMIT,
    sampleRowCount: sampleRows.length,
    sampleRowsCapped: rows.length > PROVIDER_FAILURE_PREVIEW_SAMPLE_ROW_LIMIT,
    sampleSource: 'fullRows',
    sampleRows,
    note: 'Provider failure adherence rows are previewed as context-only evidence and are not merged into local routing learning state.',
  };
}

export function buildRouterLearningImportPreview(body: unknown): RouterLearningImportPreview {
  const input = body && typeof body === 'object' ? body as Record<string, any> : {};
  const schemaVersion = typeof input.schemaVersion === 'number'
    ? input.schemaVersion
    : typeof input.fullExport?.schemaVersion === 'number'
      ? input.fullExport.schemaVersion
      : null;
  const schemaSupported = schemaVersion == null || schemaVersion === 1;
  const importSource = Array.isArray(body)
    ? 'raw-array'
    : Array.isArray(input.events)
      ? 'events'
      : Array.isArray(input.fullExport?.events)
        ? 'fullExport.events'
        : Array.isArray(input.recentEvents)
          ? 'recentEvents'
          : 'none';
  const warnings = !schemaSupported && schemaVersion != null
    ? [`Unsupported schemaVersion ${schemaVersion}; importing recognized event fields only.`]
    : [];
  const events = Array.isArray(body)
    ? body
    : Array.isArray(input.events)
      ? input.events
      : Array.isArray(input.fullExport?.events)
        ? input.fullExport.events
        : Array.isArray(input.recentEvents)
          ? input.recentEvents
          : [];

  return {
    importSource,
    schemaVersion,
    schemaSupported,
    warnings,
    events,
    toolReliabilityPreview: buildToolReliabilityImportPreview(input),
    promptBestPracticePreview: buildPromptBestPracticeImportPreview(input),
    providerFailureAdherencePreview: buildProviderFailureAdherenceImportPreview(input),
  };
}
