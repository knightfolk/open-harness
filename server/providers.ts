/**
 * Provider connection testing and model fetching
 */
import type { StoredProvider } from './config';

// ── Test provider connection ───────────────────────────

export interface TestResult {
  ok: boolean;
  error?: string;
  latencyMs?: number;
  modelsCount?: number;
}

export async function testProviderConnection(provider: StoredProvider): Promise<TestResult> {
  const start = Date.now();

  try {
    const url = buildModelsURL(provider);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
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
}

export async function fetchProviderModels(provider: StoredProvider): Promise<FetchedModel[]> {
  try {
    const url = buildModelsURL(provider);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (provider.apiKey) {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
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
    return parseModelsResponse(data, provider);
  } catch (err: any) {
    throw new Error(`Failed to fetch models: ${err.message}`);
  }
}

// ── Helpers ────────────────────────────────────────────

function buildModelsURL(provider: StoredProvider): string {
  let base = provider.baseURL.replace(/\/+$/, '');

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
      return `${versionMatch[1]}/models`;
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

function parseModelsResponse(data: any, provider: StoredProvider): FetchedModel[] {
  // OpenAI-compatible format: { data: [{ id, object, ... }] }
  if (Array.isArray(data?.data)) {
    return data.data
      .filter((m: any) => m.id)
      .map((m: any) => ({
        id: m.id,
        name: m.id, // Use ID as name; can be refined later
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
      }))
      .sort((a: FetchedModel, b: FetchedModel) => b.id.localeCompare(a.id));
  }

  return [];
}
