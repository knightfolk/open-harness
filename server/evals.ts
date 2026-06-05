
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { v4 as uuid } from 'uuid';
import { redactSecrets } from './sectionRedaction';

// ── Types ──────────────────────────────────────────────

export interface PromptCase {
  id: string;
  name: string;
  prompt: string;
  category: string;
  expectedBehavior?: string;
}

export interface EvalRunConfig {
  id: string;
  name: string;
  promptIds: string[];
  modelIds: string[];
  workingDir?: string;
  createdAt: string;
}

export interface EvalResult {
  modelId: string;
  promptId: string;
  promptName: string;
  status: 'ok' | 'error';
  response: string;
  responseLength: number;
  toolCallCount: number;
  toolCalls: Array<{ name: string; status: string }>;
  wallMs: number;
  scores: EvalScores;
}

export interface EvalScores {
  usedTools: boolean;
  answeredUser: boolean;
  referencedRealFiles: boolean;
  avoidedHallucinatedPaths: boolean;
  producedSummary: boolean;
  latencyMs: number;
  toolCount: number;
  validationPassed: boolean;
  validationScore: number; // 0-5, weighted above heuristics
  overallScore: number; // 0-10
  breakdown: EvalScoreBreakdown;
}

export type EvalSignalCategory = 'structural' | 'runtime' | 'style';

export interface EvalSignalScore {
  id: string;
  label: string;
  category: EvalSignalCategory;
  passed: boolean;
  score: number;
  maxScore: number;
}

export interface EvalScoreBreakdown {
  structural: number;
  runtime: number;
  style: number;
  total: number;
  weakestSignal: EvalSignalScore;
  signals: EvalSignalScore[];
}

export interface EvalReport {
  id: string;
  configId: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  total: number;
  completed: number;
  results: EvalResult[];
  createdAt: string;
  completedAt?: string;
  summary?: EvalSummary;
}

export interface EvalSummary {
  byModel: Record<string, { avgScore: number; avgLatencyMs: number; avgToolCount: number; totalRuns: number }>;
  bestModel: string;
  recommendations: Array<{ role: string; modelId: string; reason: string }>;
}

export interface EvalRecommendation {
  role: string;
  modelId: string;
  reason: string;
  reportId: string;
  reportName: string;
  generatedAt: string;
}

// ── Storage ────────────────────────────────────────────

const PRIMARY_EVALS_DIR = join(homedir(), '.openharness', 'evals');
const PRIMARY_SUITES_DIR = join(PRIMARY_EVALS_DIR, 'suites');
const PRIMARY_REPORTS_DIR = join(PRIMARY_EVALS_DIR, 'reports');

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getEvalDataHomeCandidates(): string[] {
  const homes = new Set<string>();
  homes.add(homedir());

  if (process.platform === 'darwin') {
    homes.add(join(homedir(), 'Library', 'Application Support', 'Parall', 'Codex Stock'));
  }

  if (process.env.OPENHARNESS_HOME_DIR) {
    homes.add(process.env.OPENHARNESS_HOME_DIR.trim());
  }

  return dedupe(Array.from(homes));
}

function getEvalDirCandidates(...parts: string[]): string[] {
  return dedupe(
    getEvalDataHomeCandidates().map((home) =>
      join(home, '.openharness', ...parts),
    ),
  );
}

const REPORTS_DIRS = getEvalDirCandidates('evals', 'reports');

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

function ensureDirs() {
  mkdirSync(PRIMARY_SUITES_DIR, { recursive: true });
  mkdirSync(PRIMARY_REPORTS_DIR, { recursive: true });
}

ensureDirs();

// ── Built-in Prompt Suites ─────────────────────────────

const BUILTIN_PROMPTS: PromptCase[] = [
  {
    id: 'review-project',
    name: 'Review this project',
    prompt: 'Review this project. What is it? What does it do? What are its strengths and weaknesses?',
    category: 'analysis',
    expectedBehavior: 'Should read key files and provide a structured review',
  },
  {
    id: 'what-changed',
    name: 'What changed?',
    prompt: 'What changed in the working tree? Summarize the changes.',
    category: 'git',
    expectedBehavior: 'Should inspect git status/diff and summarize',
  },
  {
    id: 'fix-failing-build',
    name: 'Fix failing build',
    prompt: 'Run the build command and fix any errors you find.',
    category: 'coding',
    expectedBehavior: 'Should run build, identify errors, and suggest fixes',
  },
  {
    id: 'summarize-readme',
    name: 'Summarize README',
    prompt: 'Read the README and summarize it in 3-5 bullet points.',
    category: 'analysis',
    expectedBehavior: 'Should read README.md and produce a summary',
  },
  {
    id: 'inspect-package-json',
    name: 'Inspect package.json',
    prompt: 'Look at package.json and tell me about the project dependencies and scripts.',
    category: 'analysis',
    expectedBehavior: 'Should read package.json and describe deps/scripts',
  },
  {
    id: 'debug-empty-response',
    name: 'Debug empty response',
    prompt: 'When I send a message, sometimes I get an empty response. Help me debug this.',
    category: 'debugging',
    expectedBehavior: 'Should investigate code and suggest debugging steps',
  },
  {
    id: 'compare-route-decisions',
    name: 'Compare route decisions',
    prompt: 'How does this project route different types of user requests? Explain the routing logic.',
    category: 'analysis',
    expectedBehavior: 'Should examine router code and explain routing decisions',
  },
];

// ── Prompt Suite CRUD ──────────────────────────────────

export function getAllPrompts(): PromptCase[] {
  return BUILTIN_PROMPTS;
}

export function getPromptById(id: string): PromptCase | undefined {
  return BUILTIN_PROMPTS.find(p => p.id === id);
}

export function getPromptsByCategory(category: string): PromptCase[] {
  return BUILTIN_PROMPTS.filter(p => p.category === category);
}

// ── Scoring ────────────────────────────────────────────

function roundScore(n: number): number {
  return Math.round(n * 10) / 10;
}

export function buildScoreBreakdown(signals: EvalSignalScore[]): EvalScoreBreakdown {
  const structural = signals.filter(s => s.category === 'structural').reduce((sum, s) => sum + s.score, 0);
  const runtime = signals.filter(s => s.category === 'runtime').reduce((sum, s) => sum + s.score, 0);
  const style = signals.filter(s => s.category === 'style').reduce((sum, s) => sum + s.score, 0);
  const weakestSignal = [...signals].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))[0] || {
    id: 'none',
    label: 'No signals',
    category: 'style',
    passed: false,
    score: 0,
    maxScore: 1,
  };
  return {
    structural: roundScore(structural),
    runtime: roundScore(runtime),
    style: roundScore(style),
    total: roundScore(structural + runtime + style),
    weakestSignal,
    signals: signals.map(s => ({ ...s, score: roundScore(s.score), maxScore: roundScore(s.maxScore) })),
  };
}

function scoreResult(result: { response: string; toolCalls: Array<{ name: string; status: string }>; wallMs: number; workingDir?: string }): EvalScores {
  const response = result.response.toLowerCase();
  const toolCalls = result.toolCalls;
  const toolNames = toolCalls.map(tc => tc.name);

  const usedTools = toolCalls.length > 0;
  const answeredUser = result.response.length > 100;
  const referencedRealFiles = toolNames.some(n => n === 'read_file' || n === 'list_directory');
  const avoidedHallucinatedPaths = !response.includes('file not found') && !response.includes('no such file');
  const producedSummary = response.includes('summary') || response.includes('conclusion') || response.includes('in summary') || response.includes('key findings') || response.includes('here are') || response.length > 300;

  // Calculate overall score (0-10)
  let score = 0;
  if (usedTools) score += 2;
  if (answeredUser) score += 2;
  if (referencedRealFiles) score += 2;
  if (avoidedHallucinatedPaths) score += 1;
  if (producedSummary) score += 1;
  // Latency bonus
  if (result.wallMs < 10000) score += 1;
  else if (result.wallMs < 30000) score += 0.5;
  // Tool efficiency (not too many, not too few)
  if (toolCalls.length >= 1 && toolCalls.length <= 10) score += 0.5;

  // Validation scoring (if validation results are available)
  const validationPassed = (result as any).validationPassed !== undefined
    ? (result as any).validationPassed
    : true; // Default to true if no validation was run
  const validationScore = validationPassed ? 2 : 0;
  const breakdown = buildScoreBreakdown([
    { id: 'answered-user', label: 'Answered user', category: 'structural', passed: answeredUser, score: answeredUser ? 2 : 0, maxScore: 2 },
    { id: 'real-files', label: 'Referenced real files', category: 'structural', passed: referencedRealFiles, score: referencedRealFiles ? 1.5 : 0, maxScore: 1.5 },
    { id: 'no-missing-paths', label: 'Avoided missing paths', category: 'structural', passed: avoidedHallucinatedPaths, score: avoidedHallucinatedPaths ? 1 : 0, maxScore: 1 },
    { id: 'validation', label: 'Validation passed', category: 'runtime', passed: validationPassed, score: validationScore, maxScore: 2 },
    { id: 'tool-use', label: 'Used tools', category: 'runtime', passed: usedTools, score: usedTools ? 1.5 : 0, maxScore: 1.5 },
    { id: 'summary', label: 'Produced summary', category: 'style', passed: producedSummary, score: producedSummary ? 1 : 0, maxScore: 1 },
    { id: 'latency', label: 'Responsive latency', category: 'style', passed: result.wallMs < 30000, score: result.wallMs < 10000 ? 0.7 : result.wallMs < 30000 ? 0.4 : 0, maxScore: 0.7 },
    { id: 'tool-efficiency', label: 'Tool efficiency', category: 'style', passed: toolCalls.length >= 1 && toolCalls.length <= 10, score: toolCalls.length >= 1 && toolCalls.length <= 10 ? 0.3 : 0, maxScore: 0.3 },
  ]);

  return {
    usedTools,
    answeredUser,
    referencedRealFiles,
    avoidedHallucinatedPaths,
    producedSummary,
    latencyMs: result.wallMs,
    toolCount: toolCalls.length,
    validationPassed,
    validationScore: roundScore(validationScore),
    overallScore: Math.min(10, breakdown.total || Math.round((score + validationScore) * 10) / 10),
    breakdown,
  };
}

// ── Report Persistence ─────────────────────────────────

export function saveReport(report: EvalReport): void {
  const path = join(PRIMARY_REPORTS_DIR, `${report.id}.json`);
  writeFileSync(path, JSON.stringify(redactPersistedValue(report), null, 2), 'utf-8');
}

export function loadReport(id: string): EvalReport | null {
  for (const dir of REPORTS_DIRS) {
    const path = join(dir, `${id}.json`);
    if (!existsSync(path)) continue;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }
  return null;
}

export function listReports(): Array<{ id: string; name: string; status: string; createdAt: string; completedAt?: string; total: number }> {
  const reportMap = new Map<string, { id: string; name: string; status: string; createdAt: string; completedAt?: string; total: number }>();

  for (const dir of REPORTS_DIRS) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      try {
        const report: EvalReport = JSON.parse(readFileSync(join(dir, f), 'utf-8'));
        reportMap.set(report.id, {
          id: report.id,
          name: report.name,
          status: report.status,
          createdAt: report.createdAt,
          completedAt: report.completedAt,
          total: report.total,
        });
      } catch {
        // ignore malformed report files
      }
    }
  }

  const reports = Array.from(reportMap.values());
  reports.sort((a, b) => {
    const aDate = new Date(a.completedAt || a.createdAt).getTime();
    const bDate = new Date(b.completedAt || b.createdAt).getTime();
    return bDate - aDate;
  });
  return reports;
}

function readReportsFromDir(path: string): EvalReport[] {
  if (!existsSync(path)) return [];
  const files = readdirSync(path).filter((f) => f.endsWith('.json'));
  const parsed: EvalReport[] = [];
  for (const file of files) {
    try {
      parsed.push(JSON.parse(readFileSync(join(path, file), 'utf-8')) as EvalReport);
    } catch {
      // ignore malformed report files
    }
  }
  return parsed;
}

function reportTimestamp(report: EvalReport): number {
  return new Date(report.completedAt || report.createdAt).getTime();
}

function getPersistedReports(): EvalReport[] {
  if (!REPORTS_DIRS.some((dir) => existsSync(dir))) return [];

  const byId = new Map<string, EvalReport>();
  for (const dir of REPORTS_DIRS) {
    for (const report of readReportsFromDir(dir)) {
      const current = byId.get(report.id);
      if (!current || reportTimestamp(report) > reportTimestamp(current)) {
        byId.set(report.id, report);
      }
    }
  }
  return Array.from(byId.values());
}

function getAllReports(): EvalReport[] {
  const byId = new Map<string, EvalReport>();
  for (const report of activeRuns.values()) {
    byId.set(report.id, report);
  }
  for (const report of getPersistedReports()) {
    if (!byId.has(report.id)) byId.set(report.id, report);
  }
  return Array.from(byId.values());
}

function getLatestCompletedEvalReport(): EvalReport | null {
  const completed = getAllReports()
    .filter((r) => r.status === 'complete' && r.summary);
  if (completed.length === 0) return null;

  completed.sort((a, b) => {
    const aDate = new Date(a.completedAt || a.createdAt).getTime();
    const bDate = new Date(b.completedAt || b.createdAt).getTime();
    return bDate - aDate;
  });
  return completed[0];
}

export function getLatestEvalRecommendations(): EvalRecommendation[] {
  const latest = getLatestCompletedEvalReport();
  if (!latest?.summary?.recommendations || latest.summary.recommendations.length === 0) return [];

  return latest.summary.recommendations.map((rec) => ({
    role: rec.role,
    modelId: rec.modelId,
    reason: rec.reason,
    reportId: latest.id,
    reportName: latest.name,
    generatedAt: latest.completedAt || latest.createdAt,
  }));
}

// ── Summary Generation ─────────────────────────────────

export function generateSummary(results: EvalResult[]): EvalSummary {
  const byModel: Record<string, { scores: number[]; latencies: number[]; toolCounts: number[] }> = {};

  for (const r of results) {
    if (r.status !== 'ok') continue;
    if (!byModel[r.modelId]) byModel[r.modelId] = { scores: [], latencies: [], toolCounts: [] };
    byModel[r.modelId].scores.push(r.scores.overallScore);
    byModel[r.modelId].latencies.push(r.scores.latencyMs);
    byModel[r.modelId].toolCounts.push(r.scores.toolCount);
  }

  const byModelSummary: Record<string, { avgScore: number; avgLatencyMs: number; avgToolCount: number; totalRuns: number }> = {};
  let bestModel = '';
  let bestScore = -1;

  for (const [modelId, data] of Object.entries(byModel)) {
    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const avgLatencyMs = data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length;
    const avgToolCount = data.toolCounts.reduce((a, b) => a + b, 0) / data.toolCounts.length;
    byModelSummary[modelId] = { avgScore: Math.round(avgScore * 10) / 10, avgLatencyMs: Math.round(avgLatencyMs), avgToolCount: Math.round(avgToolCount * 10) / 10, totalRuns: data.scores.length };
    if (avgScore > bestScore) {
      bestScore = avgScore;
      bestModel = modelId;
    }
  }

  // Generate recommendations
  const recommendations: Array<{ role: string; modelId: string; reason: string }> = [];
  const roles = ['coder', 'planner', 'reviewer', 'summarizer', 'worker', 'reasoner'];

  for (const role of roles) {
    // Pick best model for this role based on available data
    let bestForRole = bestModel;
    let reason = 'Highest overall score';
    if (role === 'summarizer') {
      const summarizer = Object.entries(byModelSummary).sort((a, b) => b[1].avgScore - a[1].avgScore)[0];
      if (summarizer) { bestForRole = summarizer[0]; reason = 'Best summary quality'; }
    } else if (role === 'coder') {
      const coder = Object.entries(byModelSummary).sort((a, b) => b[1].avgToolCount - a[1].avgToolCount)[0];
      if (coder) { bestForRole = coder[0]; reason = 'Most effective tool usage'; }
    }
    recommendations.push({ role, modelId: bestForRole, reason });
  }

  return {
    byModel: byModelSummary,
    bestModel,
    recommendations,
  };
}

// ── In-memory active runs ──────────────────────────────

const activeRuns = new Map<string, EvalReport>();

export function createReport(name: string, promptIds: string[], modelIds: string[]): EvalReport {
  const total = promptIds.length * modelIds.length;
  const report: EvalReport = {
    id: uuid(),
    configId: uuid(),
    name,
    status: 'running',
    total,
    completed: 0,
    results: [],
    createdAt: new Date().toISOString(),
  };
  activeRuns.set(report.id, report);
  saveReport(report);
  return report;
}

export function getReport(id: string): EvalReport | null {
  const active = activeRuns.get(id);
  if (active) return active;
  return loadReport(id);
}

export function getActiveRuns(): EvalReport[] {
  return Array.from(activeRuns.values());
}

export { scoreResult };
