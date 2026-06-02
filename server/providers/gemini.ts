import type { ProviderAdapter, ProviderChatRequest, ProviderEvent, ProviderStreamOptions } from './types';

/**
 * Google Gemini adapter.
 *
 * Streaming is implemented against :streamGenerateContent?alt=sse with a real
 * SSE parser. The non-streaming :generateContent endpoint is kept as a
 * fallback for callers that explicitly disable streaming. Function calls are
 * emitted as tool_call_done; the chat loop is responsible for round-tripping
 * functionResponse parts on the next turn.
 */
export class GeminiAdapter implements ProviderAdapter {
  id = 'gemini';
  name = 'Google Gemini';
  supportedTypes = ['google'];

  canHandle(providerType: string): boolean {
    return providerType === 'google';
  }

  async *streamChat(request: ProviderChatRequest, options: ProviderStreamOptions): AsyncGenerator<ProviderEvent> {
    const useStream = request.stream !== false;
    const url = this.buildURL(options.baseURL, options.apiKey, request.model, useStream);

    const contents = this.convertMessages(request.messages);
    const systemInstruction = request.systemInstruction || request.messages
      .filter(msg => msg.role === 'system' && msg.content)
      .map(msg => msg.content)
      .join('\n\n');
    const body: any = { contents, generationConfig: {} };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (request.max_tokens) body.generationConfig.maxOutputTokens = request.max_tokens;
    if (request.temperature != null) body.generationConfig.temperature = request.temperature;
    if (request.tools && request.tools.length > 0) {
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

    if (useStream) {
      if (!response.body) {
        yield { type: 'error', error: 'No response body' };
        return;
      }
      yield* this.parseSSE(response.body);
    } else {
      yield* this.parseNonStreaming(response);
    }
  }

  // ── SSE path ─────────────────────────────────────────
  private async *parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<ProviderEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Gemini streams as a JSON array split across multiple `data:` lines:
        //   data: { "candidates": [...] }
        //   data: { "candidates": [...] }
        // We accumulate the buffer into a single JSON document by joining
        // each `data:` payload with a comma, then parse once per pass.
        const events = this.collectSSEEvents(buffer);
        if (events) {
          for (const ev of events) yield ev;
          // Consume everything up to the last fully-formed record.
          const lastDouble = buffer.lastIndexOf('\n\n');
          if (lastDouble !== -1) buffer = buffer.slice(lastDouble + 2);
        }
      }
    } finally {
      reader.releaseLock();
    }
    yield { type: 'done' };
  }

  // Pulls complete SSE records out of the buffer and converts them to events.
  // Returns null if we don't yet have any fully-terminated record to consume.
  private collectSSEEvents(buffer: string): ProviderEvent[] | null {
    const lastDouble = buffer.lastIndexOf('\n\n');
    if (lastDouble === -1) return null;

    const out: ProviderEvent[] = [];
    const records = buffer.slice(0, lastDouble).split('\n\n');
    for (const record of records) {
      const lines = record.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        let payload = trimmed.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') continue;
        // Strip a trailing comma so we can parse a streaming array of objects
        // as a single document.
        if (payload.endsWith(',')) payload = payload.slice(0, -1);
        for (const ev of this.eventsFromPayload(payload)) out.push(ev);
      }
    }
    return out;
  }

  private *eventsFromPayload(payload: string): Generator<ProviderEvent> {
    let parsed: any;
    try { parsed = JSON.parse(payload); } catch { return; }

    const candidates: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.candidates) ? parsed.candidates
        : parsed?.candidates ? [parsed.candidates]
          : [];

    for (const candidate of candidates) {
      const parts: any[] = candidate?.content?.parts || [];
      for (const part of parts) {
        if (typeof part?.text === 'string' && part.text.length > 0) {
          yield { type: 'text_delta', text: part.text };
        }
        if (part?.functionCall) {
          const fc = part.functionCall;
          const id = `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const args = JSON.stringify(fc.args || {});
          yield { type: 'tool_call_done', id, name: fc.name || '', arguments: args };
        }
      }
    }
  }

  // ── Non-streaming fallback ───────────────────────────
  private async *parseNonStreaming(response: Response): AsyncGenerator<ProviderEvent> {
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
      yield { type: 'error', error: blockReason ? `Gemini blocked the request: ${blockReason}` : 'Gemini returned no candidates' };
      return;
    }

    for (const candidate of candidates) {
      const parts: any[] = candidate?.content?.parts || [];
      for (const part of parts) {
        if (typeof part?.text === 'string' && part.text.length > 0) {
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

  // ── Helpers ──────────────────────────────────────────
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
              args: this.safeParseArgs(tc.function.arguments),
            },
          });
        }
      }
      if (msg.role === 'tool' && msg.content) {
        parts.push({
          functionResponse: {
            // Gemini needs the function name, not the call id. The chat loop
            // populates `name` on tool messages so we can echo it back here.
            name: msg.name || msg.tool_call_id || 'unknown',
            response: { result: this.parseToolContent(msg.content) },
          },
        });
      }
      if (parts.length > 0) contents.push({ role, parts });
    }
    return contents;
  }

  private safeParseArgs(raw: string | undefined): Record<string, any> {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  }

  private parseToolContent(raw: string): any {
    try { return JSON.parse(raw); } catch { return { content: raw }; }
  }

  private buildURL(baseURL: string, apiKey: string, model: string, stream: boolean): string {
    const base = baseURL.replace(/\/+$/, '');
    const modelPath = model.startsWith('models/') ? model : `models/${model}`;
    const action = stream ? 'streamGenerateContent' : 'generateContent';
    return `${base}/${modelPath}:${action}?alt=sse&key=${encodeURIComponent(apiKey)}`;
  }

  private chunkText(text: string, size = 24): string[] {
    if (text.length <= size) return [text];
    const out: string[] = [];
    for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
    return out;
  }
}
