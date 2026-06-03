// server/providerHealth.ts
//
// Lightweight provider health probes and a persisted health history per
// provider. The health probe covers: chat (single message), streaming
// (streamed text), tool call shape, JSON mode, error handling, and
// context-length check. We do not call out to the actual model — we use
// the existing testProviderConnection from server/providers.ts for the
// network reachability check, and report capability availability based
// on the adapter type rather than burning tokens on a live chat call.
//
// Storage layout:
//   ~/.openharness/provider-health/<providerId>.json
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { testProviderConnection } from './providers';
import type { StoredProvider } from './config';

const ROOT = join(homedir(), '.openharness', 'provider-health');

function ensureDir(): void {
  if (!existsSync(ROOT)) mkdirSync(ROOT, { recursive: true });
}

function providerFile(providerId: string): string {
  return join(ROOT, `${providerId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
}

export type HealthCapability =
  | 'chat'
  | 'streaming'
  | 'tool-calls'
  | 'json-mode'
  | 'context-length'
  | 'error-handling';

export interface CapabilityResult {
  capability: HealthCapability;
  ok: boolean;
  detail: string;
  durationMs: number;
}

export interface ProviderHealthRecord {
  providerId: string;
  timestamp: string;
  ok: boolean;
  latencyMs: number;
  capabilities: CapabilityResult[];
  modelsCount: number;
  error?: string;
}

function loadHistory(providerId: string): ProviderHealthRecord[] {
  const path = providerFile(providerId);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as ProviderHealthRecord[];
  } catch {
    return [];
  }
}

function persistHistory(providerId: string, history: ProviderHealthRecord[]): void {
  ensureDir();
  // Keep the last 30 records per provider to bound disk usage.
  const trimmed = history.slice(-30);
  writeFileSync(providerFile(providerId), JSON.stringify(trimmed, null, 2), 'utf-8');
}

export function getProviderHealth(providerId: string): ProviderHealthRecord[] {
  return loadHistory(providerId);
}

export function getProviderHealthSummary(providerId: string): {
  latest?: ProviderHealthRecord;
  stale: boolean;
  failed: boolean;
  total: number;
} {
  const history = loadHistory(providerId);
  if (history.length === 0) {
    return { stale: true, failed: false, total: 0 };
  }
  const latest = history[history.length - 1];
  const ageMs = Date.now() - new Date(latest.timestamp).getTime();
  const stale = ageMs > 6 * 60 * 60 * 1000; // 6 hours
  const failed = !latest.ok;
  return { latest, stale, failed, total: history.length };
}

export function listAllProviderHealth(): Record<string, ProviderHealthRecord[]> {
  ensureDir();
  const out: Record<string, ProviderHealthRecord[]> = {};
  for (const f of readdirSync(ROOT)) {
    if (!f.endsWith('.json')) continue;
    const id = f.replace(/\.json$/, '');
    out[id] = loadHistory(id);
  }
  return out;
}

/**
 * Run a single-shot health probe for the provider. The probe is intentionally
 * lightweight: it only verifies network reachability and basic
 * authentication via testProviderConnection (which calls /models).
 *
 * Capability flags (chat, streaming, tool-calls, etc.) are reported based
 * on the provider type and stored model info rather than on live model
 * calls, so the probe never burns user tokens.
 */
export async function probeProvider(provider: StoredProvider): Promise<ProviderHealthRecord> {
  const start = Date.now();
  const capabilities: CapabilityResult[] = [];
  const supportedByType: Record<StoredProvider['type'], HealthCapability[]> = {
    'openai-compatible': ['chat', 'streaming', 'tool-calls', 'json-mode', 'context-length', 'error-handling'],
    'anthropic': ['chat', 'streaming', 'tool-calls', 'context-length', 'error-handling'],
    'google': ['chat', 'streaming', 'tool-calls', 'context-length', 'error-handling'],
    'local': ['chat', 'streaming', 'context-length', 'error-handling'],
    'custom': ['chat', 'context-length', 'error-handling'],
  };
  const caps = supportedByType[provider.type] ?? ['chat', 'error-handling'];

  for (const cap of caps) {
    const capStart = Date.now();
    let ok = true;
    let detail = 'supported by adapter';
    if (cap === 'json-mode' && provider.type !== 'openai-compatible') {
      ok = false;
      detail = 'json-mode is only advertised for OpenAI-compatible providers';
    }
    if (cap === 'tool-calls' && provider.type === 'local') {
      ok = false;
      detail = 'local providers do not advertise tool calls';
    }
    capabilities.push({ capability: cap, ok, detail, durationMs: Date.now() - capStart });
  }

  let modelsCount = provider.models?.length ?? 0;
  let error: string | undefined;
  let ok = true;
  const testResult = await testProviderConnection(provider);
  if (!testResult.ok) {
    ok = false;
    error = testResult.error;
    // Mark every capability as failed since the underlying transport
    // is broken.
    for (const c of capabilities) {
      c.ok = false;
      c.detail = `Transport failed: ${testResult.error}`;
    }
  } else if (typeof testResult.modelsCount === 'number') {
    modelsCount = testResult.modelsCount;
  }

  const record: ProviderHealthRecord = {
    providerId: provider.id,
    timestamp: new Date().toISOString(),
    ok,
    latencyMs: Date.now() - start,
    capabilities,
    modelsCount,
    error,
  };
  const history = loadHistory(provider.id);
  history.push(record);
  persistHistory(provider.id, history);
  return record;
}
