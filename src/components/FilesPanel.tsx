import type { FileChange } from '../types';

interface Props {
  fileChanges: FileChange[];
}

export function FilesPanel({ fileChanges }: Props) {
  if (fileChanges.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <div className="empty-state-text">No files changed</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 4px 8px' }}>
        File Changes
      </div>
      {fileChanges.map((fc) => (
        <div key={fc.id} className="file-change-item">
          <span className={`file-change-type ${fc.type}`}>{fc.type}</span>
          <span className="file-change-path">{fc.filePath}</span>
          <span className="file-change-stats">
            {fc.additions > 0 && <span className="file-change-additions">+{fc.additions}</span>}
            {fc.deletions > 0 && <span className="file-change-deletions">-{fc.deletions}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
