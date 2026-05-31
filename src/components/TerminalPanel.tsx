import { useState, useRef, useEffect, useCallback } from 'react';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
  onSendToChat?: (text: string) => void;
}

export function TerminalPanel({ workingDir, onSendToChat }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<api.TerminalCommandInfo[]>([]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState(workingDir || '~');
  const [loading, setLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create terminal session on mount or dir change
  useEffect(() => {
    if (workingDir) setCwd(workingDir);
  }, [workingDir]);

  useEffect(() => {
    (async () => {
      try {
        const session = await api.createTerminalSession(cwd);
        setSessionId(session.id);
      } catch {
        // fallback — use the legacy exec endpoint
      }
    })();
  }, [cwd]);

  // Poll for running command updates
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      try {
        const entries = await api.getTerminalHistory(sessionId);
        setHistory(entries);
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const runCommand = useCallback(async () => {
    const cmd = input.trim();
    if (!cmd || !sessionId || loading) return;

    setInput('');
    setLoading(true);
    setCommandHistory(prev => [cmd, ...prev.slice(0, 99)]);
    setHistoryIndex(-1);

    try {
      const entry = await api.runTerminalCommand(sessionId, cmd, cwd);
      setHistory(prev => [...prev, entry]);

      // If it was a cd command, update cwd
      if (cmd.startsWith('cd ')) {
        const target = cmd.slice(3).trim();
        const newCwd = target.startsWith('/') ? target : `${cwd}/${target}`.replace(/\/+/g, '/');
        setCwd(newCwd);
      }
    } catch {
      // Fallback: use legacy exec
      try {
        const result = await api.execCommand(cmd, cwd);
        setHistory(prev => [...prev, {
          id: `legacy-${Date.now()}`,
          sessionId: sessionId || 'legacy',
          command: cmd,
          cwd,
          status: result.exitCode === 0 ? 'complete' : 'error',
          exitCode: result.exitCode,
          output: result.output,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: result.duration,
        }]);
      } catch { /* give up */ }
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, sessionId, loading, cwd]);

  const handleCancel = useCallback(async (commandId: string) => {
    try {
      await api.cancelTerminalCommand(commandId);
      // Refresh history
      if (sessionId) {
        const entries = await api.getTerminalHistory(sessionId);
        setHistory(entries);
      }
    } catch { /* ignore */ }
  }, [sessionId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(newIndex);
      if (commandHistory[newIndex]) setInput(commandHistory[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      setInput(newIndex >= 0 && commandHistory[newIndex] ? commandHistory[newIndex] : '');
    }
  }, [runCommand, historyIndex, commandHistory]);

  const copyOutput = useCallback((output: string) => {
    navigator.clipboard.writeText(output).catch(() => {});
  }, []);

  const runningCmd = history.find(c => c.status === 'running');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-primary)', fontSize: 11,
        color: 'var(--text-tertiary)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: runningCmd ? 'var(--accent-warning)' : 'var(--accent-success)' }} />
        <span>bash</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10, opacity: 0.6 }}>{cwd.replace(/\/Users\/[^/]+/, "~")}</span>
      </div>

      {/* Terminal output */}
      <div style={{
        flex: 1, padding: 10, overflow: 'auto',
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Menlo', monospace",
        fontSize: 12, lineHeight: 1.5,
      }}>
        {history.length === 0 && (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
            Ready. Type a command and press Enter.
          </div>
        )}
        {history.map((cmd) => (
          <div key={cmd.id} style={{ marginBottom: 12 }}>
            <div style={{ color: 'var(--accent-success)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>$</span>
              <span style={{ flex: 1 }}>{cmd.command}</span>
              {cmd.status === 'running' && (
                <button
                  onClick={() => handleCancel(cmd.id)}
                  style={{
                    background: 'var(--accent-error)', color: '#fff', border: 'none',
                    borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
            {cmd.output && (
              <div style={{
                color: cmd.exitCode !== 0 ? 'var(--accent-error)' : 'var(--text-secondary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                position: 'relative',
              }}>
                {cmd.output.length > 10000 ? cmd.output.slice(0, 10000) + '\n... [truncated]' : cmd.output}
                {cmd.output && (
                  <button
                    onClick={() => copyOutput(cmd.output)}
                    title="Copy output"
                    style={{
                      position: 'absolute', top: 0, right: 0,
                      background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
                      borderRadius: 3, padding: '1px 5px', fontSize: 9,
                      cursor: 'pointer', color: 'var(--text-tertiary)', opacity: 0.6,
                    }}
                  >
                    Copy
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{
                fontSize: 10,
                color: cmd.exitCode !== 0 ? 'var(--accent-error)' : 'var(--text-tertiary)',
              }}>
                exit {cmd.exitCode ?? '?'} · {cmd.durationMs != null ? `${(cmd.durationMs / 1000).toFixed(1)}s` : '...'}
              </span>
              {onSendToChat && cmd.output && (
                <button
                  onClick={() => onSendToChat(`Output from \`${cmd.command}\`:\n\`\`\`\n${cmd.output.slice(0, 3000)}\n\`\`\``)}
                  style={{
                    background: 'none', border: '1px solid var(--border-primary)',
                    borderRadius: 3, padding: '0px 5px', fontSize: 9,
                    cursor: 'pointer', color: 'var(--accent-primary)',
                  }}
                >
                  Send to chat
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Command input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-primary)',
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
      }}>
        <span style={{ color: 'var(--accent-success)' }}>$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Run a command..."
          disabled={loading}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 'inherit',
          }}
        />
        {loading && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-warning)', animation: 'pulse 1s infinite' }} />
        )}
      </div>
    </div>
  );
}
