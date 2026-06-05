import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { v4 as uuid } from 'uuid';

import { buildScoreBreakdown, type EvalScores, type EvalScoreBreakdown } from './evals';
import { redactSecrets } from './sectionRedaction';

// ── Types ──────────────────────────────────────────────

export interface ValidationCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  findings: string[];
  durationMs: number;
  passed: boolean;
}

export interface BenchRunResult {
  taskId: string;
  taskName: string;
  modelId: string;
  providerId: string;
  status: 'ok' | 'error' | 'timeout' | 'validation-failed';
  prompt: string;
  response: string;
  responseLength: number;
  toolCalls: Array<{ name: string; status: string; input?: string; output?: string; duration?: number }>;
  validationResults: ValidationCommandResult[];
  validationPassed: boolean;
  wallMs: number;
  scores: BenchScores;
  startedAt: string;
  completedAt: string;
  error?: string;
}

export interface BenchScores extends EvalScores {
  validationPassed: boolean;
  validationScore: number;
  styleScore: number;
  breakdown: EvalScoreBreakdown;
  resolvedStatus: 'resolved' | 'unresolved' | 'partial';
  stepCount: number;
  tokenCount: number;
  costEstimate: number;
}

export interface BenchRun {
  id: string;
  name: string;
  suiteId?: string;
  status: 'running' | 'complete' | 'error';
  taskIds: string[];
  modelIds: string[];
  results: BenchRunResult[];
  total: number;
  completed: number;
  createdAt: string;
  completedAt?: string;
  summary?: BenchSummary;
  previousDelta?: BenchRunDelta | null;
}

export interface BenchRunDelta {
  previousRunId: string;
  previousRunName: string;
  previousCreatedAt: string;
  avgScoreDelta: number;
  avgScoreDeltaPct: number;
  avgValidationDelta: number;
  avgStyleDelta: number;
  taskDeltas: Array<{
    taskId: string;
    taskName: string;
    modelId: string;
    currentScore: number;
    previousScore: number;
    delta: number;
  }>;
}

export interface BenchSummary {
  byModel: Record<string, {
    resolved: number;
    unresolved: number;
    partial: number;
    avgScore: number;
    avgValidationScore: number;
    avgLatencyMs: number;
    avgCost: number;
    avgSteps: number;
    totalRuns: number;
  }>;
  bestModel: string;
  regressionFlags: Array<{ taskId: string; modelId: string; reason: string }>;
}

// ── Storage ────────────────────────────────────────────

const BENCH_DIR = join(homedir(), '.openharness', 'bench-runs');

function redactPersistedValue<T>(value: T): T {
  if (typeof value === 'string') return redactSecrets(value).redacted as T;
  if (Array.isArray(value)) return value.map((item) => redactPersistedValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactPersistedValue(item)]),
    ) as T;
  }
  return value;
}

function ensureDir() {
  mkdirSync(BENCH_DIR, { recursive: true });
}

ensureDir();

// ── Deterministic Validation Scoring ───────────────────

export function runValidation(
  commands: string[],
  workingDir: string,
  env: Record<string, string> = {},
): Promise<ValidationCommandResult[]> {
  

  return Promise.all(commands.map(cmd => new Promise<ValidationCommandResult>((resolve) => {
    const start = Date.now();
    const child = spawn('/bin/zsh', ['-lc', cmd], { cwd: workingDir, env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    const limit = 512 * 1024;

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < limit) stdout += chunk.toString().slice(0, limit - stdout.length);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < limit) stderr += chunk.toString().slice(0, limit - stderr.length);
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        command: redactSecrets(cmd).redacted,
        exitCode: 124,
        stdout: redactSecrets(stdout.slice(0, 2000)).redacted,
        stderr: redactSecrets(stderr.slice(0, 2000)).redacted,
        findings: extractValidationFindings(redactSecrets(`${stdout}\n${stderr}`).redacted),
        durationMs: Date.now() - start,
        passed: false,
      });
    }, 60_000);

    child.on('close', (code: number | null) => {
      clearTimeout(timer);
      resolve({
        command: redactSecrets(cmd).redacted,
        exitCode: code ?? 1,
        stdout: redactSecrets(stdout.slice(0, 2000)).redacted,
        stderr: redactSecrets(stderr.slice(0, 2000)).redacted,
        findings: extractValidationFindings(redactSecrets(`${stdout}\n${stderr}`).redacted),
        durationMs: Date.now() - start,
        passed: (code ?? 1) === 0,
      });
    });

    child.on('error', () => {
      clearTimeout(timer);
      resolve({
        command: cmd,
        exitCode: 1,
        stdout: '',
        stderr: 'Failed to spawn command',
        findings: ['Failed to spawn command'],
        durationMs: Date.now() - start,
        passed: false,
      });
    });
  })));
}

function extractValidationFindings(output: string): string[] {
  const findings: string[] = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (/^- /.test(trimmed)) {
      findings.push(trimmed.slice(2).trim());
    }
  }
  return findings.slice(0, 20);
}

export function computeBenchScores(params: {
  response: string;
  toolCalls: Array<{ name: string; status: string }>;
  wallMs: number;
  validationResults: ValidationCommandResult[];
  stepCount: number;
  tokenCount: number;
  costEstimate: number;
}): BenchScores {
  const { response, toolCalls, wallMs, validationResults, stepCount, tokenCount, costEstimate } = params;

  const usedTools = toolCalls.length > 0;
  const answeredUser = response.length > 100;
  const referencedRealFiles = toolCalls.some(tc => tc.name === 'read_file' || tc.name === 'list_directory');
  const avoidedHallucinatedPaths = !response.toLowerCase().includes('file not found');
  const producedSummary = response.length > 300;

  const validationPassed = validationResults.length === 0 || validationResults.every(r => r.passed);
  const validationScore = validationResults.length > 0
    ? (validationResults.filter(r => r.passed).length / validationResults.length) * 2
    : 1; // No validation commands = neutral runtime signal
  const toolRuntimeScore = usedTools ? 1.5 : 0;
  const styleScore =
    (producedSummary ? 0.8 : 0) +
    (wallMs < 30_000 ? 0.5 : 0) +
    (toolCalls.length >= 1 && toolCalls.length <= 15 ? 0.2 : 0);
  const breakdown = buildScoreBreakdown([
    { id: 'answered-user', label: 'Answered user', category: 'structural', passed: answeredUser, score: answeredUser ? 2 : 0, maxScore: 2 },
    { id: 'real-files', label: 'Referenced real files', category: 'structural', passed: referencedRealFiles, score: referencedRealFiles ? 1.5 : 0, maxScore: 1.5 },
    { id: 'no-missing-paths', label: 'Avoided missing paths', category: 'structural', passed: avoidedHallucinatedPaths, score: avoidedHallucinatedPaths ? 1 : 0, maxScore: 1 },
    { id: 'validation-commands', label: 'Validation commands', category: 'runtime', passed: validationPassed, score: validationScore, maxScore: 2 },
    { id: 'tool-use', label: 'Used tools', category: 'runtime', passed: usedTools, score: toolRuntimeScore, maxScore: 1.5 },
    { id: 'summary', label: 'Produced summary', category: 'style', passed: producedSummary, score: producedSummary ? 0.8 : 0, maxScore: 0.8 },
    { id: 'latency', label: 'Responsive latency', category: 'style', passed: wallMs < 30_000, score: wallMs < 30_000 ? 0.5 : 0, maxScore: 0.5 },
    { id: 'tool-efficiency', label: 'Tool efficiency', category: 'style', passed: toolCalls.length >= 1 && toolCalls.length <= 15, score: toolCalls.length >= 1 && toolCalls.length <= 15 ? 0.2 : 0, maxScore: 0.2 },
  ]);

  const overallScore = Math.min(10, breakdown.total);

  // Resolved status
  let resolvedStatus: BenchScores['resolvedStatus'] = 'unresolved';
  if (validationPassed && answeredUser && usedTools) resolvedStatus = 'resolved';
  else if (answeredUser) resolvedStatus = 'partial';

  return {
    usedTools,
    answeredUser,
    referencedRealFiles,
    avoidedHallucinatedPaths,
    producedSummary,
    latencyMs: wallMs,
    toolCount: toolCalls.length,
    overallScore,
    validationPassed,
    validationScore: Math.round(validationScore * 10) / 10,
    styleScore: Math.round(styleScore * 10) / 10,
    breakdown,
    resolvedStatus,
    stepCount,
    tokenCount,
    costEstimate,
  };
}

// ── Bench Run CRUD ─────────────────────────────────────

export function createBenchRun(params: {
  name: string;
  suiteId?: string;
  taskIds: string[];
  modelIds: string[];
}): BenchRun {
  const run: BenchRun = {
    id: uuid(),
    name: params.name,
    suiteId: params.suiteId,
    status: 'running',
    taskIds: params.taskIds,
    modelIds: params.modelIds,
    results: [],
    total: params.taskIds.length * params.modelIds.length,
    completed: 0,
    createdAt: new Date().toISOString(),
  };
  saveBenchRun(run);
  return run;
}

export function saveBenchRun(run: BenchRun): void {
  const path = join(BENCH_DIR, `${run.id}.json`);
  writeFileSync(path, JSON.stringify(redactPersistedValue(run), null, 2), 'utf-8');
}

export function getBenchRun(id: string): BenchRun | null {
  const path = join(BENCH_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function listFullBenchRuns(): BenchRun[] {
  if (!existsSync(BENCH_DIR)) return [];
  return readdirSync(BENCH_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(BENCH_DIR, f), 'utf-8')) as BenchRun;
      } catch {
        return null;
      }
    })
    .filter((run): run is BenchRun => run !== null);
}

function taskSignature(run: BenchRun): string {
  return [...run.taskIds].sort().join('|');
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function roundDelta(n: number): number {
  return Math.round(n * 10) / 10;
}

export function getPreviousRunDelta(run: BenchRun): BenchRunDelta | null {
  const prior = listFullBenchRuns()
    .filter(candidate => candidate.id !== run.id && candidate.status === 'complete')
    .filter(candidate => new Date(candidate.createdAt).getTime() < new Date(run.createdAt).getTime())
    .filter(candidate => {
      if (run.suiteId || candidate.suiteId) return run.suiteId === candidate.suiteId;
      return taskSignature(run) === taskSignature(candidate);
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  if (!prior) return null;

  const currentAvg = avg(run.results.map(r => r.scores.overallScore));
  const previousAvg = avg(prior.results.map(r => r.scores.overallScore));
  const currentValidation = avg(run.results.map(r => r.scores.validationScore));
  const previousValidation = avg(prior.results.map(r => r.scores.validationScore));
  const currentStyle = avg(run.results.map(r => r.scores.breakdown?.style ?? 0));
  const previousStyle = avg(prior.results.map(r => r.scores.breakdown?.style ?? 0));
  const previousByTask = new Map<string, BenchRunResult>();
  for (const r of prior.results) previousByTask.set(`${r.taskId}:${r.modelId}`, r);

  const taskDeltas = run.results
    .map(r => {
      const prev = previousByTask.get(`${r.taskId}:${r.modelId}`);
      if (!prev) return null;
      return {
        taskId: r.taskId,
        taskName: r.taskName,
        modelId: r.modelId,
        currentScore: r.scores.overallScore,
        previousScore: prev.scores.overallScore,
        delta: roundDelta(r.scores.overallScore - prev.scores.overallScore),
      };
    })
    .filter((d): d is BenchRunDelta['taskDeltas'][number] => d !== null);

  return {
    previousRunId: prior.id,
    previousRunName: prior.name,
    previousCreatedAt: prior.createdAt,
    avgScoreDelta: roundDelta(currentAvg - previousAvg),
    avgScoreDeltaPct: roundDelta((currentAvg - previousAvg) * 10),
    avgValidationDelta: roundDelta(currentValidation - previousValidation),
    avgStyleDelta: roundDelta(currentStyle - previousStyle),
    taskDeltas,
  };
}

export function listBenchRuns(): Array<Pick<BenchRun, 'id' | 'name' | 'status' | 'total' | 'completed' | 'createdAt' | 'completedAt' | 'suiteId'>> {
  if (!existsSync(BENCH_DIR)) return [];
  const files = readdirSync(BENCH_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const run: BenchRun = JSON.parse(readFileSync(join(BENCH_DIR, f), 'utf-8'));
      return {
        id: run.id,
        name: run.name,
        status: run.status,
        total: run.total,
        completed: run.completed,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        suiteId: run.suiteId,
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as any[];
}

// ── Summary Generation ─────────────────────────────────

export function generateBenchSummary(results: BenchRunResult[]): BenchSummary {
  const byModel: Record<string, {
    resolved: number; unresolved: number; partial: number;
    scores: number[]; validationScores: number[]; latencies: number[];
    costs: number[]; steps: number[];
  }> = {};

  for (const r of results) {
    if (!byModel[r.modelId]) {
      byModel[r.modelId] = { resolved: 0, unresolved: 0, partial: 0, scores: [], validationScores: [], latencies: [], costs: [], steps: [] };
    }
    const m = byModel[r.modelId];
    if (r.scores.resolvedStatus === 'resolved') m.resolved++;
    else if (r.scores.resolvedStatus === 'partial') m.partial++;
    else m.unresolved++;
    m.scores.push(r.scores.overallScore);
    m.validationScores.push(r.scores.validationScore);
    m.latencies.push(r.wallMs);
    m.costs.push(r.scores.costEstimate);
    m.steps.push(r.scores.stepCount);
  }

  const summary: BenchSummary = {
    byModel: {},
    bestModel: '',
    regressionFlags: [],
  };

  let bestModel = '';
  let bestResolvedRate = -1;

  for (const [modelId, data] of Object.entries(byModel)) {
    const totalRuns = data.scores.length;
    const resolvedRate = totalRuns > 0 ? data.resolved / totalRuns : 0;
    const avgScore = data.scores.reduce((a, b) => a + b, 0) / (totalRuns || 1);
    const avgValidationScore = data.validationScores.reduce((a, b) => a + b, 0) / (totalRuns || 1);
    const avgLatency = data.latencies.reduce((a, b) => a + b, 0) / (totalRuns || 1);
    const avgCost = data.costs.reduce((a, b) => a + b, 0) / (totalRuns || 1);
    const avgSteps = data.steps.reduce((a, b) => a + b, 0) / (totalRuns || 1);

    summary.byModel[modelId] = {
      resolved: data.resolved,
      unresolved: data.unresolved,
      partial: data.partial,
      avgScore: Math.round(avgScore * 10) / 10,
      avgValidationScore: Math.round(avgValidationScore * 10) / 10,
      avgLatencyMs: Math.round(avgLatency),
      avgCost: Math.round(avgCost * 1000) / 1000,
      avgSteps: Math.round(avgSteps * 10) / 10,
      totalRuns,
    };

    if (resolvedRate > bestResolvedRate) {
      bestResolvedRate = resolvedRate;
      bestModel = modelId;
    }
  }

  summary.bestModel = bestModel;

  // Flag regressions: tasks that failed validation or had low scores
  for (const r of results) {
    if (!r.validationPassed) {
      const findings = r.validationResults.flatMap(v => v.findings || []).slice(0, 3);
      summary.regressionFlags.push({
        taskId: r.taskId,
        modelId: r.modelId,
        reason: findings.length > 0
          ? `Validation failed: ${findings.join('; ')}`
          : `Validation failed: ${r.validationResults.filter(v => !v.passed).map(v => v.command).join(', ')}`,
      });
    }
    if (r.scores.overallScore < 3) {
      summary.regressionFlags.push({
        taskId: r.taskId,
        modelId: r.modelId,
        reason: `Low score: ${r.scores.overallScore}/10`,
      });
    }
  }

  return summary;
}

// ── Export ──────────────────────────────────────────────

export function exportBenchRunJSON(runId: string): string | null {
  const run = getBenchRun(runId);
  if (!run) return null;
  return JSON.stringify(run, null, 2);
}

export function exportBenchRunCSV(runId: string): string | null {
  const run = getBenchRun(runId);
  if (!run) return null;

  const header = [
    'task_id', 'task_name', 'model_id', 'status', 'resolved',
    'overall_score', 'validation_score', 'validation_passed',
    'wall_ms', 'tool_count', 'step_count', 'token_count', 'cost_estimate',
    'response_length',
  ].join(',');

  const rows = run.results.map(r => [
    r.taskId, `"${r.taskName}"`, r.modelId, r.status, r.scores.resolvedStatus,
    r.scores.overallScore, r.scores.validationScore, r.validationPassed,
    r.wallMs, r.toolCalls.length, r.scores.stepCount, r.scores.tokenCount,
    r.scores.costEstimate, r.responseLength,
  ].join(','));

  return [header, ...rows].join('\n');
}
