import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { extractValidationCommands, runOrchestratorPipeline } from '../server/orchestrator';
import type { StoredConfig } from '../server/config';
import type { RouteDecision } from '../server/router';

const config: StoredConfig = {
  version: 1,
  providers: [{
    id: 'mock',
    name: 'Mock Provider',
    type: 'openai-compatible',
    apiKey: 'test-key',
    baseURL: 'https://mock.provider/v1',
    models: [{ id: 'executor', name: 'Executor', enabled: true }],
  }],
  mcpServers: [],
  personality: '',
  activeModel: 'mock:executor',
  activeTheme: 'midnight',
  roleAssignments: {
    planner: 'mock:executor',
    coder: 'mock:executor',
    reviewer: 'mock:executor',
  },
  trustMode: 'read-only',
};

const route: RouteDecision = {
  mode: 'execute',
  role: 'coder',
  complexity: 'medium',
  needsTools: true,
  needsValidation: true,
  suggestedModels: [],
  reason: 'test execute proof hygiene',
};

const shipGateCommands = extractValidationCommands([
  'Validation commands:',
  'node /repo/scripts/verify-standalone-artifact-fixture.mjs game',
  'cd /repo && node --import tsx /repo/scripts/run-ship-readiness.ts /tmp/game',
].join('\n'));
assert.deepEqual(shipGateCommands, [
  'node /repo/scripts/verify-standalone-artifact-fixture.mjs game',
  'cd /repo && node --import tsx /repo/scripts/run-ship-readiness.ts /tmp/game',
], 'validation extraction should preserve cd-prefixed ship-readiness commands');

const originalFetch = globalThis.fetch;
let artifactTempDir = '';
let artifactContinuationPrompt = '';
let artifactInitialPrompt = '';
let nativeToolTempDir = '';
let nativeToolRequestHadTools = false;
let partialArtifactTempDir = '';
let partialArtifactRetryPrompt: string;
let repairArtifactTempDir = '';
let repairArtifactPrompt: string;

function artifactIndex(title: string): string {
  return [
    '<!doctype html>',
    '<html><head>',
    `<title>${title}</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<link rel="stylesheet" href="styles.css">',
    '</head><body>',
    '<main id="game">',
    '<h1>Neon Decade Descent</h1>',
    '<p id="hud">HP 10 Score 0 Depth 1 Turn 0</p>',
    '<canvas id="board" width="320" height="240"></canvas>',
    '<button id="restart">Restart</button>',
    '<p>Controls: Arrow keys or WASD. Collect mixtapes, dodge VHS sentries, reach the arcade exit.</p>',
    '</main>',
    '<script src="game.js"></script>',
    '</body></html>',
  ].join('\n');
}

const artifactStyles = [
  'body { margin: 0; min-height: 100vh; background: #050505; color: #00ffff; display: grid; place-items: center; font-family: monospace; }',
  '#game { width: min(720px, 94vw); display: grid; gap: 12px; }',
  'canvas { width: 100%; max-width: 640px; border: 2px solid #ff00ff; background: #111; image-rendering: pixelated; }',
  'button { width: max-content; padding: 8px 12px; background: #ff00ff; color: #050505; border: 0; font-weight: 700; }',
].join('\n');

const artifactGame = [
  'const canvas = document.getElementById("board");',
  'const ctx = canvas.getContext("2d");',
  'const hud = document.getElementById("hud");',
  'const player = { x: 1, y: 1, hp: 10 };',
  'const enemies = [{ x: 4, y: 2, hp: 2, name: "VHS Sentry" }];',
  'const items = [{ x: 2, y: 1, name: "mixtape powerup" }, { x: 5, y: 4, name: "floppy key" }];',
  'let score = 0;',
  'let depth = 1;',
  'let turn = 0;',
  'function render() {',
  '  hud.textContent = `HP ${player.hp} Score ${score} Depth ${depth} Turn ${turn}`;',
  '  ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height);',
  '  ctx.fillStyle = "#00ffff"; ctx.fillRect(player.x * 32, player.y * 32, 28, 28);',
  '  ctx.fillStyle = "#ff00ff"; for (const enemy of enemies) ctx.fillRect(enemy.x * 32, enemy.y * 32, 28, 28);',
  '  ctx.fillStyle = "#ffff00"; for (const item of items) ctx.fillRect(item.x * 32 + 8, item.y * 32 + 8, 12, 12);',
  '}',
  'function restart() { player.x = 1; player.y = 1; player.hp = 10; score = 0; depth = 1; turn = 0; render(); }',
  'function move(dx, dy) { player.x = Math.max(0, Math.min(9, player.x + dx)); player.y = Math.max(0, Math.min(6, player.y + dy)); score += 1; turn += 1; render(); }',
  'document.addEventListener("keydown", (event) => {',
  '  if (event.key === "r" || event.key === "R") restart();',
  '  if (event.key === "ArrowRight" || event.key === "d") move(1, 0);',
  '  if (event.key === "ArrowLeft" || event.key === "a") move(-1, 0);',
  '  if (event.key === "ArrowDown" || event.key === "s") move(0, 1);',
  '  if (event.key === "ArrowUp" || event.key === "w") move(0, -1);',
  '});',
  'document.getElementById("restart").addEventListener("click", restart);',
  'window.neonDecadeDescent = { getState: () => ({ player, score, depth, turn, enemies: enemies.length, items: items.length }) };',
  'render();',
].join('\n');

const artifactReadme = [
  '# Neon Decade Descent',
  '',
  'Neon Decade Descent is a direct-open standalone 1980s roguelike test artifact about an arcade mall dungeon with VHS sentries, mixtape powerups, floppy-disk keys, neon signage, grid movement, score, HP, depth, turn state, and replay.',
  '',
  'Controls: open index.html in a browser, move with Arrow keys or WASD, and press R or the Restart button to begin a new run.',
  '',
  'Tester objective: verify that the page loads without a build step, a canvas and HUD are visible, keyboard input changes score or turn state, enemies and items are represented, the 1980s arcade theme is obvious, and restart resets the run. Expected result: this is ready for a human to judge feel and clarity rather than basic functionality.',
].join('\n');

function toolCall(path: string, content: string): string {
  return `<tool_call>${JSON.stringify({ name: 'write_file', arguments: { path, content } })}</tool_call>`;
}

try {
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    const prompt = body.messages?.find((message: any) => message.role === 'user')?.content || '';
    const fullPrompt = body.messages?.map((message: any) => message.content).join('\n') || '';
    let content = 'Looks good.';

    if (prompt.includes('step-by-step implementation plan')) {
      content = 'Plan: edit src/App.tsx, then run npm run build.';
    } else if (
      fullPrompt.includes('Create a playable browser game in native-game folder.')
      && Array.isArray(body.tools)
      && body.tools.some((tool: any) => tool.function?.name === 'write_file')
    ) {
      nativeToolRequestHadTools = true;
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call-index',
                type: 'function',
                function: {
                  name: 'write_file',
                  arguments: JSON.stringify({
                    path: `${nativeToolTempDir}/native-game/index.html`,
                    content: artifactIndex('Native Game'),
                  }),
                },
              },
              {
                id: 'call-css',
                type: 'function',
                function: {
                  name: 'write_file',
                  arguments: JSON.stringify({
                    path: `${nativeToolTempDir}/native-game/styles.css`,
                    content: artifactStyles,
                  }),
                },
              },
              {
                id: 'call-js',
                type: 'function',
                function: {
                  name: 'write_file',
                  arguments: JSON.stringify({
                    path: `${nativeToolTempDir}/native-game/game.js`,
                    content: artifactGame,
                  }),
                },
              },
              {
                id: 'call-readme',
                type: 'function',
                function: {
                  name: 'write_file',
                  arguments: JSON.stringify({
                    path: `${nativeToolTempDir}/native-game/README.md`,
                    content: artifactReadme,
                  }),
                },
              },
            ],
          },
        }],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (fullPrompt.includes('native-game') && fullPrompt.includes('Only produce the final answer after')) {
      content = [
        'Created native-game/index.html, native-game/styles.css, native-game/game.js, and native-game/README.md.',
        '',
        'Validation commands:',
        'node -e "const fs=require(\'fs\'); if (!fs.readFileSync(\'native-game/game.js\', \'utf8\').includes(\'neonDecadeDescent\')) process.exit(1)"',
      ].join('\n');
    } else if (
      fullPrompt.includes('Create a playable browser game in partial-game folder.')
      && fullPrompt.includes('## Artifact Write Command')
      && !fullPrompt.includes('## Artifact Creation Retry')
      && !fullPrompt.includes('Tool results:')
    ) {
      content = [
        `<tool_call>{"name":"write_file","arguments":{"path":"${partialArtifactTempDir}/partial-game/index.html","content":"<!doctype html><title>Partial Game</title><main id=\\"game\\">Partial only</main><script src=\\"game.js\\"></script>"}}</tool_call>`,
      ].join('\n');
    } else if (
      fullPrompt.includes('partial-game')
      && fullPrompt.includes('## Artifact Creation Retry')
    ) {
      partialArtifactRetryPrompt = fullPrompt;
      content = 'Created partial-game/index.html and the artifact is complete.';
    } else if (
      fullPrompt.includes('Create a playable browser game in repair-game folder.')
      && fullPrompt.includes('## Artifact Write Command')
      && !fullPrompt.includes('Tool results:')
    ) {
      content = [
        toolCall(`${repairArtifactTempDir}/repair-game/index.html`, artifactIndex('Repair Game')),
        toolCall(`${repairArtifactTempDir}/repair-game/styles.css`, artifactStyles),
        `<tool_call>{"name":"write_file","arguments":{"path":"${repairArtifactTempDir}/repair-game/game.js","content":"document.getElementById('game').textContent = 'Broken state';"}}</tool_call>`,
        toolCall(`${repairArtifactTempDir}/repair-game/README.md`, artifactReadme),
      ].join('\n');
    } else if (
      fullPrompt.includes('repair-game')
      && fullPrompt.includes('Tool results:')
      && !fullPrompt.includes('## Artifact Validation Repair')
    ) {
      content = [
        'Created repair-game/index.html, repair-game/styles.css, repair-game/game.js, and repair-game/README.md.',
        '',
        'Validation commands:',
        'node -e "console.error(\'- Browser smoke: missing visible HUD after keyboard input\'); process.exit(1)"',
      ].join('\n');
    } else if (
      fullPrompt.includes('repair-game')
      && fullPrompt.includes('## Artifact Validation Repair')
      && !fullPrompt.includes('Tool results:')
    ) {
      repairArtifactPrompt = fullPrompt;
      content = [
        toolCall(`${repairArtifactTempDir}/repair-game/game.js`, `${artifactGame}\n// Repaired moved`),
      ].join('\n');
    } else if (
      fullPrompt.includes('repair-game')
      && fullPrompt.includes('## Artifact Validation Repair')
      && fullPrompt.includes('Tool results:')
    ) {
      content = [
        'Repaired repair-game/game.js.',
        '',
        'Validation commands:',
        'node -e "const fs=require(\'fs\'); if (!fs.readFileSync(\'repair-game/game.js\', \'utf8\').includes(\'Repaired moved\')) process.exit(1)"',
      ].join('\n');
    } else if (fullPrompt.includes('Create the requested artifact') && !fullPrompt.includes('Tool results:')) {
      artifactInitialPrompt = fullPrompt;
      content = [
        toolCall(`${artifactTempDir}/neon-game/index.html`, artifactIndex('Playable Demo')),
        toolCall(`${artifactTempDir}/neon-game/styles.css`, artifactStyles),
        toolCall(`${artifactTempDir}/neon-game/game.js`, artifactGame),
        toolCall(`${artifactTempDir}/neon-game/README.md`, artifactReadme),
      ].join('\n');
    } else if (fullPrompt.includes('Tool results:') && fullPrompt.includes('write_file')) {
      artifactContinuationPrompt = fullPrompt;
      content = [
        'Created neon-game/index.html.',
        '',
        'Validation commands:',
        'node -e "const fs=require(\'fs\'); if (!fs.readFileSync(\'neon-game/game.js\', \'utf8\').includes(\'neonDecadeDescent\')) process.exit(1)"',
      ].join('\n');
    } else if (prompt.includes('Produce a unified-diff patch') && fullPrompt.includes('Force a failing validation detail.')) {
      content = [
        'diff --git a/src/App.tsx b/src/App.tsx',
        '--- a/src/App.tsx',
        '+++ b/src/App.tsx',
        '@@ -1 +1 @@',
        '-export default function App() { return null; }',
        '+export default function App() { return <main>Broken demo</main>; }',
        '',
        'Validation commands:',
        'node -e "console.error(\'- Browser smoke: missing visible HUD after keyboard input\'); process.exit(1)"',
      ].join('\n');
    } else if (prompt.includes('Produce a unified-diff patch') && fullPrompt.includes('Force a passing validation detail.')) {
      content = [
        'diff --git a/src/App.tsx b/src/App.tsx',
        '--- a/src/App.tsx',
        '+++ b/src/App.tsx',
        '@@ -1 +1 @@',
        '-export default function App() { return null; }',
        '+export default function App() { return <main>Validated demo</main>; }',
        '',
        'Validation commands:',
        'node -e "console.log(\'PASS: Ship readiness passed with browser smoke evidence.\')"',
      ].join('\n');
    } else if (prompt.includes('Produce a unified-diff patch')) {
      content = [
        'diff --git a/src/App.tsx b/src/App.tsx',
        '--- a/src/App.tsx',
        '+++ b/src/App.tsx',
        '@@ -1 +1 @@',
        '-export default function App() { return null; }',
        '+export default function App() { return <main>Playable demo</main>; }',
        '',
        'Validation commands:',
        'node -e "const fs=require(\'fs\'); if (!fs.readFileSync(\'src/App.tsx\', \'utf8\').includes(\'Playable demo\')) process.exit(1)"',
      ].join('\n');
    } else if (prompt.includes('Review the implementation above')) {
      content = 'Review: the proposed patch is plausible, but it still needs to be applied and validated.';
    }

    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const readOnlyResult = await runOrchestratorPipeline(
    route,
    'Fix the existing tiny playable browser demo.',
    config,
    process.cwd(),
  );

  assert.equal(readOnlyResult.ok, false, 'read-only execute should not be marked ok without applied changes and validation proof');
  assert.match(readOnlyResult.error || '', /applied-and-validated proof/i);
  assert.match(readOnlyResult.finalText, /Delivery Status/);
  assert.match(readOnlyResult.finalText, /Patch proposal detected/i);
  assert.match(readOnlyResult.finalText, /Trust mode read-only does not allow automatic patch application/i);
  assert.match(readOnlyResult.finalText, /proposal, not a shipped change/i);
  assert.match(readOnlyResult.finalText, /proposal only; no applied-and-validated proof yet/i);

  const tempDir = mkdtempSync(join(tmpdir(), 'openharness-execute-proof-'));
  try {
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'App.tsx'), 'export default function App() { return null; }\n');

    const writeConfig: StoredConfig = { ...config, trustMode: 'workspace-write' };
    const appliedResult = await runOrchestratorPipeline(
      route,
      'Fix the existing tiny playable browser demo.',
      writeConfig,
      tempDir,
    );

    assert.equal(appliedResult.ok, true, 'workspace-write execute should be ok when patch applies and validation passes');
    assert.match(appliedResult.finalText, /Patch applied to: src\/App\.tsx/i);
    assert.match(appliedResult.finalText, /Validation passed: node -e/i);
    assert.match(appliedResult.finalText, /Applied-and-validated proof is available/i);
    assert.match(appliedResult.finalText, /files changed and validation ran/i);
    assert.match(readFileSync(join(tempDir, 'src', 'App.tsx'), 'utf8'), /Playable demo/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  const failingValidationDir = mkdtempSync(join(tmpdir(), 'openharness-execute-failure-detail-'));
  try {
    mkdirSync(join(failingValidationDir, 'src'), { recursive: true });
    writeFileSync(join(failingValidationDir, 'src', 'App.tsx'), 'export default function App() { return null; }\n');

    const writeConfig: StoredConfig = { ...config, trustMode: 'workspace-write' };
    const failedResult = await runOrchestratorPipeline(
      route,
      'Force a failing validation detail.',
      writeConfig,
      failingValidationDir,
    );

    assert.equal(failedResult.ok, false, 'failed validation should not be marked delivered');
    assert.match(failedResult.finalText, /Failure detail: Browser smoke: missing visible HUD after keyboard input/i);
  } finally {
    rmSync(failingValidationDir, { recursive: true, force: true });
  }

  const passingValidationDir = mkdtempSync(join(tmpdir(), 'openharness-execute-success-detail-'));
  try {
    mkdirSync(join(passingValidationDir, 'src'), { recursive: true });
    writeFileSync(join(passingValidationDir, 'src', 'App.tsx'), 'export default function App() { return null; }\n');

    const writeConfig: StoredConfig = { ...config, trustMode: 'workspace-write' };
    const passedResult = await runOrchestratorPipeline(
      route,
      'Force a passing validation detail.',
      writeConfig,
      passingValidationDir,
    );

    assert.equal(passedResult.ok, true, 'passing validation should still be delivered');
    assert.match(passedResult.finalText, /Proof detail: PASS: Ship readiness passed with browser smoke evidence/i);
  } finally {
    rmSync(passingValidationDir, { recursive: true, force: true });
  }

  const artifactDir = mkdtempSync(join(tmpdir(), 'openharness-artifact-proof-'));
  artifactTempDir = artifactDir;
  try {
    mkdirSync(join(artifactDir, 'neon-game'), { recursive: true });
    const writeConfig: StoredConfig = { ...config, trustMode: 'workspace-write' };
    const artifactResult = await runOrchestratorPipeline(
      route,
      'Create a playable browser game in its own folder.',
      writeConfig,
      artifactDir,
      {
        tools: [{
          type: 'function',
          function: {
            name: 'write_file',
            description: 'Write a file',
            parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
          },
        }],
        invokeTool: async (toolName, args, workingDir) => {
          assert.equal(toolName, 'write_file');
          const targetPath = isAbsolute(String(args.path)) ? String(args.path) : join(String(workingDir), String(args.path));
          writeFileSync(targetPath, String(args.content), 'utf8');
          return { written: true, path: targetPath };
        },
      },
    );

    assert.equal(artifactResult.ok, true, 'workspace-write artifact creation should be ok when write_file runs and validation passes');
    assert.equal(artifactResult.assistedByFallback, false, 'model-authored artifact writes should not be marked fallback-assisted');
    assert.ok(
      artifactInitialPrompt.indexOf('## Artifact Write Command') < artifactInitialPrompt.indexOf('## Planner Notes'),
      'artifact implementer prompt should put write command before planner notes',
    );
    assert.match(artifactInitialPrompt, /Your next response must use write_file tool calls/i);
    assert.match(artifactInitialPrompt, /generated-artifact\/index\.html/);
    assert.match(artifactInitialPrompt, /generated-artifact\/game\.js/);
    assert.match(artifactInitialPrompt, /verify-standalone-artifact-fixture\.mjs/);
    assert.match(artifactInitialPrompt, /run-ship-readiness\.ts/);
    assert.match(artifactInitialPrompt, /Do not use remote\/CDN asset URLs/i);
    assert.match(artifactInitialPrompt, /Do not use data: or blob: payloads/i);
    assert.doesNotMatch(artifactInitialPrompt.slice(0, 400), /## Plan/);
    assert.match(artifactResult.finalText, /## Delivered/);
    assert.match(artifactResult.finalText, /Direct artifact file writes were used/i);
    assert.match(artifactResult.finalText, /Workspace write tool used by implementer/i);
    assert.match(artifactResult.finalText, /openharness artifact manifest check/i);
    assert.match(artifactResult.finalText, /verify-standalone-artifact-fixture\.mjs/i);
    assert.match(artifactResult.finalText, /run-ship-readiness\.ts/i);
    assert.match(artifactResult.finalText, /Validation passed: node -e/i);
    assert.match(artifactContinuationPrompt, /request more write_file tool calls/i);
    assert.doesNotMatch(artifactContinuationPrompt, /request one read-only tool call/i);
    assert.match(readFileSync(join(artifactDir, 'neon-game', 'index.html'), 'utf8'), /Neon Decade Descent/);
    assert.match(readFileSync(join(artifactDir, 'neon-game', 'game.js'), 'utf8'), /keydown/);
  } finally {
    rmSync(artifactDir, { recursive: true, force: true });
    artifactTempDir = '';
  }

  const repairDir = mkdtempSync(join(tmpdir(), 'openharness-artifact-validation-repair-'));
  repairArtifactTempDir = repairDir;
  repairArtifactPrompt = '';
  try {
    mkdirSync(join(repairDir, 'repair-game'), { recursive: true });
    const writeConfig: StoredConfig = { ...config, trustMode: 'workspace-write' };
    const repairedResult = await runOrchestratorPipeline(
      route,
      'Create a playable browser game in repair-game folder.',
      writeConfig,
      repairDir,
      {
        tools: [{
          type: 'function',
          function: {
            name: 'write_file',
            description: 'Write a file',
            parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
          },
        }],
        invokeTool: async (toolName, args, workingDir) => {
          assert.equal(toolName, 'write_file');
          const targetPath = isAbsolute(String(args.path)) ? String(args.path) : join(String(workingDir), String(args.path));
          writeFileSync(targetPath, String(args.content), 'utf8');
          return { written: true, path: targetPath };
        },
      },
    );

    assert.equal(repairedResult.ok, true, `validation repair should recover a complete but failing artifact:\n${repairedResult.finalText}`);
    assert.equal(repairedResult.assistedByFallback, false, 'validation repair should preserve model-authored status');
    assert.match(repairArtifactPrompt, /Artifact Validation Repair/);
    assert.match(repairArtifactPrompt, /JavaScript must wire real player input|Includes enemies or hazards/i);
    assert.match(repairArtifactPrompt, /no remote\/CDN src or href values/i);
    assert.match(repairArtifactPrompt, /no data: or blob: payloads/i);
    assert.match(repairedResult.finalText, /Validation passed: node -e/);
    assert.match(readFileSync(join(repairDir, 'repair-game', 'game.js'), 'utf8'), /Repaired moved/);
  } finally {
    rmSync(repairDir, { recursive: true, force: true });
    repairArtifactTempDir = '';
  }

  const partialDir = mkdtempSync(join(tmpdir(), 'openharness-partial-artifact-proof-'));
  partialArtifactTempDir = partialDir;
  partialArtifactRetryPrompt = '';
  try {
    mkdirSync(join(partialDir, 'partial-game'), { recursive: true });
    const writeConfig: StoredConfig = { ...config, trustMode: 'workspace-write' };
    const partialResult = await runOrchestratorPipeline(
      route,
      'Create a playable browser game in partial-game folder.',
      writeConfig,
      partialDir,
      {
        tools: [{
          type: 'function',
          function: {
            name: 'write_file',
            description: 'Write a file',
            parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
          },
        }],
        invokeTool: async (toolName, args, workingDir) => {
          assert.equal(toolName, 'write_file');
          const targetPath = isAbsolute(String(args.path)) ? String(args.path) : join(String(workingDir), String(args.path));
          writeFileSync(targetPath, String(args.content), 'utf8');
          return { written: true, path: targetPath };
        },
      },
    );

    assert.equal(partialResult.ok, true, `partial model-authored artifact should be rescued to a shippable fallback:\n${partialResult.finalText}`);
    assert.equal(partialResult.assistedByFallback, true, 'partial model-authored artifact should be marked fallback-assisted');
    assert.match(partialArtifactRetryPrompt, /Missing written JavaScript file/i);
    assert.match(partialArtifactRetryPrompt, /Missing written CSS file/i);
    assert.match(partialArtifactRetryPrompt, /Missing written README\.md tester handoff/i);
    assert.match(partialResult.finalText, /deterministic fallback scaffold/i);
    assert.match(partialResult.finalText, /verify-standalone-artifact-fixture\.mjs/i);
    assert.match(partialResult.finalText, /run-ship-readiness\.ts/i);
    assert.match(readFileSync(join(partialDir, 'partial-game', 'game.js'), 'utf8'), /keydown/);
    assert.match(readFileSync(join(partialDir, 'partial-game', 'README.md'), 'utf8'), /Human testing/i);
  } finally {
    rmSync(partialDir, { recursive: true, force: true });
    partialArtifactTempDir = '';
  }

  const nativeToolDir = mkdtempSync(join(tmpdir(), 'openharness-native-tool-proof-'));
  nativeToolTempDir = nativeToolDir;
  try {
    mkdirSync(join(nativeToolDir, 'native-game'), { recursive: true });
    const writeConfig: StoredConfig = { ...config, trustMode: 'workspace-write' };
    const nativeToolResult = await runOrchestratorPipeline(
      route,
      'Create a playable browser game in native-game folder.',
      writeConfig,
      nativeToolDir,
      {
        tools: [{
          type: 'function',
          function: {
            name: 'write_file',
            description: 'Write a file',
            parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } },
          },
        }],
        invokeTool: async (toolName, args) => {
          assert.equal(toolName, 'write_file');
          writeFileSync(String(args.path), String(args.content), 'utf8');
          return { written: true, path: args.path };
        },
      },
    );

    assert.equal(nativeToolRequestHadTools, true, 'agent runtime should pass native tool schemas to the provider');
    assert.equal(nativeToolResult.ok, true, 'native tool-call artifact creation should be ok when write_file runs and validation passes');
    assert.equal(nativeToolResult.assistedByFallback, false, 'native model-authored artifact writes should not be fallback-assisted');
    assert.match(nativeToolResult.finalText, /Direct artifact file writes were used/i);
    assert.doesNotMatch(nativeToolResult.finalText, /deterministic fallback scaffold/i);
    assert.match(readFileSync(join(nativeToolDir, 'native-game', 'game.js'), 'utf8'), /neonDecadeDescent/);
  } finally {
    rmSync(nativeToolDir, { recursive: true, force: true });
    nativeToolTempDir = '';
    nativeToolRequestHadTools = false;
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Execute proof hygiene tests passed.');
