import type { ProviderAdapter, ProviderChatRequest, ProviderEvent, ProviderStreamOptions } from './types';

/**
 * OpenAI-compatible adapter.
 * Handles: OpenAI, MiniMax, DeepSeek, xAI, Mistral, Z.AI, OpenRouter, Ollama, LM Studio, and any
 * provider that follows the /v1/chat/completions API format.
 */
export class OpenAIAdapter implements ProviderAdapter {
  id = 'openai-compatible';
  name = 'OpenAI Compatible';
  supportedTypes = ['openai-compatible', 'local', 'custom'];

  canHandle(providerType: string): boolean {
    return this.supportedTypes.includes(providerType);
  }

  async *streamChat(request: ProviderChatRequest, options: ProviderStreamOptions): AsyncGenerator<ProviderEvent> {
    const url = this.buildChatURL(options.baseURL);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
      headers['x-api-key'] = options.apiKey;
    }

    const body: any = {
      model: request.model,
      messages: request.messages,
      stream: true,
    };
    if (request.max_tokens) body.max_tokens = request.max_tokens;
    if (request.temperature != null) body.temperature = request.temperature;
    if (request.tools && request.tools.length > 0) body.tools = request.tools;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: options.signal,
      });
    } catch (err: any) {
      yield { type: 'error', error: err.message || 'Connection failed' };
      return;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      yield { type: 'error', error: `HTTP ${response.status}: ${errText.slice(0, 500)}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Track tool calls being built incrementally
    const activeToolCalls = new Map<string, { name: string; arguments: string }>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          const payload = trimmed.slice(6);
          if (!payload) continue;

          let chunk: any;
          try { chunk = JSON.parse(payload); } catch { continue; }

          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          // Text content
          if (delta.content) {
            yield { type: 'text_delta', text: delta.content };
          }

          // Reasoning/thinking content (some providers)
          if (delta.reasoning_content) {
            yield { type: 'thinking_delta', text: delta.reasoning_content };
          }

          // Tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const tcId = tc.id || `tc-${Date.now()}`;
              const existing = activeToolCalls.get(tcId);

              if (tc.id) {
                // New tool call or update with name
                if (!existing) {
                  activeToolCalls.set(tcId, {
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  });
                }
                if (tc.function?.name) {
                  if (existing) existing.name = tc.function.name;
                  else activeToolCalls.get(tcId)!.name = tc.function.name;
                }
                yield {
                  type: 'tool_call_delta',
                  id: tcId,
                  name: tc.function?.name,
                  argumentsDelta: tc.function?.arguments,
                };
              } else if (tc.function?.arguments && existing) {
                // Continuation of arguments
                existing.arguments += tc.function.arguments;
                yield {
                  type: 'tool_call_delta',
                  id: tcId,
                  argumentsDelta: tc.function.arguments,
                };
              }
            }
          }

          // Finish reason — emit tool_call_done for any active tool calls
          if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
            for (const [id, tc] of activeToolCalls) {
              yield { type: 'tool_call_done', id, name: tc.name, arguments: tc.arguments };
            }
            activeToolCalls.clear();
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }

  private buildChatURL(baseURL: string): string {
    const base = baseURL.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(base)) return base;
    if (/\/v\d+$/i.test(base)) return `${base}/chat/completions`;
    if (base.includes('/v1/')) return `${base.split('/v1/')[0]}/v1/chat/completions`;
    return `${base}/v1/chat/completions`;
  }
}
