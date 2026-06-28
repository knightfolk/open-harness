import { strict as assert } from 'node:assert';
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hashPrompt,
  listRoutingAdherenceEvents,
  recordRoutingAdherenceEvent,
  routingAdherencePhaseFromQuery,
  setRoutingAdherenceBaseDirForTest,
} from '../server/routingAdherence';
import { isMiniMaxM2SeriesModelId, isMiniMaxM3ModelId } from '../shared/minimaxModelPreference';

const tempDir = mkdtempSync(join(tmpdir(), 'openharness-routing-adherence-'));
setRoutingAdherenceBaseDirForTest(tempDir);

const adherenceMatrix = JSON.parse(readFileSync('docs/routing-prompt-adherence-test-matrix.json', 'utf-8')) as {
  historicalObservedRouterState?: { classifierModel?: string; note?: string };
  preferredRouterPolicy?: { classifierModel?: string; defaultModel?: string; note?: string };
};
const preferredClassifierModel = adherenceMatrix.preferredRouterPolicy?.classifierModel || '';
assert.equal(
  adherenceMatrix.historicalObservedRouterState?.classifierModel,
  'minimax:MiniMax-M2.5-highspeed',
  'routing adherence matrix should preserve the historical classifier value instead of rewriting old evidence',
);
assert.equal(
  isMiniMaxM2SeriesModelId(preferredClassifierModel),
  false,
  'routing adherence matrix should not preserve older MiniMax M2.x as the preferred classifier default',
);
assert.equal(
  isMiniMaxM3ModelId(preferredClassifierModel),
  true,
  'routing adherence matrix should document MiniMax-M3 as the preferred MiniMax classifier default',
);
assert.equal(
  isMiniMaxM3ModelId(adherenceMatrix.preferredRouterPolicy?.defaultModel || ''),
  true,
  'routing adherence matrix should document MiniMax-M3 as the preferred MiniMax default model',
);
assert.match(
  adherenceMatrix.historicalObservedRouterState?.note || '',
  /Historical .*older MiniMax M2\.x classifier.*not the current preferred policy/i,
  'historical router snapshots should clearly mark older MiniMax classifiers as historical-only',
);
const promptPluginPhasePlan = readFileSync('docs/MODEL_PROMPT_PLUGIN_PHASE_PLAN.md', 'utf-8');
assert.match(
  promptPluginPhasePlan,
  /Historical 2026-06-06 .*classifier `minimax:MiniMax-M2\.5-highspeed`.*prefer `minimax:MiniMax-M3`/s,
  'prompt plugin phase plan should mark older MiniMax classifier evidence as historical and point future runs to M3',
);

const secret = 'sk-123456789012345678901234';
const prompt = `Review provider ${secret}`;
const promptHash = hashPrompt(prompt);

recordRoutingAdherenceEvent({
  kind: 'timeout',
  phase: 'provider-stream',
  sessionId: 'session-1',
  runId: 'run-1',
  routeMode: 'investigate',
  role: 'reviewer',
  complexity: 'medium',
  selectedModel: 'provider:model',
  providerId: 'provider',
  classifierModel: 'router:model',
  candidateScores: { 'provider:model': 0.74 },
  promptHash,
  timeoutMs: 90_000,
  elapsedMs: 90_123.4,
  error: `Timed out with ${secret}`,
  metadata: {
    authorization: `Bearer ${secret}`,
    nested: { detail: `raw ${secret}` },
  },
});

const events = listRoutingAdherenceEvents(10);
assert.equal(events.length, 1, 'event should be listed');
assert.equal(events[0].phase, 'provider-stream', 'phase should persist');
assert.equal(events[0].promptHash, promptHash, 'prompt hash should persist');
assert.equal(events[0].elapsedMs, 90123, 'elapsedMs should be rounded');
assert.equal(events[0].candidateScores?.['provider:model'], 0.74, 'candidate scores should persist');

const raw = readFileSync(join(tempDir, 'events.jsonl'), 'utf-8');
assert.equal(raw.includes(secret), false, 'raw secret should not be written to disk');
assert.ok(raw.includes('<redacted:OPENAI_KEY>') || raw.includes('<redacted:SECRET>'), 'redaction marker should be written');

for (let index = 0; index < 12; index++) {
  recordRoutingAdherenceEvent({
    kind: 'error',
    phase: 'agent-request',
    selectedModel: `agent:${index}`,
    providerId: 'agent',
  });
}

recordRoutingAdherenceEvent({
  kind: 'error',
  phase: 'provider-stream',
  selectedModel: 'provider:older-1',
  providerId: 'provider',
});
recordRoutingAdherenceEvent({
  kind: 'error',
  phase: 'provider-stream',
  selectedModel: 'provider:older-2',
  providerId: 'provider',
});

for (let index = 0; index < 12; index++) {
  recordRoutingAdherenceEvent({
    kind: 'error',
    phase: 'agent-request',
    selectedModel: `agent:newer-${index}`,
    providerId: 'agent',
  });
}

const unfilteredRecent = listRoutingAdherenceEvents(5);
assert.equal(unfilteredRecent.length, 5, 'unfiltered adherence list should still cap newest events');
assert.ok(unfilteredRecent.every((event) => event.phase === 'agent-request'), 'unfiltered newest window should preserve current behavior');

const providerStreamEvents = listRoutingAdherenceEvents(5, { phase: 'provider-stream' });
assert.deepEqual(
  providerStreamEvents.map((event) => event.selectedModel),
  ['provider:older-2', 'provider:older-1', 'provider:model'],
  'phase filtering should collect matching provider events even when newer agent events exceed the limit',
);

assert.equal(routingAdherencePhaseFromQuery(' provider-stream '), 'provider-stream');
assert.equal(routingAdherencePhaseFromQuery(undefined), undefined);
assert.equal(routingAdherencePhaseFromQuery('bogus-phase'), null);

const routingAdherenceSource = readFileSync('server/routingAdherence.ts', 'utf-8');
// Source-shape tripwire: this protects the performance fix from drifting back
// to full-file JSONL reads while the behavior tests cover line parsing.
assert.ok(
  routingAdherenceSource.includes('function readNewestJsonlLines('),
  'adherence reader should use a bounded tail-line helper',
);
assert.equal(
  routingAdherenceSource.includes('readFileSync(path'),
  false,
  'adherence reader should not slurp the full JSONL file',
);

recordRoutingAdherenceEvent({
  kind: 'error',
  phase: 'provider-stream',
  selectedModel: 'provider:wide-line',
  providerId: 'provider',
  metadata: {
    detail: `${'x'.repeat(128)}snowman-☃-rocket-🚀`,
  },
});

const chunkBoundaryEvents = listRoutingAdherenceEvents(1, {
  phase: 'provider-stream',
  maxTailBytes: 1024,
  chunkBytes: 17,
});
assert.equal(
  chunkBoundaryEvents[0].selectedModel,
  'provider:wide-line',
  'tail reader should keep large multibyte JSON lines intact across chunk boundaries',
);

appendFileSync(join(tempDir, 'events.jsonl'), JSON.stringify({
  id: 'manual-no-newline',
  createdAt: '2026-06-28T00:00:00.000Z',
  kind: 'error',
  phase: 'provider-stream',
  selectedModel: 'provider:no-newline',
  providerId: 'provider',
}));

const noTrailingNewlineEvents = listRoutingAdherenceEvents(1, {
  phase: 'provider-stream',
  maxTailBytes: 512,
  chunkBytes: 13,
});
assert.equal(
  noTrailingNewlineEvents[0].selectedModel,
  'provider:no-newline',
  'tail reader should treat the EOF line as complete even without a trailing newline',
);

const tinyTailEvents = listRoutingAdherenceEvents(5, {
  phase: 'provider-stream',
  maxTailBytes: 32,
  chunkBytes: 16,
});
assert.deepEqual(
  tinyTailEvents,
  [],
  'bounded phase queries should return no events when the tail window contains no complete JSONL line',
);

setRoutingAdherenceBaseDirForTest(null);
rmSync(tempDir, { recursive: true, force: true });

console.log('Routing adherence writer/redaction tests passed.');
