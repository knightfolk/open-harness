// ── Types ──────────────────────────────────────────────

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  appendFileSync,
  statSync,
  openSync,
  closeSync,
  readSync,
} from 'fs';
import { execSync as _execSync } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';
import { spawn, ChildProcess, execSync } from 'child_process';
import { v4 as uuid } from 'uuid';

export type ProcessKind =
  | 'server'
  | 'electron'
  | 'vite'
  | 'terminal'
  | 'browser'
  | 'worktree-cmd'
  | 'agent'
  | 'other';

export interface OwnedProcess {
  pid: number;
  id: string;
  kind: ProcessKind;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  parentPid?: number;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  status: 'running' | 'exited' | 'killed' | 'failed';
  logFile: string;
  notes?: string;
}

export interface LogTail {
  pid: number;
  logFile: string;
  exists: boolean;
  sizeBytes: number;
  tail: string;
}

const ROOT = join(homedir(), '.open-harness', 'process-ledger');
const LOGS_DIR = join(ROOT, 'logs');
const LEDGER_PATH = join(ROOT, 'ledger.json');

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

ensureDir(ROOT);
ensureDir(LOGS_DIR);

let ledger: OwnedProcess[] = [];
let loaded = false;

function loadLedger(): void {
  if (loaded) return;
  if (existsSync(LEDGER_PATH)) {
    try {
      ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf-8')) as OwnedProcess[];
    } catch {
      ledger = [];
    }
  } else {
    ledger = [];
  }
  loaded = true;
}

function persistLedger(): void {
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf-8');
}

// ── Registration ──────────────────────────────────────

export interface RegisterOptions {
  kind: ProcessKind;
  name: string;
  command: string;
  args?: string[];
  cwd?: string;
  notes?: string;
  /** When true, an existing log file is appended to instead of truncated. */
  appendLog?: boolean;
}

export function registerProcess(child: ChildProcess, opts: RegisterOptions): OwnedProcess {
  loadLedger();
  const id = uuid();
  const logFile = join(LOGS_DIR, `${opts.kind}-${id}.log`);
  const fd = openSync(logFile, opts.appendLog ? 'a' : 'w');
  closeSync(fd);

  const entry: OwnedProcess = {
    pid: child.pid ?? -1,
    id,
    kind: opts.kind,
    name: opts.name,
    command: opts.command,
    args: opts.args || [],
    cwd: opts.cwd,
    parentPid: process.pid,
    startedAt: new Date().toISOString(),
    status: 'running',
    logFile,
    notes: opts.notes,
  };

  ledger.push(entry);
  persistLedger();

  // Pipe child stdio to the log file
  if (child.stdout) {
    child.stdout.on('data', (chunk: Buffer) => {
      try { appendFileSync(logFile, chunk); } catch { /* ignore */ }
    });
  }
  if (child.stderr) {
    child.stderr.on('data', (chunk: Buffer) => {
      try { appendFileSync(logFile, chunk); } catch { /* ignore */ }
    });
  }

  child.on('exit', (code) => {
    entry.exitedAt = new Date().toISOString();
    entry.exitCode = code;
    entry.status = code === 0 ? 'exited' : (code === null ? 'killed' : 'failed');
    persistLedger();
  });

  child.on('error', (err) => {
    entry.exitedAt = new Date().toISOString();
    entry.exitCode = -1;
    entry.status = 'failed';
    entry.notes = `${entry.notes ? entry.notes + '\n' : ''}${err.message}`;
    persistLedger();
  });

  return entry;
}

/** Register an already-running process (e.g. the server itself, vite) so the user can see and kill it. */
export function registerExternal(opts: RegisterOptions & { pid: number; status?: OwnedProcess['status'] }): OwnedProcess {
  loadLedger();
  const id = uuid();
  const logFile = join(LOGS_DIR, `${opts.kind}-${id}.log`);
  const fd = openSync(logFile, 'w');
  closeSync(fd);

  const entry: OwnedProcess = {
    pid: opts.pid,
    id,
    kind: opts.kind,
    name: opts.name,
    command: opts.command,
    args: opts.args || [],
    cwd: opts.cwd,
    parentPid: process.pid,
    startedAt: new Date().toISOString(),
    status: opts.status || 'running',
    logFile,
    notes: opts.notes,
  };
  ledger.push(entry);
  persistLedger();
  return entry;
}

// ── Listing ───────────────────────────────────────────

/**
 * Mark processes whose PID is no longer alive as exited. This catches zombie
 * entries from server restarts where the previous PID is gone but the ledger
 * was not cleaned up before this run.
 */
export function reconcileLedger(): { cleaned: number } {
  loadLedger();
  let cleaned = 0;
  for (const entry of ledger) {
    if (entry.status !== 'running') continue;
    if (entry.pid <= 0) continue;
    let alive = false;
    try { _execSync(`kill -0 ${entry.pid} 2>/dev/null`, { stdio: 'ignore' }); alive = true; } catch { /* dead */ }
    if (!alive) {
      entry.status = 'exited';
      entry.exitedAt = entry.exitedAt || new Date().toISOString();
      entry.exitCode = entry.exitCode ?? null;
      cleaned++;
    }
  }
  if (cleaned > 0) persistLedger();
  return { cleaned };
}

export function listProcesses(opts: { includeExited?: boolean; kind?: ProcessKind } = {}): OwnedProcess[] {
  loadLedger();
  reconcileLedger();
  let result = [...ledger];
  if (opts.kind) result = result.filter(p => p.kind === opts.kind);
  if (!opts.includeExited) {
    result = result.filter(p => p.status === 'running');
  }
  return result.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getProcess(pid: number): OwnedProcess | null {
  loadLedger();
  return ledger.find(p => p.pid === pid) || null;
}

export function getProcessById(id: string): OwnedProcess | null {
  loadLedger();
  return ledger.find(p => p.id === id) || null;
}

function updateEntry(pid: number, mutator: (entry: OwnedProcess) => void): OwnedProcess | null {
  loadLedger();
  const entry = ledger.find(p => p.pid === pid);
  if (!entry) return null;
  mutator(entry);
  persistLedger();
  return entry;
}

// ── Kill / cleanup ────────────────────────────────────

function isAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err.code === 'EPERM';
  }
}

export function killProcess(pid: number, opts: { signal?: NodeJS.Signals; timeoutMs?: number } = {}): boolean {
  loadLedger();
  const entry = ledger.find(p => p.pid === pid);
  if (!entry) return false;
  if (entry.status !== 'running') return false;

  const signal = opts.signal || 'SIGTERM';
  const timeoutMs = opts.timeoutMs || 5000;

  try {
    if (isAlive(pid)) {
      try { process.kill(pid, signal); } catch { /* may already be dead */ }
    }
  } catch { /* ignore */ }

  // Wait briefly for graceful exit, then SIGKILL
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isAlive(pid)) break;
    // Spin briefly — keeps code simple without async
    const waitUntil = Date.now() + 50;
    while (Date.now() < waitUntil) { /* noop */ }
  }
  if (isAlive(pid)) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
  }

  // Reap zombies
  try {
    if (isAlive(pid)) execSync(`kill -9 ${pid} 2>/dev/null || true`, { stdio: 'ignore' });
  } catch { /* ignore */ }

  updateEntry(pid, (e) => {
    e.status = 'killed';
    e.exitedAt = new Date().toISOString();
    e.exitCode = -1;
  });
  return true;
}

export function killAll(opts: { kinds?: ProcessKind[] } = {}): { killed: number[]; skipped: number[] } {
  loadLedger();
  const running = ledger.filter(p => p.status === 'running');
  const killed: number[] = [];
  const skipped: number[] = [];
  for (const entry of running) {
    if (opts.kinds && !opts.kinds.includes(entry.kind)) {
      skipped.push(entry.pid);
      continue;
    }
    if (entry.pid === process.pid) {
      // Refuse to kill ourselves
      skipped.push(entry.pid);
      continue;
    }
    if (killProcess(entry.pid)) killed.push(entry.pid);
    else skipped.push(entry.pid);
  }
  return { killed, skipped };
}

/** Walk up the process tree of a pid (best-effort on macOS/Linux via ps). */
export function getProcessTree(pid: number): Array<{ pid: number; ppid: number; command: string }> {
  try {
    const raw = execSync(`ps -axo pid=,ppid=,comm= -p ${pid}`, { encoding: 'utf-8' });
    return raw
      .trim()
      .split('\n')
      .map(line => {
        const [p, pp, ...rest] = line.trim().split(/\s+/);
        return { pid: parseInt(p, 10), ppid: parseInt(pp, 10), command: rest.join(' ') };
      });
  } catch {
    return [];
  }
}

/** Kill any existing ledger entry for the same (kind, name) before launching a new one. */
export function killExistingByName(name: string, kind?: ProcessKind): number {
  loadLedger();
  const matching = ledger.filter(
    p => p.name === name && p.status === 'running' && (kind ? p.kind === kind : true),
  );
  let count = 0;
  for (const entry of matching) {
    if (killProcess(entry.pid)) count++;
  }
  return count;
}

// ── Logs ──────────────────────────────────────────────

const TAIL_BYTES = 32 * 1024;

export function tailLog(pid: number, maxBytes: number = TAIL_BYTES): LogTail | null {
  loadLedger();
  const entry = ledger.find(p => p.pid === pid);
  if (!entry) return null;

  if (!existsSync(entry.logFile)) {
    return { pid, logFile: entry.logFile, exists: false, sizeBytes: 0, tail: '' };
  }
  const stat = statSync(entry.logFile);
  const sizeBytes = stat.size;
  const start = Math.max(0, sizeBytes - maxBytes);
  const fd = openSync(entry.logFile, 'r');
  try {
    const length = sizeBytes - start;
    const buf = Buffer.alloc(length);
    if (start > 0) {
      // Skip the first `start` bytes
      const skip = start;
      const chunkSize = 64 * 1024;
      let remaining = skip;
      let offset = 0;
      while (remaining > 0) {
        const read = readSync(fd, buf, 0, Math.min(chunkSize, remaining), offset);
        if (read <= 0) break;
        remaining -= read;
        offset += read;
      }
    }
    const tailBuf = Buffer.alloc(length);
    readSync(fd, tailBuf, 0, length, start);
    return {
      pid,
      logFile: entry.logFile,
      exists: true,
      sizeBytes,
      tail: tailBuf.toString('utf-8'),
    };
  } finally {
    closeSync(fd);
  }
}

export function clearLog(pid: number): boolean {
  loadLedger();
  const entry = ledger.find(p => p.pid === pid);
  if (!entry) return false;
  try {
    writeFileSync(entry.logFile, '', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function deleteLog(pid: number): boolean {
  loadLedger();
  const entry = ledger.find(p => p.pid === pid);
  if (!entry) return false;
  try {
    if (existsSync(entry.logFile)) unlinkSync(entry.logFile);
    return true;
  } catch {
    return false;
  }
}

// ── Spawn helper (for routes that want ledger-tracked processes) ─────

export interface SpawnTrackedOptions {
  kind: ProcessKind;
  name: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  notes?: string;
  /** When true, log file is appended to; when false (default), it is truncated on launch. */
  appendLog?: boolean;
}

export function spawnTracked(command: string, args: string[], opts: SpawnTrackedOptions): {
  child: ChildProcess;
  entry: OwnedProcess;
} {
  const child = spawn(command, args, {
    cwd: opts.cwd,
    env: opts.env || process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const entry = registerProcess(child, {
    kind: opts.kind,
    name: opts.name,
    command,
    args,
    cwd: opts.cwd,
    notes: opts.notes,
    appendLog: opts.appendLog,
  });
  return { child, entry };
}

// ── Persistence helpers ──────────────────────────────

export function pruneExited(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): number {
  loadLedger();
  const cutoff = Date.now() - olderThanMs;
  const before = ledger.length;
  ledger = ledger.filter(p => {
    if (p.status === 'running') return true;
    const exitedAt = p.exitedAt ? new Date(p.exitedAt).getTime() : 0;
    return exitedAt > cutoff;
  });
  persistLedger();
  return before - ledger.length;
}

export const PROCESS_LEDGER_CONSTANTS = {
  ROOT,
  LOGS_DIR,
  LEDGER_PATH,
  TAIL_BYTES,
};
