import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

type ToolReliabilityCacheStore = typeof import('../server/toolReliabilityStore');

const priorHome = process.env.HOME;
const tempHome = mkdtempSync(join(tmpdir(), 'openharness-tool-reliability-cache-'));
process.env.HOME = tempHome;

const { getToolReliabilitySummaryCached, getToolReliabilityCacheMeta, invalidateToolReliabilitySummaryCache } = await import('../server/toolReliabilityStore') as ToolReliabilityCacheStore;

try {
  const sessionsDir = join(tempHome, '.openharness', 'sessions');
  const logsDir = join(tempHome, '.openharness', 'process-ledger');

  const emptySummary = getToolReliabilitySummaryCached({ forceRefresh: true });
  assert.equal(emptySummary.totalToolCalls, 0, 'empty workspace should produce no cached tool-call rows');

  const emptyMeta = getToolReliabilityCacheMeta();
  assert.equal(emptyMeta.enabled, true, 'cache should report writable by default');
  assert.ok(emptyMeta.generatedAt, 'cache metadata should include generation timestamp after first refresh');
  assert.ok(emptyMeta.sourceFingerprint, 'cache metadata should include source fingerprint after first refresh');
  assert.equal(emptyMeta.sourceFingerprint!.sessions.count, 0, 'initial fingerprint should count zero saved sessions');
  assert.equal(emptyMeta.sourceFingerprint!.logs.count, 0, 'initial fingerprint should count zero process log files');

  const summarySecondCall = getToolReliabilitySummaryCached();
  assert.equal(summarySecondCall.totalToolCalls, 0, 'repeat call with unchanged sources should return cached summary');
  const secondMeta = getToolReliabilityCacheMeta();
  assert.equal(emptyMeta.sourceFingerprintDigest, secondMeta.sourceFingerprintDigest, 'digest should remain stable without source changes');

  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(join(sessionsDir, 'session-1.json'), JSON.stringify({ id: 'session-1', messages: [] }), 'utf-8');
  writeFileSync(join(logsDir, 'run.log'), '[run-step] {}\n', 'utf-8');

  await new Promise((resolve) => setTimeout(resolve, 10));
  const updatedSummary = getToolReliabilitySummaryCached();
  assert.equal(updatedSummary.totalToolCalls, 0, 'updated workspace with minimal session/log payloads should still produce zero tool calls');
  const updatedMeta = getToolReliabilityCacheMeta();
  assert.notEqual(emptyMeta.sourceFingerprintDigest, updatedMeta.sourceFingerprintDigest, 'digest should change when source fingerprints change');
  assert.equal(updatedMeta.sourceFingerprint!.sessions.count, 1, 'updated fingerprint should count created session file');
  assert.equal(updatedMeta.sourceFingerprint!.logs.count, 1, 'updated fingerprint should count created process log file');

  const preRefreshDigest = updatedMeta.sourceFingerprintDigest;
  writeFileSync(join(sessionsDir, 'session-2.json'), JSON.stringify({ id: 'session-2', messages: [] }), 'utf-8');
  invalidateToolReliabilitySummaryCache();
  const forcedSummary = getToolReliabilitySummaryCached({ forceRefresh: true });
  assert.equal(forcedSummary.totalToolCalls, 0, 'forced refresh should still handle missing tool-trace data');
  const forcedMeta = getToolReliabilityCacheMeta();
  assert.ok(
    forcedMeta.generatedAt && (!updatedMeta.generatedAt || Date.parse(forcedMeta.generatedAt) >= Date.parse(updatedMeta.generatedAt)),
    'forced refresh should not regress generatedAt',
  );
  assert.notEqual(preRefreshDigest, forcedMeta.sourceFingerprintDigest, 'forced refresh after source changes should produce refreshed digest');
} finally {
  process.env.HOME = priorHome;
  rmSync(tempHome, { recursive: true, force: true });
}

console.log('tool-reliability cache test passed');
