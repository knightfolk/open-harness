import type { ProviderAdapter, ProviderChatRequest, ProviderEvent, ProviderStreamOptions } from './types';

/**
 * Google Gemini adapter.
 * Uses the generateContent streaming endpoint.
 */
export class GeminiAdapter implements ProviderAdapter {
  id = 'gemini';
  name = 'Google Gemini';
  supportedTypes = ['google'];

  canHandle(providerType: string): boolean {
    return providerType === 'google';
  }

  async *streamChat(request: ProviderChatRequest, options: ProviderStreamOptions): AsyncGenerator<ProviderEvent> {
    const url = this.buildURL(options.baseURL, options.apiKey, request.model);

    // Convert messages to Gemini format
    const contents = this.convertMessages(request.messages);
    const body: any = {
      contents,
      generationConfig: {},
    };
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

    const data = await response.json() as any;
    const candidates = data.candidates || [];

    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.text) {
          yield { type: 'text_delta', text: part.text };
        }
        if (part.functionCall) {
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
      if (msg.role === 'system') continue; // Gemini uses systemInstruction, skip for now
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

  private buildURL(baseURL: string, apiKey: string, model: string): string {
    const base = baseURL.replace(/\/+$/, '');
    const modelPath = model.startsWith('models/') ? model : `models/${model}`;
    // Gemini streaming endpoint
    return `${base}/${modelPath}:streamGenerateContent?alt=sse&key=${apiKey}`;
  }
}
