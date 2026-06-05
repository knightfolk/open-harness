import type { HarnessRole } from './runTrace';
import { isAutoRouterEnabled, routeTask, buildRouterSignal } from './autoRouter';
import type { StoredConfig } from './config';

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
    score?: number;
    cached?: boolean;
    fallback?: boolean;
    classifierModel?: string | null;
  };
}

export function routeRequest(content: string, activeModel: string, roleAssignments: Record<string, string> = {}): RouteDecision {
  const lower = content.toLowerCase();
  const long = content.length > 600;
  const asksCompare = /\b(compare|versus|vs\.?|which model|model a|model b|judge|evaluate outputs?)\b/.test(lower);
  const asksExecute = /\b(implement|code|fix|debug|change|modify|wire|add|remove|update|refactor|create file|edit|patch)\b/.test(lower);
  const asksPlan = /\b(plan|planning mode|roadmap|design|architect|architecture|strategy|proposal|approach)\b/.test(lower);
  const asksReview = /\b(review|audit|inspect|investigate|analy[sz]e|explain|summar|overview|find bugs|security|vuln|performance)\b/.test(lower);
  const asksValidation = /\b(test|lint|build|typecheck|validate|verify|smoke)\b/.test(lower);
  const simpleQuestion = !long && /^(what|why|how|is|are|can|should|tell me|say|summarize in one)/.test(lower) && !asksExecute && !asksCompare;

  let mode: OrchestrationMode = 'direct';
  if (asksCompare) mode = 'compare';
  else if (asksExecute) mode = 'execute';
  else if (asksPlan) mode = 'plan';
  else if (asksReview && !simpleQuestion) mode = 'investigate';

  let role: HarnessRole = 'coder';
  if (mode === 'compare') role = 'reviewer';
  else if (mode === 'plan') role = 'planner';
  else if (mode === 'execute') role = asksValidation ? 'coder' : 'planner';
  else if (/\b(review|audit|security|vuln|performance|bugs?)\b/.test(lower)) role = 'reviewer';
  else if (/\b(plan|roadmap|design|architect|strategy)\b/.test(lower)) role = 'planner';
  else if (/\b(summar|overview|explain|describe)\b/.test(lower)) role = 'summarizer';
  else if (/\b(why|reason|trade.?off|pros? and cons?)\b/.test(lower)) role = 'reasoner';
  else if (/\b(rename|move|delete|create|add|remove|install|update|bump)\b/.test(lower) && lower.length < 140) role = 'worker';

  const complexity: Complexity = long || /\b(deep|comprehensive|full|entire|all|thorough|architecture)\b/.test(lower) ? 'deep'
    : mode === 'direct' && simpleQuestion ? 'simple'
      : 'medium';
  const needsTools = mode !== 'direct' || /\b(repo|project|folder|file|codebase|current|this app|this project)\b/.test(lower);
  const needsValidation = asksValidation || mode === 'execute';

  const suggestedModels = Array.from(new Set([
    roleAssignments[role],
    roleAssignments.reasoner,
    activeModel,
  ].filter(Boolean))) as string[];

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
  const route = routeRequest(content, config.activeModel || '', config.roleAssignments || {});

  // If auto-router is enabled, use it for model selection
  if (isAutoRouterEnabled()) {
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
    try {
      const decision = await routeTask(signal, config);
      if (decision) {
        const isFallback = decision.fallback || decision.score === 0;
        if (!isFallback) {
          route.suggestedModels = [decision.modelId];
        }
        route.reason += ` | auto-router: ${decision.reason}`;
        route.routerData = {
          source: isFallback ? 'heuristic' : 'auto',
          score: decision.score,
          cached: decision.cached,
          fallback: decision.fallback,
          classifierModel: decision.classifierModel,
        };
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
    }
  }

  return route;
}
