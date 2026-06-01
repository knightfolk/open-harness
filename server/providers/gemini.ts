import type { ProviderAdapter, ProviderChatRequest, ProviderEvent, ProviderStreamOptions } from './types';

/**
 * Google Gemini adapter.
 *
 * Uses the non-streaming :generateContent endpoint and emits a sequence of
 * text_delta events from the JSON response. This is intentionally simple:
 * SSE on :streamGenerateContent returned a stream we could not safely parse
 * with response.json(), so we trade a small latency hit for a reliable
 * implementation. Function calls are detected and emitted as tool_call_done
 * but the surrounding chat loop does not yet round-trip them — see PLAN.md.
 */
export class GeminiAdapter implements ProviderAdapter {
  id = 'gemini';
  name = 'Google Gemini';
  supportedTypes = ['google'];

  canHandle(providerType: string): boolean {
    return providerType === 'google';
  }

  async *streamChat(request: ProviderChatRequest, options: ProviderStreamOptions): AsyncGenerator<ProviderEvent> {
    const url = this.buildURL(options.baseURL, options.apiKey, request.model, /* stream */ false);

    const contents = this.convertMessages(request.messages);
    const body: any = { contents, generationConfig: {} };
    if (request.max_tokens) body.generationConfig.maxOutputTokens = request.max_tokens;
    if (request.temperature != null) body.generationConfig.temperature = request.temperature;
    if (request.tools && request.tools.length > 0) {
      // Tools are advertised for future use, but the chat loop does not yet
      // round-trip functionCall/functionResponse for Gemini. Keep this opt-in.
      body.tools = [{ functionDeclarations: request.tools.map(t => ({
        name: t.function.name,
        description: t.function.description || '',
        parameters: t.function.parameters || {},
      }))}];
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    let data: any;
    try {
      data = await response.json();
    } catch (err: any) {
      yield { type: 'error', error: `Invalid JSON from Gemini: ${err.message || 'parse failed'}` };
      return;
    }

    const candidates: any[] = Array.isArray(data?.candidates) ? data.candidates : [];
    if (candidates.length === 0) {
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) {
        yield { type: 'error', error: `Gemini blocked the request: ${blockReason}` };
      } else {
        yield { type: 'error', error: 'Gemini returned no candidates' };
      }
      return;
    }

    for (const candidate of candidates) {
      const parts: any[] = candidate?.content?.parts || [];
      for (const part of parts) {
        if (typeof part?.text === 'string' && part.text.length > 0) {
          // Split into modest chunks so the UI sees a streaming feel.
          for (const chunk of this.chunkText(part.text)) {
            yield { type: 'text_delta', text: chunk };
          }
        }
        if (part?.functionCall) {
          const fc = part.functionCall;
          const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const args = JSON.stringify(fc.args || {});
          yield { type: 'tool_call_done', id, name: fc.name || '', arguments: args };
        }
      }
    }

    yield { type: 'done' };
  }

  private convertMessages(messages: any[]): any[] {
    const contents: any[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') continue; // Gemini uses systemInstruction; skipped for parity with the existing path.
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || '{}'),
            },
          });
        }
      }
      if (msg.role === 'tool' && msg.content) {
        parts.push({
          functionResponse: {
            name: msg.tool_call_id || 'unknown',
            response: { result: msg.content },
          },
        });
      }
      if (parts.length > 0) contents.push({ role, parts });
    }
    return contents;
  }

  private buildURL(baseURL: string, apiKey: string, model: string, stream: boolean): string {
    const base = baseURL.replace(/\/+$/, '');
    const modelPath = model.startsWith('models/') ? model : `models/${model}`;
    // Use the non-streaming :generateContent endpoint. The streaming endpoint
    // returns SSE which we deliberately do not parse here — see file header.
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    return `${base}/${modelPath}:${action}?key=${encodeURIComponent(apiKey)}`;
  }

  private chunkText(text: string, size = 24): string[] {
    if (text.length <= size) return [text];
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out;
  }
}
