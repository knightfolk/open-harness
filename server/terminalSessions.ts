import { ChildProcess } from 'child_process';
import { v4 as uuid } from 'uuid';
import { redactSecrets } from './sectionRedaction';
import { spawnShellCommand, terminateProcessTree } from './shell';

export interface TerminalSession {
  id: string;
  cwd: string;
  createdAt: string;
}

export interface TerminalCommandEntry {
  id: string;
  sessionId: string;
  command: string;
  cwd: string;
  status: 'running' | 'complete' | 'error' | 'cancelled';
  exitCode: number | null;
  output: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

interface ActiveProcess {
  child: ChildProcess;
  entry: TerminalCommandEntry;
  output: string;
  startTime: number;
}

const sessions = new Map<string, TerminalSession>();
const history = new Map<string, TerminalCommandEntry[]>();
const activeProcesses = new Map<string, ActiveProcess>();

const OUTPUT_LIMIT = 512 * 1024;
const BACKSPACE = String.fromCharCode(8);

export function cleanTerminalOutput(text: string, opts?: { final?: boolean }): string {
  let cleaned = text;
  const artifacts = [`^D${BACKSPACE}${BACKSPACE}`, `^D${BACKSPACE}`, '^D'];
  if (opts?.final === false && artifacts.some((artifact) => artifact.startsWith(cleaned))) {
    return '';
  }
  for (const artifact of artifacts) {
    while (cleaned.startsWith(artifact)) cleaned = cleaned.slice(artifact.length);
  }
  while (cleaned.startsWith(BACKSPACE)) cleaned = cleaned.slice(1);
  return cleaned;
}

export function createSession(cwd: string): TerminalSession {
  const session: TerminalSession = {
    id: uuid(),
    cwd,
    createdAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  history.set(session.id, []);
  return session;
}

export function getSession(id: string): TerminalSession | undefined {
  return sessions.get(id);
}

export function getHistory(sessionId: string): TerminalCommandEntry[] {
  return history.get(sessionId) || [];
}

export function getEntry(commandId: string): TerminalCommandEntry | undefined {
  for (const entries of history.values()) {
    const found = entries.find(e => e.id === commandId);
    if (found) return found;
  }
  return undefined;
}

export interface RunOptions {
  sessionId: string;
  command: string;
  cwd?: string;
  timeout?: number;
  onChunk?: (chunk: string) => void;
}

export function runCommand(opts: RunOptions): TerminalCommandEntry {
  const session = sessions.get(opts.sessionId);
  const cwd = opts.cwd || session?.cwd || process.cwd();
  const timeout = opts.timeout || 60_000;

  const entry: TerminalCommandEntry = {
    id: uuid(),
    sessionId: opts.sessionId,
    command: redactSecrets(opts.command).redacted,
    cwd,
    status: 'running',
    exitCode: null,
    output: '',
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null,
  };

  const entries = history.get(opts.sessionId);
  if (entries) entries.push(entry);

  const child = spawnShellCommand(opts.command, cwd, { interactive: true });
  let output = '';
  let streamedLength = 0;
  const startTime = Date.now();

  const append = (chunk: Buffer) => {
    if (output.length < OUTPUT_LIMIT) {
      output += chunk.toString().slice(0, OUTPUT_LIMIT - output.length);
      const cleanedOutput = cleanTerminalOutput(output, { final: false });
      const redacted = redactSecrets(cleanedOutput).redacted;
      entry.output = redacted;
      const delta = cleanedOutput.slice(streamedLength);
      streamedLength = cleanedOutput.length;
      if (delta) opts.onChunk?.(redactSecrets(delta).redacted);
    }
  };

  child.stdout?.on('data', append);
  child.stderr?.on('data', append);

  activeProcesses.set(entry.id, { child, entry, output, startTime });

  const timer = setTimeout(() => {
    terminateProcessTree(child, 'SIGTERM');
    entry.status = 'cancelled';
    entry.exitCode = 124;
    entry.completedAt = new Date().toISOString();
    entry.durationMs = Date.now() - startTime;
    activeProcesses.delete(entry.id);
  }, timeout);

  child.on('error', (err) => {
    clearTimeout(timer);
    entry.status = 'error';
    entry.exitCode = 1;
    entry.output = redactSecrets(entry.output + '\n' + err.message).redacted;
    entry.completedAt = new Date().toISOString();
    entry.durationMs = Date.now() - startTime;
    activeProcesses.delete(entry.id);
  });

  child.on('close', (code) => {
    clearTimeout(timer);
    if (entry.status === 'running') {
      entry.status = code === 0 ? 'complete' : 'error';
      entry.exitCode = code ?? 0;
    }
    entry.output = redactSecrets(cleanTerminalOutput(output)).redacted;
    entry.completedAt = new Date().toISOString();
    entry.durationMs = Date.now() - startTime;
    activeProcesses.delete(entry.id);
  });

  return entry;
}

export function cancelCommand(commandId: string): boolean {
  const active = activeProcesses.get(commandId);
  if (!active) return false;
  terminateProcessTree(active.child, 'SIGTERM');
  active.entry.status = 'cancelled';
  active.entry.exitCode = 130;
  active.entry.completedAt = new Date().toISOString();
  active.entry.durationMs = Date.now() - active.startTime;
  activeProcesses.delete(commandId);
  return true;
}

export function isRunning(commandId: string): boolean {
  return activeProcesses.has(commandId);
}

const defaultSession = createSession(process.cwd());
export const DEFAULT_SESSION_ID = defaultSession.id;
