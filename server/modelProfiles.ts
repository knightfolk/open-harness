/**
 * Model family detection and per-family prompt configurations.
 * Data source: docs/MODEL_PROMPTING_GUIDE.md (May 2026 research)
 */

// ── Types ──────────────────────────────────────────────

export interface ModelPromptConfig {
  family: string;
  systemPromptStyle: 'structured' | 'concise' | 'xml-tagged' | 'minimal';
  maxSystemPromptTokens: number;
  /** Total context window in tokens for this model family. */
  contextWindowTokens: number;
  toolCallQuality: 'excellent' | 'good' | 'basic' | 'none';
  preferNativeToolCalls: boolean;
  reasoningSupport: 'native-thinking' | 'prompt-based-cot' | 'none';
  defaultCodingTemperature: number;
  needsExplicitCotTrigger: boolean;
  stopSequences: string[];
  recommendedMaxTokens: number;
  repeatInstructionsInUserMsg: boolean;
  defaultRole: string;
  quirks: string[];
}

// ── Family detection ───────────────────────────────────

const FAMILY_PATTERNS: Array<[RegExp, string]> = [
  [/\bclaude\b|\banthropic\b/i, 'anthropic'],
  [/\bgemini\b|\bgoogle\b/i, 'gemini'],
  [/\bdeepseek\b/i, 'deepseek'],
  [/\bllama\b/i, 'llama'],
  [/qwen[\d._-]?/i, 'qwen'],
  [/\bdevstral\b/i, 'devstral'],
  [/\bcodestral\b/i, 'codestral'],
  [/\bmistral\b/i, 'mistral'],
  [/\bgemma\b/i, 'gemma'],
  [/\bx-?ai\b|\bgrok\b/i, 'grok'],
  [/\bcommand\b|\bcohere\b/i, 'cohere'],
  [/\bnemotron\b/i, 'nemotron'],
  [/\bglm\b|\bz-?ai\b/i, 'glm'],
  [/\bjamba\b|\bai21\b/i, 'jamba'],
  [/phi[\d._-]?/i, 'phi'],
  [/\bminimax\b|\bm[23][.-]?7?\b/i, 'minimax'],
];

/**
 * Detect the model family from a model ID string.
 * Examples: "deepseek/deepseek-v4-flash" → "deepseek", "MiniMax-M2.7" → "minimax"
 */
export function detectModelFamily(modelId: string): string {
  if (!modelId) return 'unknown';
  const lower = modelId.toLowerCase();
  for (const [pattern, family] of FAMILY_PATTERNS) {
    if (pattern.test(lower)) return family;
  }
  return 'unknown';
}

// ── Family configs ─────────────────────────────────────

export const MODEL_FAMILY_CONFIGS: Record<string, ModelPromptConfig> = {
  anthropic: {
    family: 'anthropic',
    systemPromptStyle: 'xml-tagged',
    maxSystemPromptTokens: 4000,
    contextWindowTokens: 200000,
    toolCallQuality: 'excellent',
    preferNativeToolCalls: true,
    reasoningSupport: 'none',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: [],
    recommendedMaxTokens: 16384,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'Uses top-level Messages API system field rather than a system message',
      'XML-tagged instructions and examples work well for Claude 3.5+',
    ],
  },
  gemini: {
    family: 'gemini',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 4000,
    contextWindowTokens: 1000000,
    toolCallQuality: 'good',
    preferNativeToolCalls: true,
    reasoningSupport: 'none',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: [],
    recommendedMaxTokens: 32768,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'Uses top-level systemInstruction instead of system-role contents',
      'Long-context models benefit from larger history budgets',
    ],
  },
  deepseek: {
    family: 'deepseek',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
    contextWindowTokens: 131072,
    toolCallQuality: 'excellent',
    preferNativeToolCalls: true,
    reasoningSupport: 'native-thinking',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: ['<｜end▁of▁sentence｜>'],
    recommendedMaxTokens: 16000,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'Empty assistant turn before tool call — check tool_calls first',
      'R1 reasoning can be excessive for simple tasks',
    ],
  },
  llama: {
    family: 'llama',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 1500,
    contextWindowTokens: 131072,
    toolCallQuality: 'good',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.15,
    needsExplicitCotTrigger: true,
    stopSequences: ['<|eot_id|>'],
    recommendedMaxTokens: 16000,
    repeatInstructionsInUserMsg: true,
    defaultRole: 'coder',
    quirks: [
      'Verbose by default — add length constraints',
      'Weights recent context over system prompt — repeat key rules',
    ],
  },
  qwen: {
    family: 'qwen',
    systemPromptStyle: 'xml-tagged',
    maxSystemPromptTokens: 3000,
    contextWindowTokens: 1000000,
    toolCallQuality: 'excellent',
    preferNativeToolCalls: true,
    reasoningSupport: 'native-thinking',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: ['<|im_end|>'],
    recommendedMaxTokens: 65536,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'May include Chinese characters — specify language explicitly',
      '1M context degrades after ~300K tokens for complex reasoning',
    ],
  },
  mistral: {
    family: 'mistral',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
    contextWindowTokens: 131072,
    toolCallQuality: 'excellent',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: ['</s>'],
    recommendedMaxTokens: 8192,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'Sensitive to whitespace — normalize prompt whitespace',
      'May over-explain — add Be concise when brevity matters',
    ],
  },
  devstral: {
    family: 'devstral',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
    contextWindowTokens: 131072,
    toolCallQuality: 'excellent',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: ['</s>'],
    recommendedMaxTokens: 16384,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'Code-specialized — use for dev tasks only',
      'May generate unescaped shell commands — validate before execution',
    ],
  },
  codestral: {
    family: 'codestral',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
    contextWindowTokens: 32768,
    toolCallQuality: 'good',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: ['</s>'],
    recommendedMaxTokens: 8192,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'Code-specialized — optimized for completion over agent workflows',
    ],
  },
  gemma: {
    family: 'gemma',
    systemPromptStyle: 'concise',
    maxSystemPromptTokens: 500,
    contextWindowTokens: 131072,
    toolCallQuality: 'basic',
    preferNativeToolCalls: false,
    reasoningSupport: 'none',
    defaultCodingTemperature: 0.2,
    needsExplicitCotTrigger: true,
    stopSequences: ['<end_of_turn>'],
    recommendedMaxTokens: 8192,
    repeatInstructionsInUserMsg: true,
    defaultRole: 'summarizer',
    quirks: [
      'Overly cautious — use neutral task-focused framing',
      'Limited system role — embed system instructions in first user message',
    ],
  },
  grok: {
    family: 'grok',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
    contextWindowTokens: 131072,
    toolCallQuality: 'excellent',
    preferNativeToolCalls: true,
    reasoningSupport: 'native-thinking',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: [],
    recommendedMaxTokens: 16384,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'planner',
    quirks: [
      'Can be opinionated — request factual neutral tone',
      'Less transparent reasoning than DeepSeek R1',
    ],
  },
  cohere: {
    family: 'cohere',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
    contextWindowTokens: 131072,
    toolCallQuality: 'good',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.2,
    needsExplicitCotTrigger: false,
    stopSequences: [],
    recommendedMaxTokens: 8192,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'summarizer',
    quirks: [
      'Expensive per token — reserve for RAG tasks',
      '8K max output limit',
    ],
  },
  nemotron: {
    family: 'nemotron',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 1500,
    contextWindowTokens: 131072,
    toolCallQuality: 'basic',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.15,
    needsExplicitCotTrigger: true,
    stopSequences: [],
    recommendedMaxTokens: 16384,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'worker',
    quirks: [
      'Can be overly verbose — add length constraints',
    ],
  },
  glm: {
    family: 'glm',
    systemPromptStyle: 'concise',
    maxSystemPromptTokens: 1000,
    contextWindowTokens: 131072,
    toolCallQuality: 'good',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: [],
    recommendedMaxTokens: 8192,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'May default to Chinese — add Respond in English',
    ],
  },
  jamba: {
    family: 'jamba',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
    contextWindowTokens: 262144,
    toolCallQuality: 'basic',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.15,
    needsExplicitCotTrigger: false,
    stopSequences: [],
    recommendedMaxTokens: 4096,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'summarizer',
    quirks: [
      '4K max output is very limiting',
      'Expensive for capability level',
    ],
  },
  phi: {
    family: 'phi',
    systemPromptStyle: 'minimal',
    maxSystemPromptTokens: 300,
    contextWindowTokens: 16384,
    toolCallQuality: 'none',
    preferNativeToolCalls: false,
    reasoningSupport: 'none',
    defaultCodingTemperature: 0.2,
    needsExplicitCotTrigger: true,
    stopSequences: [],
    recommendedMaxTokens: 4096,
    repeatInstructionsInUserMsg: true,
    defaultRole: 'router',
    quirks: [
      '16K context limit — keep conversations short',
      'May hallucinate outside training distribution',
    ],
  },
  minimax: {
    family: 'minimax',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
    contextWindowTokens: 1000000,
    toolCallQuality: 'excellent',
    preferNativeToolCalls: true,
    reasoningSupport: 'native-thinking',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: [],
    recommendedMaxTokens: 16000,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'MiniMax M3 is frontier model with 1M context, multimodal (image/video), and thinking blocks',
      'M3 supports Anthropic-compatible API at /anthropic/v1/messages (recommended)',
      'M2.7 still available as fallback — context window is 204,800 tokens',
      'M3 default top_p is 0.95 vs 0.9 for M2.x models',
    ],
  },
  unknown: {
    family: 'unknown',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 1500,
    contextWindowTokens: 32768,
    toolCallQuality: 'good',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.15,
    needsExplicitCotTrigger: true,
    stopSequences: [],
    recommendedMaxTokens: 8192,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'Unknown model family — using safe defaults',
    ],
  },
};

// ── Convenience functions ──────────────────────────────

/** Get the full prompt config for a model by detecting its family. */
export function getModelConfig(modelId: string): ModelPromptConfig {
  const family = detectModelFamily(modelId);
  const base = MODEL_FAMILY_CONFIGS[family] || MODEL_FAMILY_CONFIGS['unknown'];
  const lower = modelId.toLowerCase();
  const reasoningSupport = nativeThinkingModelId(lower)
    ? 'native-thinking'
    : base.reasoningSupport === 'none'
      ? 'none'
      : 'prompt-based-cot';
  if (family === 'minimax' && /m2[.-]?7/.test(lower)) {
    return { ...base, reasoningSupport, contextWindowTokens: 204800, recommendedMaxTokens: 16000 };
  }
  if (family === 'gemini' && /gemini-1\.5-pro/.test(lower)) {
    return { ...base, reasoningSupport, contextWindowTokens: 2000000, recommendedMaxTokens: 32768 };
  }
  if (family === 'gemini' && /gemini-1\.5-flash/.test(lower)) {
    return { ...base, reasoningSupport, contextWindowTokens: 1000000, recommendedMaxTokens: 32768 };
  }
  if (family === 'anthropic' && /claude-3[-.]5|claude-3-7|claude-sonnet-4|claude-opus-4/.test(lower)) {
    return { ...base, reasoningSupport, contextWindowTokens: 200000, recommendedMaxTokens: 16384 };
  }
  return { ...base, reasoningSupport };
}

/** Check if a model is a reasoning/thinking model. */
export function isReasoningModel(modelId: string): boolean {
  if (!modelId) return false;
  return nativeThinkingModelId(modelId.toLowerCase());
}

function nativeThinkingModelId(lower: string): boolean {
  return (
    /\b(o[134]|o4|o3|o1)\b/.test(lower) ||
    /\bdeepseek[-_/ ]?(r1|r2|reasoner)\b/.test(lower) ||
    /\b(r1|r2)\b/.test(lower) ||
    /\bthinking\b/.test(lower) ||
    /\bqwen.*think/.test(lower) ||
    /\bqwen3[._-]?\d*[-_/ ]?max\b/.test(lower) ||
    /\bgrok[-_/ ]?4\b/.test(lower) ||
    /\bminimax[-_/ ]?m3\b|\bminimax\/minimax[-_/ ]?m3\b/.test(lower)
  );
}


// ── Rough pricing data (per-million-tokens, USD) ──────
// Input=prompt, output=generation. Used for cost estimation in the StatusBar.
// Source: May 2026 public pricing. Update quarterly.
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // MiniMax
  'MiniMax-M3': { input: 0.15, output: 0.60 },
  'MiniMax-M2.7': { input: 1.50, output: 6.00 },
  // DeepSeek
  'deepseek-chat': { input: 0.27, output: 1.10 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // Anthropic
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-haiku-3-5': { input: 0.80, output: 4.00 },
  // OpenAI
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },
  // Qwen
  'qwen-3-235b': { input: 1.00, output: 4.00 },
  'qwen-3-32b': { input: 0.30, output: 1.20 },
  // Mistral
  'mistral-large': { input: 2.00, output: 8.00 },
  'mistral-small': { input: 0.20, output: 0.80 },
  // Grok
  'grok-3': { input: 3.00, output: 15.00 },
};

const FALLBACK_MODEL_PRICING = { input: 1.00, output: 4.00 };

/** Estimate cost in USD for a given model and token usage. Returns null if model has no pricing. */
export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): { inputCost: number; outputCost: number; total: number } | null {
  const bareId = modelId.includes(':') ? modelId.split(':').slice(1).join(':') : modelId;
  const pricing = MODEL_PRICING[bareId] || MODEL_PRICING[modelId] || null;
  if (!pricing) return null;
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return { inputCost, outputCost, total: inputCost + outputCost };
}

/** Estimate cost with a conservative fallback so unknown models are not ranked as free. */
export function estimateCostForRanking(modelId: string, inputTokens: number, outputTokens: number): { inputCost: number; outputCost: number; total: number; estimated: boolean } {
  const known = estimateCost(modelId, inputTokens, outputTokens);
  if (known) return { ...known, estimated: false };
  const inputCost = (inputTokens / 1_000_000) * FALLBACK_MODEL_PRICING.input;
  const outputCost = (outputTokens / 1_000_000) * FALLBACK_MODEL_PRICING.output;
  return { inputCost, outputCost, total: inputCost + outputCost, estimated: true };
}

/** Get ordered model family recommendations for a given agent role. */
export function getRoleModelRecommendation(role: string): string[] {
  const recommendations: Record<string, string[]> = {
    coder: ['anthropic', 'gemini', 'qwen', 'deepseek', 'devstral', 'codestral', 'mistral', 'minimax'],
    reasoner: ['deepseek', 'qwen', 'grok', 'mistral'],
    summarizer: ['deepseek', 'mistral', 'qwen', 'gemma', 'nemotron'],
    title: ['mistral', 'deepseek', 'qwen', 'gemma', 'phi'],
    planner: ['deepseek', 'qwen', 'grok', 'mistral'],
    reviewer: ['qwen', 'deepseek', 'devstral', 'mistral'],
    worker: ['qwen', 'deepseek', 'nemotron', 'mistral'],
    longcontext: ['gemini', 'anthropic', 'llama', 'deepseek', 'qwen', 'cohere'],
  };
  return recommendations[role] || recommendations['coder'];
}
