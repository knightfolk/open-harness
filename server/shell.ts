import { existsSync } from 'fs';
import { spawn, type ChildProcess } from 'child_process';

const FALLBACK_SHELLS = ['/bin/bash', '/usr/bin/bash', '/bin/sh', '/usr/bin/sh'];

interface SpawnShellCommandOptions {
  interactive?: boolean;
  env?: NodeJS.ProcessEnv;
}

interface ShellInvocation {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export function resolveShell(): string {
  if (process.platform === 'win32') return process.env.OPENHARNESS_WINDOWS_SHELL || 'powershell.exe';
  const configured = process.env.SHELL?.trim();
  if (configured && existsSync(configured)) return configured;

  return FALLBACK_SHELLS.find((shell) => existsSync(shell)) || 'sh';
}

export function buildShellInvocation(command: string, opts?: SpawnShellCommandOptions & { platform?: NodeJS.Platform }): ShellInvocation {
  const platform = opts?.platform || process.platform;
  const env = { ...process.env, ...(opts?.env || {}) };
  if (platform === 'win32') {
    return {
      command: env.OPENHARNESS_WINDOWS_SHELL || 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      env,
    };
  }

  const shell = resolveShell();
  return {
    command: shell,
    args: ['-lc', command],
    env,
  };
}

export function spawnShellCommand(command: string, cwd: string, opts?: SpawnShellCommandOptions): ChildProcess {
  const invocation = buildShellInvocation(command, opts);

  if (opts?.interactive && process.platform !== 'win32' && existsSync('/usr/bin/script')) {
    const shell = invocation.command;
    const args = process.platform === 'darwin' || process.platform === 'freebsd'
      ? ['-q', '/dev/null', shell, '-lc', command]
      : ['-q', '-c', command, '/dev/null'];

    return spawn('/usr/bin/script', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...invocation.env,
        SHELL: shell,
        TERM: invocation.env.TERM && invocation.env.TERM !== 'dumb' ? invocation.env.TERM : 'xterm-256color',
      },
    });
  }

  return spawn(invocation.command, invocation.args, { cwd, env: invocation.env });
}

export function terminateProcessTree(child: ChildProcess, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.on('error', () => child.kill(signal));
    killer.unref();
    return;
  }
  child.kill(signal);
}
