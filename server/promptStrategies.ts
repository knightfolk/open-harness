/**
 * Versioned prompt strategy database.
 *
 * Model profiles describe capability and transport behavior. Prompt strategies
 * describe how to shape instructions for a model family and task style.
 *
 * Sources are tracked in docs/PROMPT_STRATEGY_DATABASE_PLAN.md.
 */

import { detectModelFamily } from './modelProfiles';

export type PromptSystemStyle = 'outcome-first' | 'structured' | 'xml-tagged' | 'concise' | 'minimal';
export type PromptInstructionPlacement = 'system' | 'developer' | 'first-user' | 'repeat-in-user';
export type PromptContextOrder = 'instructions-first' | 'context-first-query-last' | 'short-context-inline';
export type PromptExamplePolicy = 'none' | 'one-shot' | 'few-shot' | 'format-only';
export type PromptReasoningPolicy = 'native' | 'effort-param' | 'brief-private-plan' | 'none';
export type PromptToolPolicy = 'native-tools' | 'json-contract' | 'plain-text-tools';
export type PromptOutputContract = 'proof-first' | 'findings-first' | 'concise-answer' | 'artifact-first';
export type PromptStrategyTaskType = 'coding' | 'planning' | 'review' | 'summarization' | 'reasoning' | 'tool-use' | 'direct';

export interface PromptStrategyVariant {
  id: string;
  roles: string[];
  taskTypes: PromptStrategyTaskType[];
  selectionHint: string;
  outputContract?: PromptOutputContract;
  reasoningPolicy?: PromptReasoningPolicy;
  toolPolicy?: PromptToolPolicy;
  examplePolicy?: PromptExamplePolicy;
}

export interface PromptStrategyBestPracticeNote {
  id: string;
  sourceRef: string;
  appliesTo: string[];
  guidance: string;
  rationale: string;
  evaluationCue: string;
}

export interface PromptStrategyProfile {
  id: string;
  family: string;
  appliesTo: string[];
  sourceRefs: string[];
  bestPracticeNotes: PromptStrategyBestPracticeNote[];
  updatedAt: string;
  systemStyle: PromptSystemStyle;
  maxSystemPromptTokens: number;
  instructionPlacement: PromptInstructionPlacement;
  contextOrder: PromptContextOrder;
  examplePolicy: PromptExamplePolicy;
  reasoningPolicy: PromptReasoningPolicy;
  toolPolicy: PromptToolPolicy;
  outputContract: PromptOutputContract;
  variants: PromptStrategyVariant[];
  strengths: string[];
  risks: string[];
  recommendedTests: string[];
}

export interface PromptStrategyTrace {
  id: string;
  family: string;
  modelMatch?: {
    source: 'applies-to' | 'detected-family' | 'fallback';
    hint: string;
  };
  systemStyle: PromptSystemStyle;
  contextOrder: PromptContextOrder;
  examplePolicy: PromptExamplePolicy;
  reasoningPolicy: PromptReasoningPolicy;
  toolPolicy: PromptToolPolicy;
  outputContract: PromptOutputContract;
  variantId?: string;
  role?: string;
  taskType?: PromptStrategyTaskType;
  selectionReason?: string;
  bestPractice?: {
    guidance: string;
    rationale: string;
    evaluationCue: string;
    sourceRef: string;
  };
  updatedAt: string;
}

const UPDATED_AT = '2026-06-17';

export const PROMPT_STRATEGY_SOURCES = {
  openaiPromptEngineering: 'https://platform.openai.com/docs/guides/prompt-engineering',
  openaiPromptGuidance: 'https://platform.openai.com/docs/guides/prompt-guidance',
  anthropicPromptEngineeringOverview: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview',
  anthropicClaudeBestPractices: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/multishot-prompting',
  geminiPromptStrategies: 'https://ai.google.dev/gemini-api/docs/prompting-strategies',
  mistralPromptEngineering: 'https://docs.mistral.ai/models/best-practices/prompt-engineering',
  mistralFunctionCalling: 'https://docs.mistral.ai/studio-api/conversations/function-calling',
  mistralPromptingCapabilities: 'https://docs.mistral.ai/resources/cookbooks/mistral-prompting-prompting_capabilities',
  xaiOverview: 'https://docs.x.ai/overview',
  xaiFunctionCalling: 'https://docs.x.ai/guides/function-calling',
  openHarnessGuide: 'docs/MODEL_PROMPTING_GUIDE.md',
} as const;

function sourceBackedBestPracticeNotes(family: string): PromptStrategyBestPracticeNote[] {
  const common: PromptStrategyBestPracticeNote[] = [
    {
      id: `${family}-success-evals`,
      sourceRef: PROMPT_STRATEGY_SOURCES.anthropicPromptEngineeringOverview,
      appliesTo: ['all'],
      guidance: 'Define success criteria and an eval/proof loop before treating prompt edits as improvements.',
      rationale: 'Prompt changes should be measured against the intended task behavior instead of accepted because they read better.',
      evaluationCue: 'Compare same-model outputs across prompt strategies in Model Lab and keep the winning strategy tied to proof.',
    },
  ];
  if (family === 'openai') {
    return [
      {
        id: 'openai-outcome-contract',
        sourceRef: PROMPT_STRATEGY_SOURCES.openaiPromptEngineering,
        appliesTo: ['direct', 'coding', 'tool-use', 'review'],
        guidance: 'Use short outcome-first instructions with explicit success criteria, constraints, evidence expectations, and final output shape.',
        rationale: 'OpenAI prompt guidance emphasizes clear task goals and structured outputs over large inherited prompt stacks.',
        evaluationCue: 'Check whether direct answers start with the result and tool-heavy runs preserve proof without extra monologue.',
      },
      ...common,
    ];
  }
  if (family === 'anthropic') {
    return [
      {
        id: 'anthropic-xml-role-examples',
        sourceRef: PROMPT_STRATEGY_SOURCES.anthropicClaudeBestPractices,
        appliesTo: ['planning', 'review', 'reasoning', 'tool-use'],
        guidance: 'Use explicit role framing, XML-style section boundaries, and examples when output consistency matters.',
        rationale: 'Claude guidance highlights clarity, examples, XML structuring, thinking guidance, and agentic-system prompts.',
        evaluationCue: 'Inspect Prompt Microscope for XML-tagged sections and compare review findings consistency across examples/no-examples variants.',
      },
      ...common,
    ];
  }
  if (family === 'gemini') {
    return [
      {
        id: 'gemini-specific-iterative',
        sourceRef: PROMPT_STRATEGY_SOURCES.geminiPromptStrategies,
        appliesTo: ['planning', 'reasoning', 'multimodal', 'tool-use'],
        guidance: 'Use clear, specific task instructions and iterate prompt templates by task type instead of one generic universal prompt.',
        rationale: 'Gemini prompt design guidance frames prompting as iterative, task-specific prompt design.',
        evaluationCue: 'Run same-task Model Lab packs across Gemini strategy variants and compare artifact quality, not only latency.',
      },
      ...common,
    ];
  }
  if (family === 'grok') {
    return [
      {
        id: 'grok-tooling-first',
        sourceRef: PROMPT_STRATEGY_SOURCES.xaiFunctionCalling,
        appliesTo: ['tool-use', 'direct', 'coding'],
        guidance: 'Keep tooling instructions explicit and concise, anchor outputs with direct execution evidence, and constrain output shape before examples.',
        rationale: 'xAI documentation emphasizes function-calling compatibility and disciplined tool selection behavior.',
        evaluationCue: 'Compare first-call tool success rates for Grok when tool instructions include clear schema and success-only reporting.',
      },
      {
        id: 'grok-response-calibration',
        sourceRef: PROMPT_STRATEGY_SOURCES.xaiOverview,
        appliesTo: ['direct', 'reasoning', 'review'],
        guidance: 'Favor concise, outcome-first responses with minimal extra narration for direct and review tasks.',
        rationale: 'Grok guidance favors focused instruction delivery and concise language in production prompts.',
        evaluationCue: 'Check that Grok starts with the requested outcome and avoids adding speculative planning monologues.',
      },
      ...common,
    ];
  }
  if (family === 'mistral') {
    return [
      {
        id: 'mistral-structured-output-tools',
        sourceRef: PROMPT_STRATEGY_SOURCES.mistralPromptEngineering,
        appliesTo: ['classification', 'tool-use', 'routing', 'summarization'],
        guidance: 'Use concise role/task purpose, explicit output format, and JSON/structured output when reliability matters.',
        rationale: 'Mistral docs contrast direct labels with JSON output and recommend structured formats for more reliable downstream processing.',
        evaluationCue: 'Measure whether Mistral-family runs follow requested JSON/tool contracts without whitespace-sensitive drift.',
      },
      {
        id: 'mistral-tool-choice-contract',
        sourceRef: PROMPT_STRATEGY_SOURCES.mistralFunctionCalling,
        appliesTo: ['tool-use'],
        guidance: 'Keep tool descriptions, parameters, required fields, and tool-choice policy explicit for tool-heavy prompts.',
        rationale: 'Mistral function-calling guidance separates deciding whether to use a tool from generating required tool arguments.',
        evaluationCue: 'Compare first-call tool error rate before and after tool-contract prompt changes.',
      },
      ...common,
    ];
  }
  return [
    {
      id: `${family}-local-compact-contract`,
      sourceRef: PROMPT_STRATEGY_SOURCES.openHarnessGuide,
      appliesTo: ['coding', 'tool-use', 'direct'],
      guidance: 'Keep the prompt compact, repeat critical constraints close to the user request for weaker instruction followers, and prefer structured JSON contracts when native tool calling is weak.',
      rationale: 'OpenHarness model-family guidance records that smaller/open models vary in system-prompt strength and tool reliability.',
      evaluationCue: 'Track prompt-strategy variant, first-call tool errors, retry distance, and final proof quality by model family.',
    },
    ...common,
  ];
}

export const PROMPT_STRATEGY_PROFILES: Record<string, PromptStrategyProfile> = {
  openai: {
    id: 'openai-outcome-first-v1',
    family: 'openai',
    appliesTo: ['gpt', 'openai', 'codex', 'o-series'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.openaiPromptEngineering, PROMPT_STRATEGY_SOURCES.openaiPromptGuidance],
    bestPracticeNotes: sourceBackedBestPracticeNotes('openai'),
    updatedAt: UPDATED_AT,
    systemStyle: 'outcome-first',
    maxSystemPromptTokens: 2000,
    instructionPlacement: 'developer',
    contextOrder: 'instructions-first',
    examplePolicy: 'format-only',
    reasoningPolicy: 'effort-param',
    toolPolicy: 'native-tools',
    outputContract: 'proof-first',
    variants: defaultPromptStrategyVariants('openai'),
    strengths: ['short outcome-first contracts', 'snapshot-specific evals', 'tool-heavy agent workflows'],
    risks: ['legacy process-heavy prompts can add noise', 'reasoning effort should be measured before escalation'],
    recommendedTests: ['test:prompt-routing-quality-readiness', 'test:prompt-routing-output-p0'],
  },
  anthropic: {
    id: 'anthropic-xml-evidence-v1',
    family: 'anthropic',
    appliesTo: ['claude', 'anthropic'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.anthropicPromptEngineeringOverview, PROMPT_STRATEGY_SOURCES.anthropicClaudeBestPractices],
    bestPracticeNotes: sourceBackedBestPracticeNotes('anthropic'),
    updatedAt: UPDATED_AT,
    systemStyle: 'xml-tagged',
    maxSystemPromptTokens: 4000,
    instructionPlacement: 'system',
    contextOrder: 'context-first-query-last',
    examplePolicy: 'few-shot',
    reasoningPolicy: 'brief-private-plan',
    toolPolicy: 'native-tools',
    outputContract: 'proof-first',
    variants: defaultPromptStrategyVariants('anthropic'),
    strengths: ['XML section boundaries', 'role prompting', 'structured examples', 'long-context evidence extraction'],
    risks: ['unstructured long prompts can blur instructions and examples', 'long-context work needs explicit quote/evidence grounding'],
    recommendedTests: ['test:prompt-routing-quality-readiness', 'test:routing-adherence'],
  },
  gemini: {
    id: 'gemini-specific-iterative-v1',
    family: 'gemini',
    appliesTo: ['gemini', 'google'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.geminiPromptStrategies],
    bestPracticeNotes: sourceBackedBestPracticeNotes('gemini'),
    updatedAt: UPDATED_AT,
    systemStyle: 'structured',
    maxSystemPromptTokens: 4000,
    instructionPlacement: 'system',
    contextOrder: 'instructions-first',
    examplePolicy: 'one-shot',
    reasoningPolicy: 'brief-private-plan',
    toolPolicy: 'native-tools',
    outputContract: 'artifact-first',
    variants: defaultPromptStrategyVariants('gemini'),
    strengths: ['clear specific task instructions', 'iterative templates', 'large context and multimodal task framing'],
    risks: ['generic prompts underuse Gemini-specific strengths', 'prompt changes should be measured by task type'],
    recommendedTests: ['test:prompt-routing-output-p0', 'test:routing-adherence'],
  },
  mistral: {
    id: 'mistral-structured-purpose-v1',
    family: 'mistral',
    appliesTo: ['mistral', 'devstral', 'codestral'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.mistralPromptEngineering, PROMPT_STRATEGY_SOURCES.mistralPromptingCapabilities],
    bestPracticeNotes: sourceBackedBestPracticeNotes('mistral'),
    updatedAt: UPDATED_AT,
    systemStyle: 'structured',
    maxSystemPromptTokens: 2000,
    instructionPlacement: 'system',
    contextOrder: 'instructions-first',
    examplePolicy: 'format-only',
    reasoningPolicy: 'brief-private-plan',
    toolPolicy: 'native-tools',
    outputContract: 'concise-answer',
    variants: defaultPromptStrategyVariants('mistral'),
    strengths: ['clear role and task purpose', 'hierarchical Markdown/XML structure', 'format examples'],
    risks: ['sensitive to prompt whitespace', 'overly broad prompts can cause over-explanation'],
    recommendedTests: ['test:prompt-routing-quality-readiness'],
  },
  deepseek: {
    id: 'deepseek-structured-code-v1',
    family: 'deepseek',
    appliesTo: ['deepseek'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.openHarnessGuide],
    bestPracticeNotes: sourceBackedBestPracticeNotes('deepseek'),
    updatedAt: UPDATED_AT,
    systemStyle: 'structured',
    maxSystemPromptTokens: 2000,
    instructionPlacement: 'system',
    contextOrder: 'instructions-first',
    examplePolicy: 'format-only',
    reasoningPolicy: 'native',
    toolPolicy: 'native-tools',
    outputContract: 'proof-first',
    variants: defaultPromptStrategyVariants('deepseek'),
    strengths: ['structured coding contracts', 'native reasoning variants', 'strong tool use'],
    risks: ['reasoning variants can be excessive for simple tasks', 'tool results must anchor final proof'],
    recommendedTests: ['test:prompt-routing-output-p0', 'test:routing-adherence'],
  },
  qwen: {
    id: 'qwen-xml-code-v1',
    family: 'qwen',
    appliesTo: ['qwen'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.openHarnessGuide],
    bestPracticeNotes: sourceBackedBestPracticeNotes('qwen'),
    updatedAt: UPDATED_AT,
    systemStyle: 'xml-tagged',
    maxSystemPromptTokens: 3000,
    instructionPlacement: 'system',
    contextOrder: 'instructions-first',
    examplePolicy: 'format-only',
    reasoningPolicy: 'native',
    toolPolicy: 'native-tools',
    outputContract: 'proof-first',
    variants: defaultPromptStrategyVariants('qwen'),
    strengths: ['XML-style sections', 'coding and tool discipline', 'large-context variants'],
    risks: ['ambiguous language can drift bilingual', 'long context still needs explicit evidence ordering'],
    recommendedTests: ['test:prompt-routing-quality-readiness', 'test:routing-adherence'],
  },
  minimax: {
    id: 'minimax-long-context-agent-v1',
    family: 'minimax',
    appliesTo: ['minimax', 'm3'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.openHarnessGuide],
    bestPracticeNotes: sourceBackedBestPracticeNotes('minimax'),
    updatedAt: UPDATED_AT,
    systemStyle: 'structured',
    maxSystemPromptTokens: 2000,
    instructionPlacement: 'system',
    contextOrder: 'context-first-query-last',
    examplePolicy: 'format-only',
    reasoningPolicy: 'native',
    toolPolicy: 'native-tools',
    outputContract: 'proof-first',
    variants: defaultPromptStrategyVariants('minimax'),
    strengths: ['long-context coding', 'agentic workflows', 'thinking-capable variants'],
    risks: ['large context can hide relevant evidence', 'provider compatibility differs by endpoint'],
    recommendedTests: ['test:prompt-routing-output-p0'],
  },
  grok: {
    id: 'grok-structured-pragmatic-v1',
    family: 'grok',
    appliesTo: ['grok', 'xai'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.xaiOverview, PROMPT_STRATEGY_SOURCES.xaiFunctionCalling],
    bestPracticeNotes: sourceBackedBestPracticeNotes('grok'),
    updatedAt: UPDATED_AT,
    systemStyle: 'structured',
    maxSystemPromptTokens: 2000,
    instructionPlacement: 'system',
    contextOrder: 'instructions-first',
    examplePolicy: 'format-only',
    reasoningPolicy: 'brief-private-plan',
    toolPolicy: 'native-tools',
    outputContract: 'proof-first',
    variants: defaultPromptStrategyVariants('grok'),
    strengths: ['tight structured instructions', 'explicit tool pathing', 'direct proof-first outputs'],
    risks: ['opinionated tone can appear in unconstrained tasks', 'can over-commit when failure context is weak'],
    recommendedTests: ['test:prompt-routing-output-p0', 'test:routing-adherence'],
  },
  llama: {
    id: 'llama-repeat-rules-v1',
    family: 'llama',
    appliesTo: ['llama'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.openHarnessGuide],
    bestPracticeNotes: sourceBackedBestPracticeNotes('llama'),
    updatedAt: UPDATED_AT,
    systemStyle: 'structured',
    maxSystemPromptTokens: 1500,
    instructionPlacement: 'repeat-in-user',
    contextOrder: 'short-context-inline',
    examplePolicy: 'one-shot',
    reasoningPolicy: 'brief-private-plan',
    toolPolicy: 'json-contract',
    outputContract: 'concise-answer',
    variants: defaultPromptStrategyVariants('llama'),
    strengths: ['direct short contracts', 'repeated key constraints', 'local/open deployment'],
    risks: ['small variants lose system instructions', 'verbose or format-drifting outputs'],
    recommendedTests: ['test:prompt-routing-quality-readiness'],
  },
  gemma: {
    id: 'gemma-concise-first-user-v1',
    family: 'gemma',
    appliesTo: ['gemma'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.openHarnessGuide],
    bestPracticeNotes: sourceBackedBestPracticeNotes('gemma'),
    updatedAt: UPDATED_AT,
    systemStyle: 'concise',
    maxSystemPromptTokens: 500,
    instructionPlacement: 'first-user',
    contextOrder: 'short-context-inline',
    examplePolicy: 'one-shot',
    reasoningPolicy: 'none',
    toolPolicy: 'json-contract',
    outputContract: 'concise-answer',
    variants: defaultPromptStrategyVariants('gemma'),
    strengths: ['short direct prompts', 'simple task framing', 'low-cost worker use'],
    risks: ['weak complex instruction following', 'tool schemas must be simplified'],
    recommendedTests: ['test:prompt-routing-quality-readiness'],
  },
  phi: {
    id: 'phi-minimal-router-v1',
    family: 'phi',
    appliesTo: ['phi'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.openHarnessGuide],
    bestPracticeNotes: sourceBackedBestPracticeNotes('phi'),
    updatedAt: UPDATED_AT,
    systemStyle: 'minimal',
    maxSystemPromptTokens: 300,
    instructionPlacement: 'repeat-in-user',
    contextOrder: 'short-context-inline',
    examplePolicy: 'format-only',
    reasoningPolicy: 'none',
    toolPolicy: 'plain-text-tools',
    outputContract: 'concise-answer',
    variants: defaultPromptStrategyVariants('phi'),
    strengths: ['classification', 'routing', 'small focused tasks'],
    risks: ['poor tool use', 'limited context', 'not a primary coding model'],
    recommendedTests: ['test:routing-adherence'],
  },
  unknown: {
    id: 'unknown-safe-structured-v1',
    family: 'unknown',
    appliesTo: ['unknown', 'custom'],
    sourceRefs: [PROMPT_STRATEGY_SOURCES.openHarnessGuide],
    bestPracticeNotes: sourceBackedBestPracticeNotes('unknown'),
    updatedAt: UPDATED_AT,
    systemStyle: 'structured',
    maxSystemPromptTokens: 1500,
    instructionPlacement: 'system',
    contextOrder: 'instructions-first',
    examplePolicy: 'format-only',
    reasoningPolicy: 'brief-private-plan',
    toolPolicy: 'json-contract',
    outputContract: 'proof-first',
    variants: defaultPromptStrategyVariants('unknown'),
    strengths: ['safe defaults', 'evidence-first output', 'moderate prompt size'],
    risks: ['unknown model behavior', 'must validate with live traces before trusting'],
    recommendedTests: ['test:prompt-routing-quality-readiness', 'test:routing-adherence'],
  },
};

function defaultPromptStrategyVariants(family: string): PromptStrategyVariant[] {
  return [
    {
      id: `${family}-coder-tool-proof`,
      roles: ['coder', 'worker'],
      taskTypes: ['coding', 'tool-use'],
      selectionHint: 'Coding and tool-heavy work should lead with applied result, proof, and concise changed-file evidence.',
      outputContract: 'proof-first',
      toolPolicy: family === 'gemma' || family === 'llama' ? 'json-contract' : family === 'phi' ? 'plain-text-tools' : 'native-tools',
    },
    {
      id: `${family}-review-findings`,
      roles: ['reviewer'],
      taskTypes: ['review'],
      selectionHint: 'Review tasks should lead with findings ordered by severity and evidence before summary.',
      outputContract: 'findings-first',
      examplePolicy: 'format-only',
    },
    {
      id: `${family}-planner-artifact`,
      roles: ['planner'],
      taskTypes: ['planning'],
      selectionHint: 'Planning tasks should produce an artifact-style plan with success criteria, risks, and validation.',
      outputContract: 'artifact-first',
      reasoningPolicy: family === 'phi' || family === 'gemma' ? 'none' : 'brief-private-plan',
    },
    {
      id: `${family}-summary-direct`,
      roles: ['summarizer', 'title'],
      taskTypes: ['summarization', 'direct'],
      selectionHint: 'Summarization and short-answer tasks should stay concise and avoid tool/process sprawl.',
      outputContract: 'concise-answer',
      reasoningPolicy: 'none',
    },
    {
      id: `${family}-reasoning-tradeoff`,
      roles: ['reasoner'],
      taskTypes: ['reasoning'],
      selectionHint: 'Reasoning tasks should expose conclusions and tradeoffs without hidden chain-of-thought.',
      outputContract: 'proof-first',
      reasoningPolicy: family === 'deepseek' || family === 'qwen' || family === 'minimax' ? 'native' : 'brief-private-plan',
    },
  ];
}

const FAMILY_ALIASES: Record<string, string> = {
  gpt: 'openai',
  openai: 'openai',
  codex: 'openai',
  anthropic: 'anthropic',
  claude: 'anthropic',
  devstral: 'mistral',
  codestral: 'mistral',
};

export interface PromptStrategyModelSelection {
  profile: PromptStrategyProfile;
  modelMatch: NonNullable<PromptStrategyTrace['modelMatch']>;
}

export function getPromptStrategySelectionForModel(modelId: string): PromptStrategyModelSelection {
  const normalized = modelId.toLowerCase();
  for (const [family, profile] of Object.entries(PROMPT_STRATEGY_PROFILES)) {
    if (family === 'unknown') continue;
    const hint = profile.appliesTo.find((candidate) => normalized.includes(candidate.toLowerCase()));
    if (hint) {
      return {
        profile,
        modelMatch: { source: 'applies-to', hint },
      };
    }
  }
  const detected = detectModelFamily(modelId);
  const family = FAMILY_ALIASES[detected] || detected;
  const profile = PROMPT_STRATEGY_PROFILES[family];
  if (profile) {
    return {
      profile,
      modelMatch: { source: 'detected-family', hint: family },
    };
  }
  return {
    profile: PROMPT_STRATEGY_PROFILES.unknown,
    modelMatch: { source: 'fallback', hint: detected || 'unknown' },
  };
}

export function getPromptStrategyForModel(modelId: string): PromptStrategyProfile {
  return getPromptStrategySelectionForModel(modelId).profile;
}

export function getPromptStrategyById(strategyId: string | undefined): PromptStrategyProfile | undefined {
  if (!strategyId) return undefined;
  return Object.values(PROMPT_STRATEGY_PROFILES).find((profile) => profile.id === strategyId);
}

export interface PromptStrategySelectionContext {
  role?: string;
  taskDescription?: string;
  hasTools?: boolean;
}

export function inferPromptStrategyTaskType(context: PromptStrategySelectionContext): PromptStrategyTaskType {
  const role = (context.role || '').toLowerCase();
  const task = (context.taskDescription || '').toLowerCase();
  if (role === 'reviewer' || /\b(review|audit|findings|regression|security)\b/.test(task)) return 'review';
  if (role === 'coder' || role === 'worker') return context.hasTools ? 'tool-use' : 'coding';
  if (role === 'planner' || /\b(plan|roadmap|break down|phase|strategy)\b/.test(task)) return 'planning';
  if (role === 'summarizer' || role === 'title' || /\b(summarize|summary|title)\b/.test(task)) return 'summarization';
  if (role === 'reasoner' || /\b(reason|tradeoff|why|diagnose|analyze)\b/.test(task)) return 'reasoning';
  if (context.hasTools || /\b(run|edit|implement|fix|build|test|tool|file|command)\b/.test(task)) return 'tool-use';
  return 'direct';
}

function selectPromptStrategyVariant(profile: PromptStrategyProfile, context?: PromptStrategySelectionContext): PromptStrategyVariant | undefined {
  if (!context) return undefined;
  const role = (context.role || '').toLowerCase();
  const taskType = inferPromptStrategyTaskType(context);
  return profile.variants.find((variant) => variant.roles.includes(role) && variant.taskTypes.includes(taskType))
    || profile.variants.find((variant) => variant.roles.includes(role))
    || profile.variants.find((variant) => variant.taskTypes.includes(taskType));
}

export function toPromptStrategyTrace(
  profile: PromptStrategyProfile,
  context?: PromptStrategySelectionContext,
  modelMatch?: PromptStrategyTrace['modelMatch'],
): PromptStrategyTrace {
  const variant = selectPromptStrategyVariant(profile, context);
  const taskType = context ? inferPromptStrategyTaskType(context) : undefined;
  const bestPractice = profile.bestPracticeNotes?.[0];
  return {
    id: profile.id,
    family: profile.family,
    ...(modelMatch ? { modelMatch } : {}),
    systemStyle: profile.systemStyle,
    contextOrder: profile.contextOrder,
    examplePolicy: variant?.examplePolicy || profile.examplePolicy,
    reasoningPolicy: variant?.reasoningPolicy || profile.reasoningPolicy,
    toolPolicy: variant?.toolPolicy || profile.toolPolicy,
    outputContract: variant?.outputContract || profile.outputContract,
    ...(variant ? { variantId: variant.id } : {}),
    ...(context?.role ? { role: context.role } : {}),
    ...(taskType ? { taskType } : {}),
    ...(variant ? { selectionReason: variant.selectionHint } : {}),
    ...(bestPractice ? {
      bestPractice: {
        guidance: bestPractice.guidance,
        rationale: bestPractice.rationale,
        evaluationCue: bestPractice.evaluationCue,
        sourceRef: bestPractice.sourceRef,
      },
    } : {}),
    updatedAt: profile.updatedAt,
  };
}
