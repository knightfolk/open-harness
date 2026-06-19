/**
 * Provider connection testing and model fetching
 */
import { providerAuthToken, type StoredProvider } from './config';
import { enrichModelsFromSecondarySources, normalizeModelMetadata, type RawFetchedModel } from './modelMetadata';

// ── Test provider connection ───────────────────────────

export interface TestResult {
  ok: boolean;
  error?: string;
  latencyMs?: number;
  modelsCount?: number;
}

export function assertProviderBaseURLAllowed(provider: StoredProvider): void {
  let parsed: URL;
  try {
    parsed = new URL(provider.baseURL);
  } catch {
    throw new Error('Provider baseURL must be a valid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Provider baseURL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Provider baseURL must not include credentials');
  }
  const authToken = providerAuthToken(provider);
  if (provider.type === 'local' || !authToken) return;
  if (parsed.protocol !== 'https:') {
    throw new Error('Credentialed remote providers must use https');
  }
  if (isPrivateProviderHost(parsed.hostname)) {
    throw new Error('Credentialed remote providers cannot target local or private network hosts');
  }
}

function isPrivateProviderHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host === '[::1]' || host === '::') return true;
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

export async function testProviderConnection(provider: StoredProvider): Promise<TestResult> {
  const start = Date.now();

  try {
    assertProviderBaseURLAllowed(provider);
    const url = buildModelsURL(provider);
    const authToken = providerAuthToken(provider);
    if (provider.type !== 'local' && !authToken) {
      return {
        ok: false,
        error: 'Add an API key or connect OAuth before testing this provider.',
        latencyMs: Date.now() - start,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      headers['x-api-key'] = authToken;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        error: `HTTP ${response.status}: ${body.slice(0, 200)}`,
        latencyMs,
      };
    }

    const data = await response.json() as any;
    const models = parseModelsResponse(data, provider);

    return {
      ok: true,
      latencyMs,
      modelsCount: models.length,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || 'Connection failed',
      latencyMs: Date.now() - start,
    };
  }
}

// ── Fetch available models ─────────────────────────────

export interface FetchedModel {
  id: string;
  name: string;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  inputCostPerMTok?: number;
  outputCostPerMTok?: number;
  supportsImages?: boolean;
  supportsTools?: boolean;
  metadataSource?: string;
  metadataUpdatedAt?: string;
  metadataNotes?: string[];
}

export async function fetchProviderModels(provider: StoredProvider): Promise<FetchedModel[]> {
  try {
    assertProviderBaseURLAllowed(provider);
    const url = buildModelsURL(provider);
    const authToken = providerAuthToken(provider);
    if (provider.type !== 'local' && !authToken) {
      throw new Error('Add an API key or connect OAuth before fetching models.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
      headers['x-api-key'] = authToken;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as any;
    const models = parseModelsResponse(data, provider);
    return enrichModelsFromSecondarySources(models, provider);
  } catch (err: any) {
    throw new Error(`Failed to fetch models: ${err.message}`);
  }
}

// ── Helpers ────────────────────────────────────────────

function buildModelsURL(provider: StoredProvider): string {
  const base = provider.baseURL.replace(/\/+$/, '');

  // OpenAI-compatible providers use /models or /v1/models
  if (provider.type === 'openai-compatible') {
    // If baseURL already ends with a versioned path like /v1, /v4, etc., just append /models
    if (/\/v\d+$/.test(base)) {
      return `${base}/models`;
    }
    // If baseURL contains /v1/ mid-path (e.g. /v1/chat/completions), strip back to /v1
    if (base.includes('/v1/')) {
      return `${base.split('/v1/')[0]}/v1/models`;
    }
    // If baseURL contains another versioned path mid-path (e.g. /v4/chat), strip back
    const versionMatch = base.match(/(.*)\/v\d+\/.*/);
    if (versionMatch) {
      const versionBase = base.match(/(.*\/v\d+)\/.*/)?.[1] || versionMatch[1];
      return `${versionBase}/models`;
    }
    return `${base}/v1/models`;
  }

  // Anthropic
  if (provider.type === 'anthropic') {
    return 'https://api.anthropic.com/v1/models';
  }

  // Google
  if (provider.type === 'google') {
    return `https://generativelanguage.googleapis.com/v1beta/models?key=${provider.apiKey}`;
  }

  // Fallback
  return `${base}/models`;
}

function parseModelsResponse(data: any, _provider: StoredProvider): RawFetchedModel[] {
  // OpenAI-compatible format: { data: [{ id, object, ... }] }
  if (Array.isArray(data?.data)) {
    return data.data
      .filter((m: any) => m.id)
      .map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        ...normalizeModelMetadata(m, 'provider-models-api'),
      }))
      .sort((a: FetchedModel, b: FetchedModel) => b.id.localeCompare(a.id));
  }

  // Google format: { models: [{ name, displayName, ... }] }
  if (Array.isArray(data?.models)) {
    return data.models
      .filter((m: any) => m.name)
      .map((m: any) => ({
        id: m.name.split('/').pop() || m.name,
        name: m.displayName || m.name.split('/').pop() || m.name,
        ...normalizeModelMetadata(m, 'provider-models-api'),
      }))
      .sort((a: FetchedModel, b: FetchedModel) => b.id.localeCompare(a.id));
  }

  // Anthropic format: { data: [{ id, type, ... }] } (same as OpenAI)
  if (Array.isArray(data)) {
    return data
      .filter((m: any) => m.id || m.name)
      .map((m: any) => ({
        id: m.id || m.name,
        name: m.id || m.name,
        ...normalizeModelMetadata(m, 'provider-models-api'),
      }))
      .sort((a: FetchedModel, b: FetchedModel) => b.id.localeCompare(a.id));
  }

  return [];
}
