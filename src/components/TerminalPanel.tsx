import type { TerminalCommand } from '../types';

interface Props {
  commands: TerminalCommand[];
}

export function TerminalPanel({ commands }: Props) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Terminal header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-primary)', fontSize: 11,
        color: 'var(--text-tertiary)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-success)' }} />
        bash — /Users/kevink/Projects/CMDui
      </div>

      {/* Terminal body */}
      <div style={{ flex: 1, padding: 10, overflow: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
        {commands.map((cmd) => (
          <div key={cmd.id} style={{ marginBottom: 12 }}>
            <div style={{ color: 'var(--accent-success)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>$</span>
              {cmd.command}
            </div>
            <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {cmd.output}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }} className={cmd.exitCode !== 0 ? 'error' : ''}>
              exit {cmd.exitCode} · {(cmd.duration / 1000).toFixed(1)}s
            </div>
          </div>
        ))}

        {/* Prompt line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-success)' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>$</span>
          <span style={{ color: 'var(--text-tertiary)' }}>_</span>
        </div>
      </div>
    </div>
  );
}
