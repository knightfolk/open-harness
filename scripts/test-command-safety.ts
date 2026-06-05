import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { createBranch, gitCommit } from '../server/commitMessage';
import { checkServerHealth } from '../server/browserPreview';
import { stageFiles } from '../server/git';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const root = mkdtempSync(join(tmpdir(), 'openharness-command-safety-'));

try {
  execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'openharness@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'OpenHarness Test'], { cwd: root });

  const sentinel = join(root, 'SHELL_INJECTION_SENTINEL');
  const trickyFile = 'safe;touch SHELL_INJECTION_SENTINEL.txt';
  writeFileSync(join(root, trickyFile), 'plain file with shell metacharacters\n', 'utf-8');
  stageFiles(root, [trickyFile]);
  assert(!existsSync(sentinel), 'stageFiles executed shell metacharacters from a file path');

  const commit = gitCommit(root, 'test: commit tricky path\n', [trickyFile]);
  assert(commit.ok, `gitCommit should handle shell metacharacters as a file path: ${commit.error || 'unknown error'}`);
  assert(!existsSync(sentinel), 'gitCommit executed shell metacharacters from a file path');

  const branch = createBranch(root, 'unsafe;touch-branch');
  assert(!branch.ok, 'createBranch should reject shell metacharacters in branch names');
  assert(!existsSync(sentinel), 'createBranch executed shell metacharacters from a branch name');

  const browserSentinel = join(root, 'BROWSER_INJECTION_SENTINEL');
  const health = checkServerHealth(`localhost:9/;touch ${browserSentinel}`);
  assert(!health.reachable, 'malformed local health URL unexpectedly reported reachable');
  assert(!existsSync(browserSentinel), 'checkServerHealth executed shell metacharacters from a URL');

  console.log('Command safety tests passed.');
} finally {
  rmSync(root, { recursive: true, force: true });
}
