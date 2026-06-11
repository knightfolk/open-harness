import { computeBenchScores, createBenchRun, generateBenchSummary, saveBenchRun, type BenchRunResult, type ValidationCommandResult } from '../server/benchRuns';
import { estimateTokens } from '../server/contextManager';
import { estimateCostForRanking } from '../server/modelProfiles';
import { recordRoutingDecision, recordOutcome, getLearningSummary } from '../server/routerLearning';
import { recordUsage, getUsageSummary } from '../server/usageTracker';

type SyntheticTask = {
  id: string;
  name: string;
  taskType: 'direct' | 'investigate' | 'plan' | 'execute' | 'compare';
  role: string;
  complexity: string;
  prompt: string;
};

type SyntheticModel = {
  id: string;
  providerId: string;
  baseLatencyMs: number;
  quality: Record<SyntheticTask['taskType'], 'resolved' | 'partial' | 'failed'>;
};

const tasks: SyntheticTask[] = [
  {
    id: 'routing-ease-direct',
    name: 'Direct product explanation',
    taskType: 'direct',
    role: 'summarizer',
    complexity: 'simple',
    prompt: 'Explain how OpenHarness makes model routing easier for a new user in five concrete bullets.',
  },
  {
    id: 'routing-evidence-investigate',
    name: 'Investigate routing evidence',
    taskType: 'investigate',
    role: 'reasoner',
    complexity: 'medium',
    prompt: 'Investigate which signals should affect model ranking after a prompt-routing bench run, using only available evidence.',
  },
  {
    id: 'routing-plan-setup',
    name: 'Plan first-run routing setup',
    taskType: 'plan',
    role: 'planner',
    complexity: 'medium',
    prompt: 'Plan a first-run setup that helps a user choose sensible routing defaults without reading provider docs.',
  },
  {
    id: 'routing-execute-validation',
    name: 'Execute validation proof',
    taskType: 'execute',
    role: 'coder',
    complexity: 'deep',
    prompt: 'Implement a tiny validation loop for model ranking and prove it records token spend and a quality outcome.',
  },
  {
    id: 'routing-compare-tradeoffs',
    name: 'Compare model tradeoffs',
    taskType: 'compare',
    role: 'reviewer',
    complexity: 'medium',
    prompt: 'Compare cheap, balanced, and premium models for OpenHarness routing when quality and spend both matter.',
  },
];

const models: SyntheticModel[] = [
  {
    id: 'minimax:MiniMax-M3',
    providerId: 'minimax',
    baseLatencyMs: 8400,
    quality: { direct: 'resolved', investigate: 'resolved', plan: 'resolved', execute: 'resolved', compare: 'resolved' },
  },
  {
    id: 'mistral:mistral-small',
    providerId: 'mistral',
    baseLatencyMs: 5100,
    quality: { direct: 'resolved', investigate: 'partial', plan: 'partial', execute: 'failed', compare: 'partial' },
  },
  {
    id: 'minimax:MiniMax-M2.7',
    providerId: 'minimax',
    baseLatencyMs: 14400,
    quality: { direct: 'resolved', investigate: 'resolved', plan: 'resolved', execute: 'resolved', compare: 'resolved' },
  },
];

function validationFor(status: 'resolved' | 'partial' | 'failed', task: SyntheticTask): ValidationCommandResult[] {
  return [{
    command: `synthetic-validate ${task.id}`,
    exitCode: status === 'failed' ? 1 : 0,
    stdout: status === 'failed' ? '' : `validated ${task.name}`,
    stderr: status === 'failed' ? `- Missing proof for ${task.name}` : '',
    findings: status === 'failed' ? [`Missing proof for ${task.name}`] : [],
    durationMs: status === 'resolved' ? 180 : 260,
    passed: status !== 'failed',
  }];
}

function responseFor(model: SyntheticModel, task: SyntheticTask, status: 'resolved' | 'partial' | 'failed', round: number): string {
  const outcomeLine = status === 'resolved'
    ? 'The route is appropriate, the model selection tradeoff is explicit, and the answer includes validation evidence.'
    : status === 'partial'
      ? 'The route is plausible, but the model leaves at least one ranking signal under-supported.'
      : 'The answer misses the requested validation proof and should not be treated as a successful ranking sample.';
  const proof = status === 'failed'
    ? 'Validation proof: absent.'
    : `Validation proof: synthetic round ${round} recorded quality, latency, token count, and estimated spend for ${model.id}.`;

  return [
    `Model: ${model.id}`,
    `Task: ${task.name}`,
    `Route: ${task.taskType} / ${task.role} / ${task.complexity}`,
    outcomeLine,
    'Evidence used: prompt category, routed role, validation result, response completeness, latency, token count, and estimated cost.',
    'Human-facing judgment: the output is concise enough to inspect and concrete enough to compare against other candidates.',
    proof,
    'Ranking note: prefer a cheaper model only when it preserves the requested proof and does not drop task-specific evidence.',
    'Operational next step: keep this sample in the bench ledger so future routing decisions can compare success rate with spend.',
  ].join('\n\n');
}

function usageFor(modelId: string, prompt: string, response: string) {
  const inputTokens = estimateTokens(prompt);
  const outputTokens = estimateTokens(response);
  const cost = estimateCostForRanking(modelId, inputTokens, outputTokens).total;
  return { inputTokens, outputTokens, cost, tokenCount: inputTokens + outputTokens };
}

function routeScore(status: 'resolved' | 'partial' | 'failed'): number {
  if (status === 'resolved') return 0.92;
  if (status === 'partial') return 0.68;
  return 0.39;
}

function recordLearningSample(task: SyntheticTask, model: SyntheticModel, status: 'resolved' | 'partial' | 'failed', round: number): void {
  const candidateScores = Object.fromEntries(
    models.map((candidate) => [candidate.id, routeScore(candidate.quality[task.taskType])]),
  );
  const eventId = recordRoutingDecision({
    timestamp: new Date().toISOString(),
    sessionId: `synthetic-ranking-${round}`,
    taskHash: `${task.id}:${round}`,
    selectedModel: model.id,
    score: candidateScores[model.id] ?? routeScore(status),
    candidateScores,
    wasFallback: false,
    wasCached: false,
    classifierModel: 'synthetic-local-automation',
    surface: 'bench',
    complexity: task.complexity,
    taskType: task.taskType,
    role: task.role,
    userTurns: 1,
  });
  recordOutcome(
    eventId,
    status === 'resolved' ? 'success' : status === 'partial' ? 'ambiguous' : 'failure',
    `synthetic token/spend ranking round ${round}: ${status}`,
  );
}

const rounds = Number(process.argv.find((arg) => arg.startsWith('--rounds='))?.split('=')[1] || '3');
const startedAt = Date.now();
const createdRunIds: string[] = [];

for (let round = 1; round <= rounds; round++) {
  const run = createBenchRun({
    name: `Synthetic model ranking token/spend round ${round}`,
    suiteId: 'synthetic-model-ranking-token-spend',
    taskIds: tasks.map((task) => task.id),
    modelIds: models.map((model) => model.id),
  });

  for (const model of models) {
    for (const task of tasks) {
      const statusKind = model.quality[task.taskType];
      const response = responseFor(model, task, statusKind, round);
      const usage = usageFor(model.id, task.prompt, response);
      const validationResults = validationFor(statusKind, task);
      const wallMs = model.baseLatencyMs + round * 175 + tasks.findIndex((candidate) => candidate.id === task.id) * 90;
      const started = new Date(Date.now() - wallMs).toISOString();
      const completed = new Date().toISOString();
      const toolCalls = statusKind === 'failed'
        ? []
        : [{ name: 'read_file', status: 'ok', input: 'synthetic context pack', output: 'synthetic evidence' }];

      recordUsage({
        timestamp: completed,
        modelId: model.id,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cost: usage.cost,
        sessionId: run.id,
      });
      recordLearningSample(task, model, statusKind, round);

      const result: BenchRunResult = {
        taskId: task.id,
        taskName: task.name,
        modelId: model.id,
        providerId: model.providerId,
        status: statusKind === 'failed' ? 'validation-failed' : 'ok',
        prompt: task.prompt,
        response,
        responseLength: response.length,
        toolCalls,
        validationResults,
        validationPassed: validationResults.every((result) => result.passed),
        wallMs,
        scores: computeBenchScores({
          response,
          toolCalls,
          wallMs,
          validationResults,
          stepCount: toolCalls.length,
          tokenCount: usage.tokenCount,
          costEstimate: usage.cost,
        }),
        startedAt: started,
        completedAt: completed,
      };

      run.results.push(result);
      run.completed++;
    }
  }

  run.status = 'complete';
  run.completedAt = new Date().toISOString();
  run.summary = generateBenchSummary(run.results);
  saveBenchRun(run);
  createdRunIds.push(run.id);
}

const learning = getLearningSummary();
const usageSummary = Object.fromEntries(
  models.map((model) => [model.id, getUsageSummary(model.id, 'monthly')]),
);

console.log(JSON.stringify({
  ok: true,
  rounds,
  runIds: createdRunIds,
  elapsedMs: Date.now() - startedAt,
  latestBestModels: learning.bestByTaskType,
  usageSummary,
}, null, 2));
