import type { ProviderAdapter, ProviderChatRequest, ProviderEvent, ProviderStreamOptions } from './types';

/**
 * Anthropic Messages API adapter.
 * Uses SSE with the Anthropic-specific event format.
 */
export class AnthropicAdapter implements ProviderAdapter {
  id = 'anthropic';
  name = 'Anthropic';
  supportedTypes = ['anthropic'];

  canHandle(providerType: string): boolean {
    return providerType === 'anthropic';
  }

  async *streamChat(request: ProviderChatRequest, options: ProviderStreamOptions): AsyncGenerator<ProviderEvent> {
    const url = this.buildURL(options.baseURL);

    // Separate system message from conversation
    const systemMsg = request.messages.find(m => m.role === 'system');
    const convMessages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => this.normalizeMessage(m));

    const body: any = {
      model: request.model,
      messages: convMessages,
      stream: true,
      max_tokens: request.max_tokens || 8192,
    };
    if (systemMsg?.content) body.system = systemMsg.content;
    if (request.temperature != null) body.temperature = request.temperature;
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(t => ({
        name: t.function.name,
        description: t.function.description || '',
        input_schema: t.function.parameters || { type: 'object', properties: {} },
      }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (options.apiKey) {
      headers['x-api-key'] = options.apiKey;
    }

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
    let currentToolId = '';
    let currentToolName = '';
    let currentToolArgs = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (!payload) continue;

          let event: any;
          try { event = JSON.parse(payload); } catch { continue; }

          const eventType = event.type;

          if (eventType === 'content_block_delta') {
            const delta = event.delta;
            if (delta?.type === 'text_delta' && delta.text) {
              yield { type: 'text_delta', text: delta.text };
            }
            if (delta?.type === 'thinking_delta' && delta.thinking) {
              yield { type: 'thinking_delta', text: delta.thinking };
            }
            if (delta?.type === 'input_json_delta' && delta.partial_json) {
              currentToolArgs += delta.partial_json;
              yield { type: 'tool_call_delta', id: currentToolId, argumentsDelta: delta.partial_json };
            }
          }

          if (eventType === 'content_block_start') {
            const block = event.content_block;
            if (block?.type === 'tool_use') {
              currentToolId = block.id || `tc-${Date.now()}`;
              currentToolName = block.name || '';
              currentToolArgs = '';
              yield { type: 'tool_call_delta', id: currentToolId, name: currentToolName };
            }
          }

          if (eventType === 'content_block_stop') {
            if (currentToolId && currentToolName) {
              yield { type: 'tool_call_done', id: currentToolId, name: currentToolName, arguments: currentToolArgs };
              currentToolId = '';
              currentToolName = '';
              currentToolArgs = '';
            }
          }

          if (eventType === 'error') {
            yield { type: 'error', error: event.error?.message || 'Unknown Anthropic error' };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }

  private normalizeMessage(msg: any): any {
    // Anthropic uses 'user' and 'assistant' only (no 'tool' role, uses tool_result content blocks)
    if (msg.role === 'tool') {
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: msg.content,
        }],
      };
    }
    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      const content: any[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || '{}'),
        });
      }
      return { role: 'assistant', content };
    }
    return { role: msg.role, content: msg.content || '' };
  }

  private buildURL(baseURL: string): string {
    const base = baseURL.replace(/\/+$/, '');
    if (/\/messages$/.test(base)) return base;
    if (/\/v\d+$/.test(base)) return `${base}/messages`;
    return `${base}/v1/messages`;
  }
}
