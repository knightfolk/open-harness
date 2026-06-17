import { strict as assert } from 'node:assert';
import { buildRouterLearningImportPreview } from '../server/routerLearningImport';

const event = {
  id: 'event-1',
  timestamp: '2026-06-17T00:00:00.000Z',
  selectedModel: 'provider:model',
};

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
