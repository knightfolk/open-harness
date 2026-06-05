import { execFileSync } from 'child_process';



export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  clean: boolean;
  root: string;
}

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'type-changed';
  staged: boolean;
  insertions: number;
  deletions: number;
}

export interface GitDiffResult {
  path: string;
  oldPath?: string;
  status: string;
  insertions: number;
  deletions: number;
  diff: string;
  binary: boolean;
}

function runGit(args: string[], cwd: string): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 15000,
    }).trim();
  } catch (err: any) {
    throw new Error(`git ${args[0]} failed: ${err.message?.split('\n')?.[0] || err.message}`);
  }
}

function getGitRoot(dir: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function parseStatusShort(code: string): GitFileChange['status'] {
  const map: Record<string, GitFileChange['status']> = {
    'A': 'added', 'M': 'modified', 'D': 'deleted',
    'R': 'renamed', 'C': 'copied', 'T': 'type-changed',
    '?': 'modified', // untracked — treat as modified for diff purposes
  };
  // Use the index (staged) letter or work-tree letter
  const idx = code[0]?.trim();
  const wt = code[1]?.trim();
  return map[idx || wt] || 'modified';
}

export function getStatus(dir: string): GitStatus {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');

  const branchRaw = runGit(['symbolic-ref', '--short', 'HEAD'], root).trim();
  const branch = branchRaw || 'HEAD';

  let ahead = 0;
  let behind = 0;
  try {
    const trackRaw = runGit(['rev-list', '--left-right', '--count', '@{upstream}...HEAD'], root);
    const parts = trackRaw.split(/\s+/);
    behind = parseInt(parts[0] || '0', 10);
    ahead = parseInt(parts[1] || '0', 10);
  } catch { /* no upstream */ }

  const statusRaw = runGit(['status', '--porcelain=v1', '--no-renames'], root);
  const staged: GitFileChange[] = [];
  const unstaged: GitFileChange[] = [];
  const untracked: string[] = [];

  if (statusRaw) {
    for (const line of statusRaw.split('\n')) {
      if (!line.trim()) continue;
      const xy = line.slice(0, 2);
      const filePath = line.slice(3);
      const statusCode = parseStatusShort(xy);
      const isStaged = xy[0] !== ' ' && xy[0] !== '?';

      if (xy === '??') {
        untracked.push(filePath);
        continue;
      }

      const entry: GitFileChange = {
        path: filePath,
        status: statusCode,
        staged: isStaged,
        insertions: 0,
        deletions: 0,
      };

      if (isStaged) staged.push(entry);
      else unstaged.push(entry);
    }
  }

  // Get insertions/deletions from numstat for staged
  try {
    const numstat = runGit(['diff', '--numstat', '--cached'], root);
    for (const line of numstat.split('\n')) {
      if (!line.trim()) continue;
      const [ins, del, path] = line.split('\t');
      const entry = staged.find(e => e.path === path);
      if (entry) {
        entry.insertions = ins === '-' ? 0 : parseInt(ins || '0', 10);
        entry.deletions = del === '-' ? 0 : parseInt(del || '0', 10);
      }
    }
  } catch { /* ignore */ }

  // Get insertions/deletions for unstaged
  try {
    const numstat = runGit(['diff', '--numstat'], root);
    for (const line of numstat.split('\n')) {
      if (!line.trim()) continue;
      const [ins, del, path] = line.split('\t');
      const entry = unstaged.find(e => e.path === path);
      if (entry) {
        entry.insertions = ins === '-' ? 0 : parseInt(ins || '0', 10);
        entry.deletions = del === '-' ? 0 : parseInt(del || '0', 10);
      }
    }
  } catch { /* ignore */ }

  return {
    branch,
    ahead,
    behind,
    staged,
    unstaged,
    untracked,
    clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
    root,
  };
}

export function getDiff(dir: string, options?: { cached?: boolean; path?: string }): GitDiffResult[] {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');

  const args = ['diff'];
  if (options?.cached) args.push('--cached');
  if (options?.path) args.push('--', options.path);

  const diffRaw = runGit(args, root);
  if (!diffRaw) return [];

  return parseUnifiedDiff(diffRaw);
}

export function getFileDiff(dir: string, filePath: string): GitDiffResult | null {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');

  // Try cached first, then unstaged
  try {
    const cachedDiff = runGit(['diff', '--cached', '--', filePath], root);
    if (cachedDiff) {
      const results = parseUnifiedDiff(cachedDiff);
      if (results.length > 0) return { ...results[0], path: filePath };
    }
  } catch { /* no cached diff */ }

  try {
    const unstagedDiff = runGit(['diff', '--', filePath], root);
    if (unstagedDiff) {
      const results = parseUnifiedDiff(unstagedDiff);
      if (results.length > 0) return { ...results[0], path: filePath };
    }
  } catch { /* no unstaged diff */ }

  // Maybe it's a new file
  try {
    const fullDiff = runGit(['diff', 'HEAD', '--', filePath], root);
    if (fullDiff) {
      const results = parseUnifiedDiff(fullDiff);
      if (results.length > 0) return { ...results[0], path: filePath };
    }
  } catch { /* not tracked */ }

  return null;
}

function parseUnifiedDiff(diffText: string): GitDiffResult[] {
  const results: GitDiffResult[] = [];
  const files = diffText.split(/(?=^diff --git )/m);

  for (const fileBlock of files) {
    if (!fileBlock.startsWith('diff ')) continue;

    const pathMatch = fileBlock.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const oldPath = pathMatch?.[1];
    const newPath = pathMatch?.[2];
    const path = newPath || oldPath || 'unknown';

    // Detect binary
    const binary = fileBlock.includes('Binary files') || fileBlock.includes('-binary');

    // Count insertions/deletions
    const lines = fileBlock.split('\n');
    let insertions = 0;
    let deletions = 0;
    let status = 'modified';

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) insertions++;
      else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }

    if (fileBlock.includes('new file mode')) status = 'added';
    else if (fileBlock.includes('deleted file mode')) status = 'deleted';
    else if (fileBlock.includes('rename from')) status = 'renamed';

    results.push({
      path,
      oldPath: oldPath !== newPath ? oldPath : undefined,
      status,
      insertions,
      deletions,
      diff: fileBlock,
      binary,
    });
  }

  return results;
}

export function stageFiles(dir: string, paths: string[]): void {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');

  for (const p of paths) {
    runGit(['add', '--', p], root);
  }
}

export function stageAll(dir: string): void {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');
  runGit(['add', '-A'], root);
}

export function unstageFiles(dir: string, paths: string[]): void {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');
  for (const p of paths) {
    runGit(['reset', 'HEAD', '--', p], root);
  }
}

export function commit(dir: string, message: string): { hash: string } {
  const root = getGitRoot(dir);
  if (!root) throw new Error('Not a git repository');

  const hash = runGit(['commit', '-m', message], root);
  const match = hash.match(/\[[\w-]+ ([a-f0-9]+)\]/);
  return { hash: match?.[1] || 'unknown' };
}

export function getLog(dir: string, count = 20): Array<{ hash: string; message: string; author: string; date: string }> {
  const root = getGitRoot(dir);
  if (!root) return [];

  try {
    const logRaw = runGit([
      'log', `--max-count=${count}`, '--pretty=format:%h|%s|%an|%ci',
    ], root);

    return logRaw.split('\n').filter(Boolean).map(line => {
      const [hash, message, author, date] = line.split('|');
      return { hash: hash || '', message: message || '', author: author || '', date: date || '' };
    });
  } catch {
    return [];
  }
}
