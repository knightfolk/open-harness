// ── Universal Provider Adapter Types ───────────────────

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ProviderToolCall[];
  tool_call_id?: string;
  /**
   * Optional function name. Carried on `tool` messages so adapters that
   * need the function name to echo the result back (notably Gemini's
   * functionResponse) have it. Anthropic does not need it; it derives the
   * match from `tool_call_id` against the assistant's tool_use block.
   */
  name?: string;
}

export interface ProviderToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ProviderTool {
  type: 'function';
  function: { name: string; description?: string; parameters?: any };
}

export interface ProviderChatRequest {
  model: string;
  messages: ProviderMessage[];
  stream: boolean;
  max_tokens?: number;
  temperature?: number;
  tools?: ProviderTool[];
}

export type ProviderEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'tool_call_delta'; id: string; name?: string; argumentsDelta?: string }
  | { type: 'tool_call_done'; id: string; name: string; arguments: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export interface ProviderAdapter {
  /** Unique identifier for this adapter type */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider types this adapter handles */
  supportedTypes: string[];
  /** Stream a chat completion, yielding events */
  streamChat(request: ProviderChatRequest, options: ProviderStreamOptions): AsyncGenerator<ProviderEvent>;
  /** Test if the adapter can handle a given provider type */
  canHandle(providerType: string): boolean;
}

export interface ProviderStreamOptions {
  baseURL: string;
  apiKey: string;
  signal?: AbortSignal;
}
