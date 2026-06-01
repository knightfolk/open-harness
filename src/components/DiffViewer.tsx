import { useState, useEffect, useCallback } from 'react';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
  onReviewDiff?: (diffText: string) => void;
  onProposePatch?: (diffText: string, explanation?: string) => void;
  onExplainChange?: (filePath: string) => void;
}

export function DiffViewer({ workingDir, onReviewDiff, onProposePatch, onExplainChange }: Props) {
  const [status, setStatus] = useState<api.GitStatusInfo | null>(null);
  const [diffs, setDiffs] = useState<api.GitDiffInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<api.GitDiffInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staging, setStaging] = useState<string | null>(null);
  const [proposing, setProposing] = useState<string | null>(null);
  const [proposeError, setProposeError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workingDir) return;
    setLoading(true);
    setError(null);
    try {
      const [gitStatus, gitDiffs] = await Promise.all([
        api.getGitStatus(workingDir),
        api.getGitDiff(workingDir),
      ]);
      setStatus(gitStatus);
      setDiffs(gitDiffs);
    } catch (err: any) {
      setError(err.message || 'Failed to load git data');
    } finally {
      setLoading(false);
    }
  }, [workingDir]);

  useEffect(() => { refresh(); }, [refresh]);

  const showFileDiff = useCallback(async (filePath: string) => {
    if (!workingDir) return;
    setSelectedFile(filePath);
    try {
      const diff = await api.getGitFileDiff(workingDir, filePath);
      setFileDiff(diff);
    } catch {
      // Fallback: search in loaded diffs
      const found = diffs.find(d => d.path === filePath);
      setFileDiff(found || null);
    }
  }, [workingDir, diffs]);

  const handleStage = useCallback(async (filePath: string) => {
    if (!workingDir) return;
    setStaging(filePath);
    try {
      await api.gitStage(workingDir, [filePath]);
      await refresh();
    } catch { /* ignore */ }
    setStaging(null);
  }, [workingDir, refresh]);

  const handleUnstage = useCallback(async (filePath: string) => {
    if (!workingDir) return;
    setStaging(filePath);
    try {
      await api.gitUnstage(workingDir, [filePath]);
      await refresh();
    } catch { /* ignore */ }
    setStaging(null);
  }, [workingDir, refresh]);

  const handleProposePatch = useCallback(async (diffText: string, explanation?: string) => {
    if (!onProposePatch) return;
    setProposing(diffText);
    setProposeError(null);
    try {
      await onProposePatch(diffText, explanation);
    } catch (err: any) {
      setProposeError(err?.message || 'Failed to propose patch');
    } finally {
      setProposing(null);
    }
  }, [onProposePatch]);

  const allChanges = [
    ...(status?.staged || []).map(f => ({ ...f, staged: true })),
    ...(status?.unstaged || []).map(f => ({ ...f, staged: false })),
  ];

  const totalAdditions = allChanges.reduce((s, f) => s + f.insertions, 0);
  const totalDeletions = allChanges.reduce((s, f) => s + f.deletions, 0);

  if (!workingDir) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-text">Open a project to see diffs</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          Git Changes
        </span>
        {status && (
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {status.branch} {status.clean && '· clean'}
          </span>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            background: 'none', border: '1px solid var(--border-primary)',
            borderRadius: 4, padding: '2px 8px', fontSize: 10,
            cursor: 'pointer', color: 'var(--text-tertiary)',
          }}
        >
          {loading ? '...' : '↻'}
        </button>
      </div>

      {/* Summary stats */}
      {allChanges.length > 0 && (
        <div style={{
          display: 'flex', gap: 16, padding: '6px 10px',
          borderBottom: '1px solid var(--border-primary)', fontSize: 12,
        }}>
          <span style={{ color: 'var(--accent-success)' }}>+{totalAdditions}</span>
          <span style={{ color: 'var(--accent-error)' }}>-{totalDeletions}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>{allChanges.length} file{allChanges.length === 1 ? '' : 's'}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: 10, color: 'var(--accent-error)', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Split view: file list + diff */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File list */}
        <div style={{
          width: 200, minWidth: 150, borderRight: '1px solid var(--border-primary)',
          overflow: 'auto', background: 'var(--bg-secondary)',
        }}>
          {allChanges.length === 0 && !loading && (
            <div style={{ padding: 10, color: 'var(--text-tertiary)', fontSize: 11 }}>
              No changes
            </div>
          )}
          {allChanges.map((fc) => (
            <div
              key={fc.path}
              onClick={() => showFileDiff(fc.path)}
              style={{
                padding: '5px 8px', cursor: 'pointer', fontSize: 11,
                background: selectedFile === fc.path ? 'var(--bg-tertiary)' : 'transparent',
                borderLeft: fc.staged ? '2px solid var(--accent-success)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 3px', borderRadius: 2,
                background: fc.status === 'added' ? 'rgba(34,197,94,0.15)' :
                  fc.status === 'deleted' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                color: fc.status === 'added' ? 'var(--accent-success)' :
                  fc.status === 'deleted' ? 'var(--accent-error)' : 'var(--accent-primary)',
              }}>
                {fc.status === 'added' ? 'A' : fc.status === 'deleted' ? 'D' : fc.status === 'renamed' ? 'R' : 'M'}
              </span>
              <span style={{
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace",
              }}>
                {fc.path.split('/').pop()}
              </span>
            </div>
          ))}
          {status?.untracked?.map((path) => (
            <div
              key={path}
              style={{
                padding: '5px 8px', fontSize: 11,
                display: 'flex', alignItems: 'center', gap: 4,
                color: 'var(--text-tertiary)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)' }}>?</span>
              {path.split('/').pop()}
            </div>
          ))}
        </div>

        {/* Diff content */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-primary)' }}>
          {!selectedFile && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
              Select a file to see its diff
            </div>
          )}
          {selectedFile && !fileDiff && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
              No diff available for this file
            </div>
          )}
          {fileDiff && (
            <div>
              {/* File header with actions */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-primary)',
                position: 'sticky', top: 0, zIndex: 1,
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  color: 'var(--text-primary)', flex: 1,
                }}>
                  {fileDiff.path}
                </span>
                <span style={{ fontSize: 11 }}>
                  <span style={{ color: 'var(--accent-success)' }}>+{fileDiff.insertions}</span>
                  {' '}
                  <span style={{ color: 'var(--accent-error)' }}>-{fileDiff.deletions}</span>
                </span>
                {status?.unstaged?.some(f => f.path === fileDiff.path) && (
                  <button
                    onClick={() => handleStage(fileDiff.path)}
                    disabled={staging === fileDiff.path}
                    style={{ background: 'var(--accent-success)', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}
                  >
                    {staging === fileDiff.path ? '...' : 'Stage'}
                  </button>
                )}
                {status?.staged?.some(f => f.path === fileDiff.path) && (
                  <button
                    onClick={() => handleUnstage(fileDiff.path)}
                    disabled={staging === fileDiff.path}
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}
                  >
                    {staging === fileDiff.path ? '...' : 'Unstage'}
                  </button>
                )}
                {onReviewDiff && (
                  <button
                    onClick={() => onReviewDiff(fileDiff.diff)}
                    style={{ background: 'none', border: '1px solid var(--border-primary)', borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--accent-primary)' }}
                  >
                    Review
                  </button>
                )}
                {onProposePatch && (
                  <button
                    onClick={() => handleProposePatch(fileDiff.diff)}
                    disabled={proposing === fileDiff.diff || !fileDiff.diff.trim()}
                    title="Create a patch proposal you can review and apply hunks from"
                    style={{ background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: proposing === fileDiff.diff ? 'wait' : 'pointer', opacity: proposing === fileDiff.diff ? 0.6 : 1 }}
                  >
                    {proposing === fileDiff.diff ? '...' : 'Propose patch'}
                  </button>
                )}
                {onExplainChange && (
                  <button
                    onClick={() => onExplainChange(fileDiff.path)}
                    style={{ background: 'none', border: '1px solid var(--border-primary)', borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer', color: 'var(--accent-primary)' }}
                  >
                    Explain
                  </button>
                )}
              </div>

              {/* Diff lines */}
              {proposeError && (
              <div style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.1)', color: 'var(--accent-error)', fontSize: 11, borderBottom: '1px solid var(--border-primary)' }}>
                {proposeError}
              </div>
            )}
            {fileDiff.binary ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                  Binary file
                </div>
              ) : (
                <div style={{
                  padding: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                  lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {fileDiff.diff.split('\n').map((line, i) => {
                    if (line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
                      return <div key={i} style={{ color: 'var(--accent-primary)', opacity: 0.7, fontSize: 11 }}>{line}</div>;
                    }
                    if (line.startsWith('+')) {
                      return <div key={i} style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--accent-success)' }}>{line}</div>;
                    }
                    if (line.startsWith('-')) {
                      return <div key={i} style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--accent-error)' }}>{line}</div>;
                    }
                    return <div key={i} style={{ color: 'var(--text-tertiary)' }}>{line}</div>;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
