import { useState, useEffect, useCallback } from 'react';
import { X, GitPullRequestArrow, CheckCircle2, GitCommit, FileText, Layers, Shield, ChevronRight, RefreshCw, Copy, Download } from 'lucide-react';
import * as api from '../utils/api';
import { PatchReviewPanel } from './PatchReviewPanel';

/* ── Types ─────────────────────────────────── */
type Tab = 'summary' | 'files' | 'patches' | 'validate' | 'commit';

interface TodoStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ValidationRun {
  command: string;
  status: 'running' | 'passed' | 'failed';
  output: string;
  exitCode?: number;
  duration?: number;
}

interface Props {
  workingDir: string | null;
  _sessionId: string | null;
  onClose: () => void;
  initialTab?: Tab;
  onReviewDiff?: (diffText: string) => void;
  onProposePatch?: (diffText: string, explanation?: string) => void;
  onExplainChange?: (filePath: string) => void;
  onProofArtifactSaved?: (message: api.MessageInfo) => void;
}

/* ── Helpers ─────────────────────────────────── */
function categoryForFile(path: string): string {
  if (path.startsWith('src/')) return 'Source';
  if (path.startsWith('server/')) return 'Server';
  if (path.startsWith('docs/') || path.endsWith('.md')) return 'Docs';
  if (path.startsWith('config/') || path.endsWith('.json') || path.endsWith('.toml') || path.endsWith('.yaml') || path.endsWith('.yml')) return 'Config';
  if (path.startsWith('test/') || path.startsWith('tests/') || path.endsWith('.test.') || path.endsWith('.spec.')) return 'Tests';
  return 'Other';
}

/* ── Spinning / animated circles ─────────────── */
function TodoStepCircle({ status }: { status: TodoStep['status'] }) {
  if (status === 'completed') {
    return (
      <span className="todo-step-circle completed">
        <CheckCircle2 size={14} />
      </span>
    );
  }
  if (status === 'in_progress') {
    return <span className="todo-step-circle in-progress" />;
  }
  return <span className="todo-step-circle pending" />;
}

/* ── Main Component ───────────────────────────── */
export function ReviewChangesFlyout({ workingDir, _sessionId: sessionId, onClose, initialTab, onReviewDiff, onProposePatch, onExplainChange, onProofArtifactSaved }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab || 'summary');
  const [status, setStatus] = useState<api.GitStatusInfo | null>(null);
  const [diffs, setDiffs] = useState<api.GitDiffInfo[]>([]);
  const [projectProfile, setProjectProfile] = useState<api.ProjectProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationRuns, setValidationRuns] = useState<Record<string, ValidationRun>>({});
  const [committed, setCommitted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<api.GitDiffInfo | null>(null);
  const [proposalCount, setProposalCount] = useState(0);
  const [activeProposalCount, setActiveProposalCount] = useState(0);
  const [commitMessage, setCommitMessage] = useState('');
  const [proofCopied, setProofCopied] = useState(false);
  const [proofSaving, setProofSaving] = useState(false);
  const [proofSaved, setProofSaved] = useState(false);
  const [proofSaveError, setProofSaveError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workingDir) return;
    setLoading(true);
    setError(null);
    try {
      const [gitStatus, gitDiffs, profile, proposals] = await Promise.all([
        api.getGitStatus(workingDir),
        api.getGitDiff(workingDir),
        api.getProjectProfile(workingDir).catch(() => null),
        api.listPatchProposals().catch(() => []),
      ]);
      setStatus(gitStatus);
      setDiffs(gitDiffs);
      setProjectProfile(profile);
      const projectProposals = proposals.filter((proposal) => proposal.workingDir === workingDir);
      setProposalCount(projectProposals.length);
      setActiveProposalCount(projectProposals.filter((proposal) => proposal.status === 'open').length);
    } catch (err: any) {
      setError(err.message || 'Failed to load git data');
    } finally {
      setLoading(false);
    }
  }, [workingDir]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setValidationRuns({}); }, [workingDir]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const allChanges = [
    ...(status?.staged || []).map(f => ({ ...f, staged: true })),
    ...(status?.unstaged || []).map(f => ({ ...f, staged: false })),
  ];

  const totalAdditions = allChanges.reduce((s, f) => s + f.insertions, 0);
  const totalDeletions = allChanges.reduce((s, f) => s + f.deletions, 0);

  const filesReviewed = allChanges.length > 0;
  const patchesCreated = proposalCount > 0;
  const commitMade = committed;
  const validationCommands = [
    { id: 'lint', command: projectProfile?.validation.lint || 'npm run lint' },
    { id: 'typecheck', command: projectProfile?.validation.typecheck || 'npx tsc -b --pretty false' },
    { id: 'build', command: projectProfile?.validation.build || 'npm run build' },
  ];
  const validated = validationCommands.length > 0 && validationCommands.every(({ id }) => validationRuns[id]?.status === 'passed');
  const validationFailed = validationCommands.some(({ id }) => validationRuns[id]?.status === 'failed');
  const validationRunning = validationCommands.some(({ id }) => validationRuns[id]?.status === 'running');
  const validationProofRuns = validationCommands
    .map(({ id, command }) => ({ id, command, run: validationRuns[id] }))
    .filter(({ run }) => !!run);
  const validationProofKey = validationProofRuns
    .map(({ id, command, run }) => [
      id,
      command,
      run!.status,
      run!.exitCode ?? '',
      run!.duration ?? '',
      run!.output,
    ].join(':'))
    .join('\n');
  const validationProofText = validationProofRuns.length > 0
    ? [
      `## Validation Proof`,
      ``,
      `Workspace: ${workingDir || 'unknown'}`,
      `Session: ${sessionId || 'none'}`,
      `Captured: ${new Date().toISOString()}`,
      ``,
      ...validationProofRuns.flatMap(({ command, run }) => [
        `- ${command}`,
        `  Status: ${run!.status}${typeof run!.exitCode === 'number' ? ` (exit ${run!.exitCode})` : ''}${typeof run!.duration === 'number' ? `, ${run!.duration}ms` : ''}`,
        run!.output ? `  Output tail:\n${run!.output.slice(-1200).split('\n').map((line) => `    ${line}`).join('\n')}` : '',
      ].filter(Boolean)),
    ].join('\n')
    : '';

  useEffect(() => {
    setProofSaved(false);
    setProofSaveError(null);
  }, [sessionId, validationProofKey, workingDir]);

  // Smart todo steps
  const todoSteps: TodoStep[] = [
    { id: 'review', label: 'Review files', status: filesReviewed ? 'completed' : 'pending' },
    { id: 'patches', label: 'Propose patches', status: patchesCreated ? 'completed' : 'pending' },
    { id: 'validate', label: 'Validate', status: validated ? 'completed' : 'pending' },
    { id: 'commit', label: 'Commit', status: commitMade ? 'completed' : 'pending' },
  ];

  const handleShowFileDiff = useCallback(async (filePath: string) => {
    if (!workingDir) return;
    setSelectedFile(filePath);
    try {
      const diff = await api.getGitFileDiff(workingDir, filePath);
      setFileDiff(diff);
    } catch {
      const found = diffs.find(d => d.path === filePath);
      setFileDiff(found || null);
    }
  }, [workingDir, diffs]);

  const [staging, setStaging] = useState<string | null>(null);

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

  const handleRunValidationCommand = useCallback(async (id: string, command: string) => {
    if (!workingDir) return;
    setError(null);
    setValidationRuns((prev) => ({
      ...prev,
      [id]: { command, status: 'running', output: '' },
    }));
    try {
      const result = await api.execCommand(command, workingDir);
      setValidationRuns((prev) => ({
        ...prev,
        [id]: {
          command,
          status: result.exitCode === 0 ? 'passed' : 'failed',
          output: result.output.trim(),
          exitCode: result.exitCode,
          duration: result.duration,
        },
      }));
    } catch (err: any) {
      const message = err?.message || `Failed to run ${command}`;
      setValidationRuns((prev) => ({
        ...prev,
        [id]: { command, status: 'failed', output: message },
      }));
      setError(message);
    }
  }, [workingDir]);

  const handleCopyValidationProof = useCallback(async () => {
    if (!validationProofText) return;
    await navigator.clipboard.writeText(validationProofText);
    setProofCopied(true);
    window.setTimeout(() => setProofCopied(false), 2000);
  }, [validationProofText]);

  const handleDownloadValidationProof = useCallback(() => {
    if (!validationProofText) return;
    const blob = new Blob([validationProofText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const suffix = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = url;
    anchor.download = `openharness-validation-proof-${suffix}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [validationProofText]);

  const handleSaveValidationProofArtifact = useCallback(async () => {
    if (!sessionId || !validationProofText) return;
    setProofSaving(true);
    setProofSaved(false);
    setProofSaveError(null);
    try {
      const savedMessage = await api.saveValidationProofArtifact(sessionId, {
        workingDir,
        proofText: validationProofText,
        commands: validationProofRuns.map(({ id, command, run }) => ({
          id,
          command,
          status: run!.status,
          exitCode: run!.exitCode,
          duration: run!.duration,
          outputTail: run!.output.slice(-1200),
        })),
      });
      onProofArtifactSaved?.(savedMessage);
      setProofSaved(true);
    } catch (err: any) {
      setProofSaveError(err?.message || 'Failed to save validation proof');
    } finally {
      setProofSaving(false);
    }
  }, [sessionId, validationProofText, workingDir, validationProofRuns, onProofArtifactSaved]);

  // Group changes by category for summary
  const grouped = new Map<string, typeof allChanges>();
  for (const f of allChanges) {
    const cat = categoryForFile(f.path);
    const list = grouped.get(cat) || [];
    list.push(f);
    grouped.set(cat, list);
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'summary', label: 'Summary', icon: <Layers size={14} /> },
    { id: 'files', label: 'Files', icon: <FileText size={14} /> },
    { id: 'patches', label: activeProposalCount > 0 ? `Patches (${activeProposalCount})` : 'Patches', icon: <GitPullRequestArrow size={14} /> },
    { id: 'validate', label: 'Validate', icon: <Shield size={14} /> },
    { id: 'commit', label: 'Commit', icon: <GitCommit size={14} /> },
  ];

  if (!workingDir) {
    return (
      <div className="review-flyout-overlay" onClick={onClose}>
        <div className="review-flyout" role="dialog" aria-modal="true" aria-labelledby="review-changes-title-empty" data-review-changes-surface="diffs-patches-validation-commit" onClick={e => e.stopPropagation()}>
          <div className="review-flyout-header">
            <span className="review-flyout-title" id="review-changes-title-empty">Review Changes</span>
            <button className="review-flyout-close" type="button" onClick={onClose} aria-label="Close review changes"><X size={16} /></button>
          </div>
          <div className="review-flyout-empty">
            Open a project to review changes
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="review-flyout-overlay" onClick={onClose}>
      <div className="review-flyout" role="dialog" aria-modal="true" aria-labelledby="review-changes-title" data-review-changes-surface="diffs-patches-validation-commit" onClick={e => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="review-flyout-header">
          <span className="review-flyout-title" id="review-changes-title">Review Changes</span>
          <div className="review-flyout-stats">
            {status && (
              <>
                <span className="review-flyout-branch">{status.branch}</span>
                {allChanges.length > 0 && (
                  <>
                    <span className="review-flyout-stat added">+{totalAdditions}</span>
                    <span className="review-flyout-stat deleted">-{totalDeletions}</span>
                    <span className="review-flyout-stat muted">{allChanges.length} file{allChanges.length !== 1 ? 's' : ''}</span>
                  </>
                )}
              </>
            )}
          </div>
          <button className="review-flyout-refresh" type="button" onClick={refresh} disabled={loading} title="Refresh" aria-label="Refresh review changes">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button className="review-flyout-close" type="button" onClick={onClose} aria-label="Close review changes"><X size={16} /></button>
        </div>

        {/* ── Smart Todo Tracker ── */}
        <div className="review-flyout-todo">
          {todoSteps.map((step, i) => (
            <div key={step.id} className={`todo-step ${step.status}`}>
              <TodoStepCircle status={step.status} />
              <span className="todo-step-label">{step.label}</span>
              {i < todoSteps.length - 1 && <ChevronRight size={12} className="todo-step-chevron" />}
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="review-flyout-tabs" role="tablist" aria-label="Review changes sections">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`review-changes-tab-${tab.id}`}
              className={`review-flyout-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                const currentIndex = tabs.findIndex((item) => item.id === tab.id);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                if (nextIndex !== currentIndex) {
                  event.preventDefault();
                  const nextTab = tabs[nextIndex];
                  setActiveTab(nextTab.id);
                  document.getElementById(`review-changes-tab-${nextTab.id}`)?.focus();
                }
              }}
              aria-selected={activeTab === tab.id}
              aria-controls={`review-changes-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="review-flyout-body">
          {/* SUMMARY TAB */}
          {activeTab === 'summary' && (
            <div
              className="review-flyout-panel"
              role="tabpanel"
              id="review-changes-panel-summary"
              aria-labelledby="review-changes-tab-summary"
            >
              {loading && <div className="review-flyout-loading">Loading...</div>}
              {error && <div className="review-flyout-error">{error}</div>}
              {!loading && !error && allChanges.length === 0 && (
                <div className="review-flyout-empty">
                  <CheckCircle2 size={24} style={{ opacity: 0.5 }} />
                  <span>No changes — working tree is clean</span>
                </div>
              )}
              {!loading && allChanges.length > 0 && (
                <div className="summary-content">
                  {Array.from(grouped.entries()).map(([category, files]) => (
                    <div key={category} className="summary-group">
                      <div className="summary-group-title">{category}</div>
                      {files.map(f => (
                        <button
                          type="button"
                          key={f.path}
                          className="summary-file-row"
                          onClick={() => { handleShowFileDiff(f.path); setActiveTab('files'); }}
                          aria-label={`Show diff for ${f.path}`}
                        >
                          <span className={`summary-file-status ${f.status}`}>
                            {f.status === 'added' ? 'A' : f.status === 'deleted' ? 'D' : f.status === 'renamed' ? 'R' : 'M'}
                          </span>
                          <span className="summary-file-path">{f.path}</span>
                          <span className="summary-file-stats">
                            <span className="added">+{f.insertions}</span>
                            <span className="deleted">-{f.deletions}</span>
                          </span>
                          <ChevronRight size={12} className="summary-file-arrow" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FILES TAB — inline diff viewer */}
          {activeTab === 'files' && (
            <div
              className="review-flyout-panel files-panel"
              role="tabpanel"
              id="review-changes-panel-files"
              aria-labelledby="review-changes-tab-files"
            >
              {loading && <div className="review-flyout-loading">Loading...</div>}
              {error && <div className="review-flyout-error">{error}</div>}
              {!loading && allChanges.length === 0 && (
                <div className="review-flyout-empty">No file changes</div>
              )}
              {allChanges.length > 0 && (
                <div style={{ display: 'flex', height: '100%' }}>
                  {/* File list sidebar */}
                  <div className="diff-file-list">
                    {allChanges.map(fc => (
                      <button
                        type="button"
                        key={fc.path}
                        className={`diff-file-item ${selectedFile === fc.path ? 'selected' : ''}`}
                        onClick={() => handleShowFileDiff(fc.path)}
                        aria-label={`Show diff for ${fc.path}`}
                        aria-pressed={selectedFile === fc.path}
                      >
                        <span className={`diff-file-badge ${fc.status}`}>
                          {fc.status === 'added' ? 'A' : fc.status === 'deleted' ? 'D' : fc.status === 'renamed' ? 'R' : 'M'}
                        </span>
                        <span className="diff-file-name">{fc.path.split('/').pop()}</span>
                        {fc.staged && <span className="diff-file-staged" title="Staged">●</span>}
                      </button>
                    ))}
                  </div>

                  {/* Diff content */}
                  <div className="diff-content">
                    {!selectedFile && (
                      <div className="review-flyout-empty">Select a file to see its diff</div>
                    )}
                    {selectedFile && fileDiff && (
                      <div className="diff-file-detail">
                        <div className="diff-file-header">
                          <span className="diff-file-path">{fileDiff.path}</span>
                          <span className="diff-file-stats">
                            <span className="added">+{fileDiff.insertions}</span>
                            <span className="deleted">-{fileDiff.deletions}</span>
                          </span>
                          <div className="diff-file-actions">
                            {status?.unstaged?.some(f => f.path === fileDiff.path) && (
                              <button
                                className="diff-action-btn stage-btn"
                                type="button"
                                onClick={() => handleStage(fileDiff.path)}
                                disabled={staging === fileDiff.path}
                                aria-label={`Stage ${fileDiff.path}`}
                              >
                                {staging === fileDiff.path ? '...' : 'Stage'}
                              </button>
                            )}
                            {status?.staged?.some(f => f.path === fileDiff.path) && (
                              <button
                                className="diff-action-btn unstage-btn"
                                type="button"
                                onClick={() => handleUnstage(fileDiff.path)}
                                disabled={staging === fileDiff.path}
                                aria-label={`Unstage ${fileDiff.path}`}
                              >
                                {staging === fileDiff.path ? '...' : 'Unstage'}
                              </button>
                            )}
                            {onReviewDiff && (
                              <button className="diff-action-btn review-btn" type="button" onClick={() => onReviewDiff(fileDiff.diff)} aria-label={`Review ${fileDiff.path}`}>
                                Review
                              </button>
                            )}
                            {onExplainChange && (
                              <button className="diff-action-btn explain-btn" type="button" onClick={() => onExplainChange(fileDiff.path)} aria-label={`Explain ${fileDiff.path}`}>
                                Explain
                              </button>
                            )}
                            {onProposePatch && (
                              <button className="diff-action-btn propose-btn" type="button" onClick={() => onProposePatch(fileDiff.diff, fileDiff.path)} aria-label={`Propose patch for ${fileDiff.path}`}>
                                Propose patch
                              </button>
                            )}
                          </div>
                        </div>
                        {fileDiff.binary ? (
                          <div className="review-flyout-empty">Binary file</div>
                        ) : (
                          <div className="diff-lines">
                            {fileDiff.diff.split('\n').map((line, i) => {
                              if (line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
                                return <div key={i} className="diff-line meta">{line}</div>;
                              }
                              if (line.startsWith('+')) {
                                return <div key={i} className="diff-line added">{line}</div>;
                              }
                              if (line.startsWith('-')) {
                                return <div key={i} className="diff-line removed">{line}</div>;
                              }
                              return <div key={i} className="diff-line context">{line}</div>;
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {selectedFile && !fileDiff && (
                      <div className="review-flyout-empty">
                        Could not load a diff for {selectedFile}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PATCHES TAB */}
          {activeTab === 'patches' && (
            <div
              className="review-flyout-panel"
              role="tabpanel"
              id="review-changes-panel-patches"
              aria-labelledby="review-changes-tab-patches"
            >
              <div className="review-flyout-panel-header">
                <span className="review-flyout-panel-title">Patch Proposals</span>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <PatchReviewPanel workingDir={workingDir} sessionId={sessionId} />
              </div>
            </div>
          )}

          {/* VALIDATE TAB */}
          {activeTab === 'validate' && (
            <div
              className="review-flyout-panel"
              role="tabpanel"
              id="review-changes-panel-validate"
              aria-labelledby="review-changes-tab-validate"
            >
              <div className="review-flyout-panel-header">
                <span className="review-flyout-panel-title">Validation</span>
              </div>
              <div style={{ padding: 16 }}>
                {validationProofRuns.length > 0 && (
                  <div className="validate-proof-card">
                    <div>
                      <div className="validate-proof-title">Validation proof</div>
                      <div className="validate-proof-copy">
                        {validated
                          ? 'All configured validation commands have passed.'
                          : validationFailed
                            ? 'Some validation commands are failing; copy this proof when reporting the branch state.'
                            : 'Validation is in progress; proof updates as commands finish.'}
                      </div>
                    </div>
                    <div className="validate-proof-actions">
                      <button className="validate-run-btn" type="button" onClick={handleCopyValidationProof} aria-label="Copy validation proof">
                        <Copy size={11} />
                        {proofCopied ? 'Copied' : 'Copy proof'}
                      </button>
                      <button className="validate-run-btn" type="button" onClick={handleDownloadValidationProof} aria-label="Download validation proof">
                        <Download size={11} />
                        Download proof
                      </button>
                      <button
                        className="validate-run-btn"
                        type="button"
                        onClick={handleSaveValidationProofArtifact}
                        disabled={proofSaving || !sessionId}
                        aria-label="Save validation proof artifact to chat"
                        title={sessionId ? 'Save proof into this session and show it in chat as a review artifact' : 'Open a session to save proof artifacts'}
                        aria-describedby={proofSaved || proofSaveError ? 'review-changes-proof-save-status' : undefined}
                      >
                        <FileText size={11} aria-hidden="true" />
                        {proofSaving ? 'Saving...' : proofSaved ? 'Saved to chat' : 'Save artifact'}
                      </button>
                    </div>
                    {proofSaved && !proofSaveError && (
                      <div id="review-changes-proof-save-status" className="validate-proof-saved" role="status" aria-live="polite">
                        Validation proof saved to chat as a review artifact.
                      </div>
                    )}
                    {proofSaveError && (
                      <div id="review-changes-proof-save-status" className="validate-proof-error" role="alert">
                        {proofSaveError}
                      </div>
                    )}
                  </div>
                )}
                <div className="validate-commands">
                  {validationCommands.map(({ id, command }) => {
                    const run = validationRuns[id];
                    const isRunning = run?.status === 'running';
                    return (
                      <div key={id} style={{ marginBottom: 12 }}>
                        <div className="validate-command">
                          <code>{command}</code>
                          <button
                            className="validate-run-btn"
                            type="button"
                            onClick={() => handleRunValidationCommand(id, command)}
                            disabled={isRunning}
                            aria-label={`${isRunning ? 'Running' : run ? 'Re-run' : 'Run'} validation command ${command}`}
                          >
                            {isRunning ? 'Running...' : run ? 'Re-run' : 'Run'}
                          </button>
                        </div>
                        {run && (
                          <div style={{
                            marginTop: 8,
                            padding: 10,
                            borderRadius: 10,
                            border: '1px solid var(--border-primary)',
                            background: 'var(--bg-secondary)',
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              color: run.status === 'passed'
                                ? 'var(--accent-success)'
                                : run.status === 'failed'
                                  ? 'var(--accent-error)'
                                  : 'var(--text-secondary)',
                            }}>
                              <span>{run.status === 'passed' ? 'Passed' : run.status === 'failed' ? 'Failed' : 'Running'}</span>
                              {typeof run.exitCode === 'number' && <span>exit {run.exitCode}</span>}
                              {typeof run.duration === 'number' && <span>{run.duration}ms</span>}
                            </div>
                            {run.output && (
                              <pre style={{
                                margin: '8px 0 0',
                                padding: 10,
                                maxHeight: 180,
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                borderRadius: 8,
                                background: 'var(--bg-primary)',
                                color: 'var(--text-secondary)',
                                fontSize: 11,
                              }}>
                                {run.output.slice(-2000)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {validated && (
                  <div className="validate-result success">
                    <CheckCircle2 size={14} />
                    <span>Validation completed with real command passes</span>
                  </div>
                )}
                {!validated && validationFailed && (
                  <div className="validate-result" style={{ color: 'var(--accent-error)' }}>
                    <span>Validation is still failing. Fix the failed command(s) before treating this branch as ready.</span>
                  </div>
                )}
                {!validated && validationRunning && (
                  <div className="validate-result">
                    <span>Validation is running.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* COMMIT TAB */}
          {activeTab === 'commit' && (
            <div
              className="review-flyout-panel"
              role="tabpanel"
              id="review-changes-panel-commit"
              aria-labelledby="review-changes-tab-commit"
            >
              <div className="review-flyout-panel-header">
                <span className="review-flyout-panel-title">Commit</span>
              </div>
              <div style={{ padding: 16 }}>
                <div className="commit-section">
                  <label className="commit-label">Commit message</label>
                  <textarea
                    className="commit-input"
                    rows={3}
                    aria-label="Commit message"
                    placeholder="Describe what changed and why..."
                    value={commitMessage}
                    onChange={(event) => setCommitMessage(event.target.value)}
                  />
                </div>
                <div className="commit-section">
                  <label className="commit-label">Staged files</label>
                  <div className="commit-staged-files">
                    {(status?.staged || []).length === 0 ? (
                      <span className="commit-empty-files">No files staged — use the Files tab to stage changes</span>
                    ) : (
                      status?.staged.map(f => (
                        <div key={f.path} className="commit-file-row">
                          <span className="commit-file-path">{f.path}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="commit-actions">
                  <button
                    className="commit-btn"
                    type="button"
                    disabled={!status?.staged?.length}
                    aria-label="Create commit from staged files"
                    onClick={async () => {
                      if (!workingDir) return;
                      try {
                        const msg = commitMessage.trim();
                        if (!msg) {
                          setError('Commit message is required');
                          return;
                        }
                        await api.gitCommit(workingDir, msg);
                        setCommitted(true);
                        setCommitMessage('');
                        await refresh();
                      } catch { /* ignore */ }
                    }}
                  >
                    <GitCommit size={14} />
                    <span>Commit</span>
                  </button>
                </div>
                {commitMade && (
                  <div className="validate-result success">
                    <CheckCircle2 size={14} />
                    <span>Commit created</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {status && !status.clean && (
          <div className="review-flyout-footer">
            <span className="review-flyout-footer-text">
              {status.ahead > 0 && `${status.ahead} ahead · `}
              {status.behind > 0 && `${status.behind} behind · `}
              {status.staged.length} staged · {allChanges.length - status.staged.length} unstaged
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
