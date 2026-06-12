import type { HarnessRole } from './runTrace';
import { isAutoRouterEnabled, routeTask, buildRouterSignal } from './autoRouter';
import type { StoredConfig } from './config';
import { hashPrompt, recordRoutingAdherenceEvent } from './routingAdherence';

export type OrchestrationMode = 'direct' | 'plan' | 'investigate' | 'execute' | 'compare';
export type Complexity = 'simple' | 'medium' | 'deep';
export type ModelSelectionPolicy = 'cheap-direct' | 'classifier' | 'escalated';

export interface RouteDecision {
  mode: OrchestrationMode;
  role: HarnessRole;
  complexity: Complexity;
  needsTools: boolean;
  needsValidation: boolean;
  suggestedModels: string[];
  reason: string;
  routerData?: {
    source: 'heuristic' | 'auto';
    heuristicMode?: OrchestrationMode;
    heuristicRole?: HarnessRole;
    heuristicComplexity?: Complexity;
    policy?: string;
    modelSelectionPolicy?: ModelSelectionPolicy;
    signal?: {
      hasImages: boolean;
      turns: number;
      toolCount: number;
      estimatedInputTokens: number;
      artifactCount?: number;
      dirtyGitState?: boolean;
      thinkingEffort?: string;
      requiresStrongToolUse?: boolean;
    };
    candidateScores?: Record<string, number>;
    score?: number;
    cached?: boolean;
    fallback?: boolean;
    classifierModel?: string | null;
    classifierRationale?: string;
  };
}

export interface RouteSignalOptions {
  hasImages?: boolean;
  turns?: number;
  toolCount?: number;
  estimatedInputTokens?: number;
  artifactCount?: number;
  dirtyGitState?: boolean;
  thinkingEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}

const FILE_REFERENCE_RE = /\b(?:[\w-]+\/)*[\w.-]+\.(?:ts|tsx|js|jsx|py|java|go|rs|cpp|c|cs|rb|swift|kt|php|html|css|scss|less|md|json|yml|yaml|toml|sh|bash|mjs|cjs|sql|txt|lock)\b/g;
const CODE_BLOCK_RE = /```[\s\S]*?```/;
const ARTIFACT_NOUN_RE = /\b(?:game|app|application|site|website|tool|demo|prototype|project|artifact|clone|platformer|roguelike|rogue.?like|rpg|shooter|puzzle|arcade|metroidvania|tower defense|flappy|runner|brawler|strategy|simulator|sim)\b/;
const STRONG_TOOL_USE_RE = /\b(?:tool-?heavy|multi-?tool|use (?:the )?(?:tools|mcp|browser|terminal|shell)|mcp|browser\s+screenshot|screenshot|terminal|shell|commands?|run\s+(?:tests?|lint|build|typecheck|validation|smoke|npm|pnpm|yarn|bun)|validate|validation|verify|verification|current diff|git diff|inspect\s+(?:the\s+)?(?:repo|repository|codebase|files?|project))\b/;

function detectFileReferences(text: string): string[] {
  const refs = new Set<string>();
  const matches = text.match(FILE_REFERENCE_RE);
  if (!matches) return [];
  for (const match of matches) refs.add(match.toLowerCase());
  return [...refs];
}

function detectComplexitySignals(text: string, lower: string, fileRefs: string[]) {
  const hasCodeBlock = CODE_BLOCK_RE.test(text);
  const hasShortLength = text.length < 100;
  const hasNoCodeOrFiles = !hasCodeBlock && fileRefs.length === 0;
  const hasLongTask = text.length > 800;
  const hasArchitectureSignal = /\b(architecture|system design|design|refactor|rewrite|migration|multi.?file|comprehensive|large|security|performance|scaling|deployment|pipeline|trade.?off|tradeoffs)\b/.test(lower);
  const hasMultipleFileRefs = fileRefs.length >= 2;
  return {
    hasCodeBlock,
    hasShortLength,
    hasNoCodeOrFiles,
    hasLongTask,
    hasArchitectureSignal,
    hasMultipleFileRefs,
  };
}

function stripNegatedActionPhrases(lower: string) {
  return lower
    .replace(/\b(?:without|do not|don't|dont|no need to|no need for|not asking you to)\s+(?:\w+\s+){0,4}(?:implement|code|fix|debug|change|modify|wire|add|remove|update|refactor|create file|edit|patch)(?:\s+\w+){0,4}/g, ' ')
    .replace(/\b(?:no|without)\s+(?:code|coding|edits?|changes?|patch(?:es)?)\b/g, ' ');
}

export function routeRequest(content: string, activeModel: string, roleAssignments: Record<string, string> = {}): RouteDecision {
  const lower = content.toLowerCase();
  const intentLower = stripNegatedActionPhrases(lower);
  const fileRefs = detectFileReferences(lower);
  const complexitySignals = detectComplexitySignals(content, lower, fileRefs);
  const asksCompare = /\b(compare|versus|vs\.?|which model|model a|model b|judge|evaluate outputs?)\b/.test(intentLower);
  const asksInformationalRunQuestion = /^\s*(?:how|what|where|which)\b[\s\S]{0,120}\brun\b/.test(intentLower);
  const asksInformationalCreationQuestion = /\b(?:how|what|where|which|explain|describe)\b[\s\S]{0,120}\b(?:build|make|create|scaffold|prototype|generate)\b/.test(intentLower);
  const asksExplicitExecution = !asksInformationalRunQuestion && (
    /\bexecute[-\s]?mode\b/.test(intentLower)
    || /\borchestration mode:\s*execute\b/.test(intentLower)
    || /\bdo not stop at (?:a )?plan\b/.test(intentLower)
    || /\bdo not only plan\b/.test(intentLower)
    || /\bcradle-to-grave\b/.test(intentLower)
    || /\brun\b[\s\S]{0,80}\b(?:npm run|lint|build|test|tests|typecheck|validate|validation|verify|smoke)\b/.test(intentLower)
    || /\brun\b[\s\S]{0,80}\b(?:check|checks|gate|gates)\b/.test(intentLower)
    || /\bperform\b[\s\S]{0,80}\b(?:test|tests|validation|verification|checks?)\b/.test(intentLower)
  );
  const asksCreateArtifact = !asksInformationalCreationQuestion && (
    new RegExp(`\\b(?:build|make|create|scaffold|prototype|generate)\\b[\\s\\S]{0,80}${ARTIFACT_NOUN_RE.source}`).test(intentLower)
    || new RegExp(`${ARTIFACT_NOUN_RE.source}[\\s\\S]{0,80}\\b(?:build|made|created|scaffolded|prototyped|generated)\\b`).test(intentLower)
  );
  const asksExecute = asksExplicitExecution
    || asksCreateArtifact
    || /\b(implement|code|fix|debug|change|modify|wire|add|remove|update|refactor|create file|edit|patch)\b/.test(intentLower);
  const asksPlan = /\b(plan|planning mode|roadmap|design|architect|architecture|strategy|proposal|approach)\b/.test(intentLower);
  const asksTeamPlan = asksPlan
    && /\b(spawn|team|agents?|participants?|planning room|compare notes?|consensus|single plan|guiding document)\b/.test(intentLower);
  const asksEvidenceBasedExplanation = /\b(explain|summar|overview)\b/.test(intentLower)
    && (fileRefs.length > 0 || /\b(repo|repository|project|codebase|architecture|file|folder|current|this app|this project)\b/.test(intentLower));
  const asksReview = /\b(review|audit|inspect|investigate|analy[sz]e|find bugs|security|vuln|performance)\b/.test(intentLower)
    || asksEvidenceBasedExplanation;
  const tinyAmbiguousReview = /^\s*(?:please\s+)?review(?:\s+(?:this|it))?\s*[.!?]?\s*$/.test(lower);
  const asksProjectOverview = /\b(overview|summar|explain|describe)\b[\s\S]{0,80}\b(project|codebase|repo|repository|architecture|components)\b/.test(lower)
    || /\b(project|codebase|repo|repository)\b[\s\S]{0,80}\b(overview|summar|explain|describe|architecture|components)\b/.test(lower);
  const asksValidation = /\b(tests?|lint|build|typecheck|validate|validation|verification|verify|smoke)\b/.test(lower);
  const simpleQuestion = complexitySignals.hasShortLength
    && complexitySignals.hasNoCodeOrFiles
    && /^(what|why|how|is|are|can|should|tell me|say|summarize in one|hello|hi|hey|please|help|show me|show)/.test(lower)
    && !asksExecute
    && !asksReview
    && !asksCompare
    && !asksValidation;

  let mode: OrchestrationMode = 'direct';
  if (asksExecute) mode = 'execute';
  else if (asksTeamPlan) mode = 'plan';
  else if (asksCompare) mode = 'compare';
  else if (asksProjectOverview) mode = 'investigate';
  else if (asksPlan) mode = 'plan';
  else if (asksReview && !simpleQuestion) mode = 'investigate';

  let role: HarnessRole = 'coder';
  if (mode === 'compare') role = 'reviewer';
  else if (mode === 'plan') role = 'planner';
  else if (mode === 'execute') role = asksValidation || asksCreateArtifact ? 'coder' : 'planner';
  else if (asksProjectOverview) role = 'summarizer';
  else if (/\b(review|audit|inspect|investigate|analy[sz]e|find bugs|security|vuln|performance|bugs?)\b/.test(lower)) role = 'reviewer';
  else if (/\b(plan|roadmap|design|architect|strategy)\b/.test(lower)) role = 'planner';
  else if (/\b(summar|overview|explain|describe)\b/.test(lower)) role = 'summarizer';
  else if (/\b(why|reason|trade.?off|pros? and cons?)\b/.test(lower)) role = 'reasoner';
  else if (/\b(rename|move|delete|create|add|remove|install|update|bump)\b/.test(lower) && lower.length < 140) role = 'worker';

  const explicitDeepSignal = !tinyAmbiguousReview && /\b(deep|comprehensive|full|entire|all|thorough|architecture)\b/.test(lower);
  const complexity: Complexity = complexitySignals.hasLongTask
    || complexitySignals.hasCodeBlock
    || complexitySignals.hasArchitectureSignal
    || complexitySignals.hasMultipleFileRefs
    || explicitDeepSignal
      ? 'deep'
    : tinyAmbiguousReview ? 'simple'
    : mode === 'direct' && simpleQuestion ? 'simple'
      : 'medium';
  const needsTools = mode !== 'direct' || /\b(repo|project|folder|file|codebase|current|this app|this project)\b/.test(lower);
  const needsValidation = asksValidation || mode === 'execute';

  const suggestedModels = Array.from(new Set([
    roleAssignments[role],
    roleAssignments.reasoner,
    activeModel,
  ].filter((modelId) => modelId && modelId.trim().toLowerCase() !== 'auto'))) as string[];

  const reason = tinyAmbiguousReview ? 'Tiny ambiguous review request uses a bounded shallow review default.'
    : mode === 'direct' ? 'Simple request can be answered by one role model.'
    : mode === 'plan' ? 'Request asks for planning, strategy, roadmap, or architecture and should use Planning Room.'
    : mode === 'investigate' ? 'Request asks for repo analysis, review, debugging, or explanation.'
      : mode === 'execute' ? 'Request asks for code or file changes and should plan, implement, validate, and review.'
        : 'Request asks to compare or evaluate alternatives.';

  return { mode, role, complexity, needsTools, needsValidation, suggestedModels, reason };
}

/**
 * Enhanced route decision that also runs the auto-router for per-task model selection.
 * Falls back to the heuristic-only router when auto-router is not configured.
 * Returns the route decision with auto-router model selection merged in.
 */
export async function routeWithAutoRouter(
  content: string,
  config: StoredConfig,
  options: RouteSignalOptions = {},
): Promise<RouteDecision> {
  // First run the heuristic router for role/mode classification
  const activeModel = config.activeModel || '';
  const route = routeRequest(content, activeModel, config.roleAssignments || {});
  const shouldUseAutoRouter = activeModel.trim().toLowerCase() === 'auto';
  const roleThinking = options.thinkingEffort
    || config.roleThinking?.[route.role]
    || config.thinkingEffort
    || 'medium';
  const requiresStrongToolUse = route.needsTools
    && route.complexity !== 'simple'
    && STRONG_TOOL_USE_RE.test(content.toLowerCase());
  const modelSelectionPolicy: ModelSelectionPolicy = route.complexity === 'simple'
    ? 'cheap-direct'
    : route.complexity === 'deep' || requiresStrongToolUse
      ? 'escalated'
      : 'classifier';
  route.routerData = {
    source: 'heuristic',
    heuristicMode: route.mode,
    heuristicRole: route.role,
    heuristicComplexity: route.complexity,
    policy: modelSelectionPolicy === 'cheap-direct'
      ? 'workflow routed heuristically; model selection uses cheapest viable candidate without classifier'
      : modelSelectionPolicy === 'escalated'
        ? 'workflow routed heuristically; model selection escalates to strongest suitable candidate'
        : 'workflow routed heuristically; model selection is classifier-eligible',
    modelSelectionPolicy,
  };

  // If auto-router is enabled, use it for model selection
  if (isAutoRouterEnabled() && shouldUseAutoRouter) {
    const signal = buildRouterSignal(
      content,
      'orchestrator',
      options.hasImages ?? false,
      options.turns ?? 1,
      options.toolCount ?? (route.needsTools ? 5 : 0),
      {
        estimatedInputTokens: options.estimatedInputTokens,
        artifactCount: options.artifactCount,
        dirtyGitState: options.dirtyGitState,
        thinkingEffort: roleThinking,
        requiresStrongToolUse,
      },
    );
    const routerStart = Date.now();
    try {
      const forcedCostStrategy = modelSelectionPolicy === 'cheap-direct'
        ? 'cheapest'
        : modelSelectionPolicy === 'escalated'
          ? 'strongest'
          : undefined;
      const forcedCostReason = modelSelectionPolicy === 'cheap-direct' || modelSelectionPolicy === 'escalated'
        ? modelSelectionPolicy
        : undefined;
      const decision = await routeTask(signal, config, {
        forceCostStrategy: forcedCostStrategy,
        forceCostReason: forcedCostReason,
        thinkingEffort: forcedCostStrategy ? roleThinking : undefined,
      });
    if (decision) {
      const isFallback = decision.fallback || decision.score === 0;
      const classifierFailed = decision.fallback && /classifier/i.test(decision.reason);
      route.suggestedModels = [decision.modelId];
      route.reason += ` | auto-router: ${decision.reason}`;
      route.routerData = {
        source: 'auto',
        heuristicMode: route.mode,
        heuristicRole: route.role,
        heuristicComplexity: route.complexity,
        policy: modelSelectionPolicy === 'cheap-direct'
          ? 'cheap-direct: simple low-risk task; selected cheapest viable candidate and skipped classifier'
          : modelSelectionPolicy === 'escalated'
            ? 'escalated: deep/high-risk task; selected strongest suitable candidate and skipped classifier'
            : 'classifier: medium task; classifier scored candidates before cost-aware selection',
        modelSelectionPolicy,
        signal: {
          hasImages: signal.hasImages,
          turns: signal.turns,
          toolCount: signal.toolCount,
          estimatedInputTokens: signal.estimatedInputTokens,
          artifactCount: signal.artifactCount,
          dirtyGitState: signal.dirtyGitState,
          thinkingEffort: signal.thinkingEffort,
          requiresStrongToolUse: signal.requiresStrongToolUse,
        },
        candidateScores: decision.scores,
        score: decision.score,
        cached: decision.cached,
        fallback: decision.fallback,
        classifierModel: decision.classifierModel,
        classifierRationale: decision.classifierRationale,
      };
      if (classifierFailed) {
        recordRoutingAdherenceEvent({
          kind: 'error',
          phase: 'router-classifier',
          routeMode: route.mode,
          role: route.role,
          complexity: route.complexity,
          selectedModel: decision.modelId,
          classifierModel: decision.classifierModel,
          candidateScores: decision.scores,
          promptHash: hashPrompt(content),
          elapsedMs: Date.now() - routerStart,
          error: decision.reason,
          retryable: true,
          fallbackAttempted: true,
          fallbackModelId: decision.modelId,
        });
      }
        console.log(
          `[route] auto-router: ${isFallback ? 'fallback' : 'active'} ` +
          `model=${decision.modelId} score=${decision.score.toFixed(2)} ` +
          `cached=${decision.cached} fallback=${decision.fallback} ` +
          `reason="${decision.reason}"`
        );
      }
    } catch (err) {
      // If auto-router fails, fall through to heuristic suggestedModels
      console.warn('[route] auto-router decision failed, using heuristic:', err);
      recordRoutingAdherenceEvent({
        kind: 'error',
        phase: 'router-classifier',
        routeMode: route.mode,
        role: route.role,
        complexity: route.complexity,
        classifierModel: config.autoRouter?.classifierModel ?? null,
        promptHash: hashPrompt(content),
        elapsedMs: Date.now() - routerStart,
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
        fallbackAttempted: true,
      });
    }
  }

  return route;
}
