#!/usr/bin/env node

import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const API_BASE = process.env.OPENHARNESS_BASE || 'http://localhost:3001';
const PROJECT_ROOT = process.env.OPENHARNESS_WORKING_DIR || process.cwd();

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text };
}

async function expectStatus(path, status, options) {
  const result = await request(path, options);
  if (result.res.status !== status) {
    const detail = typeof result.body === 'object' ? JSON.stringify(result.body) : result.text;
    throw new Error(`${path} expected ${status}, got ${result.res.status}: ${detail}`);
  }
  return result;
}

async function updateTrustMode(trustMode) {
  const result = await request('/api/config', {
    method: 'PUT',
    body: JSON.stringify({ trustMode }),
  });
  if (!result.res.ok) throw new Error(`Failed to set trustMode=${trustMode}: ${result.text}`);
}

async function main() {
  console.log('Tool boundary smoke');
  console.log(`API: ${API_BASE}`);

  const config = await request('/api/config');
  if (!config.res.ok) throw new Error(`OpenHarness API is not reachable: ${config.res.status}`);
  const originalTrustMode = config.body?.trustMode || 'workspace-write';

  try {
    await updateTrustMode('workspace-write');

    const outsideFile = join('/tmp', `openharness-policy-escape-${Date.now()}.txt`);
    writeFileSync(outsideFile, 'outside workspace');
    try {
      const params = new URLSearchParams({ path: outsideFile, workingDir: '/tmp' });
      await expectStatus(`/api/fs/read?${params.toString()}`, 403);
    } finally {
      try { unlinkSync(outsideFile); } catch { /* ignore */ }
    }

    await expectStatus('/api/mcp/docker-mcp/tools/read_file', 403, {
      method: 'POST',
      body: JSON.stringify({
        root: '/tmp',
        path: '/tmp/openharness-policy-escape.txt',
      }),
    });

    const fakeKey = 'sk-123456789012345678901234';
    const redactionCheck = await expectStatus('/api/terminal/exec', 200, {
      method: 'POST',
      body: JSON.stringify({ command: `printf ${JSON.stringify(fakeKey)}`, cwd: PROJECT_ROOT }),
    });
    if (redactionCheck.text.includes(fakeKey)) {
      throw new Error('terminal output leaked an API-key-shaped secret');
    }
    if (!redactionCheck.text.includes('<redacted:OPENAI_KEY>')) {
      throw new Error(`terminal output did not include redaction marker: ${redactionCheck.text}`);
    }

    await expectStatus('/api/terminal/exec', 403, {
      method: 'POST',
      body: JSON.stringify({ command: 'rm -r dist', cwd: PROJECT_ROOT }),
    });

    await expectStatus('/api/terminal/exec', 403, {
      method: 'POST',
      body: JSON.stringify({ command: 'git reset --hard HEAD', cwd: PROJECT_ROOT }),
    });

    await updateTrustMode('read-only');

    await expectStatus('/api/terminal/exec', 403, {
      method: 'POST',
      body: JSON.stringify({ command: 'pwd', cwd: PROJECT_ROOT }),
    });

    await updateTrustMode('workspace-write');

    await expectStatus('/api/terminal/sessions', 403, {
      method: 'POST',
      body: JSON.stringify({ cwd: '/tmp' }),
    });

    await expectStatus('/api/git/status?dir=%2Ftmp', 403);
    await expectStatus('/api/git/diff?dir=%2Ftmp', 403);
    await expectStatus('/api/git/file-diff?dir=%2Ftmp&path=escape.txt', 403);
    await expectStatus('/api/git/log?dir=%2Ftmp', 403);

    await expectStatus(`/api/git/diff?dir=${encodeURIComponent(PROJECT_ROOT)}&path=${encodeURIComponent('../escape.txt')}`, 403);
    await expectStatus(`/api/git/file-diff?dir=${encodeURIComponent(PROJECT_ROOT)}&path=${encodeURIComponent('../escape.txt')}`, 403);

    await expectStatus('/api/git/stage', 403, {
      method: 'POST',
      body: JSON.stringify({ dir: '/tmp', paths: ['escape.txt'] }),
    });

    await expectStatus('/api/git/stage', 403, {
      method: 'POST',
      body: JSON.stringify({ dir: PROJECT_ROOT, paths: ['../escape.txt'] }),
    });

    await expectStatus('/api/checkpoints', 403, {
      method: 'POST',
      body: JSON.stringify({ dir: '/tmp', label: 'escape' }),
    });

    await expectStatus('/api/worktrees', 403, {
      method: 'POST',
      body: JSON.stringify({ dir: '/tmp', label: 'escape' }),
    });

    await expectStatus('/api/project/memory', 403, {
      method: 'PUT',
      body: JSON.stringify({ path: '/tmp', content: 'outside memory' }),
    });

    await expectStatus('/api/project/memory/archive', 403, {
      method: 'POST',
      body: JSON.stringify({ path: '/tmp' }),
    });

    await expectStatus('/api/project/memory/export?path=%2Ftmp', 403);

    await expectStatus(`/api/project/memory/export?path=${encodeURIComponent(PROJECT_ROOT)}`, 200);

    await expectStatus('/api/checkpoints?dir=%2Ftmp', 403);
    await expectStatus('/api/worktrees?dir=%2Ftmp', 403);
    await expectStatus('/api/safety/summary?dir=%2Ftmp', 403);
    await expectStatus('/api/project/profile?path=%2Ftmp', 403);
    await expectStatus('/api/repo/map?path=%2Ftmp', 403);
    await expectStatus('/api/repo/symbol?path=%2Ftmp&name=anything', 403);
    await expectStatus('/api/repo/deps?path=%2Ftmp&file=escape.txt', 403);
    await expectStatus('/api/repo/impact?path=%2Ftmp&files=escape.txt', 403);
    await expectStatus('/api/repo/context-pack?path=%2Ftmp&pack=review', 403);

    await expectStatus(`/api/repo/deps?path=${encodeURIComponent(PROJECT_ROOT)}&file=${encodeURIComponent('../escape.txt')}`, 403);
    await expectStatus(`/api/repo/impact?path=${encodeURIComponent(PROJECT_ROOT)}&files=${encodeURIComponent('../escape.txt')}`, 403);

    await expectStatus('/api/secrets/scan-files', 403, {
      method: 'POST',
      body: JSON.stringify({ root: '/tmp', paths: ['escape.txt'] }),
    });

    await expectStatus('/api/secrets/scan-files', 403, {
      method: 'POST',
      body: JSON.stringify({ root: PROJECT_ROOT, paths: ['../escape.txt'] }),
    });

    await expectStatus('/api/tasks/seed', 403, {
      method: 'POST',
      body: JSON.stringify({ workingDir: '/tmp' }),
    });

    await expectStatus('/api/tasks', 403, {
      method: 'POST',
      body: JSON.stringify({
        name: 'escape task',
        prompt: 'run outside',
        workingDir: '/tmp',
        setupCommands: [],
        verificationCommands: [],
        trustMode: 'workspace-write',
        timeoutMs: 1000,
        rubric: [],
        tags: ['smoke'],
      }),
    });

    await expectStatus('/api/tasks', 403, {
      method: 'POST',
      body: JSON.stringify({
        name: 'dangerous task',
        prompt: 'danger',
        workingDir: PROJECT_ROOT,
        setupCommands: ['rm -r dist'],
        verificationCommands: [],
        trustMode: 'workspace-write',
        timeoutMs: 1000,
        rubric: [],
        tags: ['smoke'],
      }),
    });

    await expectStatus('/api/test/run', 403, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'hello', workingDir: '/tmp', modelId: 'no-provider:model' }),
    });

    await expectStatus('/api/test/batch', 403, {
      method: 'POST',
      body: JSON.stringify({
        prompts: [{ id: 'p1', name: 'p1', prompt: 'hello' }],
        modelIds: ['no-provider:model'],
        workingDir: '/tmp',
      }),
    });

    await expectStatus('/api/agents/background', 403, {
      method: 'POST',
      body: JSON.stringify({
        profileId: 'explorer',
        prompt: 'inspect',
        workingDir: '/tmp',
        modelId: 'no-provider:model',
      }),
    });

    await expectStatus('/api/evals/run', 403, {
      method: 'POST',
      body: JSON.stringify({ workingDir: '/tmp', promptIds: ['repo-review'], modelIds: ['no-provider:model'] }),
    });

    const smokeTask = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        name: `safe smoke task ${Date.now()}`,
        prompt: 'Say hello.',
        workingDir: PROJECT_ROOT,
        setupCommands: [],
        verificationCommands: [],
        trustMode: 'workspace-write',
        timeoutMs: 1000,
        rubric: [],
        tags: ['smoke'],
      }),
    });
    if (!smokeTask.res.ok || !smokeTask.body?.id) {
      throw new Error(`Failed to create smoke task: ${smokeTask.text}`);
    }

    await expectStatus('/api/bench/run', 403, {
      method: 'POST',
      body: JSON.stringify({ workingDir: '/tmp', taskIds: [smokeTask.body.id], modelIds: ['no-provider:model'] }),
    });
    await request(`/api/tasks/${smokeTask.body.id}`, { method: 'DELETE' });

    await updateTrustMode('read-only');

    await expectStatus('/api/git/stage', 403, {
      method: 'POST',
      body: JSON.stringify({ dir: PROJECT_ROOT, paths: ['package.json'] }),
    });

    await expectStatus('/api/checkpoints', 403, {
      method: 'POST',
      body: JSON.stringify({ dir: PROJECT_ROOT, label: 'read-only blocked' }),
    });

    await expectStatus('/api/worktrees', 403, {
      method: 'POST',
      body: JSON.stringify({ dir: PROJECT_ROOT, label: 'read-only blocked' }),
    });

    await expectStatus('/api/project/memory', 403, {
      method: 'PUT',
      body: JSON.stringify({ path: PROJECT_ROOT, content: 'read-only blocked' }),
    });

    await expectStatus('/api/project/memory/archive', 403, {
      method: 'POST',
      body: JSON.stringify({ path: PROJECT_ROOT }),
    });

    await expectStatus('/api/processes/kill-all', 403, {
      method: 'POST',
      body: JSON.stringify({ kinds: ['terminal'] }),
    });

    await expectStatus('/api/processes/prune', 403, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    await expectStatus('/api/processes/999999/log', 403, { method: 'DELETE' });
    await expectStatus('/api/processes/999999', 403, { method: 'DELETE' });

    await expectStatus('/api/tasks', 403, {
      method: 'POST',
      body: JSON.stringify({
        name: 'read-only command task',
        prompt: 'blocked',
        workingDir: PROJECT_ROOT,
        setupCommands: [],
        verificationCommands: ['pwd'],
        trustMode: 'read-only',
        timeoutMs: 1000,
        rubric: [],
        tags: ['smoke'],
      }),
    });

    const terminalSession = await request('/api/terminal/sessions', {
      method: 'POST',
      body: JSON.stringify({ cwd: PROJECT_ROOT }),
    });
    if (!terminalSession.res.ok || !terminalSession.body?.id) {
      throw new Error(`Failed to create terminal session: ${terminalSession.text}`);
    }

    await expectStatus(`/api/terminal/sessions/${terminalSession.body.id}/run`, 403, {
      method: 'POST',
      body: JSON.stringify({ command: 'pwd', cwd: PROJECT_ROOT }),
    });

    console.log('Tool boundary smoke passed.');
  } finally {
    await updateTrustMode(originalTrustMode);
  }
}

main().catch((err) => {
  console.error(`Tool boundary smoke failed: ${err.message}`);
  process.exit(1);
});
