import { isGlm5ModelId } from '../../shared/glmModelPreference';

export type PromptStrategyModelMatchSource = 'applies-to' | 'detected-family' | 'fallback';

export interface PromptStrategyModelMatch {
  source: PromptStrategyModelMatchSource;
  hint: string;
}

export interface PromptStrategyModelResolution {
  strategyId: string;
  family: string;
  modelMatch: PromptStrategyModelMatch;
}

interface PromptStrategyModelRule {
  family: string;
  strategyId: string;
  appliesTo: readonly string[];
}

interface PromptStrategyModelOverride {
  match: (modelId: string, normalizedModelId: string) => boolean;
  family: string;
  strategyId: string;
  hint: string;
}

export const PROMPT_STRATEGY_MODEL_RULES: readonly PromptStrategyModelRule[] = Object.freeze([
  { family: 'openai', strategyId: 'openai-outcome-first-v1', appliesTo: ['gpt', 'openai', 'codex', 'o-series'] },
  { family: 'openaiReasoning', strategyId: 'openai-openai-reasoning-v1', appliesTo: ['o1', 'o3'] },
  { family: 'anthropic', strategyId: 'anthropic-xml-evidence-v1', appliesTo: ['claude', 'anthropic'] },
  { family: 'gemini', strategyId: 'gemini-specific-iterative-v1', appliesTo: ['gemini', 'google'] },
  { family: 'mistral', strategyId: 'mistral-structured-purpose-v1', appliesTo: ['mistral', 'devstral', 'codestral'] },
  { family: 'deepseek', strategyId: 'deepseek-structured-code-v1', appliesTo: ['deepseek'] },
  { family: 'qwen', strategyId: 'qwen-xml-code-v1', appliesTo: ['qwen'] },
  { family: 'minimax', strategyId: 'minimax-long-context-agent-v1', appliesTo: ['minimax', 'm3'] },
  { family: 'glm', strategyId: 'glm-compact-english-tool-v1', appliesTo: ['glm', 'z-ai', 'zhipu'] },
  { family: 'grok', strategyId: 'grok-structured-pragmatic-v1', appliesTo: ['grok', 'xai'] },
  { family: 'llama', strategyId: 'llama-repeat-rules-v1', appliesTo: ['llama'] },
  { family: 'gemma', strategyId: 'gemma-concise-first-user-v1', appliesTo: ['gemma'] },
  { family: 'phi', strategyId: 'phi-minimal-router-v1', appliesTo: ['phi'] },
  { family: 'unknown', strategyId: 'unknown-safe-structured-v1', appliesTo: ['unknown', 'custom'] },
]);

export const PROMPT_STRATEGY_MODEL_OVERRIDES: readonly PromptStrategyModelOverride[] = Object.freeze([
  {
    match: (_modelId, normalizedModelId) => /\bo1\b|\bo3\b/i.test(normalizedModelId),
    family: 'openaiReasoning',
    strategyId: 'openai-openai-reasoning-v1',
    hint: 'OpenAI reasoning model IDs (o1/o3) use stricter reasoning-aware contracts.',
  },
  {
    match: (modelId) => isGlm5ModelId(modelId),
    family: 'glm',
    strategyId: 'glm-5-patient-partner-v1',
    hint: 'GLM 5.x model IDs use the patient-partner prompt strategy while older GLM workers stay compact.',
  },
]);

const PROMPT_STRATEGY_BY_FAMILY = new Map(PROMPT_STRATEGY_MODEL_RULES.map((rule) => [rule.family, rule]));
const PROMPT_STRATEGY_BY_ID = new Map(PROMPT_STRATEGY_MODEL_RULES.map((rule) => [rule.strategyId, rule]));

const FAMILY_ALIASES: Record<string, string> = {
  gpt: 'openai',
  openai: 'openai',
  codex: 'openai',
  anthropic: 'anthropic',
  claude: 'anthropic',
  devstral: 'mistral',
  codestral: 'mistral',
};

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
  [/\bglm\b|\bz-?ai\b|\bzhipu\b/i, 'glm'],
  [/phi[\d._-]?/i, 'phi'],
  [/\bminimax\b|\bm[23][.-]?7?\b/i, 'minimax'],
];

function normalizeModelIdForPromptStrategy(modelId: string): string {
  return modelId.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function promptStrategyHintMatches(normalizedModelId: string, hint: string): boolean {
  const normalizedHint = normalizeModelIdForPromptStrategy(hint);
  if (!normalizedHint) return false;
  if (normalizedHint.includes(' ')) {
    return new RegExp(`(?:^| )${normalizedHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`).test(normalizedModelId);
  }
  return normalizedModelId.split(' ').some((token) => (
    token === normalizedHint
    || (token.startsWith(normalizedHint) && /^\d/.test(token.slice(normalizedHint.length)))
  ));
}

function detectPromptStrategyFamily(modelId: string): string {
  if (!modelId) return 'unknown';
  const lower = modelId.toLowerCase();
  for (const [pattern, family] of FAMILY_PATTERNS) {
    if (pattern.test(lower)) return family;
  }
  return 'unknown';
}

export function promptStrategyAppliesTo(strategyId: string): string[] {
  return [...(PROMPT_STRATEGY_BY_ID.get(strategyId)?.appliesTo || [])];
}

export function resolvePromptStrategyForModel(modelId: string): PromptStrategyModelResolution {
  const normalized = normalizeModelIdForPromptStrategy(modelId);
  for (const override of PROMPT_STRATEGY_MODEL_OVERRIDES) {
    if (override.match(modelId, normalized)) {
      return {
        strategyId: override.strategyId,
        family: override.family,
        modelMatch: { source: 'applies-to', hint: override.hint },
      };
    }
  }

  for (const rule of PROMPT_STRATEGY_MODEL_RULES) {
    if (rule.family === 'unknown') continue;
    const hint = rule.appliesTo.find((candidate) => promptStrategyHintMatches(normalized, candidate));
    if (hint) {
      return {
        strategyId: rule.strategyId,
        family: rule.family,
        modelMatch: { source: 'applies-to', hint },
      };
    }
  }

  const detected = detectPromptStrategyFamily(modelId);
  const family = FAMILY_ALIASES[detected] || detected;
  const detectedRule = PROMPT_STRATEGY_BY_FAMILY.get(family);
  if (detectedRule) {
    return {
      strategyId: detectedRule.strategyId,
      family: detectedRule.family,
      modelMatch: { source: 'detected-family', hint: family },
    };
  }

  const fallback = PROMPT_STRATEGY_BY_FAMILY.get('unknown')!;
  return {
    strategyId: fallback.strategyId,
    family: fallback.family,
    modelMatch: { source: 'fallback', hint: detected || 'unknown' },
  };
}

export function promptStrategyIdForModel(modelId: string): string {
  return resolvePromptStrategyForModel(modelId).strategyId;
}
