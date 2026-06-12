import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const tempHome = mkdtempSync(join(tmpdir(), 'openharness-task-seeding-'));

try {
  const result = spawnSync(process.execPath, [
    '--import',
    'tsx',
    '--eval',
    `
      const tasks = await import('./server/harnessTasks.ts');
      tasks.seedFixtures(process.cwd());
      const first = tasks.listTasks().find((task) => task.name === 'Create standalone 1980s roguelike artifact');
      if (!first) throw new Error('seeded artifact task missing');
      tasks.updateTask(first.id, { timeoutMs: 240000, prompt: 'stale prompt' });
      tasks.seedFixtures(process.cwd());
      const refreshed = tasks.getTask(first.id);
      if (!refreshed) throw new Error('refreshed artifact task missing');
      console.log(JSON.stringify({
        sameId: refreshed.id === first.id,
        timeoutMs: refreshed.timeoutMs,
        prompt: refreshed.prompt,
        verificationCommands: refreshed.verificationCommands,
        rubric: refreshed.rubric,
      }));
    `,
  ], {
    cwd: process.cwd(),
    env: { ...process.env, HOME: tempHome },
    encoding: 'utf8',
    timeout: 30_000,
  });

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  const lastLine = result.stdout.trim().split('\n').at(-1) || '{}';
  const parsed = JSON.parse(lastLine);
  assert.equal(parsed.sameId, true, 'seed refresh should preserve the existing task id');
  assert.equal(parsed.timeoutMs, 360000, 'seed refresh should update changed built-in task metadata');
  assert.match(parsed.prompt, /standalone browser game artifact/i);
  assert.match(parsed.prompt, /no remote\/CDN src or href assets/i);
  assert.match(parsed.prompt, /no data: or blob: payloads/i);
  assert.deepEqual(parsed.verificationCommands, [
    'node scripts/verify-standalone-artifact-fixture.mjs test-fixtures/standalone-artifact-eval',
    'node --import tsx scripts/run-ship-readiness.ts test-fixtures/standalone-artifact-eval',
  ]);
  assert.ok(
    parsed.rubric.some((item: any) => item.id === 'validation-passes' && /ship-readiness/i.test(item.description)),
    'artifact rubric should require ship-readiness proof',
  );
  assert.ok(
    parsed.rubric.some((item: any) => item.id === 'self-contained-assets' && /remote CDN data URI or blob URI/i.test(item.description)),
    'artifact rubric should require self-contained inspectable assets',
  );
} finally {
  rmSync(tempHome, { recursive: true, force: true });
}

console.log('Harness task seeding regression checks passed.');
