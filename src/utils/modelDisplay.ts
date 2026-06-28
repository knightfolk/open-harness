const KNOWN_MODEL_FAMILIES: Array<[RegExp, string]> = [
  [/minimax/i, 'MiniMax'],
  [/claude|anthropic/i, 'Claude'],
  [/gemini|google/i, 'Gemini'],
  [/gpt|openai/i, 'GPT'],
  [/grok|xai/i, 'Grok'],
  [/llama/i, 'Llama'],
  [/qwen/i, 'Qwen'],
  [/glm|zhipu/i, 'GLM'],
  [/deepseek/i, 'DeepSeek'],
  [/mistral|mixtral/i, 'Mistral'],
  [/ollama/i, 'Ollama'],
];

/**
 * Convert a provider model id into a compact chat sender label.
 * Examples: MiniMax-M2.7 -> MiniMax, claude-sonnet-4 -> Claude, gemini-2.5-pro -> Gemini.
 */
export function shortModelName(modelId?: string | null): string {
  const value = modelId?.trim();
  if (!value) return 'AI';

  const known = KNOWN_MODEL_FAMILIES.find(([pattern]) => pattern.test(value));
  if (known) return known[1];

  return value
    .replace(/^[^/:]+[:/]/, '')
    .split(/[-_\s.]/)[0]
    .replace(/[^a-z0-9]+/gi, '') || 'AI';
}
