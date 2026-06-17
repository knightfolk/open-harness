import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  GitBranch,
  Lock,
  Cpu,
  RotateCcw,
  Plus,
  Trash2,
  Play,
  Eye,
  EyeOff,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Server,
} from 'lucide-react';
import * as api from '../utils/api';
import type {
  Checkpoint,
  Worktree,
  OwnedProcess,
  LogTail,
  SecretFinding,
  ProtectedPathRule,
} from '../utils/api';
import { ProjectMemoryPanel } from './ProjectMemoryPanel';

interface Props {
  workingDir: string | null;
}
type Tab = 'checkpoints' | 'worktrees' | 'secrets' | 'processes' | 'memory';

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: 'checkpoints', label: 'Checkpoints', icon: Shield },
  { id: 'worktrees', label: 'Worktrees', icon: GitBranch },
  { id: 'secrets', label: 'Secrets & Paths', icon: Lock },
  { id: 'processes', label: 'Processes', icon: Cpu },
  { id: 'memory', label: 'Memory', icon: FileText },
];

export function SafetyPanel({ workingDir }: Props) {
  const [tab, setTab] = useState<Tab>('checkpoints');
  const dir = workingDir || '';

  if (!dir) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🛡️</div>
        <div className="empty-state-text">Open a project folder to use Safety tools</div>
      </div>
    );
  }

  return (
    <div className="safety-panel">
      <div className="safety-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`safety-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
            type="button"
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <div className="safety-tab-content">
        {tab === 'processes' && <ProcessesTab />}
        {tab === 'memory' && <ProjectMemoryPanel workingDir={dir} />}
        {tab === 'checkpoints' && <CheckpointsTab dir={dir} />}
        {tab === 'worktrees' && <WorktreesTab dir={dir} />}
        {tab === 'secrets' && <SecretsTab />}
        {tab === 'processes' && <ProcessesTab />}
      </div>
    </div>
  );
}

// ── Checkpoints ─────────────────────────────────────

function CheckpointsTab({ dir }: { dir: string }) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listCheckpoints(dir);
      setCheckpoints(list);
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    }
  }, [dir]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const cp = await api.createCheckpoint(dir, label || undefined);
      setMessage({ kind: 'ok', text: `Snapshot saved: ${cp.label}` });
      setLabel('');
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const restore = async (id: string, mode: 'reset' | 'apply') => {
    setMessage(null);
    if (mode === 'reset' && !confirm('Reset tracked files to checkpoint HEAD? Untracked files that were too large will NOT be restored.')) {
      return;
    }
    try {
      const res = await api.restoreCheckpoint(dir, id, mode);
      const summary = [
        res.changed ? `${res.applied.length} file(s) updated` : 'no changes',
        res.warnings.length ? `⚠️ ${res.warnings.length} warning(s)` : null,
      ].filter(Boolean).join(' — ');
      setMessage({ kind: res.ok ? 'ok' : 'error', text: summary });
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this checkpoint?')) return;
    try {
      await api.deleteCheckpoint(dir, id);
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    }
  };

  return (
    <div className="safety-section">
      <div className="safety-section-header">
        <div>
          <h3>Checkpoints</h3>
          <p>Snapshot the dirty working tree, then roll back if a run goes sideways.</p>
        </div>
        <button className="btn btn-secondary btn-small" onClick={refresh} title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="safety-create-row">
        <input
          className="safety-input"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn btn-primary btn-small" onClick={create} disabled={loading}>
          <Plus size={12} /> Snapshot now
        </button>
      </div>

      {message && (
        <div className={`safety-banner ${message.kind}`}>
          {message.kind === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {message.text}
        </div>
      )}

      {checkpoints.length === 0 ? (
        <div className="safety-empty">No checkpoints yet. Take one before risky runs.</div>
      ) : (
        <ul className="safety-list">
          {checkpoints.map((cp) => {
            const isOpen = expanded === cp.id;
            return (
              <li key={cp.id} className={`safety-item ${cp.status === 'restored' ? 'restored' : ''}`}>
                <div className="safety-item-row">
                  <button
                    className="safety-item-toggle"
                    onClick={() => setExpanded(isOpen ? null : cp.id)}
                    title="Toggle files"
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <div className="safety-item-main">
                    <div className="safety-item-title">{cp.label}</div>
                    <div className="safety-item-meta">
                      {new Date(cp.createdAt).toLocaleString()} · {cp.branch} @ {cp.head.slice(0, 7)} ·
                      {' '}{cp.files.length} file(s)
                      {cp.untrackedTooLarge.length > 0 && (
                        <span className="safety-warn"> · ⚠️ {cp.untrackedTooLarge.length} large untracked</span>
                      )}
                    </div>
                  </div>
                  <div className="safety-item-actions">
                    <button className="btn btn-secondary btn-small" onClick={() => restore(cp.id, 'reset')} title="Reset tracked files to checkpoint HEAD">
                      <RotateCcw size={12} /> Restore
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => restore(cp.id, 'apply')} title="Re-apply the saved diff on top of current HEAD">
                      <Play size={12} /> Re-apply
                    </button>
                    <button className="btn btn-ghost btn-small" onClick={() => remove(cp.id)} title="Delete checkpoint">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="safety-item-detail">
                    {cp.untrackedTooLarge.length > 0 && (
                      <div className="safety-warn-block">
                        Large untracked files were not embedded and cannot be restored automatically:
                        <ul>
                          {cp.untrackedTooLarge.map((p) => <li key={p}><code>{p}</code></li>)}
                        </ul>
                      </div>
                    )}
                    <ul className="safety-file-list">
                      {cp.files.map((f) => (
                        <li key={f.path}>
                          <span className={`safety-tag tag-${f.kind}`}>{f.kind}</span>
                          <span className={`safety-tag status-${f.status}`}>{f.status}</span>
                          <code>{f.path}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Worktrees ───────────────────────────────────────

function WorktreesTab({ dir }: { dir: string }) {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setWorktrees(await api.listWorktrees(dir));
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    }
  }, [dir]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const wt = await api.createWorktree(dir, { label: label || undefined });
      setMessage({ kind: 'ok', text: `Worktree created on ${wt.branch}` });
      setLabel('');
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const promote = async (id: string) => {
    setMessage(null);
    try {
      const res = await api.promoteWorktree(dir, id);
      setMessage({
        kind: res.ok ? 'ok' : 'error',
        text: res.ok
          ? `Promoted to ${res.targetBranch}: ${res.applied.join(', ') || 'merge complete'}`
          : `Promote failed: ${res.warnings.concat(res.failed).join('; ')}`,
      });
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    }
  };

  const validate = async (id: string) => {
    setMessage(null);
    setValidatingId(id);
    try {
      const res = await api.validateWorktree(dir, id);
      setMessage({
        kind: res.passed ? 'ok' : 'error',
        text: `${res.passed ? 'Validation passed' : 'Validation failed'} in worktree: ${res.results.map((result) => `${result.command} (${result.exitCode})`).join(', ')}`,
      });
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setValidatingId(null);
    }
  };

  const remove = async (id: string, force: boolean) => {
    if (!confirm(force ? 'Force-remove this worktree (loses uncommitted changes)?' : 'Remove this worktree?')) return;
    try {
      await api.deleteWorktree(dir, id, force);
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    }
  };

  const autoClean = async () => {
    try {
      const res = await api.autoCleanWorktrees(dir);
      setMessage({ kind: 'ok', text: `Auto-clean: removed ${res.removed.length}, kept ${res.kept.length}` });
      await refresh();
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message });
    }
  };

  const showDiff = async (id: string) => {
    setExpanded(expanded === id ? null : id);
    if (expanded !== id) {
      try {
        const d = await api.getWorktreeDiff(dir, id);
        setMessage({ kind: 'ok', text: `${d.commitCount} commit(s) ahead of ${d.baseRef}, ${d.files.length} file(s) changed` });
      } catch (err: any) {
        setMessage({ kind: 'error', text: err.message });
      }
    }
  };

  return (
    <div className="safety-section">
      <div className="safety-section-header">
        <div>
          <h3>Sandboxed Worktrees</h3>
          <p>Run risky work in a git worktree. Validate, promote, or discard isolated changes from here.</p>
        </div>
        <div className="safety-section-actions">
          <button className="btn btn-ghost btn-small" onClick={autoClean} title="Auto-remove clean worktrees (keeps the most recent)">
            <Trash2 size={12} /> Auto-clean
          </button>
          <button className="btn btn-secondary btn-small" onClick={refresh} title="Refresh">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div className="safety-create-row">
        <input
          className="safety-input"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn btn-primary btn-small" onClick={create} disabled={loading}>
          <Plus size={12} /> New worktree
        </button>
      </div>

      {message && (
        <div className={`safety-banner ${message.kind}`}>
          {message.kind === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {message.text}
        </div>
      )}

      {worktrees.length === 0 ? (
        <div className="safety-empty">No worktrees. Create one to sandbox a high-risk run.</div>
      ) : (
        <ul className="safety-list">
          {worktrees.map((wt) => {
            const shortId = wt.id.slice(0, 8);
            const worktreeLabel = wt.label || wt.branch;
            return (
            <li key={wt.id} className={`safety-item ${wt.status !== 'active' ? 'restored' : ''}`}>
              <div className="safety-item-row">
                <div className="safety-item-main">
                  <div className="safety-item-title">
                    <GitBranch size={12} /> {worktreeLabel}
                  </div>
                  <div className="safety-item-meta">
                    id: <code title={wt.id}>{shortId}</code> · {new Date(wt.createdAt).toLocaleString()} · base: {wt.baseRef} ·
                    {' '}<span className={wt.clean ? 'safety-ok' : 'safety-warn'}>{wt.clean ? 'clean' : 'dirty'}</span>
                    {wt.lastError && <span className="safety-warn"> · {wt.lastError}</span>}
                  </div>
                </div>
                <div className="safety-item-actions">
                  <button className="btn btn-ghost btn-small" onClick={() => showDiff(wt.id)} title="Show diff vs base" aria-label={`Show diff for isolated worktree ${shortId}: ${worktreeLabel}`}>
                    {expanded === wt.id ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button className="btn btn-ghost btn-small" onClick={() => validate(wt.id)} disabled={validatingId === wt.id} title="Run project validation commands inside this isolated worktree" aria-label={`Validate isolated worktree ${shortId}: ${worktreeLabel}`}>
                    {validatingId === wt.id ? <RefreshCw size={12} className="spin" /> : <CheckCircle2 size={12} />}
                    Validate
                  </button>
                  <button className="btn btn-secondary btn-small" onClick={() => promote(wt.id)} title="Merge worktree branch into its base" aria-label={`Promote isolated worktree ${shortId}: ${worktreeLabel}`}>
                    <Play size={12} /> Promote
                  </button>
                  <button className="btn btn-ghost btn-small" onClick={() => remove(wt.id, !wt.clean)} title={wt.clean ? 'Discard isolated worktree' : 'Force-discard isolated worktree with uncommitted changes'} aria-label={`${wt.clean ? 'Discard' : 'Force-discard'} isolated worktree ${shortId}: ${worktreeLabel}`}>
                    <Trash2 size={12} />
                    Discard
                  </button>
                </div>
              </div>
              {expanded === wt.id && (
                <div className="safety-item-detail">
                  <code className="safety-path">{wt.path}</code>
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Secrets & Protected Paths ───────────────────────

function SecretsTab() {
  const [rules, setRules] = useState<ProtectedPathRule[]>([]);
  const [path, setPath] = useState('.env');
  const [pathResult, setPathResult] = useState<{ protected: boolean; rule?: ProtectedPathRule; reason?: string } | null>(null);
  const [text, setText] = useState('');
  const [scanResult, setScanResult] = useState<{ hasSecrets: boolean; findings: SecretFinding[]; redactedText: string } | null>(null);
  const [showRedacted, setShowRedacted] = useState(false);

  useEffect(() => {
    api.listProtectedRules().then(setRules).catch(() => setRules([]));
  }, []);

  const checkPath = async () => {
    try { setPathResult(await api.checkPathProtected(path)); }
    catch { setPathResult(null); }
  };

  const scan = async () => {
    if (!text) { setScanResult(null); return; }
    try { setScanResult(await api.scanSecrets(text)); }
    catch { setScanResult(null); }
  };

  return (
    <div className="safety-section">
      <div className="safety-section-header">
        <div>
          <h3>Secrets & Protected Paths</h3>
          <p>Check whether a path or string contains credentials before you commit, share, or export.</p>
        </div>
      </div>

      <div className="safety-block">
        <h4>Path check</h4>
        <div className="safety-create-row">
          <input
            className="safety-input"
            placeholder="e.g. .env, id_rsa, src/App.tsx"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkPath()}
          />
          <button className="btn btn-primary btn-small" onClick={checkPath}>
            <Lock size={12} /> Check
          </button>
        </div>
        {pathResult && (
          <div className={`safety-banner ${pathResult.protected ? (pathResult.rule?.severity === 'block' ? 'error' : 'warn') : 'ok'}`}>
            {pathResult.protected
              ? <><AlertTriangle size={14} /> <strong>Protected ({pathResult.rule?.category})</strong> — {pathResult.reason}</>
              : <><CheckCircle2 size={14} /> Not protected — safe to write</>}
          </div>
        )}
      </div>

      <div className="safety-block">
        <h4>Secret scan</h4>
        <textarea
          className="safety-textarea"
          placeholder="Paste a diff, log, or any text to scan for API keys, tokens, passwords, etc."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
        />
        <div className="safety-create-row">
          <button className="btn btn-primary btn-small" onClick={scan}>
            <Lock size={12} /> Scan
          </button>
          {scanResult && (
            <button className="btn btn-ghost btn-small" onClick={() => setShowRedacted(s => !s)}>
              {showRedacted ? <EyeOff size={12} /> : <Eye size={12} />} {showRedacted ? 'Original' : 'Redacted'}
            </button>
          )}
        </div>
        {scanResult && (
          <>
            <div className={`safety-banner ${scanResult.hasSecrets ? 'error' : 'ok'}`}>
              {scanResult.hasSecrets
                ? <><AlertTriangle size={14} /> Found {scanResult.findings.length} secret(s)</>
                : <><CheckCircle2 size={14} /> No secrets detected</>}
            </div>
            {scanResult.findings.length > 0 && (
              <ul className="safety-findings">
                {scanResult.findings.map((f, i) => (
                  <li key={i}>
                    <span className="safety-tag">{f.kind}</span>
                    <code>{f.redacted}</code>
                    <span className="safety-finding-pos">@{f.start}-{f.end}</span>
                  </li>
                ))}
              </ul>
            )}
            {showRedacted && (
              <pre className="safety-redacted">{scanResult.redactedText}</pre>
            )}
          </>
        )}
      </div>

      <div className="safety-block">
        <h4>Default protected-path rules ({rules.length})</h4>
        <details className="safety-rules">
          <summary>Show all rules</summary>
          <ul className="safety-rule-list">
            {rules.map((r, i) => (
              <li key={i}>
                <span className={`safety-tag severity-${r.severity}`}>{r.severity}</span>
                <span className="safety-tag">{r.category}</span>
                <code>{r.pattern}</code>
                <span className="safety-rule-reason">{r.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

// ── Process Ledger ──────────────────────────────────

function ProcessesTab() {
  const [procs, setProcs] = useState<OwnedProcess[]>([]);
  const [includeExited, setIncludeExited] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [log, setLog] = useState<Record<number, LogTail>>({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(async () => {
    try { setProcs(await api.listProcesses(includeExited)); }
    catch (err: any) { setMessage({ kind: 'error', text: err.message }); }
  }, [includeExited]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh, autoRefresh]);

  const kill = async (pid: number) => {
    if (!confirm(`Kill process ${pid}?`)) return;
    try { await api.killProcess(pid); setMessage({ kind: 'ok', text: `Killed ${pid}` }); await refresh(); }
    catch (err: any) { setMessage({ kind: 'error', text: err.message }); }
  };

  const killAll = async () => {
    if (!confirm('Kill all non-server running processes? Server is protected.')) return;
    try {
      const res = await api.killAllProcesses();
      setMessage({ kind: 'ok', text: `Killed ${res.killed.length}, skipped ${res.skipped.length}` });
      await refresh();
    } catch (err: any) { setMessage({ kind: 'error', text: err.message }); }
  };

  const prune = async () => {
    try {
      const res = await api.pruneExitedProcesses();
      setMessage({ kind: 'ok', text: `Pruned ${res.removed} exited process(es)` });
      await refresh();
    } catch (err: any) { setMessage({ kind: 'error', text: err.message }); }
  };

  const showLog = async (pid: number) => {
    if (expanded === pid) { setExpanded(null); return; }
    setExpanded(pid);
    try {
      const tail = await api.getProcessLog(pid);
      setLog(l => ({ ...l, [pid]: tail }));
    } catch {
      setLog(l => ({ ...l, [pid]: { pid, logFile: '', exists: false, sizeBytes: 0, tail: 'failed to read' } }));
    }
  };

  const clearLog = async (pid: number) => {
    try { await api.clearProcessLog(pid); setLog(l => ({ ...l, [pid]: { ...l[pid], sizeBytes: 0, tail: '' } })); }
    catch (err: any) { setMessage({ kind: 'error', text: err.message }); }
  };

  const byKind = procs.reduce((acc: Record<string, number>, p) => {
    acc[p.kind] = (acc[p.kind] || 0) + 1; return acc;
  }, {});

  return (
    <div className="safety-section">
      <div className="safety-section-header">
        <div>
          <h3>Process Ledger</h3>
          <p>Server-owned processes with logs and kill controls.</p>
        </div>
        <div className="safety-section-actions">
          <label className="safety-toggle">
            <input type="checkbox" checked={includeExited} onChange={(e) => setIncludeExited(e.target.checked)} />
            Show exited
          </label>
          <label className="safety-toggle">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          <button className="btn btn-ghost btn-small" onClick={prune} title="Remove old exited entries">
            <Trash2 size={12} /> Prune
          </button>
          <button className="btn btn-ghost btn-small" onClick={killAll} title="Kill all non-server processes">
            <X size={12} /> Kill non-server
          </button>
        </div>
      </div>

      <div className="safety-kinds">
        {Object.entries(byKind).map(([kind, n]) => (
          <span key={kind} className="safety-kind-pill">
            <Server size={10} /> {kind}: {n}
          </span>
        ))}
        {Object.keys(byKind).length === 0 && <span className="safety-empty">No processes in ledger.</span>}
      </div>

      {message && (
        <div className={`safety-banner ${message.kind}`}>
          {message.kind === 'ok' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {message.text}
        </div>
      )}

      <ul className="safety-list">
        {procs.map((p) => (
          <li key={p.pid} className={`safety-item proc-${p.status}`}>
            <div className="safety-item-row">
              <div className="safety-item-main">
                <div className="safety-item-title">
                  <Cpu size={12} /> {p.name}
                  <span className="safety-pid">PID {p.pid}</span>
                  <span className={`safety-tag status-${p.status}`}>{p.status}</span>
                  <span className="safety-tag">{p.kind}</span>
                </div>
                <div className="safety-item-meta">
                  {new Date(p.startedAt).toLocaleString()} · <code>{p.command}</code>
                  {p.cwd && <> · cwd: <code>{p.cwd}</code></>}
                  {p.exitCode !== undefined && p.exitCode !== null && <> · exit: {p.exitCode}</>}
                </div>
                {p.notes && <div className="safety-item-notes">{p.notes}</div>}
              </div>
              <div className="safety-item-actions">
                <button className="btn btn-ghost btn-small" onClick={() => showLog(p.pid)} title="Toggle log">
                  {expanded === p.pid ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
                {p.status === 'running' && (
                  <button className="btn btn-ghost btn-small" onClick={() => kill(p.pid)} title="Kill">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
            {expanded === p.pid && (
              <div className="safety-item-detail">
                <div className="safety-log-header">
                  <code className="safety-path">{log[p.pid]?.logFile}</code>
                  <span className="safety-tag">{(log[p.pid]?.sizeBytes || 0).toLocaleString()} bytes</span>
                  <button className="btn btn-ghost btn-small" onClick={() => clearLog(p.pid)}>
                    <Trash2 size={12} /> Clear log
                  </button>
                  <button className="btn btn-ghost btn-small" onClick={() => showLog(p.pid)}>
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>
                <pre className="safety-log">
                  {log[p.pid]?.tail || '(no log)'}
                </pre>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
