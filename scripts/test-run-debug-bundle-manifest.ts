import { strict as assert } from 'node:assert';
import { buildRunDebugBundleManifest } from '../server/runDebugBundleManifest';

const manifest = buildRunDebugBundleManifest({
  schemaVersion: '0.1.0',
  exportedAt: '2026-06-28T00:00:00.000Z',
  sessionId: 'session-1',
  runId: 'run-1',
  messageCount: 4,
  routeDecisionCount: 2,
  modelOutputCount: 3,
  artifactCount: 1,
  errorCount: 2,
  retryable: true,
});

assert.deepEqual(manifest, {
  schemaVersion: '0.1.0',
  exportedAt: '2026-06-28T00:00:00.000Z',
  sessionId: 'session-1',
  runId: 'run-1',
  messageCount: 4,
  routeDecisionCount: 2,
  modelOutputCount: 3,
  artifactCount: 1,
  errorCount: 2,
  retryableErrorCount: 2,
  retryable: true,
  redactionNote: 'Bundle content is sourced from persisted run traces, which redact known secret patterns before storage and export.',
});

assert.equal(manifest.schemaVersion, '0.1.0', 'manifest schema should mirror the debug bundle schema');
assert.equal(manifest.retryable, true, 'manifest should preserve the replay retryable flag');
assert.equal(manifest.retryableErrorCount, manifest.errorCount, 'retryable exports should expose retryable error count');

const nonRetryableManifest = buildRunDebugBundleManifest({
  schemaVersion: '0.1.0',
  exportedAt: '2026-06-28T00:00:00.000Z',
  sessionId: 'session-2',
  runId: 'run-2',
  messageCount: 1,
  routeDecisionCount: 0,
  modelOutputCount: 1,
  artifactCount: 0,
  errorCount: 3,
  retryable: false,
});

assert.equal(nonRetryableManifest.retryableErrorCount, 0, 'non-retryable exports should not imply retryable errors');

console.log('Run debug bundle manifest checks passed.');
