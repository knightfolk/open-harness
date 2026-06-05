import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import {
  runValidation,
  saveBenchRun,
  type BenchRun,
} from '../server/benchRuns';
import {
  saveReport,
  type EvalReport,
} from '../server/evals';

const secret = 'sk-123456789012345678901234';
const benchId = `redaction-bench-${Date.now()}`;
const reportId = `redaction-report-${Date.now()}`;
const benchPath = join(homedir(), '.openharness', 'bench-runs', `${benchId}.json`);
const reportPath = join(homedir(), '.openharness', 'evals', 'reports', `${reportId}.json`);

try {
  const benchRun: BenchRun = {
    id: benchId,
    name: `Bench ${secret}`,
    status: 'complete',
    taskIds: ['secret-task'],
    modelIds: ['secret-model'],
    results: [{
      taskId: 'secret-task',
      taskName: 'Secret Task',
      modelId: 'secret-model',
      providerId: 'secret-provider',
      status: 'ok',
      prompt: `Prompt ${secret}`,
      response: `Response ${secret}`,
      responseLength: 0,
      toolCalls: [{ name: 'exec_command', status: 'complete', input: `printf ${secret}`, output: secret }],
      validationResults: [{
        command: `printf ${secret}`,
        exitCode: 0,
        stdout: secret,
        stderr: secret,
        findings: [secret],
        durationMs: 1,
        passed: true,
      }],
      validationPassed: true,
      wallMs: 1,
      scores: {
        usedTools: true,
        answeredUser: true,
        referencedRealFiles: false,
        avoidedHallucinatedPaths: true,
        producedSummary: false,
        latencyMs: 1,
        toolCount: 1,
        overallScore: 1,
        validationPassed: true,
        validationScore: 1,
        styleScore: 0,
        resolvedStatus: 'partial',
        stepCount: 1,
        tokenCount: 0,
        costEstimate: 0,
        breakdown: {
          structural: 0,
          runtime: 0,
          style: 0,
          total: 0,
          weakestSignal: { id: 'x', label: 'x', category: 'style', passed: false, score: 0, maxScore: 1 },
          signals: [],
        },
      },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }],
    total: 1,
    completed: 1,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  saveBenchRun(benchRun);
  const savedBench = readFileSync(benchPath, 'utf-8');
  assert.equal(savedBench.includes(secret), false, 'bench run JSON should not persist raw secrets');
  assert.ok(savedBench.includes('<redacted:OPENAI_KEY>'), 'bench run JSON should contain a redaction marker');

  const report: EvalReport = {
    id: reportId,
    configId: 'redaction-config',
    name: `Eval ${secret}`,
    status: 'complete',
    total: 1,
    completed: 1,
    results: [{
      modelId: 'secret-model',
      promptId: 'secret-prompt',
      promptName: `Prompt ${secret}`,
      status: 'ok',
      response: `Response ${secret}`,
      responseLength: 0,
      toolCallCount: 1,
      toolCalls: [{ name: 'read_file', status: secret }],
      wallMs: 1,
      scores: {
        usedTools: true,
        answeredUser: true,
        referencedRealFiles: true,
        avoidedHallucinatedPaths: true,
        producedSummary: false,
        latencyMs: 1,
        toolCount: 1,
        validationPassed: true,
        validationScore: 1,
        overallScore: 1,
        breakdown: {
          structural: 0,
          runtime: 0,
          style: 0,
          total: 0,
          weakestSignal: { id: 'x', label: 'x', category: 'style', passed: false, score: 0, maxScore: 1 },
          signals: [],
        },
      },
    }],
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  saveReport(report);
  const savedReport = readFileSync(reportPath, 'utf-8');
  assert.equal(savedReport.includes(secret), false, 'eval report JSON should not persist raw secrets');
  assert.ok(savedReport.includes('<redacted:OPENAI_KEY>'), 'eval report JSON should contain a redaction marker');

  const validationDir = mkdtempSync(join(tmpdir(), 'openharness-redaction-'));
  try {
    const validation = await runValidation([`printf ${JSON.stringify(`- ${secret}`)}`], validationDir);
    assert.equal(JSON.stringify(validation).includes(secret), false, 'validation results should redact raw secrets');
    assert.ok(JSON.stringify(validation).includes('<redacted:OPENAI_KEY>'), 'validation results should include redaction marker');
  } finally {
    rmSync(validationDir, { recursive: true, force: true });
  }
} finally {
  if (existsSync(benchPath)) unlinkSync(benchPath);
  if (existsSync(reportPath)) unlinkSync(reportPath);
}

console.log('Artifact redaction tests passed.');
