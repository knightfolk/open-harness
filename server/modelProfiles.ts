/**
 * Model family detection and per-family prompt configurations.
 * Data source: docs/MODEL_PROMPTING_GUIDE.md (May 2026 research)
 */

// ── Types ──────────────────────────────────────────────

export interface ModelPromptConfig {
  family: string;
  systemPromptStyle: 'structured' | 'concise' | 'xml-tagged' | 'minimal';
  maxSystemPromptTokens: number;
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
  [/\bdeepseek\b/i, 'deepseek'],
  [/\bllama\b/i, 'llama'],
  [/\bqwen\b/i, 'qwen'],
  [/\bdevstral\b/i, 'devstral'],
  [/\bcodestral\b/i, 'codestral'],
  [/\bmistral\b/i, 'mistral'],
  [/\bgemma\b/i, 'gemma'],
  [/\bx-?ai\b|\bgrok\b/i, 'grok'],
  [/\bcommand\b|\bcohere\b/i, 'cohere'],
  [/\bnemotron\b/i, 'nemotron'],
  [/\bglm\b|\bz-?ai\b/i, 'glm'],
  [/\bjamba\b|\bai21\b/i, 'jamba'],
  [/\bphi[\-_]?4?\b/i, 'phi'],
  [/\bminimax\b|\bm2[\.\-]?7?\b/i, 'minimax'],
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
  deepseek: {
    family: 'deepseek',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 2000,
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
    toolCallQuality: 'excellent',
    preferNativeToolCalls: true,
    reasoningSupport: 'prompt-based-cot',
    defaultCodingTemperature: 0.1,
    needsExplicitCotTrigger: false,
    stopSequences: [],
    recommendedMaxTokens: 16000,
    repeatInstructionsInUserMsg: false,
    defaultRole: 'coder',
    quirks: [
      'MiniMax M2.7 default — good all-rounder',
    ],
  },
  unknown: {
    family: 'unknown',
    systemPromptStyle: 'structured',
    maxSystemPromptTokens: 1500,
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
  return MODEL_FAMILY_CONFIGS[family] || MODEL_FAMILY_CONFIGS['unknown'];
}

/** Check if a model is a reasoning/thinking model. */
export function isReasoningModel(modelId: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return (
    /\br1\b/.test(lower) ||
    /\bthinking\b/.test(lower) ||
    /\breasoning\b/.test(lower) ||
    lower.includes('grok-4')
  );
}

/** Get ordered model family recommendations for a given agent role. */
export function getRoleModelRecommendation(role: string): string[] {
  const recommendations: Record<string, string[]> = {
    coder: ['qwen', 'deepseek', 'devstral', 'codestral', 'mistral', 'minimax'],
    reasoner: ['deepseek', 'qwen', 'grok', 'mistral'],
    summarizer: ['deepseek', 'mistral', 'qwen', 'gemma', 'nemotron'],
    title: ['mistral', 'deepseek', 'qwen', 'gemma', 'phi'],
    planner: ['deepseek', 'qwen', 'grok', 'mistral'],
    reviewer: ['qwen', 'deepseek', 'devstral', 'mistral'],
    worker: ['qwen', 'deepseek', 'nemotron', 'mistral'],
    longcontext: ['llama', 'deepseek', 'qwen', 'cohere'],
  };
  return recommendations[role] || recommendations['coder'];
}
