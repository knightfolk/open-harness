import { useEffect, useMemo, useState } from 'react';
import {
  Bot, ChevronDown, ChevronRight, CircleGauge, FileSearch, GitBranch,
  ListPlus, Loader, PanelRightClose, Shield, ShieldCheck, Eye, EyeOff,
  X,
} from 'lucide-react';
import * as api from '../utils/api';
import type { SubAgent } from '../types';
import { getActiveWorkState } from '../utils/agentWorkState';

interface Props {
  workingDir: string | null;
  trustMode: string;
  subAgents: SubAgent[];
  onReviewChanges: () => void;
  onFocusAgents: () => void;
  rightRailPinned?: boolean;
  onHide?: () => void;
  variant?: 'rail' | 'panel' | 'floating';
}

const TRUST_ICONS: Record<string, React.ReactNode> = {
  'chat-only': <EyeOff size={16} aria-hidden="true" />,
  'read-only': <Eye size={16} aria-hidden="true" />,
  'ask-before-write': <Shield size={16} aria-hidden="true" />,
  'workspace-write': <ShieldCheck size={16} aria-hidden="true" />,
  'full-local': <Shield size={16} aria-hidden="true" />,
};

const TRUST_COLORS: Record<string, string> = {
  'chat-only': '#6b7280',
  'read-only': '#3b82f6',
  'ask-before-write': '#22c55e',
  'workspace-write': '#f59e0b',
  'full-local': '#ef4444',
};

const TRUST_LABELS: Record<string, string> = {
  'chat-only': 'Chat Only',
  'read-only': 'Read Only',
  'ask-before-write': 'Ask Before Write',
  'workspace-write': 'Workspace',
  'full-local': 'Full Access',
};

type SectionId = 'git' | 'agents' | 'access' | 'progress' | 'sources';
const DEFAULT_ORDER: SectionId[] = ['git', 'agents', 'access', 'progress', 'sources'];
const COLLAPSED_KEY = 'openharness.right-panel.collapsed.v1';

function loadCollapsed(): Record<SectionId, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch { /* ignore */ }
  // Default: Progress and Sources start collapsed to honor the cleanup plan.
  return { git: false, agents: true, access: false, progress: true, sources: true };
}

export function EnvironmentRail({
  workingDir,
  trustMode,
  subAgents,
  onReviewChanges,
  onFocusAgents,
  rightRailPinned = false,
  variant = 'rail',
  onHide,
}: Props) {
  const [branch, setBranch] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [additions, setAdditions] = useState(0);
  const [deletions, setDeletions] = useState(0);

  useEffect(() => {
    if (!workingDir) return;
    let mounted = true;
    const load = async () => {
      try {
        const status = await api.getGitStatus(workingDir);
        if (!mounted) return;
        setBranch(status.branch);
        const changes = [...status.staged, ...status.unstaged];
        setFileCount(changes.length);
        setAdditions(changes.reduce((s, f) => s + f.insertions, 0));
        setDeletions(changes.reduce((s, f) => s + f.deletions, 0));
      } catch {
        if (mounted) {
          setBranch(null);
          setFileCount(0);
        }
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [workingDir]);

  const [collapsed, setCollapsed] = useState<Record<SectionId, boolean>>(loadCollapsed);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  const toggleCollapse = (id: SectionId) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));


  const accessColor = TRUST_COLORS[trustMode] || 'var(--text-secondary)';
  const accessLabel = TRUST_LABELS[trustMode] || trustMode;
  const projectName = workingDir ? workingDir.split('/').pop() : 'No project';

  const runningCount = subAgents.filter((a) => a.status === 'running').length;
  const waitingCount = subAgents.filter((a) => a.status === 'idle').length;
  const totalAgents = subAgents.length;
  const hasAnyAgents = totalAgents > 0;
  const hasProject = Boolean(workingDir);
  const hasChanges = hasProject && fileCount > 0;
  const hasPendingWork = hasChanges;
  const hasRunningAgents = runningCount > 0;
  const activeWorkState = useMemo(() => getActiveWorkState(subAgents), [subAgents]);

  useEffect(() => {
    if (hasPendingWork) {
      setCollapsed((prev) => (prev.git ? { ...prev, git: false } : prev));
    }
  }, [hasPendingWork]);

  useEffect(() => {
    if (hasRunningAgents) {
      setCollapsed((prev) => (prev.agents ? { ...prev, agents: false } : prev));
    }
  }, [hasRunningAgents]);

  // Per-section definitions. Body content is computed inline so each section can
  // own its visual logic without leaking concerns across the rail.
  const sectionDefs = useMemo(() => {
    const defs: Record<SectionId, { title: string; icon: React.ReactNode; body: React.ReactNode; summary: React.ReactNode }> = {
      git: {
        title: 'Git',
        icon: <GitBranch size={16} aria-hidden="true" />,
        summary: !hasProject ? <span className="env-clean">No project</span> : !hasChanges ? <span className="env-clean">Clean</span> : (
          <span className="env-change-count">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
        ),
        body: (
          <>
            <button
              className="env-card-row env-card-row-button"
              type="button"
              onClick={onReviewChanges}
              aria-label="Review changes"
              title={!hasProject ? 'Open a project to review changes' : !hasChanges ? 'Review clean working tree' : 'Review changed files'}
            >
              <ListPlus size={18} className="env-card-row-icon" aria-hidden="true" />
              <span className="env-card-row-main">Changes</span>
              <span className="env-card-row-meta">
                {!hasProject ? (
                  <span className="env-clean">No project</span>
                ) : !hasChanges ? (
                  <span className="env-clean">Clean</span>
                ) : (
                  <>
                    <span className="env-rail-added">+{additions}</span>
                    <span className="env-rail-deleted">-{deletions}</span>
                  </>
                )}
              </span>
            </button>
            <div className="env-card-row env-card-row-static">
              <GitBranch size={18} className="env-card-row-icon" aria-hidden="true" />
              <span className="env-card-row-main">{branch || 'No branch'}</span>
            </div>
          </>
        ),
      },
      agents: {
        title: 'Agents',
        icon: <Bot size={16} aria-hidden="true" />,
        summary: totalAgents === 0 ? <span className="env-clean">None</span> : (
          <span className="env-change-count">
            {runningCount} working · {waitingCount} waiting
          </span>
        ),
        body: (
          <button
            className="env-card-row env-card-row-button"
            type="button"
            onClick={onFocusAgents}
            disabled={totalAgents === 0}
            aria-label="Focus on agent work"
          >
            <Bot size={18} className="env-card-row-icon" aria-hidden="true" />
            <span className="env-card-row-main">Agent work</span>
            <span className="env-card-row-meta">
              {totalAgents === 0 ? (
                <span className="env-clean">None</span>
              ) : (
                <>
                  {runningCount > 0 && <Loader size={12} className="env-agents-spin" aria-hidden="true" />}
                  <span className="env-change-count">
                    {runningCount} working · {waitingCount} waiting
                  </span>
                </>
              )}
            </span>
          </button>
        ),
      },
      access: {
        title: 'Access',
        icon: TRUST_ICONS[trustMode] || <Shield size={16} aria-hidden="true" />,
        summary: <span className="env-access" style={{ color: accessColor }}>{accessLabel}</span>,
        body: (
          <div className="env-card-row env-card-row-static">
            {TRUST_ICONS[trustMode] || <Shield size={18} className="env-card-row-icon" aria-hidden="true" />}
            <span className="env-card-row-main">Trust mode</span>
            <span className="env-access" style={{ color: accessColor }}>{accessLabel}</span>
          </div>
        ),
      },
      progress: {
        title: 'Progress',
        icon: <CircleGauge size={16} aria-hidden="true" />,
        summary: activeWorkState ? <span className="env-change-count">{activeWorkState.workflowLabel}</span> : null,
        body: activeWorkState ? (
          <div className="env-workflow" role="status" aria-live="polite" aria-label={`${activeWorkState.workflowLabel} active work progress`}>
                <div className="env-workflow-title">{activeWorkState.workflowLabel}</div>
                <div className="env-workflow-actions">
                  <button
                    className="env-workflow-action"
                    type="button"
                    onClick={onFocusAgents}
                    aria-label="Open Agent detail"
                  >
                    <span>Agent detail</span>
                  </button>
                </div>
                {(activeWorkState.currentTask || activeWorkState.modelProvider || activeWorkState.latestArtifact) && (
                  <div
                    className="env-workflow-meta"
                role="group"
                aria-label={[
                  activeWorkState.currentTask ? `Current task: ${activeWorkState.currentTask}` : null,
                  activeWorkState.modelProvider ? `Model: ${activeWorkState.modelProvider}` : null,
                  activeWorkState.latestArtifact ? `Latest ${activeWorkState.latestArtifact}` : null,
                ].filter(Boolean).join('. ')}
              >
                {activeWorkState.currentTask && <span role="group" aria-label={`Current task: ${activeWorkState.currentTask}`}>{activeWorkState.currentTask}</span>}
                {activeWorkState.modelProvider && <span role="group" aria-label={`Model and provider: ${activeWorkState.modelProvider}`}>{activeWorkState.modelProvider}</span>}
                {activeWorkState.latestArtifact && <span role="group" aria-label={`Latest proof or artifact: ${activeWorkState.latestArtifact}`}>{activeWorkState.latestArtifact}</span>}
              </div>
            )}
            <div className="env-workflow-steps" role="list" aria-label={`${activeWorkState.workflowLabel} steps`}>
              {activeWorkState.steps.map((step) => (
                <div key={step.id} className="env-workflow-step" role="listitem" aria-label={`${step.label}: ${step.status}`} aria-current={step.status === 'in_progress' ? 'step' : undefined}>
                  <span className={`active-work-strip-dot ${step.status}`} aria-hidden="true" />
                  <span className={`active-work-strip-step ${step.status}`}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="env-card-section-empty">
            No active run progress.
          </div>
        ),
      },
      sources: {
        title: 'Sources',
        icon: <FileSearch size={16} aria-hidden="true" />,
        summary: null,
        body: (
          <div className="env-card-section-empty">
            No source context attached.
          </div>
        ),
      },
    };
    return defs;
  }, [branch, fileCount, additions, deletions, hasChanges, hasProject, totalAgents, runningCount, waitingCount, trustMode, accessLabel, accessColor, activeWorkState, onReviewChanges, onFocusAgents]);

  const sectionIds = useMemo(() => {
    if (hasAnyAgents) return DEFAULT_ORDER;
    return DEFAULT_ORDER.filter((id) => id !== 'agents' && id !== 'progress');
  }, [hasAnyAgents]);

  return (
    <aside className={`env-rail ${variant === 'panel' ? 'env-rail-panel' : ''} ${variant === 'floating' ? 'env-rail-floating' : ''} ${variant === 'rail' ? 'right-panel-overlay' : ''}`} data-right-panel="visible" aria-label={variant === 'rail' ? 'Right panel' : 'Super panel'}>
      <div className="env-card">
        <div className="env-card-header">
          <div>
            <div className="env-card-title right-panel-project">{variant === 'floating' ? 'Environment' : projectName}</div>
            {variant === 'floating' && projectName !== 'No project' && (
              <div className="env-card-subtitle">{projectName}</div>
            )}
          </div>
          {variant === 'floating' && onHide && (
            <div className="env-card-header-actions">
              <button
                className="env-icon-btn super-panel-hide"
                type="button"
                onClick={onHide}
                title="Hide Super panel"
                aria-label="Hide Super panel"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          {variant === 'rail' && !rightRailPinned && onHide && (
            <div className="env-card-header-actions">
              <button
                className="env-icon-btn right-panel-hide"
                type="button"
                onClick={onHide}
                title="Hide right panel (⇧⌘S)"
                aria-label="Hide right panel"
              >
                <PanelRightClose size={17} aria-hidden="true" />
              </button>
            </div>
          )}
          {variant === 'rail' && (
          <div className="right-panel-quickbar">
            <span className="right-panel-quickbar-label">
              {rightRailPinned ? 'Pinned while no workspace panel is open' : 'Hide panel'}
            </span>
            {!rightRailPinned && onHide && (
              <button
                className="right-panel-hide-labeled"
                type="button"
                onClick={onHide}
                title="Hide right panel (⇧⌘S)"
                aria-label="Hide right panel"
              >
                <PanelRightClose size={14} aria-hidden="true" />
                <span>Hide</span>
                <kbd className="right-panel-kbd" aria-hidden="true">⇧⌘S</kbd>
              </button>
            )}
          </div>
          )}
        </div>

        <div className="env-card-sections">
          {sectionIds.map((id) => {
            const def = sectionDefs[id];
            const isCollapsed = !!collapsed[id];
            const sectionBodyId = `env-section-body-${variant}-${id}`;
            return (
              <div
                key={id}
                className="env-section"
              >
                <div className="env-section-header">
                  <button
                    type="button"
                    className="env-section-toggle"
                    onClick={() => toggleCollapse(id)}
                    aria-expanded={!isCollapsed}
                    aria-controls={sectionBodyId}
                  >
                    <span className="env-section-toggle-icon">
                      {isCollapsed ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
                    </span>
                    <span className="env-section-icon" aria-hidden="true">
                      {def.icon}
                    </span>
                    <span className="env-section-title">{def.title}</span>
                    <span className="env-section-summary">{def.summary}</span>
                  </button>
                </div>
                {!isCollapsed && (
                  <div
                    id={sectionBodyId}
                    className="env-section-body"
                    role="region"
                    aria-label={`${def.title} details`}
                  >
                    {def.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
