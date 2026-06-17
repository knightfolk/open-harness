/**
 * server/toolReliabilityStore.ts
 *
 * Shared cache for tool-reliability summaries.
 *
 * The routing and learning endpoints both need the same summary data. Rebuilding
 * from all saved sessions and process logs repeatedly is expensive and can race
 * with rapid route/learn API calls. This cache stores the aggregated summary on
 * disk and refreshes it when source traces change.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { buildToolReliabilitySummary, type ToolReliabilitySummary } from './toolReliability';
import { getToolReliabilitySessions, getToolReliabilitySourceFingerprint, type ToolReliabilitySourceFingerprint } from './toolReliabilityLogTrace';

export interface ToolReliabilityCacheRecord {
  schemaVersion: number;
  generatedAt: string;
  sourceFingerprint: ToolReliabilitySourceFingerprint;
  sourceFingerprintDigest: string;
  summary: ToolReliabilitySummary;
}

const SCHEMA_VERSION = 1;
const CACHE_DIR = join(homedir(), '.openharness', 'router');
const CACHE_PATH = join(CACHE_DIR, 'toolReliabilityCache.json');

let inMemoryCache: ToolReliabilityCacheRecord | null = null;
let cacheWriteSupported = true;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidSourceFingerprint(value: unknown): value is ToolReliabilitySourceFingerprint {
  if (!isObject(value)) return false;
  const candidate = value as {
    sessions?: unknown;
    logs?: unknown;
    computedAt?: unknown;
  };
  if (typeof candidate.computedAt !== 'string' || candidate.computedAt.length === 0) return false;

  const sessions = candidate.sessions;
  if (!isObject(sessions)) return false;
  const sessionsRecord = sessions as {
    count?: unknown;
    sessionFileNames?: unknown;
    latestMtimeMs?: unknown;
  };
  if (typeof sessionsRecord.count !== 'number' || sessionsRecord.count < 0) return false;
  if (typeof sessionsRecord.latestMtimeMs !== 'number' || sessionsRecord.latestMtimeMs < 0) return false;
  if (!Array.isArray(sessionsRecord.sessionFileNames) || !sessionsRecord.sessionFileNames.every((entry) => typeof entry === 'string')) {
    return false;
  }

  const logs = candidate.logs;
  if (!isObject(logs)) return false;
  const logsRecord = logs as {
    count?: unknown;
    logFileNames?: unknown;
    latestMtimeMs?: unknown;
    totalLogBytes?: unknown;
  };
  if (typeof logsRecord.count !== 'number' || logsRecord.count < 0) return false;
  if (typeof logsRecord.latestMtimeMs !== 'number' || logsRecord.latestMtimeMs < 0) return false;
  if (typeof logsRecord.totalLogBytes !== 'number' || logsRecord.totalLogBytes < 0) return false;
  if (!Array.isArray(logsRecord.logFileNames) || !logsRecord.logFileNames.every((entry) => typeof entry === 'string')) {
    return false;
  }

  return true;
}

function isValidToolReliabilitySummary(value: unknown): value is ToolReliabilitySummary {
  if (!isObject(value)) return false;
  const summary = value as { [key: string]: unknown };
  const numericFields = [
    'totalToolCalls',
    'completedToolCalls',
    'errorToolCalls',
    'skippedToolCalls',
    'runningToolCalls',
    'runsWithToolCalls',
    'firstCallErrorRuns',
    'runsWithToolErrors',
    'recoveredRunsWithToolErrors',
    'avgRecoveryRounds',
  ];
  if (!numericFields.every((field) => typeof summary[field] === 'number')) return false;

  const keyedRecordFields = ['byModel', 'byProvider', 'byTool', 'byModelTool', 'byPromptStrategy', 'byPromptStrategyVariant'];
  for (const field of keyedRecordFields) {
    if (!isObject(summary[field])) return false;
  }

  const arrayFields = ['toolHeavyAdvice', 'recoveryExamples', 'outcomeExamples', 'recoveryPatterns', 'failureMemory', 'errorSignatures', 'retryReductionRecommendations', 'recentErrors', 'byEvidenceSource'];
  for (const field of arrayFields) {
    if (!Array.isArray(summary[field])) return false;
  }

  return true;
}

function sourceFingerprintDigest(fingerprint: ToolReliabilitySourceFingerprint): string {
  return [
    `sessions:${fingerprint.sessions.count}@${fingerprint.sessions.latestMtimeMs}`,
    `logs:${fingerprint.logs.count}@${fingerprint.logs.latestMtimeMs}`,
    `logBytes:${fingerprint.logs.totalLogBytes}`,
  ].join('|');
}

function loadCache(): ToolReliabilityCacheRecord | null {
  if (inMemoryCache) return inMemoryCache;
  if (!existsSync(CACHE_PATH)) return null;
  try {
    const raw = readFileSync(CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as ToolReliabilityCacheRecord;
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) {
      return null;
    }
    if (!isValidSourceFingerprint(parsed.sourceFingerprint)) {
      return null;
    }
    if (!parsed.sourceFingerprintDigest || typeof parsed.sourceFingerprintDigest !== 'string') {
      return null;
    }
    if (!isValidToolReliabilitySummary(parsed.summary)) {
      return null;
    }
    inMemoryCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(record: ToolReliabilityCacheRecord): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(record, null, 2), 'utf-8');
    cacheWriteSupported = true;
  } catch {
    cacheWriteSupported = false;
    // Cache write failures are intentionally non-fatal.
  }
}

function invalidateCache(): void {
  inMemoryCache = null;
}

function buildFreshSummary(): ToolReliabilitySummary {
  try {
    const sessions = getToolReliabilitySessions();
    return buildToolReliabilitySummary(sessions);
  } catch {
    return buildToolReliabilitySummary([]);
  }
}

export function getToolReliabilitySummaryCached(options: { forceRefresh?: boolean } = {}): ToolReliabilitySummary {
  const forceRefresh = options.forceRefresh === true;
  const sourceFingerprint = getToolReliabilitySourceFingerprint();
  const digest = sourceFingerprintDigest(sourceFingerprint);

  const cached = forceRefresh ? null : loadCache();
  if (!forceRefresh && cached && cached.sourceFingerprintDigest === digest) {
    return cached.summary;
  }

  const summary = buildFreshSummary();
  const nextRecord: ToolReliabilityCacheRecord = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceFingerprint,
    sourceFingerprintDigest: digest,
    summary,
  };
  inMemoryCache = nextRecord;
  saveCache(nextRecord);
  return summary;
}

export function getToolReliabilityCacheMeta(): {
  enabled: boolean;
  generatedAt: string | null;
  sourceFingerprint: ToolReliabilitySourceFingerprint | null;
  sourceFingerprintDigest: string | null;
  schemaVersion: number;
} {
  const cached = inMemoryCache || loadCache();
  if (!cached) {
    return {
      enabled: cacheWriteSupported,
      generatedAt: null,
      sourceFingerprint: null,
      sourceFingerprintDigest: null,
      schemaVersion: SCHEMA_VERSION,
    };
  }
  return {
    enabled: cacheWriteSupported,
    generatedAt: cached.generatedAt,
    sourceFingerprint: cached.sourceFingerprint,
    sourceFingerprintDigest: cached.sourceFingerprintDigest,
    schemaVersion: cached.schemaVersion,
  };
}

export function invalidateToolReliabilitySummaryCache(): void {
  invalidateCache();
}
