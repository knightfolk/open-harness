import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { modelAbilityStates, modelCapabilityFlags } from '../src/utils/modelCapabilities';

const autoFlags = modelCapabilityFlags('Auto');
assert.deepEqual(
  autoFlags,
  { thinking: true, vision: true, tools: true, longContext: true },
  'Auto should advertise broad capability because routing can select capable candidates',
);
assert.deepEqual(
  modelAbilityStates('Auto').map((ability) => `${ability.id}:${ability.active}`),
  ['thinking:true', 'vision:true', 'tools:true', 'context:true'],
  'Auto ability state should expose thinking, vision, tools, and long-context support',
);

const settings = readFileSync('src/components/SettingsModal.tsx', 'utf-8');
const routingLearning = readFileSync('src/components/RoutingLearningPane.tsx', 'utf-8');
const modelLab = readFileSync('src/components/ModelLabPanel.tsx', 'utf-8');
const promptMicroscope = readFileSync('src/components/PromptMicroscope.tsx', 'utf-8');
const modelCapabilities = readFileSync('src/utils/modelCapabilities.ts', 'utf-8');
const api = readFileSync('src/utils/api.ts', 'utf-8');
const autoRouter = readFileSync('server/autoRouter.ts', 'utf-8');
const serverIndex = readFileSync('server/index.ts', 'utf-8');
const routingLearningContract = `${routingLearning}\n${api}\n${serverIndex}`;

for (const expected of [
  "export type ModelAbilityId = 'thinking' | 'vision' | 'tools' | 'context'",
  'Auto can route to candidates with this capability.',
  'Thinking/reasoning model.',
  'Vision input supported.',
  'Tool use supported.',
  'Long context detected.',
  'Long context below 200K or unknown.',
]) {
  assert.ok(
    modelCapabilities.includes(expected),
    `Model capability utility should preserve honest capability labels: ${expected}`,
  );
}

for (const expected of [
  'function ModelAbilityIcons',
  'aria-label="Model abilities"',
  'modelAbilityStates(modelId, providerId)',
  "const Icon = id === 'thinking' ? Brain : id === 'vision' ? Eye : id === 'tools' ? Wrench : Layers",
  'aria-label={`${title}: ${active ? \'available\' : \'unavailable\'}`}',
  'function scoreModelForEffort',
  'function scoreModelForRole',
  'supportsTools',
  'supportsThinking',
  'longContext',
  'hugeContext',
  'function modelScorecardSignals',
  'Coding capability ${signals.coding}',
  'Reasoning capability ${signals.reasoning}',
  'Review capability ${signals.review}',
  'Planning capability ${signals.planning}',
  'Speed expectation ${signals.speed}',
  'Privacy and deployment posture ${signals.privacy}',
  'Local availability ${signals.localAvailability}',
  'core capability scorecard: coding, reasoning, review, planning, tool use, vision, long context, speed, cost, privacy, and local availability',
]) {
  assert.ok(
    settings.includes(expected),
    `Settings should preserve model capability scorecards and role/effort scoring: ${expected}`,
  );
}

for (const expected of [
  'Premium-cost model selected',
  'Luxury-cost model selected',
  'Use Auto or a lower-cost worker model for routine chat, long background runs, or bulk tool loops.',
  'ModelBudgetEditor',
  'ProviderRateLimitEditor',
  'ProviderRateLimitStatus',
  'Provider health probe running',
  'Probe provider health and capabilities; no previous probe summary is available',
  'Provider health failed after ${summary.total} probe',
  'Provider health is stale after ${summary.total} probe',
  'Provider health OK after ${summary.total} probe',
]) {
  assert.ok(
    settings.includes(expected),
    `Settings should preserve budget/rate-limit/provider-health visibility before expensive model work: ${expected}`,
  );
}

for (const expected of [
  '<PaneTitle>Auto-Router</PaneTitle>',
  'Use a classifier model to pick the best candidate model per task.',
  'Active candidate used to score task fit before cost and context gates are applied',
  'The lowest effective-cost candidate above the threshold wins. Effective cost is a preference weight, not a quality score.',
  'Eval proof trust',
  'Treat approved proof as trusted, review unreviewed proof manually, and do not trust needs-attention proof until it is resolved.',
  'Candidate evidence freshness',
  'Auto-Router evidence freshness: candidate evidence refreshed',
  'Auto-router catalog contains',
  'Auto-router has ${configuredCandidates.length} configured provider models available to sync',
  'Auto-router has ${arCandidates.length} active routed candidates',
]) {
  assert.ok(
    settings.includes(expected),
    `Auto-Router settings should preserve honest router explanations and evidence freshness: ${expected}`,
  );
}

for (const expected of [
  'aria-label={`${c.modelId} Auto-Router evidence badges`}',
  'Eval-backed',
  'Eval evidence',
  'Tool {toolReliability.error}/{toolReliability.total}',
  'aria-label={`Auto-router tool reliability for ${c.modelId}:',
  'Risky tools for this model:',
  'session ${example.sessionId}, run ${example.runId}',
  'Recovery proof: session {toolRecovery.sessionId}, run {toolRecovery.runId}.',
  'aria-label={`Auto-Router recovery proof for ${c.modelId}: session ${toolRecovery.sessionId}, run ${toolRecovery.runId}`}',
  'const toolEvidenceSources = routerLearningSummary?.toolReliability?.byEvidenceSource || []',
  'aria-label={`Auto-Router tool-error evidence sources:',
  'Tool-error evidence sources',
  'Check the source mix before changing candidate cards or costs',
  'tuning action ${source.tuningAction}',
  'routerRetryReductionForModel',
  'Retry reduction: first failed {retryReduction.failedProviderId || \'unknown\'}:{retryReduction.avoidPath}; recovered {retryReduction.preferPath}; prefer after {retryReduction.retryDistance} rounds; avg recovery distance {retryReduction.avgRetryDistance}; source {retryReduction.evidenceSource}; confidence {retryReduction.evidenceConfidence} from {retryReduction.supportRunCount} run',
  'supporting sessions {(retryReduction.supportSessionIds || []).join',
  'supporting runs {(retryReduction.supportRunIds || []).join',
  'provider path avoid {retryReduction.avoidProviderPath}; provider path prefer {retryReduction.preferProviderPath}',
  'aria-label={`Auto-Router retry-reduction recommendation for ${c.modelId}: first failed ${retryReduction.failedProviderId || \'unknown\'}:${retryReduction.avoidPath}, recovered ${retryReduction.preferPath}, prefer after ${retryReduction.retryDistance} rounds, avg recovery distance ${retryReduction.avgRetryDistance}, source ${retryReduction.evidenceSource}, confidence ${retryReduction.evidenceConfidence} from ${retryReduction.supportRunCount} run',
  'Prompt strategy {promptStrategyReliability.strategyId}:',
  'This same evidence is also added to classifier candidate cards for tool-heavy execute scoring.',
  'Prompt strategy best practice for ${selection.profile.id}:',
  'Use as advisory prompt-contract evidence, not an automatic routing override.',
  'aria-label={`${c.modelId} capability card for classifier routing; describe strengths, weaknesses, and safest task fit`}',
]) {
  assert.ok(
    settings.includes(expected),
    `Auto-Router candidate rows should preserve eval/tool/prompt reliability evidence: ${expected}`,
  );
}

for (const expected of [
  '<h3>Tool Reliability</h3>',
  'Derived from saved run traces. Use this to spot models, providers, or tools that cause avoidable retries before a final answer.',
  'First-call failures',
  'Recovery rounds',
  '<ToolReliabilityColumn title="By model" data={toolReliability.byModel} />',
  '<ToolReliabilityColumn title="By model/tool pair" data={toolReliability.byModelTool} />',
  '<ToolReliabilityColumn title="By prompt strategy" data={toolReliability.byPromptStrategy} />',
  '<ToolReliabilityColumn title="By strategy variant" data={toolReliability.byPromptStrategyVariant} />',
  'aria-label="Tool-error evidence source summary"',
  "'- Tool-error evidence sources:'",
  'toolReliability.byEvidenceSource',
  'Retry-reduction advice from tool-call history',
  'aria-label="Tool-call retry-reduction recommendations"',
  "'- Retry-reduction recommendations:'",
  "'- Recent recovery paths:'",
  'strategy ${strategy}; evidence source ${item.evidenceSource}; session ${item.sessionId}; run ${item.runId}',
  'strategy {item.promptStrategyVariantId || item.promptStrategyId || \'unknown\'}',
  'item.avoidPath',
  'item.preferPath',
  'item.tuningAction',
  'item.tuningGuidance',
  'item.supportRunCount',
  'item.supportSessionIds',
  'item.supportRunIds',
  'item.evidenceConfidence',
  'item.avgRetryDistance',
  'aria-label="Normalized tool-error signatures"',
  'aria-label="Session outcomes after tool-call errors"',
  "'- Normalized tool-error signatures:'",
  'worked.avgRetryDistance',
  'item.exampleRunIds.join',
  'session ${item.sessionId}',
  'run ${item.runId}',
  'item.exampleSessionIds?.join',
  'evidence source ${item.evidenceSource}',
  'item.exampleEvidenceSources?.join',
  'source {item.evidenceSource}',
  'preview.toolReliabilityPreview',
  'Tool reliability summary: ${preview.toolReliabilityPreview.evidenceSource}',
  'not merged into local routing learning state',
  'Tool-reliability summary was previewed as ${result.toolReliabilityPreview.evidenceSource} only and was not merged into local routing state.',
  'api.getPromptStrategies().catch(() => [])',
  'function routeEventPromptBestPractice',
  'Prompt eval cue: ${note.evaluationCue}; source: ${note.sourceRef}.',
  'promptStrategyBestPractices?: Array<{',
  'bestPracticeNotes: PromptStrategyBestPracticeNote[]',
  'promptBestPracticePreview?: {',
  'bestPracticeNoteCount: number',
  'promptBestPracticePreview } = buildRouterLearningImportPreview(body)',
  'Prompt best-practice metadata was previewed as context-only evidence and was not merged into local prompt strategy profiles.',
  'aria-label={`Role recommendation ${rec.role} to ${rec.modelId}. Report ${rec.reportName}. Proof ${evalProofStatusLabel(rec)}. ${rec.proofTrusted ? \'Trusted evidence may be applied.\' : \'Not trusted until Model Lab proof is approved.\'}`}',
]) {
  assert.ok(
    routingLearningContract.includes(expected),
    `Routing Learning should preserve model/tool/prompt reliability visibility: ${expected}`,
  );
}

for (const expected of [
  'evidence ${pattern.exampleEvidenceSources?.join',
  'evidence ${item.exampleEvidenceSources?.join',
  'evidence ${item.evidenceSource}',
  'Retry-reduction recommendations:',
  'supporting sessions ${item.supportSessionIds?.join',
  'supporting runs ${item.supportRunIds?.join',
  'examples session ${pattern.exampleSessionIds?.join',
  'examples session ${item.exampleSessionIds?.join',
  'session ${item.sessionId}, run ${item.runId}',
  'Use matching signatures to avoid repeating the same failed first tool',
]) {
  assert.ok(
    autoRouter.includes(expected),
    `Auto-Router candidate cards should preserve session/run breadcrumbs for tool-error evidence: ${expected}`,
  );
}

for (const expected of [
  'errorSignatures: ToolReliabilityErrorSignature[]',
  'retryReductionRecommendations: ToolReliabilityRetryReductionRecommendation[]',
  'byEvidenceSource: ToolReliabilityEvidenceSourceSummary[]',
  'export interface ToolReliabilityEvidenceSourceSummary',
  'export interface ToolReliabilityRetryReductionRecommendation',
  'avoidProviderPath: string',
  'preferProviderPath: string',
  'export interface ToolReliabilityErrorSignature',
  'avgRetryDistance: number',
  'exampleSessionIds: string[]',
  'exampleRunIds: string[]',
  "export type ToolReliabilityEvidenceSource = 'saved_session_trace' | 'log_trace' | 'imported_trace'",
  "export type ToolReliabilityTuningAction = 'tune_local_router' | 'review_before_tuning' | 'context_only'",
  "export type ToolReliabilityEvidenceConfidence = 'single_trace' | 'repeated_trace'",
  'evidenceSource: ToolReliabilityEvidenceSource',
  'tuningAction: ToolReliabilityTuningAction',
  'evidenceConfidence: ToolReliabilityEvidenceConfidence',
  'supportRunCount: number',
  'supportSessionIds: string[]',
  'supportRunIds: string[]',
  'avgRetryDistance: number',
  'tuningGuidance: string',
  'exampleEvidenceSources: ToolReliabilityEvidenceSource[]',
  'toolReliabilityPreview?:',
  "evidenceSource: 'imported_trace'",
  'bestPractice?: {',
  'evaluationCue: string',
  'sourceRef: string',
]) {
  assert.ok(
    api.includes(expected),
    `Client API types should preserve normalized tool-error signature data: ${expected}`,
  );
}

for (const expected of [
  'const advisoryLabel = `${title}: ${totalRuns} ${unit}${totalRuns === 1 ? \'\' : \'s\'}. Provider rate-limit and metered billing caution.`',
  'Model Lab runs execute in the background and can hit provider rate limits or metered billing.',
  'Provider health: {providerHealthSignal.tracked} tracked',
  'Latest health check: {new Date(providerHealthSignal.latestChecked).toLocaleString()}',
  'Provider-budget approval required before running ${label}.',
  'const modelLabPackGuidance = [',
  'Open-source calibration pass',
  'Start with the cheapest strong local or open candidates, then run the same prompt pack across coder, reviewer, and summarizer roles before changing defaults.',
  'Frontier comparison pass',
  'Keep the matrix tight: current default, one premium challenger, and one low-cost challenger on identical prompts. Export the report before applying role changes.',
  'Auto-router trust pass',
  'Use prompt packs as repeatable proof runs: calibrate cheaper candidates first, compare frontier models second, then apply only the role or router changes the report supports.',
  'Export pack evidence brief',
  'const bestPractice = strategy.bestPracticeNotes?.[0]',
  'Source-backed guidance: ${bestPractice.guidance}. Eval cue: ${bestPractice.evaluationCue}',
  '<strong>Best practice:</strong> {bestPractice.guidance}',
  'Eval cue: {bestPractice.evaluationCue}',
]) {
  assert.ok(
    modelLab.includes(expected),
    `Model Lab prompt packs should preserve calibration/comparison proof guidance: ${expected}`,
  );
}

for (const expected of [
  'aria-label={`Prompt strategy ${strategy.id}; source-backed metadata is advisory prompt-contract evidence, not an automatic routing override`}',
  '<span className="pm-score-model">Provenance use</span>',
  '<span className="pm-score-value">Advisory prompt-contract evidence, not an automatic routing override</span>',
  'Best model: ${summary?.bestModel || \'not available\'}',
  'Prompt strategies observed:',
  'Same-model prompt strategy comparisons: ${sameModelComparisons.length > 0 ? sameModelComparisons.join(\'; \') : \'not recorded\'}',
  'function summarizeSameModelPromptStrategyComparisons',
  'promptName?: string; taskId?: string; taskName?: string',
  'const workLabel = result.promptName || result.promptId || result.taskName || result.taskId || \'unknown prompt/task\'',
  '`${modelId} / ${workLabel}: ${[...strategies].sort().join(\', \')}`',
  'const sameModelComparisons = summarizeSameModelPromptStrategyComparisons(run.results)',
  '## Model results',
  '## Prompt strategy results',
  'Best prompt strategy: ${summary?.bestPromptStrategy || \'not available\'}',
  'Same-model comparison proof status: ${report.proofReview?.status || \'unreviewed\'}',
  'Comparison artifact path: ${report.artifactPath || \'not available\'}',
  'eval cue: ${strategy.bestPractice.evaluationCue}, source: ${strategy.bestPractice.sourceRef}',
  'Recommendation trust: ${report.proofReview?.status === \'approved\' ? \'approved proof; may be used as routing evidence\' : \'proof not approved; review before applying role or router changes\'}',
  '- Inspectable output evidence in Model Lab includes response excerpts, failed/weak signals, and tool calls.',
]) {
  assert.ok(
    modelLab.includes(expected),
    `Model Lab proof briefs should preserve model/prompt evidence and trust language: ${expected}`,
  );
}

for (const expected of [
  '# Model Lab Bench Proof Brief',
  'Run id: ${run.id}',
  'Proof review: ${run.proofReview?.status || \'unreviewed\'}',
  'Comparison artifact path: ${run.artifactPath || \'not available\'}',
  'Same-model comparison proof status: ${run.proofReview?.status || \'unreviewed\'}',
  'Ranking trust: ${run.proofReview?.status === \'approved\' ? \'approved proof; may be used as routing evidence\' : \'proof not approved; review before applying role or router changes\'}',
]) {
  assert.ok(
    modelLab.includes(expected),
    `Model Lab benchmark proof rows should preserve run-level proof status and artifacts: ${expected}`,
  );
}

for (const expected of [
  '<span className="pm-score-model">Best practice</span>',
  'promptStep.assembly.promptStrategy.bestPractice.guidance',
  '<span className="pm-score-model">Eval cue</span>',
  'promptStep.assembly.promptStrategy.bestPractice.evaluationCue',
  '<span className="pm-score-model">Source</span>',
  'promptStep.assembly.promptStrategy.bestPractice.sourceRef',
  'aria-label={`Prompt strategy ${promptStep.assembly.promptStrategy.id}; source-backed metadata is advisory prompt-contract evidence, not an automatic routing override`}',
]) {
  assert.ok(
    promptMicroscope.includes(expected),
    `Prompt Microscope should preserve source-backed prompt best-practice trace evidence: ${expected}`,
  );
}

console.log('Premier model-harness checks passed.');
