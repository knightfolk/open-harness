import type { HarnessRole } from './runTrace';

export type OrchestrationMode = 'direct' | 'investigate' | 'execute' | 'compare';
export type Complexity = 'simple' | 'medium' | 'deep';

export interface RouteDecision {
  mode: OrchestrationMode;
  role: HarnessRole;
  complexity: Complexity;
  needsTools: boolean;
  needsValidation: boolean;
  suggestedModels: string[];
  reason: string;
}

export function routeRequest(content: string, activeModel: string, roleAssignments: Record<string, string> = {}): RouteDecision {
  const lower = content.toLowerCase();
  const long = content.length > 600;
  const asksCompare = /\b(compare|versus|vs\.?|which model|model a|model b|judge|evaluate outputs?)\b/.test(lower);
  const asksExecute = /\b(implement|code|fix|debug|change|modify|wire|add|remove|update|refactor|create file|edit|patch)\b/.test(lower);
  const asksReview = /\b(review|audit|inspect|investigate|analy[sz]e|explain|summar|overview|find bugs|security|vuln|performance)\b/.test(lower);
  const asksValidation = /\b(test|lint|build|typecheck|validate|verify|smoke)\b/.test(lower);
  const simpleQuestion = !long && /^(what|why|how|is|are|can|should|tell me|say|summarize in one)/.test(lower) && !asksExecute && !asksCompare;

  let mode: OrchestrationMode = 'direct';
  if (asksCompare) mode = 'compare';
  else if (asksExecute) mode = 'execute';
  else if (asksReview && !simpleQuestion) mode = 'investigate';

  let role: HarnessRole = 'coder';
  if (mode === 'compare') role = 'reviewer';
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
    : mode === 'investigate' ? 'Request asks for repo analysis, review, debugging, or explanation.'
      : mode === 'execute' ? 'Request asks for code or file changes and should plan, implement, validate, and review.'
        : 'Request asks to compare or evaluate alternatives.';

  return { mode, role, complexity, needsTools, needsValidation, suggestedModels, reason };
}
