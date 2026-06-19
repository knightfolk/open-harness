import { createSession, runCommand, cleanTerminalOutput, type TerminalCommandEntry } from '../server/terminalSessions';
import { buildShellInvocation } from '../server/shell';
import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function waitForEntry(entry: TerminalCommandEntry): Promise<TerminalCommandEntry> {
  const deadline = Date.now() + 5_000;
  while (entry.status === 'running' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert(entry.status !== 'running', `command did not finish: ${entry.command}`);
  return entry;
}

assert(cleanTerminalOutput(`^D${String.fromCharCode(8)}${String.fromCharCode(8)}hello`) === 'hello', 'script startup artifact should be stripped');
assert(cleanTerminalOutput(`${String.fromCharCode(8)}${String.fromCharCode(8)}hello`) === 'hello', 'leading backspaces should be stripped');
assert(cleanTerminalOutput('^', { final: false }) === '', 'partial script artifact should not stream');
assert(cleanTerminalOutput('^') === '^', 'literal caret output should be preserved at completion');
assert(
  JSON.stringify(buildShellInvocation('echo ok', { platform: 'win32' }).args) === JSON.stringify(['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', 'echo ok']),
  'Windows command runner should use PowerShell noninteractive flags',
);
assert(
  buildShellInvocation('echo ok', { platform: 'win32' }).args.includes('-lc') === false,
  'Windows command runner must not use POSIX -lc',
);
assert(
  buildShellInvocation('Write-Output "path with spaces"', { platform: 'win32' }).args.at(-1) === 'Write-Output "path with spaces"',
  'Windows command runner should preserve the full command string as one PowerShell argument',
);
assert(
  buildShellInvocation('echo ok', { platform: 'win32', env: { OPENHARNESS_WINDOWS_SHELL: 'pwsh.exe' } }).command === 'pwsh.exe',
  'Windows command runner should allow an explicit PowerShell-compatible shell override',
);
const shellSource = readFileSync('server/shell.ts', 'utf-8');
assert(
  /taskkill\.exe/.test(shellSource) && /'\/t'/.test(shellSource) && /'\/f'/.test(shellSource),
  'Windows process cancellation should terminate the child process tree with taskkill /t /f',
);

const session = createSession(process.cwd());
const chunks: string[] = [];
const echoEntry = runCommand({
  sessionId: session.id,
  command: 'printf hello',
  timeout: 2_000,
  onChunk: (chunk) => chunks.push(chunk),
});
await waitForEntry(echoEntry);
assert(echoEntry.status === 'complete', 'terminal command should complete');
assert(echoEntry.exitCode === 0, 'terminal command should exit zero');
assert(echoEntry.output === 'hello', `terminal output should be clean, got ${JSON.stringify(echoEntry.output)}`);
assert(chunks.join('') === 'hello', `streamed terminal output should be clean, got ${JSON.stringify(chunks.join(''))}`);

const timeoutEntry = runCommand({
  sessionId: session.id,
  command: 'node -e "setTimeout(() => {}, 1000)"',
  timeout: 50,
});
await waitForEntry(timeoutEntry);
assert(timeoutEntry.status === 'cancelled', 'timed out terminal command should stay cancelled');
assert(timeoutEntry.exitCode === 124, `timed out terminal command should preserve exit code 124, got ${timeoutEntry.exitCode}`);

console.log('Terminal session tests passed.');
