import type {
  RouterLearningSummary,
  ToolReliabilityBucket,
  ToolReliabilityOutcomeExample,
  ToolReliabilityRetryReductionRecommendation,
  ToolReliabilitySummary,
} from './api';
import { promptStrategyIdForModel } from './promptStrategyResolver';
import {
  ROUTING_LEARNING_STALE_DECISION_DAYS,
  buildRoutingLearningActionCues,
  formatRoutingLearningCueDecisionDate,
  formatRoutingLearningCuePercentDisplay,
} from './routingLearningActionCues';
import type { RoutingLearningActionCue } from './routingLearningActionCues';
import { glmPatienceLaneLabel, glmPatientPartnerLabel } from '../../shared/glmModelPreference';
import {
  isMiniMaxM2SeriesModelId,
  isMiniMaxM3ModelId,
  miniMaxM2FallbackPolicyDetail,
  miniMaxM2FallbackPolicyLabel,
  miniMaxM3PreferencePolicyDetail,
  miniMaxM3PreferencePolicyLabel,
} from '../../shared/minimaxModelPreference';

type EvidenceTone = 'ok' | 'risk' | 'context';

export interface AutoRouterCandidateEvidence {
  text: string;
  ariaLabel: string;
  tone: EvidenceTone;
  stale: boolean;
}

export interface AutoRouterCandidateEvidenceBuilder {
  forModel(modelId: string): AutoRouterCandidateEvidence | null;
}

export interface AutoRouterCandidateEvidenceOptions {
  nowMs?: number;
}

interface AutoRouterCandidateEvidenceIndex {
  summary: RouterLearningSummary;
  toolReliability: ToolReliabilitySummary | null;
  actionCues: IndexedRoutingActionCue[];
  staleActionCues: IndexedRoutingActionCue[];
  byModelEntries: IndexedToolReliabilityEntry[];
  variantsByStrategyId: Map<string, Array<[string, ToolReliabilityBucket]>>;
  outcomesByNewest: IndexedToolReliabilityOutcome[];
  retryRecommendationsByStrength: IndexedRetryRecommendation[];
}

interface IndexedRoutingActionCue {
  cue: RoutingLearningActionCue;
  normalizedModelKey: string;
}

interface IndexedToolReliabilityEntry {
  model: string;
  normalizedModelKey: string;
  bucket: ToolReliabilityBucket;
}

interface IndexedToolReliabilityOutcome {
  outcome: ToolReliabilityOutcomeExample;
  normalizedModelKey: string;
}

interface IndexedRetryRecommendation {
  recommendation: ToolReliabilityRetryReductionRecommendation;
  normalizedModelKey: string;
}

const MIN_EVIDENCE_TOTAL = 2;

function normalizeModelKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizedModelKeysMatch(normalizedCandidate: string, normalizedEvidence: string): boolean {
  return normalizedCandidate === normalizedEvidence
    || normalizedCandidate.endsWith(normalizedEvidence)
    || normalizedEvidence.endsWith(normalizedCandidate);
}

export function routerModelKeysMatch(candidate: string, evidenceKey: string): boolean {
  return normalizedModelKeysMatch(normalizeModelKey(candidate), normalizeModelKey(evidenceKey));
}

export function promptStrategyIdForRouterCandidate(modelId: string): string {
  return promptStrategyIdForModel(modelId);
}

function usableBucket(bucket: ToolReliabilityBucket | null | undefined): bucket is ToolReliabilityBucket {
  return Boolean(bucket && Number.isFinite(bucket.total) && bucket.total >= MIN_EVIDENCE_TOTAL);
}

function buildCandidateEvidenceIndex(
  summary: RouterLearningSummary | null | undefined,
  options: AutoRouterCandidateEvidenceOptions = {},
): AutoRouterCandidateEvidenceIndex | null {
  if (!summary) return null;
  const toolReliability = summary.toolReliability || null;

  const variantsByStrategyId = new Map<string, Array<[string, ToolReliabilityBucket]>>();
  for (const [variantId, bucket] of Object.entries(toolReliability?.byPromptStrategyVariant || {})) {
    const separatorIndex = variantId.indexOf(':');
    if (separatorIndex <= 0 || !usableBucket(bucket) || bucket.error <= 0) continue;
    const strategyId = variantId.slice(0, separatorIndex);
    const variants = variantsByStrategyId.get(strategyId) || [];
    variants.push([variantId, bucket]);
    variantsByStrategyId.set(strategyId, variants);
  }
  for (const variants of variantsByStrategyId.values()) {
    variants.sort(([aKey, a], [bKey, b]) => (
      b.errorRate - a.errorRate
      || b.total - a.total
      || b.error - a.error
      || aKey.localeCompare(bKey)
    ));
  }

  const routingActionCues = buildRoutingLearningActionCues(summary.bestByTaskType || [], options.nowMs);
  const indexedRoutingActionCues = routingActionCues.map((cue): IndexedRoutingActionCue => ({
    cue,
    normalizedModelKey: normalizeModelKey(cue.model),
  }));
  return {
    summary,
    toolReliability,
    actionCues: indexedRoutingActionCues.filter(({ cue }) => cue.status === 'actionable' && !cue.stale),
    staleActionCues: indexedRoutingActionCues.filter(({ cue }) => cue.status === 'actionable' && cue.stale),
    byModelEntries: Object.entries(toolReliability?.byModel || {}).map(([model, bucket]) => ({
      model,
      normalizedModelKey: normalizeModelKey(model),
      bucket,
    })),
    variantsByStrategyId,
    outcomesByNewest: [...(toolReliability?.outcomeExamples || [])]
      .sort((a, b) => timestampMs(b.timestamp) - timestampMs(a.timestamp))
      .map((outcome) => ({
        outcome,
        normalizedModelKey: normalizeModelKey(outcome.failedModel),
      })),
    retryRecommendationsByStrength: [...(toolReliability?.retryReductionRecommendations || [])]
      .sort((a, b) => (
        b.supportRunCount - a.supportRunCount
        || timestampMs(b.timestamp) - timestampMs(a.timestamp)
      ))
      .map((recommendation) => ({
        recommendation,
        normalizedModelKey: normalizeModelKey(recommendation.failedModel),
      })),
  };
}

function candidateToolBucket(index: AutoRouterCandidateEvidenceIndex, normalizedModelKey: string): ToolReliabilityBucket | null {
  for (const entry of index.byModelEntries) {
    if (normalizedModelKeysMatch(normalizedModelKey, entry.normalizedModelKey) && usableBucket(entry.bucket)) return entry.bucket;
  }
  return null;
}

function riskiestStrategyVariant(index: AutoRouterCandidateEvidenceIndex, strategyId: string): [string, ToolReliabilityBucket] | null {
  return index.variantsByStrategyId.get(strategyId)?.[0] || null;
}

function errorText(label: string, bucket: ToolReliabilityBucket): string {
  return `${label} ${bucket.error}/${bucket.total} errors`;
}

function compactErrorText(label: string, bucket: ToolReliabilityBucket): string {
  return `${label} ${bucket.error}/${bucket.total}`;
}

function candidateActionCues(index: AutoRouterCandidateEvidenceIndex, normalizedModelKey: string): RoutingLearningActionCue[] {
  return index.actionCues
    .filter((entry) => normalizedModelKeysMatch(normalizedModelKey, entry.normalizedModelKey))
    .map((entry) => entry.cue);
}

function candidateStaleActionCues(index: AutoRouterCandidateEvidenceIndex, normalizedModelKey: string): RoutingLearningActionCue[] {
  return index.staleActionCues
    .filter((entry) => normalizedModelKeysMatch(normalizedModelKey, entry.normalizedModelKey))
    .map((entry) => entry.cue);
}

function actionCueText(cue: RoutingLearningActionCue): string {
  const confidenceSuffix = cue.confidence === 'limited' ? ' · limited' : '';
  const lastSeenDate = formatRoutingLearningCueDecisionDate(cue.lastSeenAt);
  const freshnessSuffix = lastSeenDate ? ` · routed=${lastSeenDate}` : '';
  return `RL ${cue.taskType} ${formatRoutingLearningCuePercentDisplay(cue.rate)}/${cue.total}${confidenceSuffix}${freshnessSuffix}`;
}

function latestRoutingLearningCueDecisionDate(cues: RoutingLearningActionCue[]): string | null {
  let latestMs = Number.NEGATIVE_INFINITY;
  let latestDate: string | null = null;
  for (const cue of cues) {
    if (!cue.lastSeenAt) continue;
    const parsed = Date.parse(cue.lastSeenAt);
    if (!Number.isFinite(parsed) || parsed <= latestMs) continue;
    latestMs = parsed;
    latestDate = formatRoutingLearningCueDecisionDate(cue.lastSeenAt);
  }
  return latestDate;
}

function staleActionCuesText(cues: RoutingLearningActionCue[]): string {
  const latestDate = latestRoutingLearningCueDecisionDate(cues);
  const routedSuffix = latestDate ? ` · last routed=${latestDate}` : '';
  const contextLabel = cues.length === 1 ? 'Stale RL context' : `${cues.length} stale RL contexts`;
  return `${contextLabel} withheld${routedSuffix} · >${ROUTING_LEARNING_STALE_DECISION_DAYS}d`;
}

function staleActionCuesAria(cues: RoutingLearningActionCue[]): string {
  const latestDate = latestRoutingLearningCueDecisionDate(cues);
  const taskDetails = cues
    .map((cue) => `${cue.taskType} ${formatRoutingLearningCuePercentDisplay(cue.rate)}/${cue.total}`)
    .join('; ');
  if (cues.length === 1) {
    const cue = cues[0];
    const routedDetail = latestDate ? ` most recent routed ${latestDate};` : '';
    return `stale Routing Learning context withheld from scoring annotation because it is stale:${routedDetail} ${cue.model} handled ${cue.taskType} at ${formatRoutingLearningCuePercentDisplay(cue.rate)} across ${cue.total} reviewed outcomes. Refresh recent outcomes before using it as routing-card evidence.`;
  }
  const routedDetail = latestDate ? ` latest routed ${latestDate};` : '';
  return `${cues.length} stale Routing Learning contexts withheld from scoring annotation because they are stale:${routedDetail} affected task evidence ${taskDetails}. Refresh recent outcomes before using them as routing-card evidence.`;
}

function actionCueAria(cue: RoutingLearningActionCue): string {
  const freshnessDetail = cue.freshnessDetail ? `; ${cue.freshnessDetail}` : '';
  return `Routing Learning action cue for ${cue.taskType}: advisory only; ${cue.model} handled ${cue.taskType} at ${formatRoutingLearningCuePercentDisplay(cue.rate)} across ${cue.total} reviewed outcomes; confidence ${cue.confidenceLabel.toLowerCase()}: ${cue.confidenceDetail}${freshnessDetail}`;
}

function compactVariantId(variantId: string, strategyId: string): string {
  return variantId.startsWith(`${strategyId}:`) ? variantId.slice(strategyId.length + 1) : variantId;
}

function timestampMs(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function providerQualifiedPath(providerId: string | undefined, modelId: string, tool: string): string {
  const path = `${modelId}/${tool}`;
  const provider = providerId?.trim();
  if (!provider) return path;
  return modelId.toLowerCase().startsWith(`${provider.toLowerCase()}:`) ? path : `${provider}:${path}`;
}

function latestOutcomeForCandidate(
  index: AutoRouterCandidateEvidenceIndex,
  normalizedModelKey: string,
): ToolReliabilityOutcomeExample | null {
  return index.outcomesByNewest.find((entry) => normalizedModelKeysMatch(normalizedModelKey, entry.normalizedModelKey))?.outcome || null;
}

function latestRetryRecommendationForCandidate(
  index: AutoRouterCandidateEvidenceIndex,
  normalizedModelKey: string,
): ToolReliabilityRetryReductionRecommendation | null {
  return index.retryRecommendationsByStrength.find((entry) => normalizedModelKeysMatch(normalizedModelKey, entry.normalizedModelKey))?.recommendation || null;
}

function outcomeText(outcome: ToolReliabilityOutcomeExample): string {
  const workedBy = outcome.workedBy?.tool || (outcome.finalAnswerCaptured ? 'final_answer' : outcome.finalStatus);
  return `Outcome ${outcome.failedTool} -> ${workedBy} (${outcome.outcome}, retry ${outcome.retryDistance})`;
}

function compactOutcomeText(outcome: ToolReliabilityOutcomeExample): string {
  const workedBy = outcome.workedBy?.tool || (outcome.finalAnswerCaptured ? 'final_answer' : outcome.finalStatus);
  return `Recovery ${outcome.failedTool} -> ${workedBy}`;
}

function outcomeAria(outcome: ToolReliabilityOutcomeExample): string {
  const failedPath = providerQualifiedPath(outcome.failedProviderId, outcome.failedModel, outcome.failedTool);
  const workedBy = outcome.workedBy
    ? providerQualifiedPath(outcome.workedBy.providerId, outcome.workedBy.model, outcome.workedBy.tool)
    : outcome.finalAnswerCaptured
      ? 'final answer without a later tool'
      : outcome.finalStatus;
  return `session outcome ${outcome.evidenceSource} session ${outcome.sessionId} run ${outcome.runId}: ${failedPath} recovered by ${workedBy} with retry distance ${outcome.retryDistance}`;
}

function runCountLabel(count: number): string {
  return `${count} run${count === 1 ? '' : 's'}`;
}

function retryRecommendationText(recommendation: ToolReliabilityRetryReductionRecommendation): string {
  return `Retry ${recommendation.avoidPath} -> ${recommendation.preferPath} (${recommendation.evidenceConfidence}, ${runCountLabel(recommendation.supportRunCount)})`;
}

function compactRetryRecommendationText(recommendation: ToolReliabilityRetryReductionRecommendation): string {
  return `Retry ${runCountLabel(recommendation.supportRunCount)}`;
}

function retryRecommendationAria(recommendation: ToolReliabilityRetryReductionRecommendation): string {
  return `retry-reduction recommendation from ${recommendation.evidenceSource} with ${recommendation.evidenceConfidence} confidence: prefer ${recommendation.preferPath} over ${recommendation.avoidPath}, supported by ${runCountLabel(recommendation.supportRunCount)}`;
}

function retryRecommendationTrustText(recommendation: ToolReliabilityRetryReductionRecommendation): string {
  if (recommendation.tuningAction === 'review_before_tuning') return 'Review first';
  if (recommendation.tuningAction === 'context_only') return 'Context only';
  return recommendation.evidenceConfidence === 'repeated_trace' || recommendation.supportRunCount > 1
    ? 'Repeated trace'
    : 'Single trace';
}

function retryRecommendationTrustAria(recommendation: ToolReliabilityRetryReductionRecommendation): string {
  const trustText = retryRecommendationTrustText(recommendation).toLowerCase();
  if (recommendation.tuningAction === 'review_before_tuning') {
    return `trust signal ${trustText}: review this ${recommendation.evidenceSource} retry evidence before tuning routing`;
  }
  if (recommendation.tuningAction === 'context_only') {
    return `trust signal ${trustText}: use this ${recommendation.evidenceSource} retry evidence as context only`;
  }
  if (recommendation.evidenceConfidence === 'repeated_trace' || recommendation.supportRunCount > 1) {
    return `trust signal ${trustText}: retry evidence is supported by ${runCountLabel(recommendation.supportRunCount)}`;
  }
  return `trust signal ${trustText}: verify this single-run retry evidence before tuning routing`;
}

function candidatePolicyEvidence(
  modelId: string,
  strategyId: string,
): { text: string; ariaLabel: string } | null {
  if (strategyId === 'glm-5-patient-partner-v1') {
    const partnerLabel = glmPatientPartnerLabel(modelId);
    const laneLabel = glmPatienceLaneLabel(modelId);
    return {
      text: `Policy ${partnerLabel}`,
      ariaLabel: `static prompt policy: ${partnerLabel} is treated as a patient partner for difficult work; allow a private plan, preserve English tool discipline, require proof-first output, and do not request visible chain-of-thought; runtime expectation: ${laneLabel} means deliberate slow responses get a longer wait when the request uses the slow-model lane; this is intentional, not a hung model`,
    };
  }
  if (isMiniMaxM3ModelId(modelId)) {
    const label = miniMaxM3PreferencePolicyLabel();
    return {
      text: `Policy ${label}`,
      ariaLabel: `static routing policy: ${miniMaxM3PreferencePolicyDetail()}`,
    };
  }
  if (isMiniMaxM2SeriesModelId(modelId)) {
    const label = miniMaxM2FallbackPolicyLabel();
    return {
      text: `Policy ${label}`,
      ariaLabel: `static routing policy: ${miniMaxM2FallbackPolicyDetail()}`,
    };
  }
  return null;
}

function buildAutoRouterCandidateEvidenceFromIndex(
  index: AutoRouterCandidateEvidenceIndex | null,
  modelId: string,
): AutoRouterCandidateEvidence | null {
  const strategyId = promptStrategyIdForRouterCandidate(modelId);
  const normalizedModelKey = normalizeModelKey(modelId);
  const policy = candidatePolicyEvidence(modelId, strategyId);
  const actionCues = index ? candidateActionCues(index, normalizedModelKey) : [];
  const staleActionCues = index ? candidateStaleActionCues(index, normalizedModelKey) : [];
  const tool = index ? candidateToolBucket(index, normalizedModelKey) : null;
  const strategy = index?.toolReliability?.byPromptStrategy?.[strategyId];
  const variant = index ? riskiestStrategyVariant(index, strategyId) : null;
  const outcome = index ? latestOutcomeForCandidate(index, normalizedModelKey) : null;
  const retryRecommendation = index ? latestRetryRecommendationForCandidate(index, normalizedModelKey) : null;
  const parts: string[] = [];
  const visibleParts: string[] = [];
  const ariaParts: string[] = [];
  const riskParts: boolean[] = [];

  if (policy) {
    parts.push(policy.text);
    visibleParts.push(policy.text);
    ariaParts.push(policy.ariaLabel);
    riskParts.push(false);
  }
  for (const cue of actionCues) {
    parts.push(actionCueText(cue));
    visibleParts.push(actionCueText(cue));
    ariaParts.push(actionCueAria(cue));
    riskParts.push(true);
  }
  if (staleActionCues.length > 0) {
    const staleText = staleActionCuesText(staleActionCues);
    parts.push(staleText);
    visibleParts.push(staleText);
    ariaParts.push(staleActionCuesAria(staleActionCues));
    riskParts.push(false);
  }
  if (tool) {
    parts.push(errorText('Tool', tool));
    visibleParts.push(compactErrorText('Tool', tool));
    ariaParts.push(`model-specific tool reliability ${tool.error} errors from ${tool.total} traced tool calls`);
    riskParts.push(tool.error > 0);
  }
  if (usableBucket(strategy)) {
    parts.push(errorText(`Strategy ${strategyId}`, strategy));
    visibleParts.push(compactErrorText(`Strategy ${strategyId}`, strategy));
    ariaParts.push(`prompt strategy ${strategyId} ${strategy.error} errors from ${strategy.total} traced tool calls`);
    riskParts.push(strategy.error > 0);
  }
  if (variant) {
    const [variantId, bucket] = variant;
    parts.push(errorText(`Variant ${variantId}`, bucket));
    visibleParts.push(compactErrorText(`Variant ${compactVariantId(variantId, strategyId)}`, bucket));
    ariaParts.push(`risky prompt variant ${variantId} ${bucket.error} errors from ${bucket.total} traced tool calls`);
    riskParts.push(bucket.error > 0);
  }
  if (outcome) {
    parts.push(outcomeText(outcome));
    visibleParts.push(compactOutcomeText(outcome));
    ariaParts.push(outcomeAria(outcome));
    riskParts.push(true);
  }
  if (retryRecommendation) {
    parts.push(retryRecommendationText(retryRecommendation));
    visibleParts.push(compactRetryRecommendationText(retryRecommendation));
    ariaParts.push(retryRecommendationAria(retryRecommendation));
    riskParts.push(true);
    const trustText = retryRecommendationTrustText(retryRecommendation);
    parts.push(`Trust ${trustText}`);
    visibleParts.push(trustText);
    ariaParts.push(retryRecommendationTrustAria(retryRecommendation));
    riskParts.push(true);
  }

  if (parts.length === 0) return null;

  const summaryStale = index?.summary.outdated === true;
  const hasFreshRiskEvidence = riskParts.some(Boolean);
  const learnedPartCount = parts.length - (policy ? 1 : 0);
  const stale = summaryStale || staleActionCues.length > 0;
  const compactVisibleParts = summaryStale ? ['Learning stale', ...visibleParts] : visibleParts;
  const fullVisibleParts = summaryStale ? ['Learning stale', ...parts] : parts;
  const accessibleParts = summaryStale
    ? ['router learning summary is marked outdated', ...ariaParts]
    : ariaParts;

  return {
    text: `Evidence: ${compactVisibleParts.join(' · ')}`,
    ariaLabel: `Routing evidence for ${modelId}: ${accessibleParts.join('; ')}. Full visible detail: ${fullVisibleParts.join(' · ')}`,
    tone: hasFreshRiskEvidence ? 'risk' : (stale || (policy && learnedPartCount === 0)) ? 'context' : 'ok',
    stale,
  };
}

export function createAutoRouterCandidateEvidenceBuilder(
  summary: RouterLearningSummary | null | undefined,
  options: AutoRouterCandidateEvidenceOptions = {},
): AutoRouterCandidateEvidenceBuilder {
  const index = buildCandidateEvidenceIndex(summary, options);
  return {
    forModel(modelId: string) {
      return buildAutoRouterCandidateEvidenceFromIndex(index, modelId);
    },
  };
}

export function buildAutoRouterCandidateEvidence(
  summary: RouterLearningSummary | null | undefined,
  modelId: string,
  options: AutoRouterCandidateEvidenceOptions = {},
): AutoRouterCandidateEvidence | null {
  return createAutoRouterCandidateEvidenceBuilder(summary, options).forModel(modelId);
}
