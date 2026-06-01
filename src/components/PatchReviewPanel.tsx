import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitPullRequestArrow, RefreshCw, Plus, Check, X, FilePlus, FileX,
  FileEdit, Binary as BinaryIcon, AlertTriangle, Loader, Trash2, Play, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import * as api from '../utils/api';
import type {
  PatchProposal, PatchFile, PatchHunk, PatchFileAction, ApplyPatchProposalResult,
} from '../types';

interface Props {
  workingDir: string | null;
  sessionId: string | null;
  pendingProposalId?: string | null;
  onClearPendingProposal?: (idToClear?: string) => void;
}

type View = 'list' | 'create' | 'detail';

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 0) return 'just now';
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

function statusLabel(status: PatchProposal['status']): string {
  return status;
}

function fileActionIcon(action: PatchFileAction) {
  switch (action) {
    case 'create': return FilePlus;
    case 'delete': return FileX;
    case 'rename': return FileEdit;
    default: return FileEdit;
  }
}

function fileActionColor(action: PatchFileAction): string {
  switch (action) {
    case 'create': return 'var(--accent-success)';
    case 'delete': return 'var(--accent-error)';
    case 'rename': return 'var(--accent-warning, #f59e0b)';
    default: return 'var(--accent-primary)';
  }
}

function proposalFileCount(p: PatchProposal): number {
  return p.files?.length ?? 0;
}

function proposalHunkCount(p: PatchProposal): number {
  return p.files?.reduce((sum, f) => sum + (f.hunks?.length ?? 0), 0) ?? 0;
}

function proposalAcceptedHunkCount(p: PatchProposal): number {
  return p.files?.reduce(
    (sum, f) => sum + (f.hunks?.filter((h) => h.status === 'accepted').length ?? 0),
    0,
  ) ?? 0;
}

function basename(p: string): string {
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] || p;
}

export function PatchReviewPanel({ workingDir, sessionId, pendingProposalId, onClearPendingProposal }: Props) {
  const [proposals, setProposals] = useState<PatchProposal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyPatchProposalResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listPatchProposals(
        sessionId ? { sessionId } : {},
      );
      setProposals(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load patch proposals');
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { refresh(); }, [refresh]);

  // When a new proposal was just created elsewhere (DiffViewer / chat
  // diff block / next-best action), refresh and auto-select it.
  // We capture the id locally so a stale effect can't clear a newer
  // signal that the parent has since set.
  useEffect(() => {
    if (!pendingProposalId) return;
    const myId = pendingProposalId;
    let cancelled = false;
    (async () => {
      try {
        await refresh();
        if (cancelled) return;
        // The proposal was just created on this same server, so a single
        // fetch is enough — no polling.
        const found = await api.getPatchProposal(myId);
        if (cancelled) return;
        if (found) {
          setProposals((prev) => {
            const list = prev ?? [];
            const without = list.filter((x) => x.id !== found.id);
            return [found, ...without];
          });
        }
        setSelectedId(myId);
        setView('detail');
        setApplyResult(null);
        setApplyError(null);
      } catch {
        // Swallow; the list will still reflect the new proposal on next
        // manual refresh. Don't try to clear the parent signal here
        // either, for the same race-avoidance reason.
      } finally {
        if (!cancelled) onClearPendingProposal?.(myId);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProposalId]);

  const selected: PatchProposal | null = useMemo(() => {
    if (!selectedId || !proposals) return null;
    return proposals.find((p) => p.id === selectedId) ?? null;
  }, [proposals, selectedId]);

  const openDetail = useCallback((p: PatchProposal) => {
    setSelectedId(p.id);
    setView('detail');
    setActionError(null);
    setApplyResult(null);
    setApplyError(null);
  }, []);

  const openCreate = useCallback(() => {
    setView('create');
    setActionError(null);
    setApplyResult(null);
    setApplyError(null);
  }, []);

  const backToList = useCallback(() => {
    setView('list');
    setSelectedId(null);
    setActionError(null);
    setApplyResult(null);
    setApplyError(null);
  }, []);

  const updateProposal = useCallback((p: PatchProposal | null) => {
    if (!p) {
      setProposals((prev) => (prev ?? []).filter((x) => x.id !== selectedId));
      setSelectedId(null);
      setView('list');
      return;
    }
    setProposals((prev) => (prev ?? []).map((x) => (x.id === p.id ? p : x)));
  }, [selectedId]);

  const handleAcceptHunk = useCallback(async (fileId: string, hunkId: string) => {
    if (!selected) return;
    setBusyId(`${fileId}:${hunkId}`);
    setActionError(null);
    try {
      const updated = await api.setPatchProposalHunkStatus({
        proposalId: selected.id,
        fileId,
        hunkId,
        status: 'accepted',
      });
      updateProposal(updated);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to accept hunk');
    } finally {
      setBusyId(null);
    }
  }, [selected, updateProposal]);

  const handleRejectHunk = useCallback(async (fileId: string, hunkId: string) => {
    if (!selected) return;
    setBusyId(`${fileId}:${hunkId}`);
    setActionError(null);
    try {
      const updated = await api.setPatchProposalHunkStatus({
        proposalId: selected.id,
        fileId,
        hunkId,
        status: 'rejected',
      });
      updateProposal(updated);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to reject hunk');
    } finally {
      setBusyId(null);
    }
  }, [selected, updateProposal]);

  const handleAcceptAll = useCallback(async () => {
    if (!selected) return;
    setBusyId('accept-all');
    setActionError(null);
    try {
      const updated = await api.acceptAllPatchProposalHunks(selected.id);
      updateProposal(updated);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to accept all hunks');
    } finally {
      setBusyId(null);
    }
  }, [selected, updateProposal]);

  const handleRejectAll = useCallback(async () => {
    if (!selected) return;
    setBusyId('reject-all');
    setActionError(null);
    try {
      const updated = await api.rejectAllPatchProposalHunks(selected.id);
      updateProposal(updated);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to reject all hunks');
    } finally {
      setBusyId(null);
    }
  }, [selected, updateProposal]);

  const handleDiscard = useCallback(async () => {
    if (!selected) return;
    setBusyId('discard');
    setActionError(null);
    try {
      const updated = await api.discardPatchProposal(selected.id);
      updateProposal(updated);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to discard proposal');
    } finally {
      setBusyId(null);
    }
  }, [selected, updateProposal]);

  const handleApply = useCallback(async () => {
    if (!selected) return;
    setBusyId('apply');
    setApplyError(null);
    setApplyResult(null);
    try {
      const result = await api.applyPatchProposal(selected.id);
      setApplyResult(result);
      // Refresh proposal list so status flips to 'applied' / 'failed'.
      refresh();
    } catch (err: any) {
      setApplyError(err?.message || 'Failed to apply proposal');
    } finally {
      setBusyId(null);
    }
  }, [selected, refresh]);

  return (
    <div className="patch-review-root">
      <div className="patch-review-toolbar">
        <div className="patch-review-title">
          <GitPullRequestArrow size={14} style={{ color: 'var(--accent-primary)' }} />
          <span>Patch Review</span>
          {proposals && proposals.length > 0 && (
            <span className="patch-review-count">{proposals.length}</span>
          )}
        </div>
        <div className="patch-review-toolbar-actions">
          {view !== 'list' && (
            <button className="btn btn-ghost btn-small" onClick={backToList}>
              ← List
            </button>
          )}
          <button className="btn btn-ghost btn-small" onClick={refresh} disabled={loading} title="Refresh">
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn-primary btn-small" onClick={openCreate} disabled={!workingDir || !sessionId}>
            <Plus size={12} />
            New
          </button>
        </div>
      </div>

      <div className="patch-review-body">
        <ProposalList
          proposals={proposals}
          loading={loading}
          error={error}
          selectedId={view === 'detail' ? selectedId : null}
          onSelect={openDetail}
          onRefresh={refresh}
        />
        <div className="patch-review-detail">
          {view === 'list' && (
            <div className="empty-state">
              <div className="empty-state-icon">🩹</div>
              <div className="empty-state-text">Select a proposal to inspect, or click New to paste a diff.</div>
            </div>
          )}
          {view === 'create' && (
            <CreateProposalForm
              workingDir={workingDir}
              sessionId={sessionId}
              onCreated={(p) => {
                setProposals((prev) => {
                  const list = prev ?? [];
                  return [p, ...list.filter((x) => x.id !== p.id)];
                });
                setSelectedId(p.id);
                setView('detail');
                setApplyResult(null);
                setApplyError(null);
              }}
              onCancel={backToList}
            />
          )}
          {view === 'detail' && selected && (
            <ProposalDetail
              proposal={selected}
              busyId={busyId}
              actionError={actionError}
              applyResult={applyResult}
              applyError={applyError}
              onAcceptHunk={handleAcceptHunk}
              onRejectHunk={handleRejectHunk}
              onAcceptAll={handleAcceptAll}
              onRejectAll={handleRejectAll}
              onDiscard={handleDiscard}
              onApply={handleApply}
            />
          )}
          {view === 'detail' && !selected && (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <div className="empty-state-text">Proposal not found.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Proposal list (left side)                                         */
/* ------------------------------------------------------------------ */

function ProposalList({
  proposals, loading, error, selectedId, onSelect, onRefresh,
}: {
  proposals: PatchProposal[] | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (p: PatchProposal) => void;
  onRefresh: () => void;
}) {
  if (loading && !proposals) {
    return (
      <div className="patch-review-list">
        <div className="empty-state">
          <div className="empty-state-icon"><Loader size={18} /></div>
          <div className="empty-state-text">Loading proposals…</div>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="patch-review-list">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-text" style={{ color: 'var(--accent-error)' }}>{error}</div>
          <button className="btn btn-secondary btn-small" style={{ marginTop: 8 }} onClick={onRefresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!proposals || proposals.length === 0) {
    return (
      <div className="patch-review-list">
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-text">No patch proposals yet.</div>
          <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>
            Click New to paste a unified diff.
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="patch-review-list">
      {proposals.map((p) => (
        <ProposalListItem
          key={p.id}
          proposal={p}
          selected={p.id === selectedId}
          onClick={() => onSelect(p)}
        />
      ))}
    </div>
  );
}

function ProposalListItem({ proposal: p, selected, onClick }: {
  proposal: PatchProposal;
  selected: boolean;
  onClick: () => void;
}) {
  const fileCount = proposalFileCount(p);
  const hunkCount = proposalHunkCount(p);
  const acceptedCount = proposalAcceptedHunkCount(p);
  return (
    <button
      className={'patch-review-list-item' + (selected ? ' selected' : '')}
      onClick={onClick}
    >
      <div className="patch-review-list-item-row">
        <span className={`patch-status-badge patch-status-${p.status}`}>{statusLabel(p.status)}</span>
        <span className="patch-source-tag">{p.source}</span>
      </div>
      <div className="patch-review-list-item-path" title={p.workingDir}>
        {basename(p.workingDir) || p.workingDir}
      </div>
      <div className="patch-review-list-item-stats">
        <span>{fileCount} {fileCount === 1 ? 'file' : 'files'}</span>
        <span>·</span>
        <span>{hunkCount} {hunkCount === 1 ? 'hunk' : 'hunks'}</span>
        {p.status === 'open' && acceptedCount > 0 && (
          <>
            <span>·</span>
            <span style={{ color: 'var(--accent-success)' }}>{acceptedCount} accepted</span>
          </>
        )}
        <span>·</span>
        <span>{(p.verificationCommands ?? []).length} verif</span>
      </div>
      <div className="patch-review-list-item-time">
        <Clock size={10} style={{ marginRight: 3, verticalAlign: -1 }} />
        {formatRelative(p.updatedAt || p.createdAt)}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Create proposal form                                               */
/* ------------------------------------------------------------------ */

function CreateProposalForm({
  workingDir, sessionId, onCreated, onCancel,
}: {
  workingDir: string | null;
  sessionId: string | null;
  onCreated: (p: PatchProposal) => void;
  onCancel: () => void;
}) {
  const [patchText, setPatchText] = useState('');
  const [wd, setWd] = useState(workingDir ?? '');
  const [explanation, setExplanation] = useState('');
  const [verifyText, setVerifyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setWd(workingDir ?? ''); }, [workingDir]);

  const canSubmit = Boolean(
    !submitting && sessionId && wd.trim() && patchText.trim(),
  );

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const verificationCommands = verifyText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.createPatchProposal({
        patch: patchText,
        workingDir: wd.trim(),
        sessionId: sessionId!,
        source: 'manual',
        explanation: explanation.trim() || undefined,
        verificationCommands: verificationCommands.length ? verificationCommands : undefined,
      });
      onCreated(res.proposal);
    } catch (err: any) {
      setError(err?.message || 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, patchText, wd, sessionId, explanation, verifyText, onCreated]);

  if (!workingDir || !sessionId) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📂</div>
        <div className="empty-state-text">
          {!workingDir
            ? 'Open a folder to create patch proposals.'
            : 'Start a session to create patch proposals.'}
        </div>
        <button className="btn btn-ghost btn-small" style={{ marginTop: 8 }} onClick={onCancel}>
          Back
        </button>
      </div>
    );
  }

  return (
    <form className="patch-create-form" onSubmit={handleSubmit}>
      <div className="patch-create-header">
        <h3>New patch proposal</h3>
        <p className="patch-create-subtitle">Paste a unified diff to create a reviewable proposal.</p>
      </div>

      <label className="patch-create-label">
        <span>Working directory</span>
        <input
          type="text"
          className="patch-create-input"
          value={wd}
          onChange={(e) => setWd(e.target.value)}
          placeholder="/absolute/path/to/project"
          required
        />
      </label>

      <label className="patch-create-label">
        <span>Unified diff</span>
        <textarea
          className="patch-create-textarea"
          value={patchText}
          onChange={(e) => setPatchText(e.target.value)}
          placeholder={'--- a/foo.txt\n+++ b/foo.txt\n@@ -1,1 +1,1 @@\n-old\n+new'}
          rows={10}
          required
        />
      </label>

      <label className="patch-create-label">
        <span>Explanation (optional)</span>
        <input
          type="text"
          className="patch-create-input"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          placeholder="What does this patch do?"
        />
      </label>

      <label className="patch-create-label">
        <span>Verification commands (optional, one per line)</span>
        <textarea
          className="patch-create-textarea"
          value={verifyText}
          onChange={(e) => setVerifyText(e.target.value)}
          placeholder={'npm run lint\ngit diff --stat'}
          rows={3}
        />
      </label>

      {error && (
        <div className="patch-error-banner">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <div className="patch-create-actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-small" disabled={!canSubmit}>
          {submitting ? <><Loader size={12} className="spin" /> Creating…</> : 'Create proposal'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Proposal detail (right side)                                      */
/* ------------------------------------------------------------------ */

function ProposalDetail({
  proposal: p, busyId, actionError, applyResult, applyError,
  onAcceptHunk, onRejectHunk, onAcceptAll, onRejectAll, onDiscard, onApply,
}: {
  proposal: PatchProposal;
  busyId: string | null;
  actionError: string | null;
  applyResult: ApplyPatchProposalResult | null;
  applyError: string | null;
  onAcceptHunk: (fileId: string, hunkId: string) => void;
  onRejectHunk: (fileId: string, hunkId: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onDiscard: () => void;
  onApply: () => void;
}) {
  const isOpen = p.status === 'open';
  const acceptedHunks = proposalAcceptedHunkCount(p);
  const totalHunks = proposalHunkCount(p);
  const canApply = isOpen && acceptedHunks > 0 && busyId !== 'apply';

  return (
    <div className="patch-detail">
      <div className="patch-detail-header">
        <div className="patch-detail-header-row">
          <span className={`patch-status-badge patch-status-${p.status}`}>{p.status}</span>
          <span className="patch-source-tag">{p.source}</span>
          <span className="patch-detail-id" title={p.id}>{p.id.slice(0, 8)}</span>
        </div>
        <div className="patch-detail-header-path" title={p.workingDir}>{p.workingDir}</div>
        {p.explanation && (
          <div className="patch-detail-explanation">{p.explanation}</div>
        )}
        <div className="patch-detail-stats">
          <span>{p.files.length} {p.files.length === 1 ? 'file' : 'files'}</span>
          <span>·</span>
          <span>{totalHunks} {totalHunks === 1 ? 'hunk' : 'hunks'}</span>
          <span>·</span>
          <span>{acceptedHunks} accepted</span>
          <span>·</span>
          <span>{(p.verificationCommands ?? []).length} verif</span>
          <span>·</span>
          <span title={p.updatedAt || p.createdAt}>updated {formatRelative(p.updatedAt || p.createdAt)}</span>
        </div>
      </div>

      <div className="patch-detail-actions">
        <button
          className="btn btn-secondary btn-small"
          onClick={onAcceptAll}
          disabled={!isOpen || busyId === 'accept-all'}
          title="Accept every hunk in this proposal"
        >
          {busyId === 'accept-all' ? <Loader size={12} className="spin" /> : <Check size={12} />}
          Accept all
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={onRejectAll}
          disabled={!isOpen || busyId === 'reject-all'}
          title="Reject every hunk in this proposal"
        >
          {busyId === 'reject-all' ? <Loader size={12} className="spin" /> : <X size={12} />}
          Reject all
        </button>
        <button
          className="btn btn-ghost btn-small"
          onClick={onDiscard}
          disabled={!isOpen || busyId === 'discard'}
          title="Discard this proposal"
        >
          {busyId === 'discard' ? <Loader size={12} className="spin" /> : <Trash2 size={12} />}
          Discard
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-primary btn-small"
          onClick={onApply}
          disabled={!canApply}
          title={acceptedHunks === 0 ? 'Accept at least one hunk to apply.' : 'Apply accepted hunks to disk'}
        >
          {busyId === 'apply' ? <Loader size={12} className="spin" /> : <Play size={12} />}
          Apply
        </button>
      </div>

      {actionError && (
        <div className="patch-error-banner">
          <AlertTriangle size={12} /> {actionError}
        </div>
      )}

      {applyError && (
        <div className="patch-error-banner">
          <AlertTriangle size={12} /> {applyError}
        </div>
      )}

      {applyResult && <ApplyResultView result={applyResult} />}

      <div className="patch-files">
        {p.files.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-text">This proposal has no files.</div>
          </div>
        )}
        {p.files.map((f) => (
          <FileSection
            key={f.id}
            file={f}
            readOnly={!isOpen}
            busyId={busyId}
            onAcceptHunk={(hunkId) => onAcceptHunk(f.id, hunkId)}
            onRejectHunk={(hunkId) => onRejectHunk(f.id, hunkId)}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  One file (header + hunks)                                          */
/* ------------------------------------------------------------------ */

function FileSection({
  file: f, readOnly, busyId, onAcceptHunk, onRejectHunk,
}: {
  file: PatchFile;
  readOnly: boolean;
  busyId: string | null;
  onAcceptHunk: (hunkId: string) => void;
  onRejectHunk: (hunkId: string) => void;
}) {
  const ActionIcon = fileActionIcon(f.action);
  const color = fileActionColor(f.action);
  return (
    <div className="patch-file">
      <div className="patch-file-header">
        <ActionIcon size={13} style={{ color, flexShrink: 0 }} />
        <span className="patch-file-action-badge" style={{ color, borderColor: color }}>{f.action}</span>
        <span className="patch-file-path" title={f.oldPath && f.oldPath !== f.filePath ? `${f.oldPath} → ${f.filePath}` : f.filePath}>
          {f.filePath}
        </span>
        {f.oldPath && f.oldPath !== f.filePath && (
          <span className="patch-file-oldpath">from {f.oldPath}</span>
        )}
        {f.binary && (
          <span className="patch-file-binary-badge" title="Binary file — apply will replace the file in full.">
            <BinaryIcon size={11} /> binary
          </span>
        )}
        <span className={`patch-file-rollup patch-rollup-${f.status}`}>{f.status}</span>
      </div>
      {f.binary ? (
        <div className="patch-binary-note">Binary change — diff body hidden.</div>
      ) : (
        <div className="patch-hunks">
          {f.hunks.length === 0 && (
            <div className="patch-no-hunks">No hunks (file header only).</div>
          )}
          {f.hunks.map((h) => (
            <HunkView
              key={h.id}
              hunk={h}
              readOnly={readOnly}
              busy={busyId === `${f.id}:${h.id}`}
              onAccept={() => onAcceptHunk(h.id)}
              onReject={() => onRejectHunk(h.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hunk view (header + lines + per-hunk accept/reject)                */
/* ------------------------------------------------------------------ */

function HunkView({
  hunk: h, readOnly, busy, onAccept, onReject,
}: {
  hunk: PatchHunk;
  readOnly: boolean;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className={`patch-hunk patch-hunk-${h.status}`}>
      <div className="patch-hunk-header">
        <span className="patch-hunk-heading">{h.header || h.sectionHeading || `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`}</span>
        <span className={`patch-hunk-badge patch-hunk-badge-${h.status}`}>{h.status}</span>
        {!readOnly && (
          <div className="patch-hunk-actions">
            <button
              className="btn btn-ghost btn-small"
              onClick={onAccept}
              disabled={busy || h.status === 'accepted'}
              title="Accept this hunk"
            >
              {busy ? <Loader size={11} className="spin" /> : <Check size={11} />}
            </button>
            <button
              className="btn btn-ghost btn-small"
              onClick={onReject}
              disabled={busy || h.status === 'rejected'}
              title="Reject this hunk"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>
      <div className="patch-hunk-body">
        {h.lines.map((line, i) => (
          <div key={i} className={`diff-line diff-line-${line.kind}`}>
            <span className="diff-line-number">{line.oldLine ?? ''}</span>
            <span className="diff-line-number">{line.newLine ?? ''}</span>
            <span className="diff-line-text">
              {line.kind === 'add' ? '+ ' : line.kind === 'del' ? '- ' : '  '}
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Apply results (rendered exactly as the server returns)             */
/* ------------------------------------------------------------------ */

function ApplyResultView({ result }: { result: ApplyPatchProposalResult }) {
  return (
    <div className="patch-apply-result">
      <div className="patch-apply-result-header">
        {result.validation.length === 0 ? (
          <span className="patch-apply-pill patch-apply-pill-none">
            <AlertTriangle size={12} /> No verification commands
          </span>
        ) : result.validationPassed ? (
          <span className="patch-apply-pill patch-apply-pill-pass">
            <CheckCircle2 size={12} /> Validation passed
          </span>
        ) : (
          <span className="patch-apply-pill patch-apply-pill-fail">
            <XCircle size={12} /> Validation failed
          </span>
        )}
      </div>
      {result.appliedFiles.length > 0 && (
        <div className="patch-apply-section">
          <div className="patch-apply-section-title">
            Applied files ({result.appliedFiles.length})
          </div>
          <ul className="patch-apply-list">
            {result.appliedFiles.map((f) => (
              <li key={f}><Check size={11} style={{ color: 'var(--accent-success)' }} /> {f}</li>
            ))}
          </ul>
        </div>
      )}
      {result.skippedFiles.length > 0 && (
        <div className="patch-apply-section">
          <div className="patch-apply-section-title">
            Skipped files ({result.skippedFiles.length})
          </div>
          <ul className="patch-apply-list">
            {result.skippedFiles.map((f) => (
              <li key={f}><X size={11} style={{ color: 'var(--text-tertiary)' }} /> {f}</li>
            ))}
          </ul>
        </div>
      )}
      {result.errors.length > 0 && (
        <div className="patch-apply-section">
          <div className="patch-apply-section-title">
            Errors ({result.errors.length})
          </div>
          <ul className="patch-apply-list">
            {result.errors.map((e, i) => (
              <li key={i}><AlertTriangle size={11} style={{ color: 'var(--accent-error)' }} /> {e}</li>
            ))}
          </ul>
        </div>
      )}
      {result.validation.length > 0 && (
        <div className="patch-apply-section">
          <div className="patch-apply-section-title">
            Validation ({result.validation.length})
          </div>
          <ul className="patch-apply-list">
            {result.validation.map((v, i) => (
              <li key={i} className="patch-apply-validation">
                {v.passed
                  ? <CheckCircle2 size={11} style={{ color: 'var(--accent-success)' }} />
                  : <XCircle size={11} style={{ color: 'var(--accent-error)' }} />}
                <code>{v.command}</code>
                <span style={{ color: 'var(--text-tertiary)' }}> exit {v.exitCode} · {v.durationMs}ms</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
