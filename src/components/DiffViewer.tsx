import type { FileChange } from '../types';

interface Props {
  fileChanges: FileChange[];
}

export function DiffViewer({ fileChanges }: Props) {
  if (fileChanges.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-text">No file changes yet</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
        Changes ({fileChanges.length} files)
      </div>

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12 }}>
        <span style={{ color: 'var(--accent-success)' }}>+{fileChanges.reduce((s, f) => s + f.additions, 0)} additions</span>
        <span style={{ color: 'var(--accent-error)' }}>-{fileChanges.reduce((s, f) => s + f.deletions, 0)} deletions</span>
      </div>

      {fileChanges.map((fc) => (
        <div key={fc.id} style={{ marginBottom: 16 }}>
          {/* File header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
            border: '1px solid var(--border-primary)',
            borderBottom: 'none',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
          }}>
            <span className={`file-change-type ${fc.type}`}>{fc.type}</span>
            <span style={{ color: 'var(--text-primary)', flex: 1 }}>{fc.filePath}</span>
            <span className="file-change-stats">
              {fc.additions > 0 && <span className="file-change-additions">+{fc.additions}</span>}
              {fc.deletions > 0 && <span className="file-change-deletions">-{fc.deletions}</span>}
            </span>
          </div>

          {/* Diff content (simulated) */}
          <div style={{
            background: 'var(--code-bg)', border: '1px solid var(--border-primary)',
            borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
            padding: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            maxHeight: 200, overflowY: 'auto',
          }}>
            {fc.type === 'add' && (
              <div className="diff-line added"><span className="diff-line-number">1</span><span className="diff-line-number">1</span> + new file</div>
            )}
            {fc.type === 'delete' && (
              <div className="diff-line removed"><span className="diff-line-number">1</span><span className="diff-line-number"> </span> - removed file</div>
            )}
            {fc.type === 'modify' && generateMockDiff()}
          </div>
        </div>
      ))}
    </div>
  );
}

function generateMockDiff() {
  const lines = [
    { type: 'context', text: '// existing code...' },
    { type: 'removed', text: '- const old = fetchData();' },
    { type: 'added', text: '+ const data = await fetchData();' },
    { type: 'added', text: '+ const processed = transform(data);' },
    { type: 'context', text: '// ...' },
  ];
  return lines.map((line, i) => (
    <div key={i} className={`diff-line ${line.type}`}>
      <span className="diff-line-number">{i + 1}</span>
      <span className="diff-line-number">{i + 1}</span>
      {' '}{line.text}
    </div>
  ));
}
