/**
 * server/autoRouter.ts
 *
 * Classifier-based per-task model router.
 * Ported from the UltraCode-Shim auto-router design
 * (https://github.com/OnlyTerp/UltraCode-Shim).
 *
 * A cheap classifier model scores each configured candidate on how likely
 * it is to complete the current task correctly. The cheapest candidate
 * above a quality threshold wins — so trivial tasks go cheap and hard
 * tasks escalate to the strongest model, automatically.
 *
 * The classifier never sees cost; cost is applied afterward as a
 * tie-break among viable candidates. Decisions are cached per task to
 * avoid re-classifying tool-call round-trips.
 */

import { getProviderForModel, splitModelRef } from './config';
import { suggestThresholdAdjustment } from './routerLearning';
import { getLatestEvalRecommendations } from './evals';
import { estimateTokens } from './contextManager';
import { getModelConfig, isReasoningModel } from './modelProfiles';
import { buildToolReliabilitySummary, type ToolReliabilitySummary } from './toolReliability';
import { getToolReliabilitySessions } from './toolReliabilityLogTrace';
import { getPromptStrategySelectionForModel } from './promptStrategies';
import type { StoredConfig, StoredProvider } from './config';

// ── Types ──────────────────────────────────────────────

export interface AutoRouterCandidate {
  /** Model ID (e.g. "minimax:MiniMax-M3" or just "claude-sonnet-4-6") */
  modelId: string;
  /** Relative cost weight — only ordering matters, units don't */
  cost: number;
  /** Whether this model can accept image attachments */
  supportsImages: boolean;
  /** Whether this model exposes native thinking/reasoning output */
  supportsThinking?: boolean;
  /** Native/tool-call reliability for tool-heavy agent work. Defaults from model family profile. */
  toolCallQuality?: 'excellent' | 'good' | 'basic' | 'none';
  /** Short capability description the classifier reads to score this model */
  card: string;
}

export interface AutoRouterConfig {
  /** Master switch — off by default, user opts in */
  enabled: boolean;
  /** Classifier model ID (cheapest model that does scoring) */
  classifierModel: string;
  /** 0–1 quality bar. Cheapest candidate scoring >= this wins. Lower = cheaper, higher = safer. */
  threshold: number;
  /** Fallback model when classifier can't run */
  defaultModel: string;
  /** Cache TTL in milliseconds for per-task routing decisions */
  cacheTTLMs: number;
  /** Candidate models the router chooses among */
  candidates: AutoRouterCandidate[];
}

export interface AutoRouterCandidateDiagnostic {
  modelId: string;
  available: boolean;
  reason?: string;
}

export interface AutoRouterSignal {
  /** The latest user message text */
  task: string;
  /** Whether this is the main loop ("orchestrator") or background ("worker") */
  surface: 'orchestrator' | 'worker';
  /** Whether the task has image attachments */
  hasImages: boolean;
  /** Total user turns in this session */
  turns: number;
  /** Number of tools available */
  toolCount: number;
  /** Estimated input tokens that must fit in the selected model context */
  estimatedInputTokens: number;
  /** Number of attached or generated artifacts that may influence routing risk */
  artifactCount?: number;
  /** Whether the current workspace has uncommitted git changes */
  dirtyGitState?: boolean;
  /** User-visible thinking effort hint */
  thinkingEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  /** Whether the task likely depends on reliable multi-tool / shell / file workflows. */
  requiresStrongToolUse?: boolean;
}

export interface AutoRouterDecision {
  /** The selected model ID */
  modelId: string;
  /** The classifier score for this model (0–1) */
  score: number;
  /** Human-readable reason for the decision */
  reason: string;
  /** All candidate scores from the classifier */
  scores: Record<string, number>;
  /** Whether the decision was served from cache */
  cached: boolean;
  /** Whether the decision fell back to deterministic (no classifier call) */
  fallback: boolean;
  /** Classifier model used (or null for fallback) */
  classifierModel: string | null;
  /** Short classifier-provided scoring rationale, when available. */
  classifierRationale?: string;
}

export interface AutoRouterDecisionOptions {
  /** Force a deterministic cost-aware fallback mode, bypassing classification. */
  forceCostStrategy?: 'cheapest' | 'strongest';
  /** Names the deterministic policy when classification is intentionally skipped. */
  forceCostReason?: 'cheap-direct' | 'escalated';
  /** User-visible thinking effort hint used to bias Auto routing. */
  thinkingEffort?: 'low' | 'medium' | 'high' | 'xhigh';
}

// ── State ──────────────────────────────────────────────

let autoRouterConfig: AutoRouterConfig | null = null;
let autoRouterBaseCandidates: AutoRouterCandidate[] = [];
let candidateDiagnostics: AutoRouterCandidateDiagnostic[] = [];
let candidateEvidenceRefreshedAt: string | null = null;
let candidateEvidenceRefreshCount = 0;
const CANDIDATE_CARD_MAX_CHARS = 5200;

const decisionCache = new Map<string, { decision: AutoRouterDecision; expiresAt: number }>();
const CACHE_MAX_ENTRIES = 256;

function normalizeRecommendationModelKey(modelId: string): string {
  return modelId.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function recommendationMatchesCandidate(recModelId: string, candidateModelId: string): boolean {
  const recKey = normalizeRecommendationModelKey(recModelId);
  const candidateKey = normalizeRecommendationModelKey(candidateModelId);
  return recKey === candidateKey || candidateKey.endsWith(recKey) || recKey.endsWith(candidateKey);
}

function annotateCandidatesWithEvalRecommendations(
  candidates: AutoRouterCandidate[],
): AutoRouterCandidate[] {
  const recommendations = getLatestEvalRecommendations();
  if (recommendations.length === 0) return candidates;

  const recs = recommendations
    .filter((rec) => rec.modelId && rec.role && rec.reason)
    .map((rec) => ({
      modelId: rec.modelId,
      role: rec.role,
      reason: rec.reason,
      proofReviewStatus: rec.proofReviewStatus || 'unreviewed',
      proofTrusted: rec.proofTrusted === true,
    }));
  if (recs.length === 0) return candidates;

  const byModel = new Map<string, Array<{ role: string; reason: string; proofReviewStatus: string; proofTrusted: boolean }>>();
  for (const rec of recommendations) {
    if (!rec.modelId || !rec.role || !rec.reason) continue;
    if (!byModel.has(rec.modelId)) byModel.set(rec.modelId, []);
    byModel.get(rec.modelId)!.push({
      role: rec.role,
      reason: rec.reason,
      proofReviewStatus: rec.proofReviewStatus || 'unreviewed',
      proofTrusted: rec.proofTrusted === true,
    });
  }

  return candidates.map((candidate) => {
    const matchingRecs = [
      ...(byModel.get(candidate.modelId) || []),
      ...recs.filter((rec) => rec.modelId !== candidate.modelId && recommendationMatchesCandidate(rec.modelId, candidate.modelId)),
    ];
    if (matchingRecs.length === 0) return candidate;

    const base = candidate.card?.trim() ? candidate.card.trim() : 'General-purpose model. No capability card provided.';
    const evalLine = matchingRecs.map((r) => {
      if (r.proofTrusted) return `${r.role} (approved proof): ${r.reason}`;
      if (r.proofReviewStatus === 'needs-attention') return `${r.role} (proof needs attention; do not trust yet): ${r.reason}`;
      return `${r.role} (proof unreviewed; verify before trusting): ${r.reason}`;
    }).join(' | ');
    const trustedCount = matchingRecs.filter((r) => r.proofTrusted).length;
    const label = trustedCount === matchingRecs.length ? 'Eval-backed recommendation' : 'Eval evidence caution';
    const merged = `${base} ${label}: ${evalLine}`;

    return {
      ...candidate,
      card: merged.length > 360 ? `${merged.slice(0, 357)}…` : merged,
    };
  });
}

function modelKeysMatch(a: string, b: string): boolean {
  const left = normalizeRecommendationModelKey(a);
  const right = normalizeRecommendationModelKey(b);
  return left === right || left.endsWith(right) || right.endsWith(left);
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function modelToolPairMatchesCandidate(pair: string, candidateModelId: string): boolean {
  const [modelPart] = pair.split('/').map((part) => part.trim());
  return modelKeysMatch(modelPart || pair, candidateModelId);
}

function modelToolPairToolName(pair: string): string {
  const parts = pair.split('/').map((part) => part.trim());
  return parts.length > 1 ? parts.slice(1).join(' / ') : pair;
}

function promptStrategyReliabilityLine(candidateModelId: string, summary: ToolReliabilitySummary): string {
  const strategyId = getPromptStrategySelectionForModel(candidateModelId).profile.id;
  const baseStats = summary.byPromptStrategy?.[strategyId];
  const variantStats = Object.entries(summary.byPromptStrategyVariant || {})
    .filter(([key, stats]) => key.startsWith(`${strategyId}:`) && stats.total > 0)
    .sort(([, a], [, b]) => b.errorRate - a.errorRate || b.error - a.error || b.total - a.total)
    .slice(0, 2);
  if (!baseStats && variantStats.length === 0) return '';

  const baseLine = baseStats
    ? ` Prompt strategy tool evidence for ${strategyId}: ${baseStats.error}/${baseStats.total} tool errors, first-call ${baseStats.firstCallErrors}/${baseStats.runs}, recovery ${pct(baseStats.recoveryRate)}.`
    : ` Prompt strategy tool evidence for ${strategyId}: no base bucket yet.`;
  const variantLine = variantStats.length > 0
    ? ` Risky prompt variants: ${variantStats.map(([key, stats]) =>
      `${key} ${stats.error}/${stats.total} errors, first-call ${stats.firstCallErrors}/${stats.runs}`
    ).join('; ')}.`
    : '';
  return `${baseLine}${variantLine}`;
}

function promptStrategyBestPracticeLine(candidateModelId: string): string {
  const selection = getPromptStrategySelectionForModel(candidateModelId);
  const note = selection.profile.bestPracticeNotes?.[0];
  if (!note) return '';
  return ` Prompt strategy best practice for ${selection.profile.id}: ${note.guidance} Eval cue: ${note.evaluationCue} Source: ${note.sourceRef}. Use as advisory prompt-contract evidence, not an automatic routing override.`;
}

function recoveryPatternLine(candidateModelId: string, summary: ToolReliabilitySummary): string {
  const patterns = (summary.recoveryPatterns || [])
    .filter((pattern) => modelKeysMatch(pattern.failedModel, candidateModelId))
    .sort((a, b) => b.runs - a.runs || Date.parse(b.latestTimestamp) - Date.parse(a.latestTimestamp))
    .slice(0, 2);
  if (patterns.length === 0) return '';
  return ` Repeated recovery patterns: ${patterns.map((pattern) =>
    `${pattern.failedTool} failed, then ${pattern.recoveredByModel}/${pattern.recoveredByTool} worked in ${pattern.runs} run${pattern.runs === 1 ? '' : 's'} (evidence ${pattern.exampleEvidenceSources?.join(', ') || 'unknown'}, examples session ${pattern.exampleSessionIds?.join(', ') || 'unknown'}, run ${pattern.exampleRunIds.join(', ') || 'unknown'})`
  ).join('; ')}. Prefer the recovered tool path or a cleaner model for similar first-tool choices.`;
}

function failureMemoryLine(candidateModelId: string, summary: ToolReliabilitySummary): string {
  const memories = (summary.failureMemory || [])
    .filter((item) => modelKeysMatch(item.model, candidateModelId))
    .sort((a, b) => b.unrecoveredRuns - a.unrecoveredRuns || b.errorRuns - a.errorRuns)
    .slice(0, 2);
  if (memories.length === 0) return '';
  return ` Model failure memory: ${memories.map((item) => {
    const fixedBy = item.fixedBy.length
      ? ` fixed by ${item.fixedBy.map((fix) => `${fix.model}/${fix.tool} in ${fix.runs} run${fix.runs === 1 ? '' : 's'}`).join(', ')}`
      : ' no recovered fix path captured yet';
    const fallback = item.fallbackRecoveryRuns > 0 ? `, fallback helped ${item.fallbackRecoveryRuns} time${item.fallbackRecoveryRuns === 1 ? '' : 's'}` : '';
    const strategies = item.promptStrategyVariants.length > 0
      ? `, prompt variants ${item.promptStrategyVariants.map((variant) => `${variant.id} (${variant.runs})`).join(', ')}`
      : item.promptStrategies.length > 0
        ? `, prompt strategies ${item.promptStrategies.map((strategy) => `${strategy.id} (${strategy.runs})`).join(', ')}`
        : '';
    return `${item.tool} failed in ${item.errorRuns} run${item.errorRuns === 1 ? '' : 's'} (${item.unrecoveredRuns} unrecovered${fallback}${strategies}, evidence ${item.exampleEvidenceSources?.join(', ') || 'unknown'}, examples session ${item.exampleSessionIds?.join(', ') || 'unknown'}, run ${item.exampleRunIds.join(', ') || 'unknown'});${fixedBy}`;
  }).join('; ')}.`;
}

function outcomeExampleLine(candidateModelId: string, summary: ToolReliabilitySummary): string {
  const outcomes = (summary.outcomeExamples || [])
    .filter((item) => modelKeysMatch(item.failedModel, candidateModelId))
    .slice(0, 3);
  if (outcomes.length === 0) return '';
  return ` Session outcomes after tool errors: ${outcomes.map((item) => {
    const workedBy = item.workedBy
      ? `${item.workedBy.model}/${item.workedBy.tool}`
      : item.finalAnswerCaptured ? 'final answer without later tool' : item.finalStatus;
    return `${item.failedTool} -> ${workedBy} (${item.outcome}, retry distance ${item.retryDistance}); evidence ${item.evidenceSource}, session ${item.sessionId}, run ${item.runId}`;
  }).join('; ')}. Use these as avoid/retry-reduction evidence for similar tool-heavy tasks.`;
}

function errorSignatureLine(candidateModelId: string, summary: ToolReliabilitySummary): string {
  const signatures = (summary.errorSignatures || [])
    .filter((item) => modelKeysMatch(item.model, candidateModelId))
    .sort((a, b) => b.unrecoveredRuns - a.unrecoveredRuns || b.runs - a.runs)
    .slice(0, 2);
  if (signatures.length === 0) return '';
  return ` Tool error signatures: ${signatures.map((item) => {
    const workedBy = item.workedBy.length
      ? ` later worked via ${item.workedBy.map((worked) => `${worked.model}/${worked.tool} (${worked.runs} run${worked.runs === 1 ? '' : 's'}, avg retry ${worked.avgRetryDistance})`).join(', ')}`
      : ' no working follow-up captured';
    const variants = item.promptStrategyVariants.length > 0
      ? `, prompt variants ${item.promptStrategyVariants.map((variant) => `${variant.id} (${variant.runs})`).join(', ')}`
      : '';
    return `${item.tool} "${item.signature}" in ${item.runs} run${item.runs === 1 ? '' : 's'} (${item.unrecoveredRuns} unrecovered, ${item.recoveredRuns} recovered${variants}, evidence ${item.exampleEvidenceSources?.join(', ') || 'unknown'}, examples session ${item.exampleSessionIds?.join(', ') || 'unknown'}, run ${item.exampleRunIds.join(', ') || 'unknown'});${workedBy}`;
  }).join('; ')}. Use matching signatures to avoid repeating the same failed first tool or to choose the known recovered path earlier.`;
}

function retryReductionRecommendationLine(candidateModelId: string, summary: ToolReliabilitySummary): string {
  const recommendations = (summary.retryReductionRecommendations || [])
    .filter((item) => modelKeysMatch(item.failedModel, candidateModelId))
    .slice(0, 2);
  if (recommendations.length === 0) return '';
  return ` Retry-reduction recommendations: ${recommendations.map((item) =>
    `avoid ${item.avoidPath}; prefer ${item.preferPath}; retry distance ${item.retryDistance}; avg retry distance ${item.avgRetryDistance}; evidence ${item.evidenceSource}; confidence ${item.evidenceConfidence} from ${item.supportRunCount} run${item.supportRunCount === 1 ? '' : 's'}; supporting sessions ${item.supportSessionIds?.join(', ') || item.sessionId}; supporting runs ${item.supportRunIds?.join(', ') || item.runId}; tuning action ${item.tuningAction}; ${item.tuningGuidance}; session ${item.sessionId}; run ${item.runId}; provider path avoid ${item.avoidProviderPath}; provider path prefer ${item.preferProviderPath}`
  ).join('; ')}. Prefer these observed working paths before adding more retries.`;
}

export function annotateCandidatesWithToolReliability(
  candidates: AutoRouterCandidate[],
  summary: ToolReliabilitySummary | null | undefined,
): AutoRouterCandidate[] {
  if (!summary || summary.totalToolCalls === 0) return candidates;

  return candidates.map((candidate) => {
    const promptStrategyLine = promptStrategyReliabilityLine(candidate.modelId, summary);
    const promptBestPracticeLine = promptStrategyBestPracticeLine(candidate.modelId);
    const match = Object.entries(summary.byModel || {})
      .find(([model]) => modelKeysMatch(model, candidate.modelId));
    if (!match) {
      if (!promptStrategyLine && !promptBestPracticeLine) return candidate;
      const base = candidate.card?.trim() ? candidate.card.trim() : 'General-purpose model. No capability card provided.';
      const merged = `${base}${promptBestPracticeLine}${promptStrategyLine} Treat as prompt-contract evidence for tool-heavy execute tasks until this model has its own tool traces.`;
      return {
        ...candidate,
        card: merged.length > CANDIDATE_CARD_MAX_CHARS
          ? `${merged.slice(0, CANDIDATE_CARD_MAX_CHARS - 3)}…`
          : merged,
      };
    }

    const [model, bucket] = match;
    const patternLine = recoveryPatternLine(candidate.modelId, summary);
    const failureLine = failureMemoryLine(candidate.modelId, summary);
    const outcomeLine = outcomeExampleLine(candidate.modelId, summary);
    const signatureLine = errorSignatureLine(candidate.modelId, summary);
    const retryReductionLine = retryReductionRecommendationLine(candidate.modelId, summary);
    if (bucket.total === 0) {
      if (!promptStrategyLine && !promptBestPracticeLine) return candidate;
      const base = candidate.card?.trim() ? candidate.card.trim() : 'General-purpose model. No capability card provided.';
      const merged = `${base}${promptBestPracticeLine}${promptStrategyLine} Treat as prompt-contract evidence for tool-heavy execute tasks until this model has its own tool traces.`;
      return {
        ...candidate,
        card: merged.length > CANDIDATE_CARD_MAX_CHARS
          ? `${merged.slice(0, CANDIDATE_CARD_MAX_CHARS - 3)}…`
          : merged,
      };
    }

    const recoveryExample = (summary.recoveryExamples || [])
      .find((item) => modelKeysMatch(item.firstError.model, candidate.modelId));
    const recoveryPath = recoveryExample
      ? recoveryExample.recoveredBy.length > 0
        ? ` Recent recovery path: ${recoveryExample.firstError.tool} failed, then ${recoveryExample.recoveredBy.map((step) => step.tool).join(' -> ')} completed before final answer.`
        : ` Recent recovery path: ${recoveryExample.firstError.tool} failed, then the run still reached a final answer.`
      : '';
    const riskyToolPairs = Object.entries(summary.byModelTool || {})
      .filter(([pair, stats]) => modelToolPairMatchesCandidate(pair, candidate.modelId) && stats.error > 0)
      .sort(([, a], [, b]) => b.errorRate - a.errorRate || b.error - a.error || b.total - a.total)
      .slice(0, 3);
    const riskyToolLine = riskyToolPairs.length > 0
      ? ` Specific risky tools for this model: ${riskyToolPairs.map(([pair, stats]) =>
        `${modelToolPairToolName(pair)} ${stats.error}/${stats.total} errors, first-call ${stats.firstCallErrors}/${stats.runs}, recovery ${pct(stats.recoveryRate)}`
      ).join('; ')}.`
      : '';
    const riskLine = bucket.error > 0
      ? `${promptBestPracticeLine}Tool reliability evidence for ${model}: ${bucket.error}/${bucket.total} traced tool calls errored (${pct(bucket.errorRate)}), first-call failures ${bucket.firstCallErrors}/${bucket.runs}, recovery ${pct(bucket.recoveryRate)} over ${bucket.affectedRuns} affected run${bucket.affectedRuns === 1 ? '' : 's'}, avg recovery rounds ${bucket.avgRecoveryRounds}. Penalize this candidate for tool-heavy execute tasks until prompt/tool contracts or capability cards are improved.${promptStrategyLine}${recoveryPath}${patternLine}${failureLine}${signatureLine}${retryReductionLine}${outcomeLine}${riskyToolLine}`
      : `${promptBestPracticeLine}Tool reliability evidence for ${model}: 0/${bucket.total} traced tool-call errors across ${bucket.runs} tool-using run${bucket.runs === 1 ? '' : 's'}.${patternLine}${failureLine}${signatureLine}${retryReductionLine}${outcomeLine}${promptStrategyLine} Treat as positive but still limited historical evidence for tool-heavy execute tasks.`;
    const base = candidate.card?.trim() ? candidate.card.trim() : 'General-purpose model. No capability card provided.';
    const merged = `${base} ${riskLine}`;

    return {
      ...candidate,
      card: merged.length > CANDIDATE_CARD_MAX_CHARS
        ? `${merged.slice(0, CANDIDATE_CARD_MAX_CHARS - 3)}…`
        : merged,
    };
  });
}

function annotateCandidatesWithCurrentEvidence(candidates: AutoRouterCandidate[]): AutoRouterCandidate[] {
  let annotatedCandidates = annotateCandidatesWithEvalRecommendations(candidates);
  try {
    annotatedCandidates = annotateCandidatesWithToolReliability(
      annotatedCandidates,
      buildToolReliabilitySummary(getToolReliabilitySessions()),
    );
  } catch {
    // Best-effort; persisted sessions may be unavailable during tests/startup.
  }
  candidateEvidenceRefreshedAt = new Date().toISOString();
  candidateEvidenceRefreshCount += 1;
  return annotatedCandidates;
}

function normalizeCandidate(candidate: AutoRouterCandidate): AutoRouterCandidate {
  const supportsThinking = typeof candidate.supportsThinking === 'boolean'
    ? candidate.supportsThinking
    : isReasoningModel(candidate.modelId);
  const profile = getModelConfig(candidate.modelId);
  const toolCallQuality = candidate.toolCallQuality || profile.toolCallQuality;
  const baseCard = candidate.card?.trim() ? candidate.card.trim() : 'General-purpose model. No capability card provided.';
  const thinkingLine = `Native thinking: ${supportsThinking ? 'yes' : 'no'}.`;
  const toolLine = `Tool quality: ${toolCallQuality}.`;
  const withThinking = /native thinking:/i.test(baseCard) ? baseCard : `${baseCard} ${thinkingLine}`;
  const card = /tool quality:/i.test(withThinking) ? withThinking : `${withThinking} ${toolLine}`;
  return { ...candidate, supportsThinking, toolCallQuality, card };
}

function candidateAvailability(config: StoredConfig, candidate: AutoRouterCandidate): AutoRouterCandidateDiagnostic {
  if (!candidate.modelId) return { modelId: '(missing)', available: false, reason: 'missing modelId' };
  if (!candidate.card?.trim()) return { modelId: candidate.modelId, available: false, reason: 'missing capability card' };

  const { providerId, bareModelId } = splitModelRef(candidate.modelId);
  const provider = config.providers.find((p) => !providerId || p.id === providerId);
  if (!provider) return { modelId: candidate.modelId, available: false, reason: `provider ${providerId || '(any)'} not configured` };

  const hasAuth = provider.type === 'local' || !!provider.apiKey || !!provider.oauth?.accessToken;
  if (!hasAuth) return { modelId: candidate.modelId, available: false, reason: `provider ${provider.id} has no API key or OAuth token` };

  const model = provider.models.find((m) => m.id === bareModelId);
  if (!model) return { modelId: candidate.modelId, available: false, reason: `model ${bareModelId} is not configured for provider ${provider.id}` };
  if (!model.enabled) return { modelId: candidate.modelId, available: false, reason: `model ${bareModelId} is disabled` };

  return { modelId: candidate.modelId, available: true };
}

// ── Public API ─────────────────────────────────────────

/** Configure the auto-router from StoredConfig. Call on startup and config change. */
export function configureAutoRouter(config: StoredConfig): void {
  const ar = (config as any).autoRouter as AutoRouterConfig | undefined;
  if (!ar || !ar.enabled || !ar.classifierModel || !ar.candidates || ar.candidates.length === 0) {
    autoRouterConfig = null;
    autoRouterBaseCandidates = [];
    candidateEvidenceRefreshedAt = null;
    candidateEvidenceRefreshCount = 0;
    candidateDiagnostics = [];
    return;
  }

  // Validate: candidates must have modelIds that resolve to a provider
  candidateDiagnostics = ar.candidates.map((c) => candidateAvailability(config, c));
  const validCandidateIds = new Set(candidateDiagnostics.filter((d) => d.available).map((d) => d.modelId));
  const validCandidates = ar.candidates
    .filter((c) => validCandidateIds.has(c.modelId) && getProviderForModel(config, c.modelId) !== null)
    .map(normalizeCandidate);

  if (validCandidates.length === 0) {
    autoRouterConfig = null;
    autoRouterBaseCandidates = [];
    candidateEvidenceRefreshedAt = null;
    candidateEvidenceRefreshCount = 0;
    return;
  }

  autoRouterBaseCandidates = validCandidates;
  const annotatedCandidates = annotateCandidatesWithCurrentEvidence(autoRouterBaseCandidates);

  autoRouterConfig = {
    enabled: true,
    classifierModel: ar.classifierModel,
    threshold: typeof ar.threshold === 'number' ? ar.threshold : 0.7,
    defaultModel: ar.defaultModel || validCandidates[0].modelId,
    cacheTTLMs: typeof ar.cacheTTLMs === 'number' ? ar.cacheTTLMs : 300_000,
    candidates: annotatedCandidates,
  };

  // Auto-adjust threshold from historical data if available
  try {
    const adj = suggestThresholdAdjustment(autoRouterConfig.threshold);
    if (adj.dataPoints >= 10 && adj.suggestedThreshold !== autoRouterConfig.threshold) {
      console.log("[autoRouter] Auto-adjusting threshold from " + autoRouterConfig.threshold.toFixed(2) + " to " + adj.suggestedThreshold.toFixed(2) + " — " + adj.reason);
      autoRouterConfig.threshold = adj.suggestedThreshold;
    }
  } catch {
    // Best-effort; learning data may not exist yet
  }
}

/** Check if the auto-router is configured and enabled. */
export function isAutoRouterEnabled(): boolean {
  return autoRouterConfig !== null && autoRouterConfig.enabled;
}

/** Get the current auto-router state (for API endpoints). */
export function getAutoRouterState(): {
  enabled: boolean;
  classifierModel: string | null;
  threshold: number;
  configuredCandidateCount: number;
  candidateCount: number;
  candidates: Array<{ modelId: string; cost: number; supportsImages: boolean; supportsThinking: boolean; toolCallQuality: string; contextWindowTokens: number }>;
  unavailableCandidates: AutoRouterCandidateDiagnostic[];
  candidateEvidenceRefreshedAt: string | null;
  candidateEvidenceRefreshCount: number;
  cacheSize: number;
} {
  if (!autoRouterConfig) {
    return {
      enabled: false,
      classifierModel: null,
      threshold: 0.7,
      configuredCandidateCount: candidateDiagnostics.length,
      candidateCount: 0,
      candidates: [],
      unavailableCandidates: candidateDiagnostics.filter((d) => !d.available),
      candidateEvidenceRefreshedAt,
      candidateEvidenceRefreshCount,
      cacheSize: 0,
    };
  }
  return {
    enabled: true,
    classifierModel: autoRouterConfig.classifierModel,
    threshold: autoRouterConfig.threshold,
    configuredCandidateCount: candidateDiagnostics.length || autoRouterConfig.candidates.length,
    candidateCount: autoRouterConfig.candidates.length,
    candidates: autoRouterConfig.candidates.map((c) => ({
      modelId: c.modelId,
      cost: c.cost,
      supportsImages: c.supportsImages,
      supportsThinking: c.supportsThinking === true,
      toolCallQuality: c.toolCallQuality || candidateToolCallQuality(c),
      contextWindowTokens: candidateContextWindow(c),
    })),
    unavailableCandidates: candidateDiagnostics.filter((d) => !d.available),
    candidateEvidenceRefreshedAt,
    candidateEvidenceRefreshCount,
    cacheSize: decisionCache.size,
  };
}

/** Get available candidates (filtered to ones whose providers resolve). */
export function getAvailableCandidates(): AutoRouterCandidate[] {
  if (!autoRouterConfig) return [];
  return autoRouterConfig.candidates;
}

export async function generateSessionTitleWithClassifier(task: string, config: StoredConfig): Promise<string | null> {
  const assignedTitleModel = config.roleAssignments?.title;
  const titleModels = [
    autoRouterConfig?.classifierModel,
    assignedTitleModel && assignedTitleModel !== 'Auto' ? assignedTitleModel : undefined,
  ].filter((model): model is string => Boolean(model));
  if (titleModels.length === 0 || !task.trim()) return null;

  const systemPrompt = [
    'You write short, descriptive chat titles for a local AI coding harness.',
    'Return JSON only.',
    'Rules:',
    '- The JSON shape is {"title":"3 to 7 words"}.',
    '- No markdown or prose outside JSON.',
    '- Prefer the user intent over exact wording.',
    '- Keep proper nouns when useful.',
    '- Never write meta commentary such as "the user wants".',
  ].join('\n');
  const userContent = [
    'Create a concise title JSON object for this first user message.',
    '',
    '<message>',
    task.slice(0, 2000),
    '</message>',
  ].join('\n');

  for (const titleModel of [...new Set(titleModels)]) {
    const classifierResolved = getProviderForModel(config, titleModel);
    if (!classifierResolved) continue;
    try {
      const provider = classifierResolved.provider;
      const apiModelId = splitModelRef(titleModel).bareModelId;
      const responseText = provider.type === 'anthropic'
        ? await callAnthropicClassifier(provider, apiModelId, systemPrompt, userContent, 80, 20_000)
        : provider.type === 'google'
          ? await callGoogleClassifier(provider, apiModelId, systemPrompt, userContent, 80, 20_000)
          : await callOpenAICompatibleClassifier(provider, apiModelId, systemPrompt, userContent, 80, 20_000);
      const title = sanitizeGeneratedTitle(responseText);
      if (title) return title;
    } catch (err) {
      console.warn('[autoRouter] title classifier call failed:', err);
    }
  }
  return null;
}

// ── Core routing logic ────────────────────────────────

/**
 * Make a routing decision for the given task signal.
 * Returns null if the router is not configured/enabled, in which case
 * the caller should fall back to the heuristic router + Agent Roles.
 */
export async function routeTask(
  signal: AutoRouterSignal,
  config: StoredConfig,
  options: AutoRouterDecisionOptions = {},
): Promise<AutoRouterDecision | null> {
  if (!autoRouterConfig || !autoRouterConfig.enabled) return null;

  const candidates = autoRouterBaseCandidates.length > 0
    ? annotateCandidatesWithCurrentEvidence(autoRouterBaseCandidates)
    : autoRouterConfig.candidates;
  autoRouterConfig.candidates = candidates;
  if (candidates.length === 0) return null;

  // Single candidate: no routing needed
  if (candidates.length === 1) {
    return {
      modelId: candidates[0].modelId,
      score: 1.0,
      reason: 'Single candidate; no routing needed',
      scores: { [candidates[0].modelId]: 1.0 },
      cached: false,
      fallback: false,
      classifierModel: autoRouterConfig.classifierModel,
    };
  }

  const tierStrategy = options.forceCostStrategy || costStrategyForThinkingEffort(options.thinkingEffort);
  if (tierStrategy) {
    return pickByCost(candidates, tierStrategy, signal.hasImages, signal.estimatedInputTokens, signal.requiresStrongToolUse === true, autoRouterConfig, options.forceCostReason);
  }

  // Check cache
  const cacheKey = buildCacheKey(signal);
  if (autoRouterConfig.cacheTTLMs > 0) {
    const cached = decisionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.decision, cached: true };
    }
  }

  // Build classifier prompt
  const classifierModel = autoRouterConfig.classifierModel;
  const classifierResolved = getProviderForModel(config, classifierModel);
  if (!classifierResolved) {
    // Classifier not available — fall back to cheapest or default
    return fallbackDecision(candidates, autoRouterConfig, 'classifier provider not found');
  }

  try {
    const classifierResult = await callClassifier(
      classifierResolved.provider,
      classifierModel,
      signal,
      candidates,
    );

    if (!classifierResult?.scores || Object.keys(classifierResult.scores).length === 0) {
      return fallbackDecision(candidates, autoRouterConfig, 'classifier returned empty scores');
    }

    const decision = pickCandidate(
      classifierResult.scores,
      candidates,
      autoRouterConfig.threshold,
      signal.hasImages,
      signal.estimatedInputTokens,
      signal.requiresStrongToolUse === true,
      autoRouterConfig.defaultModel,
      classifierResult.reasoning,
    );

    // Cache the decision
    if (autoRouterConfig.cacheTTLMs > 0) {
      if (decisionCache.size >= CACHE_MAX_ENTRIES) {
        // Evict oldest entry
        const oldest = decisionCache.keys().next().value;
        if (oldest) decisionCache.delete(oldest);
      }
      decisionCache.set(cacheKey, {
        decision,
        expiresAt: Date.now() + autoRouterConfig.cacheTTLMs,
      });
    }

    return { ...decision, cached: false, fallback: false, classifierModel };
  } catch (err: any) {
    return fallbackDecision(candidates, autoRouterConfig, `classifier error: ${err?.message || err}`);
  }
}

/** Clear the routing decision cache. */
export function clearRouterCache(): void {
  decisionCache.clear();
}

// ── Classifier call ───────────────────────────────────

async function callClassifier(
  provider: StoredProvider,
  classifierModelId: string,
  signal: AutoRouterSignal,
  candidates: AutoRouterCandidate[],
): Promise<{ scores: Record<string, number>; reasoning?: string } | null> {
  const systemPrompt = buildClassifierSystemPrompt(candidates);
  const userContent = buildClassifierUserContent(signal, candidates);

  // Build the request for an OpenAI-compatible chat completions endpoint
  const apiModelId = splitModelRef(classifierModelId).bareModelId;

  try {
    let responseText: string;

    if (provider.type === 'anthropic') {
      responseText = await callAnthropicClassifier(provider, apiModelId, systemPrompt, userContent);
    } else if (provider.type === 'google') {
      responseText = await callGoogleClassifier(provider, apiModelId, systemPrompt, userContent);
    } else {
      // OpenAI-compatible (default path)
      responseText = await callOpenAICompatibleClassifier(provider, apiModelId, systemPrompt, userContent);
    }

    return parseClassifierScores(responseText, candidates.map((c) => c.modelId));
  } catch (err) {
    console.warn('[autoRouter] classifier call failed:', err);
    return null;
  }
}

async function callOpenAICompatibleClassifier(
  provider: StoredProvider,
  modelId: string,
  systemPrompt: string,
  userContent: string,
  maxTokens = 600,
  timeoutMs = 12_000,
): Promise<string> {
  const baseURL = provider.baseURL.replace(/\/+$/, '');
  const url = baseURL.includes('/chat/completions')
    ? baseURL
    : `${baseURL}/chat/completions`;

  const payload = {
    model: modelId,
    stream: false,
    temperature: 0,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
    headers['x-api-key'] = provider.apiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`classifier HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  return content || '';
}

async function callAnthropicClassifier(
  provider: StoredProvider,
  modelId: string,
  systemPrompt: string,
  userContent: string,
  maxTokens = 600,
  timeoutMs = 12_000,
): Promise<string> {
  const baseURL = provider.baseURL.replace(/\/+$/, '');
  const url = baseURL.includes('/v1/messages') ? baseURL : `${baseURL}/v1/messages`;

  const payload = {
    model: modelId,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (provider.apiKey) {
    headers['x-api-key'] = provider.apiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`classifier HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  const contentBlocks = data?.content || [];
  const texts = contentBlocks
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text);
  return texts.join('\n');
}

async function callGoogleClassifier(
  provider: StoredProvider,
  modelId: string,
  _systemPrompt: string,
  userContent: string,
  maxTokens = 600,
  timeoutMs = 12_000,
): Promise<string> {
  const baseURL = provider.baseURL.replace(/\/+$/, '');
  const url = `${baseURL}/v1beta/models/${modelId}:generateContent`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    systemInstruction: { parts: [{ text: _systemPrompt }] },
    generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`classifier HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  const candidates = data?.candidates || [];
  const texts = candidates
    .flatMap((c: any) => c?.content?.parts || [])
    .filter((p: any) => p.text)
    .map((p: any) => p.text);
  return texts.join('\n');
}

// ── Prompt building ───────────────────────────────────

function buildClassifierSystemPrompt(candidates: AutoRouterCandidate[]): string {
  const lines: string[] = [
    'You are a task-routing classifier for an AI coding agent.',
    'You are given a <session> describing the user\'s current task and a list',
    'of candidate models. For EACH candidate, output a score from 0.0 to 1.0:',
    'the probability that the model completes THIS task correctly on its first',
    'attempt, without errors or rework.',
    '',
    'You are NOT choosing a winner. A downstream system combines your scores',
    'with cost data you do not see to make the final pick. Be an accurate,',
    'well-calibrated, independent probability estimator for each model.',
    '',
    'Scoring guide:',
    '  0.0       cannot attempt (e.g. images required but unsupported) — exact 0.0',
    '  0.1–0.3   will almost certainly fail; lacks the capability',
    '  0.4–0.6   real chance of failure; touches a known weakness or is uncertain',
    '  0.7–0.8   likely success; handles this category well',
    '  0.9–1.0   near-certain success; well within demonstrated ability',
    'Use the full range. A short prompt is NOT necessarily an easy task — hidden',
    'complexity (multi-file edits, debugging, niche domains, strict correctness)',
    'should pull scores down for weaker models. Default to ~0.5–0.6 when unsure.',
    '',
    'Candidate models:',
  ];

  for (const c of candidates) {
    const card = c.card.trim() || 'General-purpose model. No capability card provided.';
    lines.push(`- modelId: ${c.modelId}`);
    lines.push(`  images: ${c.supportsImages ? 'yes' : 'no'}`);
    lines.push(`  tool_quality: ${c.toolCallQuality || candidateToolCallQuality(c)}`);
    lines.push(`  context_window_tokens: ${candidateContextWindow(c)}`);
    lines.push(`  capability: ${card}`);
  }

  lines.push('');
  lines.push('Respond with ONE JSON object, no prose, no code fence, exactly this shape:');
  lines.push(JSON.stringify(
    { scores: Object.fromEntries(candidates.map((c) => [c.modelId, 0.0])), reasoning: 'one short sentence' },
    null,
    2,
  ));
  lines.push('Every modelId above MUST appear in "scores". Each value in [0.0, 1.0].');

  return lines.join('\n');
}

function buildClassifierUserContent(signal: AutoRouterSignal, candidates: AutoRouterCandidate[]): string {
  const task = signal.task || '(no explicit instruction; infer from context)';
  const truncated = task.length > 6000
    ? task.slice(0, 3000) + '\n...\n' + task.slice(-3000)
    : task;

  return [
    '<session>',
    `  surface: ${signal.surface}`,
    `  images_present: ${signal.hasImages ? 'yes' : 'no'}`,
    `  user_turns: ${signal.turns}`,
    `  tools_available: ${signal.toolCount}`,
    `  strong_tool_use_required: ${signal.requiresStrongToolUse ? 'yes' : 'no'}`,
    `  estimated_input_tokens: ${signal.estimatedInputTokens}`,
    '  note: Score models near 0.0 when the estimated input cannot fit their context window.',
    '  current_task: |',
    ...truncated.split('\n').map((l) => '    ' + l),
    '</session>',
    '',
    `Score these modelIds: ${candidates.map((c) => c.modelId).join(', ')}`,
  ].join('\n');
}

// ── Score parsing ────────────────────────────────────

function parseClassifierScores(text: string, candidateIds: string[]): { scores: Record<string, number>; reasoning?: string } | null {
  if (!text) return null;

  // Find the first JSON object in the response
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    const scores = obj?.scores;
    if (!scores || typeof scores !== 'object') return null;

    const result: Record<string, number> = {};
    for (const id of candidateIds) {
      const raw = scores[id];
      result[id] = typeof raw === 'number' ? clamp(raw, 0, 1)
        : typeof raw === 'string' ? clamp(parseFloat(raw), 0, 1)
          : 0;
    }
    const reasoning = typeof obj?.reasoning === 'string' ? obj.reasoning.trim().slice(0, 240) : undefined;
    return { scores: result, reasoning };
  } catch {
    // Try greedy then first-object parsing
    const firstEnd = text.indexOf('}', start);
    if (firstEnd !== -1 && firstEnd > start) {
      try {
        const obj = JSON.parse(text.slice(start, firstEnd + 1));
        const scores = obj?.scores;
        if (scores && typeof scores === 'object') {
          const result: Record<string, number> = {};
          for (const id of candidateIds) {
            const raw = scores[id];
            result[id] = typeof raw === 'number' ? clamp(raw, 0, 1)
              : typeof raw === 'string' ? clamp(parseFloat(raw), 0, 1)
                : 0;
          }
          const reasoning = typeof obj?.reasoning === 'string' ? obj.reasoning.trim().slice(0, 240) : undefined;
          return { scores: result, reasoning };
        }
      } catch { /* fall through */ }
    }
    return null;
  }
}

function sanitizeGeneratedTitle(text: string): string | null {
  const titleMatch = text.match(/"title"\s*:\s*"([^"]{4,120})"/i);
  if (titleMatch) return sanitizeGeneratedTitle(titleMatch[1]);

  const firstLine = text
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => !/^<\/?(think|thinking|reasoning|qdom|transitioned)\b[^>]*>$/i.test(line));
  if (!firstLine) return null;

  const cleaned = firstLine
    .replace(/<\/?(think|thinking|reasoning|qdom|transitioned)\b[^>]*>/gi, '')
    .replace(/^["'`*_#\-\s]+|["'`*_\-\s.]+$/g, '')
    .replace(/^(title|chat title)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (/\b(the user wants|the user asks|create a concise title|short descriptive title)\b/i.test(cleaned)) return null;

  const words = cleaned.split(/\s+/).slice(0, 7);
  const title = words.join(' ').slice(0, 72).trim();
  if (title.length < 4) return null;
  return title;
}

// ── Candidate selection ──────────────────────────────

function pickCandidate(
  scores: Record<string, number>,
  candidates: AutoRouterCandidate[],
  threshold: number,
  hasImages: boolean,
  estimatedInputTokens: number,
  requiresStrongToolUse: boolean,
  defaultModel: string,
  classifierRationale?: string,
): AutoRouterDecision {
  const rationale = classifierRationale ? ` classifier rationale: ${classifierRationale}` : '';
  // Build scored list with image-incapable models hard-zeroed
  const scored: Array<{ candidate: AutoRouterCandidate; score: number }> = candidates.map((c) => {
    let score = scores[c.modelId] ?? 0;
    if (hasImages && !c.supportsImages) {
      score = 0;
    }
    if (!candidateFitsContext(c, estimatedInputTokens)) {
      score = 0;
    }
    if (requiresStrongToolUse && !candidateHasStrongToolUse(c)) {
      score = 0;
    }
    return { candidate: c, score };
  });

  // Candidates above threshold, sorted by cost (cheapest first)
  const viable = scored.filter((s) => s.score >= threshold);
  if (viable.length > 0) {
    viable.sort((a, b) => a.candidate.cost - b.candidate.cost);
    const winner = viable[0];
    return {
      modelId: winner.candidate.modelId,
      score: winner.score,
      reason: `score=${winner.score.toFixed(2)} >= ${threshold.toFixed(2)}, cheapest among viable.${rationale}`,
      scores: Object.fromEntries(scored.map((s) => [s.candidate.modelId, s.score])),
      cached: false,
      fallback: false,
      classifierModel: null, // set by caller
      classifierRationale,
    };
  }

  // No candidate clears threshold — pick highest score
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 0 && scored[0].score > 0) {
    const best = scored[0];
    return {
      modelId: best.candidate.modelId,
      score: best.score,
      reason: `no candidate >= ${threshold.toFixed(2)}; picked highest score (${best.score.toFixed(2)}).${rationale}`,
      scores: Object.fromEntries(scored.map((s) => [s.candidate.modelId, s.score])),
      cached: false,
      fallback: false,
      classifierModel: null,
      classifierRationale,
    };
  }

  // All scores zero — use default
  const defaultCandidate = candidates.find((c) => c.modelId === defaultModel) || candidates[0];
  return {
    modelId: defaultCandidate.modelId,
    score: 0,
    reason: 'all scores zero; used default model',
    scores: Object.fromEntries(scored.map((s) => [s.candidate.modelId, s.score])),
    cached: false,
    fallback: true,
    classifierModel: null,
  };
}

function pickByCost(
  candidates: AutoRouterCandidate[],
  strategy: 'cheapest' | 'strongest' | 'premium',
  hasImages: boolean,
  estimatedInputTokens: number,
  requiresStrongToolUse: boolean,
  config: AutoRouterConfig,
  policyReason?: 'cheap-direct' | 'escalated',
): AutoRouterDecision {
  const imageSafeCandidates = hasImages
    ? candidates.filter((c) => c.supportsImages)
    : candidates;
  const toolSafeCandidates = requiresStrongToolUse
    ? imageSafeCandidates.filter(candidateHasStrongToolUse)
    : imageSafeCandidates;
  const capabilitySafeCandidates = toolSafeCandidates.length > 0 ? toolSafeCandidates : imageSafeCandidates;
  const contextSafeCandidates = capabilitySafeCandidates.filter((c) => candidateFitsContext(c, estimatedInputTokens));
  const usableCandidates = contextSafeCandidates.length > 0 ? contextSafeCandidates : capabilitySafeCandidates;

  if (usableCandidates.length === 0) {
    return fallbackDecision(candidates, config, `No viable candidates for image/context strategy ${strategy}`);
  }

  const preferredCandidates = strategy === 'premium'
    ? usableCandidates.filter((candidate) => candidate.supportsThinking)
    : strategy === 'strongest'
      ? usableCandidates.filter((candidate) => candidate.supportsThinking)
    : usableCandidates;
  const effectiveCandidates = preferredCandidates.length > 0 ? preferredCandidates : usableCandidates;
  const ordered = [...effectiveCandidates].sort((a, b) => (
    strategy === 'cheapest' ? a.cost - b.cost : b.cost - a.cost
  ));

  const selected = ordered[0];
  const skippedForContext = capabilitySafeCandidates.length - contextSafeCandidates.length;
  const skippedForTools = requiresStrongToolUse ? imageSafeCandidates.length - toolSafeCandidates.length : 0;
  const contextReason = skippedForContext > 0
    ? ` Skipped ${skippedForContext} candidate(s) that could not fit ~${estimatedInputTokens} input tokens.`
    : '';
  const toolReason = skippedForTools > 0 && toolSafeCandidates.length > 0
    ? ` Skipped ${skippedForTools} candidate(s) without strong tool-call quality.`
    : requiresStrongToolUse && toolSafeCandidates.length === 0
      ? ' No strong tool-call candidate was available; used strongest viable candidate.'
      : '';
  const premiumFallback = strategy === 'premium' && preferredCandidates.length === 0
    ? ' No native-thinking candidate was available; used strongest viable candidate.'
    : '';
  const thinkingFallback = strategy === 'strongest' && preferredCandidates.length === 0
    ? ' No native-thinking candidate was available; used strongest viable candidate.'
    : '';
  const baseReason = policyReason === 'cheap-direct'
    ? 'Cheap-direct policy selected; using cheapest viable candidate.'
    : policyReason === 'escalated'
      ? 'Escalation policy selected; using strongest native-thinking candidate when available.'
      : strategy === 'cheapest'
        ? 'Low thinking selected; using cheapest viable candidate.'
        : strategy === 'premium'
          ? 'xHigh thinking selected; using strongest native-thinking candidate when available.'
          : 'High thinking selected; using strongest native-thinking candidate when available.';
  const reason = baseReason + premiumFallback + thinkingFallback + toolReason + contextReason;
  const scores = Object.fromEntries(candidates.map((c) => [c.modelId, c.modelId === selected.modelId ? 1.0 : 0]));
  return {
    modelId: selected.modelId,
    score: 1.0,
    reason,
    scores,
    cached: false,
    fallback: false,
    classifierModel: null,
  };
}

function costStrategyForThinkingEffort(effort?: 'low' | 'medium' | 'high' | 'xhigh'): 'cheapest' | 'strongest' | 'premium' | undefined {
  if (effort === 'low') return 'cheapest';
  if (effort === 'high') return 'strongest';
  if (effort === 'xhigh') return 'premium';
  return undefined;
}

function fallbackDecision(
  candidates: AutoRouterCandidate[],
  config: AutoRouterConfig,
  reason: string,
): AutoRouterDecision {
  const defaultCandidate = candidates.find((c) => c.modelId === config.defaultModel)
    || candidates.reduce((a, b) => (a.cost < b.cost ? a : b));

  return {
    modelId: defaultCandidate.modelId,
    score: 0,
    reason: `Fallback: ${reason}`,
    scores: {},
    cached: false,
    fallback: true,
    classifierModel: config.classifierModel,
  };
}

// ── Cache key ──────────────────────────────────────────

function buildCacheKey(signal: AutoRouterSignal): string {
  // Use surface + task content hash (truncated for perf)
  const taskHash = simpleHash(signal.task);
  return `${signal.surface}|${taskHash}`;
}

function simpleHash(text: string): string {
  let hash = 0;
  const maxChars = 200;
  const str = text.slice(0, maxChars);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}

// ── Utilities ──────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Build a router signal from the current message context.
 */
export function buildRouterSignal(
  latestUserMessage: string,
  surface: 'orchestrator' | 'worker',
  hasImages: boolean,
  totalUserTurns: number,
  toolCount: number,
  options: {
    estimatedInputTokens?: number;
    artifactCount?: number;
    dirtyGitState?: boolean;
    thinkingEffort?: 'low' | 'medium' | 'high' | 'xhigh';
    requiresStrongToolUse?: boolean;
  } = {},
): AutoRouterSignal {
  return {
    task: latestUserMessage,
    surface,
    hasImages,
    turns: totalUserTurns,
    toolCount,
    estimatedInputTokens: Math.max(options.estimatedInputTokens ?? estimateTokens(latestUserMessage), 1),
    artifactCount: options.artifactCount,
    dirtyGitState: options.dirtyGitState,
    thinkingEffort: options.thinkingEffort,
    requiresStrongToolUse: options.requiresStrongToolUse,
  };
}

const ROUTER_OUTPUT_RESERVE_TOKENS = 16_000;

function candidateContextWindow(candidate: AutoRouterCandidate): number {
  return getModelConfig(candidate.modelId).contextWindowTokens;
}

function candidateFitsContext(candidate: AutoRouterCandidate, estimatedInputTokens: number): boolean {
  const config = getModelConfig(candidate.modelId);
  const contextWindow = config.contextWindowTokens;
  const outputReserve = Math.min(ROUTER_OUTPUT_RESERVE_TOKENS, config.recommendedMaxTokens);
  const safetyMargin = Math.ceil(contextWindow * 0.05);
  return estimatedInputTokens + outputReserve + safetyMargin <= contextWindow;
}

function candidateToolCallQuality(candidate: AutoRouterCandidate): 'excellent' | 'good' | 'basic' | 'none' {
  return candidate.toolCallQuality || getModelConfig(candidate.modelId).toolCallQuality;
}

function candidateHasStrongToolUse(candidate: AutoRouterCandidate): boolean {
  const quality = candidateToolCallQuality(candidate);
  return quality === 'excellent' || quality === 'good';
}

/**
 * Check if the router's classifier model is reachable and responding.
 * Makes a minimal test call. Returns health status (never throws).
 */
export async function checkRouterHealth(config: StoredConfig): Promise<{
  ok: boolean;
  classifierModel: string | null;
  latencyMs: number;
  error?: string;
}> {
  const cfg = autoRouterConfig;
  if (!cfg || !cfg.enabled) {
    return { ok: false, classifierModel: null, latencyMs: 0, error: 'auto-router not configured' };
  }
  const classifierModel = cfg.classifierModel;
  const resolved = getProviderForModel(config, classifierModel);
  if (!resolved) {
    return { ok: false, classifierModel, latencyMs: 0, error: 'classifier provider not found' };
  }
  const start = Date.now();
  try {
    // Use a trivially simple task to test classifier availability
    const dummySignal: AutoRouterSignal = {
      task: 'say hello',
      surface: 'orchestrator',
      hasImages: false,
      turns: 0,
      toolCount: 0,
      estimatedInputTokens: 10,
    };
    const result = await callClassifier(
      resolved.provider,
      classifierModel,
      dummySignal,
      [{ modelId: '__test__', cost: 0, supportsImages: false, card: 'test' }],
    );
    const latencyMs = Date.now() - start;
    return { ok: result !== null, classifierModel, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return { ok: false, classifierModel, latencyMs, error: err?.message || String(err) };
  }
}
