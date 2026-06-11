import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOrchestratorPipeline } from '../server/orchestrator';
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

const originalFetch = globalThis.fetch;
let artifactTempDir = '';
let artifactContinuationPrompt = '';
let artifactInitialPrompt = '';
let nativeToolTempDir = '';
let nativeToolRequestHadTools = false;

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
                    content: '<!doctype html><title>Native Game</title><link rel="stylesheet" href="styles.css"><main id="game">Native game</main><script src="game.js"></script>',
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
                    content: 'body { background: #080808; color: #f5f5f5; font-family: monospace; }',
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
                    content: 'document.addEventListener("keydown", () => { document.getElementById("game").textContent = "Native moved"; });',
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
                    content: '# Native Game\n\nOpen index.html and press a key to verify movement for human testing.',
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
        'node -e "const fs=require(\'fs\'); if (!fs.readFileSync(\'native-game/game.js\', \'utf8\').includes(\'Native moved\')) process.exit(1)"',
      ].join('\n');
    } else if (fullPrompt.includes('Create the requested artifact') && !fullPrompt.includes('Tool results:')) {
      artifactInitialPrompt = fullPrompt;
      content = [
        `<tool_call>{"name":"write_file","arguments":{"path":"${artifactTempDir}/neon-game/index.html","content":"<!doctype html><title>Playable demo</title><link rel=\\"stylesheet\\" href=\\"styles.css\\"><main id=\\"game\\">Playable demo</main><script src=\\"game.js\\"></script>"}}</tool_call>`,
        `<tool_call>{"name":"write_file","arguments":{"path":"${artifactTempDir}/neon-game/styles.css","content":"body { background: #111; color: #0ff; font-family: monospace; }"}}</tool_call>`,
        `<tool_call>{"name":"write_file","arguments":{"path":"${artifactTempDir}/neon-game/game.js","content":"document.addEventListener('keydown', () => { document.getElementById('game').textContent = 'Moved'; });"}}</tool_call>`,
        `<tool_call>{"name":"write_file","arguments":{"path":"${artifactTempDir}/neon-game/README.md","content":"# Playable Demo\\n\\nOpen index.html and press a key to verify movement for human testing."}}</tool_call>`,
      ].join('\n');
    } else if (fullPrompt.includes('Tool results:') && fullPrompt.includes('write_file')) {
      artifactContinuationPrompt = fullPrompt;
      content = [
        'Created neon-game/index.html.',
        '',
        'Validation commands:',
        'node -e "const fs=require(\'fs\'); if (!fs.readFileSync(\'neon-game/index.html\', \'utf8\').includes(\'Playable demo\')) process.exit(1)"',
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
        invokeTool: async (toolName, args) => {
          assert.equal(toolName, 'write_file');
          writeFileSync(String(args.path), String(args.content), 'utf8');
          return { written: true, path: args.path };
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
    assert.doesNotMatch(artifactInitialPrompt.slice(0, 400), /## Plan/);
    assert.match(artifactResult.finalText, /## Delivered/);
    assert.match(artifactResult.finalText, /Direct artifact file writes were used/i);
    assert.match(artifactResult.finalText, /Workspace write tool used by implementer/i);
    assert.match(artifactResult.finalText, /openharness artifact manifest check/i);
    assert.match(artifactResult.finalText, /Validation passed: node -e/i);
    assert.match(artifactContinuationPrompt, /request more write_file tool calls/i);
    assert.doesNotMatch(artifactContinuationPrompt, /request one read-only tool call/i);
    assert.match(readFileSync(join(artifactDir, 'neon-game', 'index.html'), 'utf8'), /Playable demo/);
    assert.match(readFileSync(join(artifactDir, 'neon-game', 'game.js'), 'utf8'), /keydown/);
  } finally {
    rmSync(artifactDir, { recursive: true, force: true });
    artifactTempDir = '';
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
    assert.match(readFileSync(join(nativeToolDir, 'native-game', 'game.js'), 'utf8'), /Native moved/);
  } finally {
    rmSync(nativeToolDir, { recursive: true, force: true });
    nativeToolTempDir = '';
    nativeToolRequestHadTools = false;
  }
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Execute proof hygiene tests passed.');
