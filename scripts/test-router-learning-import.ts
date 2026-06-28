import { strict as assert } from 'node:assert';
import { buildRouterLearningImportPreview } from '../server/routerLearningImport';

const event = {
  id: 'event-1',
  timestamp: '2026-06-17T00:00:00.000Z',
  selectedModel: 'provider:model',
};

const providerFailureRows = Array.from({ length: 21 }, (_, index) => ({
  id: `provider-failure-${index + 1}`,
  routingContext: {
    promptStrategyId: index % 2 === 0 ? 'qwen-xml-code-v1' : 'glm-patient-review-v1',
  },
}));

const schemaOne = buildRouterLearningImportPreview({ schemaVersion: 1, events: [event] });
assert.equal(schemaOne.importSource, 'events', 'events payload should be detected');
assert.equal(schemaOne.schemaVersion, 1, 'schema version 1 should be detected');
assert.equal(schemaOne.schemaSupported, true, 'schema version 1 should be supported');
assert.deepEqual(schemaOne.warnings, [], 'schema version 1 should not warn');
assert.equal(schemaOne.events.length, 1, 'events payload should preserve events');

const fullExport = buildRouterLearningImportPreview({ fullExport: { schemaVersion: 1, events: [event] } });
assert.equal(fullExport.importSource, 'fullExport.events', 'full export payload should be detected');
assert.equal(fullExport.schemaSupported, true, 'full export schema version 1 should be supported');
assert.equal(fullExport.events.length, 1, 'full export events should be extracted');

const fullExportWithToolReliability = buildRouterLearningImportPreview({
  fullExport: {
    schemaVersion: 1,
    events: [event],
    promptStrategyBestPractices: [
      {
        strategyId: 'qwen-xml-code-v1',
        family: 'qwen',
        systemStyle: 'xml-tagged',
        sourceRefs: ['docs/MODEL_PROMPTING_GUIDE.md'],
        bestPracticeNotes: [
          {
            id: 'qwen-local-compact-contract',
            sourceRef: 'docs/MODEL_PROMPTING_GUIDE.md',
            appliesTo: ['coding'],
            guidance: 'Keep the prompt compact.',
            rationale: 'Open models vary.',
            evaluationCue: 'Track first-call tool errors.',
          },
        ],
      },
    ],
    summary: {
      toolReliability: {
        recoveryPatterns: [{ exampleSessionIds: ['session-1'], exampleRunIds: ['run-1'], exampleEvidenceSources: ['saved_session_trace'] }],
        failureMemory: [{ exampleSessionIds: ['session-1'], exampleRunIds: ['run-1'], exampleEvidenceSources: ['saved_session_trace'] }],
        errorSignatures: [{ exampleSessionIds: ['session-1'], exampleRunIds: ['run-1'], exampleEvidenceSources: ['saved_session_trace'] }],
        retryReductionRecommendations: [{ evidenceSource: 'saved_session_trace', tuningAction: 'tune_local_router', supportRunCount: 1, supportSessionIds: ['session-1'], supportRunIds: ['run-1'], evidenceConfidence: 'single_trace', avgRetryDistance: 1, sessionId: 'session-1', runId: 'run-1', avoidPath: 'model/read_file', preferPath: 'model/list_directory', avoidProviderPath: 'provider:model/read_file', preferProviderPath: 'provider:model/list_directory' }],
        byEvidenceSource: [{ source: 'saved_session_trace', tuningAction: 'tune_local_router', outcomeRuns: 1, retryReductionRecommendations: 1 }],
      },
    },
  },
  providerFailureAdherence: {
    scope: 'rolling-tail',
    scopeNote: 'Provider failure adherence is limited to the most recent provider-stream failures rendered in Settings.',
    source: {
      loadedEventCount: 3,
      renderedRowCount: 2,
    },
    summary: {
      rowCount: 2,
    },
    strategyBreakdown: [
      { strategyId: 'qwen-xml-code-v1', failureCount: 1 },
      { strategyId: 'glm-patient-review-v1', failureCount: 1 },
    ],
    rowScope: {
      fullRows: 'rows',
      filteredRows: 'filteredRows contains rows after appliedStrategyFilter',
    },
    appliedStrategyFilter: 'qwen-xml-code-v1',
    filteredRows: [{ id: 'provider-failure-1', routingContext: { promptStrategyId: 'qwen-xml-code-v1' } }],
    hint: 'Provider fallback happened after routing selected the model.',
    rows: providerFailureRows,
  },
});
assert.equal(fullExportWithToolReliability.importSource, 'fullExport.events', 'full export with tool reliability summary should still import events');
assert.equal(fullExportWithToolReliability.schemaSupported, true, 'full export with tool reliability should keep schema version support');
assert.equal(fullExportWithToolReliability.events.length, 1, 'tool reliability summary evidence should not block event import preview');
assert.equal(fullExportWithToolReliability.toolReliabilityPreview?.evidenceSource, 'imported_trace', 'tool reliability import preview should label imported summaries as imported trace evidence');
assert.equal(fullExportWithToolReliability.toolReliabilityPreview?.recoveryPatterns, 1, 'tool reliability import preview should count recovery patterns');
assert.equal(fullExportWithToolReliability.toolReliabilityPreview?.failureMemory, 1, 'tool reliability import preview should count failure memory rows');
assert.equal(fullExportWithToolReliability.toolReliabilityPreview?.errorSignatures, 1, 'tool reliability import preview should count error signatures');
assert.equal(fullExportWithToolReliability.toolReliabilityPreview?.retryReductionRecommendations, 1, 'tool reliability import preview should count retry-reduction recommendations');
assert.equal(fullExportWithToolReliability.toolReliabilityPreview?.evidenceSourceRows, 1, 'tool reliability import preview should count source summary rows');
assert.match(fullExportWithToolReliability.toolReliabilityPreview?.note || '', /not merged into local routing learning state/i, 'tool reliability import preview should explain that summary evidence is preview-only');
assert.equal(fullExportWithToolReliability.promptBestPracticePreview?.strategyCount, 1, 'prompt best-practice import preview should count strategy metadata rows');
assert.equal(fullExportWithToolReliability.promptBestPracticePreview?.bestPracticeNoteCount, 1, 'prompt best-practice import preview should count best-practice notes');
assert.deepEqual(fullExportWithToolReliability.promptBestPracticePreview?.sourceRefs, ['docs/MODEL_PROMPTING_GUIDE.md'], 'prompt best-practice import preview should preserve source refs');
assert.match(fullExportWithToolReliability.promptBestPracticePreview?.note || '', /context-only evidence/i, 'prompt best-practice import preview should explain that metadata is context-only');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.evidenceSource, 'provider_failure_adherence', 'provider failure import preview should label provider adherence as separate context evidence');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.contextOnly, true, 'provider failure import preview should be explicitly context-only');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.scope, 'rolling-tail', 'provider failure import preview should preserve rolling-tail scope');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.loadedEventCount, 3, 'provider failure import preview should preserve loaded adherence event count');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.renderedRowCount, 2, 'provider failure import preview should preserve rendered row count');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.rowCount, 2, 'provider failure import preview should count the full rows array');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.filteredRowCount, 1, 'provider failure import preview should distinguish filtered row count from full row count');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.appliedStrategyFilter, 'qwen-xml-code-v1', 'provider failure import preview should preserve the active strategy filter');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.strategyCount, 2, 'provider failure import preview should count strategy breakdown rows');
assert.deepEqual(fullExportWithToolReliability.providerFailureAdherencePreview?.rowScope, {
  fullRows: 'rows',
  filteredRows: 'filteredRows contains rows after appliedStrategyFilter',
}, 'provider failure import preview should preserve row scope labels');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.sampleRowLimit, 20, 'provider failure import preview should expose the bounded sample limit');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.sampleRowCount, 20, 'provider failure import preview should expose the actual sampled row count');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.sampleRowsCapped, true, 'provider failure import preview should mark when full rows exceed the sample limit');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.sampleSource, 'fullRows', 'provider failure import preview should make clear that sample rows come from full provenance rows');
assert.equal(fullExportWithToolReliability.providerFailureAdherencePreview?.sampleRows.length, 20, 'provider failure import preview should include a bounded sample of full rows');
assert.match(fullExportWithToolReliability.providerFailureAdherencePreview?.note || '', /not merged into local routing learning state/i, 'provider failure import preview should explain that adherence rows are preview-only');

const recentEvents = buildRouterLearningImportPreview({ recentEvents: [event] });
assert.equal(recentEvents.importSource, 'recentEvents', 'recentEvents payload should be detected');
assert.equal(recentEvents.schemaVersion, null, 'missing schema version should be unknown');
assert.equal(recentEvents.schemaSupported, true, 'unknown schema should be allowed for recognized event fields');

const rawArray = buildRouterLearningImportPreview([event]);
assert.equal(rawArray.importSource, 'raw-array', 'raw event array should be detected');
assert.equal(rawArray.events.length, 1, 'raw event array should be preserved');

const unsupported = buildRouterLearningImportPreview({ schemaVersion: 99, events: [event] });
assert.equal(unsupported.schemaSupported, false, 'unsupported schema should be flagged');
assert.match(unsupported.warnings[0], /Unsupported schemaVersion 99/, 'unsupported schema should warn');
assert.equal(unsupported.events.length, 1, 'unsupported schema should still expose recognized event fields');

const empty = buildRouterLearningImportPreview({});
assert.equal(empty.importSource, 'none', 'empty payload should have no import source');
assert.equal(empty.events.length, 0, 'empty payload should produce no events');

console.log('Router learning import tests passed.');
