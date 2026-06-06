import type { HarnessRole } from './runTrace';
import { isAutoRouterEnabled, routeTask, buildRouterSignal } from './autoRouter';
import type { StoredConfig } from './config';
import { hashPrompt, recordRoutingAdherenceEvent } from './routingAdherence';

export type OrchestrationMode = 'direct' | 'plan' | 'investigate' | 'execute' | 'compare';
export type Complexity = 'simple' | 'medium' | 'deep';

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
    candidateScores?: Record<string, number>;
    score?: number;
    cached?: boolean;
    fallback?: boolean;
    classifierModel?: string | null;
    classifierRationale?: string;
  };
}

const FILE_REFERENCE_RE = /\b(?:[\w-]+\/)*[\w.-]+\.(?:ts|tsx|js|jsx|py|java|go|rs|cpp|c|cs|rb|swift|kt|php|html|css|scss|less|md|json|yml|yaml|toml|sh|bash|mjs|cjs|sql|txt|lock)\b/g;
const CODE_BLOCK_RE = /```[\s\S]*?```/;

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
  const asksExecute = /\b(implement|code|fix|debug|change|modify|wire|add|remove|update|refactor|create file|edit|patch)\b/.test(intentLower);
  const asksPlan = /\b(plan|planning mode|roadmap|design|architect|architecture|strategy|proposal|approach)\b/.test(intentLower);
  const asksTeamPlan = asksPlan
    && /\b(spawn|team|agents?|participants?|planning room|compare notes?|consensus|single plan|guiding document)\b/.test(intentLower);
  const asksReview = /\b(review|audit|inspect|investigate|analy[sz]e|explain|summar|overview|find bugs|security|vuln|performance)\b/.test(intentLower);
  const asksProjectOverview = /\b(overview|summar|explain|describe)\b[\s\S]{0,80}\b(project|codebase|repo|repository|architecture|components)\b/.test(lower)
    || /\b(project|codebase|repo|repository)\b[\s\S]{0,80}\b(overview|summar|explain|describe|architecture|components)\b/.test(lower);
  const asksValidation = /\b(test|lint|build|typecheck|validate|verify|smoke)\b/.test(lower);
  const simpleQuestion = complexitySignals.hasShortLength
    && complexitySignals.hasNoCodeOrFiles
    && /^(what|why|how|is|are|can|should|tell me|say|summarize in one|hello|hi|hey|please|help|show me|show)/.test(lower)
    && !asksExecute
    && !asksReview
    && !asksCompare
    && !asksValidation;

  let mode: OrchestrationMode = 'direct';
  if (asksTeamPlan) mode = 'plan';
  else if (asksCompare) mode = 'compare';
  else if (asksExecute) mode = 'execute';
  else if (asksProjectOverview) mode = 'investigate';
  else if (asksPlan) mode = 'plan';
  else if (asksReview && !simpleQuestion) mode = 'investigate';

  let role: HarnessRole = 'coder';
  if (mode === 'compare') role = 'reviewer';
  else if (mode === 'plan') role = 'planner';
  else if (mode === 'execute') role = asksValidation ? 'coder' : 'planner';
  else if (asksProjectOverview) role = 'summarizer';
  else if (/\b(review|audit|security|vuln|performance|bugs?)\b/.test(lower)) role = 'reviewer';
  else if (/\b(plan|roadmap|design|architect|strategy)\b/.test(lower)) role = 'planner';
  else if (/\b(summar|overview|explain|describe)\b/.test(lower)) role = 'summarizer';
  else if (/\b(why|reason|trade.?off|pros? and cons?)\b/.test(lower)) role = 'reasoner';
  else if (/\b(rename|move|delete|create|add|remove|install|update|bump)\b/.test(lower) && lower.length < 140) role = 'worker';

  const explicitDeepSignal = /\b(deep|comprehensive|full|entire|all|thorough|architecture)\b/.test(lower);
  const complexity: Complexity = complexitySignals.hasLongTask
    || complexitySignals.hasCodeBlock
    || complexitySignals.hasArchitectureSignal
    || complexitySignals.hasMultipleFileRefs
    || explicitDeepSignal
      ? 'deep'
    : mode === 'direct' && simpleQuestion ? 'simple'
      : 'medium';
  const needsTools = mode !== 'direct' || /\b(repo|project|folder|file|codebase|current|this app|this project)\b/.test(lower);
  const needsValidation = asksValidation || mode === 'execute';

  const suggestedModels = Array.from(new Set([
    roleAssignments[role],
    roleAssignments.reasoner,
    activeModel,
  ].filter((modelId) => modelId && modelId.trim().toLowerCase() !== 'auto'))) as string[];

  const reason = mode === 'direct' ? 'Simple request can be answered by one role model.'
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
): Promise<RouteDecision> {
  // First run the heuristic router for role/mode classification
  const activeModel = config.activeModel || '';
  const route = routeRequest(content, activeModel, config.roleAssignments || {});
  const shouldUseAutoRouter = activeModel.trim().toLowerCase() === 'auto';

  // If auto-router is enabled, use it for model selection
  if (isAutoRouterEnabled() && shouldUseAutoRouter) {
    // TODO(P1): Pass real hasImages, turns, and toolCount from session state.
    // Currently hardcoded because routeWithAutoRouter doesn't have access to the session.
    // The classifier still works, but accuracy improves with real signal values.
    const signal = buildRouterSignal(
      content,
      'orchestrator',
      false, // hasImages — would need to check message content
      1,     // turns — approximate; true count from session
      route.needsTools ? 5 : 0,  // approximate tool count
    );
    const routerStart = Date.now();
    try {
      const roleThinking = config.roleThinking?.[route.role] || config.thinkingEffort || 'medium';
      const decision = await routeTask(signal, config, {
        forceCostStrategy: roleThinking === 'medium'
          ? route.complexity === 'simple'
            ? 'cheapest'
            : route.complexity === 'deep' && route.mode !== 'investigate'
              ? 'strongest'
              : undefined
          : undefined,
        thinkingEffort: roleThinking,
      });
    if (decision) {
      const isFallback = decision.fallback || decision.score === 0;
      const classifierFailed = decision.fallback && /classifier/i.test(decision.reason);
      if (!isFallback) {
        route.suggestedModels = [decision.modelId];
      }
      route.reason += ` | auto-router: ${decision.reason}`;
      route.routerData = {
        source: isFallback ? 'heuristic' : 'auto',
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
