#!/usr/bin/env node
/**
 * OpenHarness Test Harness — runs prompts through models, captures results,
 * writes JSON + markdown reports with multi-model comparison.
 *
 * Usage:
 *   node scripts/test-prompts.mjs                              # all models, all prompts
 *   node scripts/test-prompts.mjs --model MiniMax-M3           # specific model
 *   node scripts/test-prompts.mjs --models "MiniMax-M3,glm-5.2"  # multi-model comparison
 *   node scripts/test-prompts.mjs --quick                      # first 3 prompts only
 *   node scripts/test-prompts.mjs --output-dir ./my-results    # custom output dir
 */

import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { isGlm5ModelId } from '../shared/glmModelPreference.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const API = 'http://127.0.0.1:3001';
const UNIT_TEST_IMPORT = import.meta.url.includes('?unit-test');
const DEFAULT_PROMPT_HARNESS_TIMEOUT_MS = 120_000;
const GLM5_PROMPT_HARNESS_TIMEOUT_MS = 300_000;

const args = process.argv.slice(2);
const quickMode = args.includes('--quick');
const modelFlag = args.indexOf('--model');
const modelsFlag = args.indexOf('--models');
const outputDirFlag = args.indexOf('--output-dir');
const targetDirFlag = args.indexOf('--target-dir');

// Parse model(s)
let forcedModels = null;
if (modelsFlag >= 0) {
  forcedModels = args[modelsFlag + 1].split(',').map(m => m.trim());
} else if (modelFlag >= 0) {
  forcedModels = [args[modelFlag + 1]];
}

// Parse output dir
const outputDir = outputDirFlag >= 0 ? args[outputDirFlag + 1] : null;

const TARGET_DIR = targetDirFlag >= 0 ? resolve(args[targetDirFlag + 1]) : ROOT;

// ── Test prompts ───────────────────────────────────────

const PROMPTS = [
  {
    id: 'project-review',
    name: 'Full Project Review',
    prompt: `You have filesystem tools available. Use them.

Review the project at ${TARGET_DIR}. Start by listing the directory structure, then read key files (README, package.json, main source files). Give a detailed summary covering:
1. What the project does
2. Architecture and tech stack
3. Code quality observations
4. Potential issues or improvements`,
  },
  {
    id: 'architecture-scan',
    name: 'Architecture Scan',
    prompt: `You have filesystem tools available. Use them.

Analyze the architecture of the project at ${TARGET_DIR}. List all directories and key files, then identify:
1. Entry points and main modules
2. Data flow patterns
3. How components connect to each other
4. External dependencies and their roles`,
  },
  {
    id: 'readme-summary',
    name: 'README + Config Summary',
    prompt: `You have filesystem tools available. Use them.

Read the README.md and any config files (package.json, tsconfig, etc.) from ${TARGET_DIR}. Summarize:
1. The project's purpose and goals
2. How to install and run it
3. Key dependencies and scripts
4. Any documented architecture decisions`,
  },
  {
    id: 'code-quality',
    name: 'Code Quality Spot-Check',
    prompt: `You have filesystem tools available. Use them.

Examine 3-5 source files from ${TARGET_DIR}. For each file, assess:
1. Readability and naming conventions
2. Error handling patterns
3. Type safety (if TypeScript)
4. Test coverage indicators
5. One concrete improvement suggestion`,
  },
  {
    id: 'deps-audit',
    name: 'Dependency Audit',
    prompt: `You have filesystem tools available. Use them.

List the contents of ${TARGET_DIR}, then read package.json and any lock files. Analyze:
1. Number and purpose of dependencies
2. Any outdated or risky packages
3. Dev vs production dependency split
4. Scripts and their purposes`,
  },
  {
    id: 'bug-hunt',
    name: 'Bug Hunt',
    prompt: `You have filesystem tools available. Use them.

Look through the source code in ${TARGET_DIR} for potential bugs. Check for:
1. Unhandled error cases
2. Race conditions
3. Off-by-one errors
4. Memory leaks or resource cleanup issues
5. Type assertion misuse
List each finding with file path and line reference.`,
  },
];

if (quickMode) PROMPTS.length = 3;

// ── Fetch helpers ──────────────────────────────────────

async function getModels() {
  const res = await fetch(`${API}/api/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
}

export function promptHarnessTimeoutMs(modelId) {
  return isGlm5ModelId(modelId) ? GLM5_PROMPT_HARNESS_TIMEOUT_MS : DEFAULT_PROMPT_HARNESS_TIMEOUT_MS;
}

async function runTest(prompt, modelId) {
  const body = { prompt: prompt.prompt, modelId, workingDir: TARGET_DIR, testId: `${modelId}--${prompt.id}` };
  const start = Date.now();
  const res = await fetch(`${API}/api/test/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(promptHarnessTimeoutMs(modelId)),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    const errText = await res.text();
    throw new Error(`Non-JSON response (${contentType}): ${errText.slice(0, 200)}`);
  }
  const result = await res.json();
  result.wallMs = Date.now() - start;
  return result;
}

function promptRequiresFilesystemTools(prompt) {
  return /filesystem tools available/i.test(prompt.prompt);
}

function responseLeaksToolMarkup(response = '') {
  return /<tool_call>/i.test(response);
}

// ── Incremental file writers ───────────────────────────

function createResultWriter(resultsDir, timestamp) {
  const jsonPath = join(resultsDir, `test-${timestamp}.json`);
  const mdPath = join(resultsDir, `summary-${timestamp}.md`);
  let allResults = [];

  return {
    jsonPath,
    mdPath,
    appendResult(result) {
      allResults.push(result);
      // Rewrite JSON each time with all results so far
      writeFileSync(jsonPath, JSON.stringify({
        timestamp,
        targetDir: TARGET_DIR,
        completed: allResults.length,
        results: allResults,
      }, null, 2));
    },
    writeSummary(models, prompts) {
      const md = buildMarkdownSummary(allResults, models, prompts);
      writeFileSync(mdPath, md);
    },
    get results() { return allResults; },
  };
}

// ── Markdown summary builder (with comparison table) ──

function buildMarkdownSummary(results, models, prompts) {
  const lines = [
    `# OpenHarness Test Results`,
    ``,
    `**Date:** ${new Date().toISOString()}`,
    `**Target:** ${TARGET_DIR}`,
    `**Models tested:** ${models.length}`,
    `**Prompts:** ${prompts.length}`,
    `**Total runs:** ${results.length} (${results.filter(r => r.status === 'ok').length} ok, ${results.filter(r => r.status !== 'ok').length} failed)`,
    ``,
  ];

  // ── Comparison table ────────────────────────────────
  lines.push(`## Comparison Table`, ``);
  lines.push(`| Model | Prompt | Response | Tools | Wall Time | Used FS Tools | Status |`);
  lines.push(`|-------|--------|----------|-------|-----------|---------------|--------|`);

  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : '❌';
    const respLen = r.responseLength || r.response?.length || 0;
    const tools = r.toolCallCount || 0;
    const wall = r.wallMs ? `${(r.wallMs / 1000).toFixed(1)}s` : '?';
    const usedFS = r.usedTools !== undefined
      ? (r.usedTools ? '✓' : '✗')
      : (r.toolCalls?.some(tc => tc.name === 'list_directory' || tc.name === 'read_file') ? '✓' : '✗');
    lines.push(`| ${r.model} | ${r.prompt} | ${respLen} chars | ${tools} | ${wall} | ${usedFS} | ${icon} |`);
  }
  lines.push('');

  // ── Per-model averages ──────────────────────────────
  lines.push(`## Results by Model`, ``);

  for (const model of models) {
    const modelResults = results.filter(r => r.model === (model.id || model));
    const ok = modelResults.filter(r => r.status === 'ok');
    const avgLen = ok.length > 0 ? Math.round(ok.reduce((s, r) => s + (r.responseLength || r.response?.length || 0), 0) / ok.length) : 0;
    const avgTools = ok.length > 0 ? (ok.reduce((s, r) => s + (r.toolCallCount || 0), 0) / ok.length).toFixed(1) : '0';
    const avgMs = ok.length > 0 ? Math.round(ok.reduce((s, r) => s + (r.wallMs || 0), 0) / ok.length) : 0;

    lines.push(`### ${model.id || model} (${model.providerName || 'forced'})`);
    lines.push(`- Prompts passed: ${ok.length}/${modelResults.length}`);
    lines.push(`- Avg response length: ${avgLen} chars`);
    lines.push(`- Avg tool calls: ${avgTools}`);
    lines.push(`- Avg wall time: ${avgMs}ms`);
    lines.push(``);

    for (const r of modelResults) {
      const icon = r.status === 'ok' ? '✅' : '❌';
      lines.push(`${icon} **${r.prompt}** — ${r.status === 'ok' ? `${r.responseLength || r.response?.length || 0} chars, ${r.toolCallCount || 0} tools` : r.error}`);
    }
    lines.push(``);
  }

  // ── Detailed responses ──────────────────────────────
  lines.push(`## Detailed Responses`, ``);
  for (const r of results.filter(r => r.status === 'ok')) {
    lines.push(`### ${r.model} / ${r.promptName || r.prompt}`, ``);
    lines.push(r.response || '(empty)');
    lines.push(``, `---`, ``);
  }

  return lines.join('\n');
}

// ── Main runner ────────────────────────────────────────

async function main() {
  console.log('═══ OpenHarness Test Harness ═══\n');
  console.log(`Target: ${TARGET_DIR}`);
  console.log(`Prompts: ${PROMPTS.length}`);

  // Get models
  let models;
  if (forcedModels) {
    models = forcedModels.map(id => ({ id, name: id, providerName: 'forced' }));
    console.log(`Models: ${forcedModels.join(', ')} (forced)`);
  } else {
    models = await getModels();
    console.log(`Models: ${models.length}`);
  }
  console.log('');

  const resultsDir = outputDir
    ? (outputDir.startsWith('/') ? outputDir : join(ROOT, outputDir))
    : join(ROOT, 'test-results');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const writer = createResultWriter(resultsDir, timestamp);

  const totalRuns = models.length * PROMPTS.length;
  let completed = 0;
  let failed = 0;

  // Run matrix: model × prompt
  for (const model of models) {
    console.log(`\n── ${model.name || model.id} (${model.providerName}) ──`);
    for (const p of PROMPTS) {
      completed++;
      const label = `[${completed}/${totalRuns}]`;
      process.stdout.write(`  ${label} ${p.id}... `);

      try {
        const result = await runTest(p, model.id);
        if (result.error) {
          console.log(`ERROR: ${result.error}`);
          failed++;
          const entry = { model: model.id, prompt: p.id, status: 'error', error: result.error };
          writer.appendResult(entry);
        } else {
          const respLen = result.response?.length || 0;
          const tools = result.toolCallCount || 0;
          const usedFS = result.toolCalls?.some(tc => tc.name === 'list_directory' || tc.name === 'read_file') ?? false;
          const leakedToolMarkup = responseLeaksToolMarkup(result.response || '');
          const missingRequiredTools = promptRequiresFilesystemTools(p) && !usedFS;
          if (leakedToolMarkup || missingRequiredTools) {
            const reason = leakedToolMarkup
              ? 'Raw tool markup leaked into the response'
              : 'Prompt required filesystem tools, but none executed';
            console.log(`FAIL: ${reason}`);
            failed++;
            writer.appendResult({
              model: model.id,
              modelProvider: model.providerName,
              prompt: p.id,
              promptName: p.name,
              status: 'fail',
              error: reason,
              toolCallCount: tools,
              toolCalls: result.toolCalls,
              responseLength: respLen,
              responsePreview: result.response?.slice(0, 300) || '',
              response: result.response || '',
              wallMs: result.wallMs,
              messageCount: result.messageCount,
              usedTools: usedFS,
            });
            continue;
          }
          console.log(`OK (${respLen} chars, ${tools} tools, ${result.wallMs}ms)`);
          const entry = {
            model: model.id,
            modelProvider: model.providerName,
            prompt: p.id,
            promptName: p.name,
            status: 'ok',
            toolCallCount: tools,
            toolCalls: result.toolCalls,
            responseLength: respLen,
            responsePreview: result.response?.slice(0, 300) || '',
            response: result.response || '',
            wallMs: result.wallMs,
            messageCount: result.messageCount,
            usedTools: usedFS,
          };
          writer.appendResult(entry);
        }
      } catch (err) {
        console.log(`FAIL: ${err.message}`);
        failed++;
        writer.appendResult({ model: model.id, prompt: p.id, status: 'fail', error: err.message });
      }
    }
  }

  // Write final summary with comparison table
  writer.writeSummary(models, PROMPTS);

  console.log(`\n═══ Results ═══`);
  console.log(`  Full results: ${writer.jsonPath}`);
  console.log(`  Summary:      ${writer.mdPath}`);
  console.log(`  ${completed - failed}/${totalRuns} passed`);
}

if (!UNIT_TEST_IMPORT) {
  main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
