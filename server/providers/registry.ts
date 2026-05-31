import type { ProviderAdapter, ProviderChatRequest, ProviderEvent, ProviderStreamOptions } from './types';
import type { StoredProvider } from '../config';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GeminiAdapter } from './gemini';

// ── Adapter registry ───────────────────────────────────

const adapters: ProviderAdapter[] = [
  new OpenAIAdapter(),
  new AnthropicAdapter(),
  new GeminiAdapter(),
];

/**
 * Resolve the correct adapter for a given provider.
 */
export function getAdapter(provider: StoredProvider): ProviderAdapter | null {
  return adapters.find(a => a.canHandle(provider.type)) || null;
}

/**
 * Stream a chat completion through the correct adapter.
 */
export async function* streamWithAdapter(
  provider: StoredProvider,
  request: ProviderChatRequest,
): AsyncGenerator<ProviderEvent> {
  const adapter = getAdapter(provider);
  if (!adapter) {
    yield { type: 'error', error: `No adapter found for provider type: ${provider.type}` };
    return;
  }

  const options: ProviderStreamOptions = {
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
  };

  yield* adapter.streamChat(request, options);
}

/**
 * Get adapter metadata for a provider type.
 */
export function getAdapterInfo(providerType: string): { id: string; name: string } | null {
  const adapter = adapters.find(a => a.canHandle(providerType));
  if (!adapter) return null;
  return { id: adapter.id, name: adapter.name };
}

// ── Local discovery ────────────────────────────────────

export interface LocalDiscovery {
  id: string;
  name: string;
  type: string;
  baseURL: string;
  reachable: boolean;
  latencyMs: number;
  modelsCount?: number;
}

export async function discoverLocalProviders(): Promise<LocalDiscovery[]> {
  const discoveries: LocalDiscovery[] = [];

  // Check Ollama on port 11434
  const ollama = await checkLocalProvider('ollama', 'Ollama', 'http://localhost:11434');
  discoveries.push(ollama);

  // Check LM Studio on port 1234
  const lmstudio = await checkLocalProvider('lmstudio', 'LM Studio', 'http://localhost:1234');
  discoveries.push(lmstudio);

  return discoveries;
}

async function checkLocalProvider(id: string, name: string, baseURL: string): Promise<LocalDiscovery> {
  const start = Date.now();
  try {
    const modelsURL = `${baseURL.replace(/\/+$/, '')}/v1/models`;
    const res = await fetch(modelsURL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const data = await res.json() as any;
      const models = Array.isArray(data?.data) ? data.data.length : 0;
      return { id, name, type: 'openai-compatible', baseURL, reachable: true, latencyMs, modelsCount: models };
    }
    return { id, name, type: 'openai-compatible', baseURL, reachable: false, latencyMs: Date.now() - start };
  } catch {
    return { id, name, type: 'openai-compatible', baseURL, reachable: false, latencyMs: Date.now() - start };
  }
}
