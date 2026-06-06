import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hashPrompt,
  listRoutingAdherenceEvents,
  recordRoutingAdherenceEvent,
  setRoutingAdherenceBaseDirForTest,
} from '../server/routingAdherence';

const tempDir = mkdtempSync(join(tmpdir(), 'openharness-routing-adherence-'));
setRoutingAdherenceBaseDirForTest(tempDir);

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

setRoutingAdherenceBaseDirForTest(null);
rmSync(tempDir, { recursive: true, force: true });

console.log('Routing adherence writer/redaction tests passed.');
