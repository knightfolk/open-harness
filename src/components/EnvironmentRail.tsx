import { useEffect, useMemo, useState } from 'react';
import {
  Bot, ChevronDown, ChevronRight, GitBranch, GripVertical, Laptop, ListPlus, Loader,
  PanelRightClose, Send, Settings, Shield, Eye, EyeOff,
} from 'lucide-react';
import * as api from '../utils/api';
import type { SubAgent } from '../types';

interface Props {
  workingDir: string | null;
  trustMode: string;
  subAgents: SubAgent[];
  onReviewChanges: () => void;
  onFocusAgents: () => void;
  rightRailPinned?: boolean;
  onHide: () => void;
}

const TRUST_ICONS: Record<string, React.ReactNode> = {
  'chat-only': <EyeOff size={12} />,
  'read-only': <Eye size={12} />,
  'ask-before-write': <Shield size={12} />,
  'workspace-write': <Shield size={12} />,
  'full-local': <Shield size={12} />,
};

const TRUST_COLORS: Record<string, string> = {
  'chat-only': '#6b7280',
  'read-only': '#3b82f6',
  'ask-before-write': '#f59e0b',
  'workspace-write': '#22c55e',
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
const ORDER_KEY = 'openharness.wunderbar.order.v1';
const COLLAPSED_KEY = 'openharness.wunderbar.collapsed.v1';

function loadOrder(): SectionId[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as SectionId[];
    if (!Array.isArray(parsed)) return DEFAULT_ORDER;
    // Filter to known ids, then append any missing ones (forward compat).
    const known = parsed.filter((id): id is SectionId => DEFAULT_ORDER.includes(id));
    const missing = DEFAULT_ORDER.filter((id) => !known.includes(id));
    return [...known, ...missing];
  } catch { return DEFAULT_ORDER; }
}

function loadCollapsed(): Record<SectionId, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch { /* ignore */ }
  // Default: Progress and Sources start collapsed to honor the cleanup plan.
  return { git: false, agents: false, access: false, progress: true, sources: true };
}

export function EnvironmentRail({
  workingDir,
  trustMode,
  subAgents,
  onReviewChanges,
  onFocusAgents,
  rightRailPinned = false,
  onHide,
}: Props) {
  const [branch, setBranch] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [additions, setAdditions] = useState(0);
  const [deletions, setDeletions] = useState(0);
  const [clean, setClean] = useState(true);

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
        setClean(status.clean);
      } catch {
        if (mounted) {
          setBranch(null);
          setFileCount(0);
          setClean(true);
        }
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, [workingDir]);

  const [order, setOrder] = useState<SectionId[]>(loadOrder);
  const [collapsed, setCollapsed] = useState<Record<SectionId, boolean>>(loadCollapsed);
  const [dragId, setDragId] = useState<SectionId | null>(null);
  const [dragOverId, setDragOverId] = useState<SectionId | null>(null);

  // Persist on change.
  useEffect(() => {
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch { /* ignore */ }
  }, [order]);
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  const toggleCollapse = (id: SectionId) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  // Drag-and-drop reorder handlers (HTML5 DnD — simple list, no library needed).
  const onDragStart = (id: SectionId) => (e: React.DragEvent) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Use a plain text payload so the browser still permits the drag without
    // requiring external asset previews. We only act on items where our type matches.
    e.dataTransfer.setData('text/plain', id);
  };
  const onDragOver = (id: SectionId) => (e: React.DragEvent) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  };
  const onDragLeave = (id: SectionId) => () => {
    if (dragOverId === id) setDragOverId(null);
  };
  const onDrop = (id: SectionId) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = e.dataTransfer.getData('text/plain') as SectionId;
    if (!from || from === id) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    setOrder((prev) => {
      const next = prev.slice();
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(id);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      return next;
    });
    setDragId(null);
    setDragOverId(null);
  };
  const onDragEnd = () => { setDragId(null); setDragOverId(null); };

  const accessColor = TRUST_COLORS[trustMode] || 'var(--text-secondary)';
  const accessLabel = TRUST_LABELS[trustMode] || trustMode;
  const projectName = workingDir ? workingDir.split('/').pop() : 'No project';

  const runningCount = subAgents.filter((a) => a.status === 'running').length;
  const totalAgents = subAgents.length;
  const hasPendingWork = !clean;
  const hasActiveAgents = runningCount > 0;

  useEffect(() => {
    if (hasPendingWork) {
      setCollapsed((prev) => (prev.git ? { ...prev, git: false } : prev));
    }
  }, [hasPendingWork]);

  useEffect(() => {
    if (hasActiveAgents) {
      setCollapsed((prev) => (prev.agents ? { ...prev, agents: false } : prev));
    }
  }, [hasActiveAgents]);

  // Per-section definitions. Body content is computed inline so each section can
  // own its visual logic without leaking concerns across the rail.
  const sectionDefs = useMemo(() => {
    const defs: Record<SectionId, { title: string; icon: React.ReactNode; body: React.ReactNode; summary: React.ReactNode }> = {
      git: {
        title: 'Git',
        icon: <GitBranch size={14} />,
        summary: clean ? <span className="env-clean">Clean</span> : (
          <span className="env-change-count">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
        ),
        body: (
          <>
            <button
              className="env-card-row env-card-row-button"
              type="button"
              onClick={onReviewChanges}
              disabled={clean}
              aria-label="Review changes"
            >
              <ListPlus size={18} className="env-card-row-icon" />
              <span className="env-card-row-main">Changes</span>
              <span className="env-card-row-meta">
                {clean ? (
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
              <Laptop size={18} className="env-card-row-icon" />
              <span className="env-card-row-main">Local</span>
            </div>
            <div className="env-card-row env-card-row-static">
              <GitBranch size={18} className="env-card-row-icon" />
              <span className="env-card-row-main">{branch || 'No branch'}</span>
            </div>
            <div className="env-card-row env-card-row-static">
              <Send size={18} className="env-card-row-icon" />
              <span className="env-card-row-main">Commit or push</span>
            </div>
          </>
        ),
      },
      agents: {
        title: 'Agents',
        icon: <Bot size={14} />,
        summary: totalAgents === 0 ? <span className="env-clean">None</span> : (
          <span className="env-change-count">
            {runningCount} of {totalAgents} running
          </span>
        ),
        body: (
          <button
            className="env-card-row env-card-row-button"
            type="button"
            onClick={onFocusAgents}
            disabled={totalAgents === 0}
            aria-label="Focus on sub-agents"
          >
            <Bot size={18} className="env-card-row-icon" />
            <span className="env-card-row-main">Sub-agents</span>
            <span className="env-card-row-meta">
              {totalAgents === 0 ? (
                <span className="env-clean">None</span>
              ) : (
                <>
                  {runningCount > 0 && <Loader size={12} className="env-agents-spin" />}
                  <span className="env-change-count">
                    {runningCount} of {totalAgents} running
                  </span>
                </>
              )}
            </span>
          </button>
        ),
      },
      access: {
        title: 'Access',
        icon: TRUST_ICONS[trustMode] || <Shield size={14} />,
        summary: <span className="env-access" style={{ color: accessColor }}>{accessLabel}</span>,
        body: (
          <div className="env-card-row env-card-row-static">
            {TRUST_ICONS[trustMode] || <Shield size={18} className="env-card-row-icon" />}
            <span className="env-card-row-main">Trust mode</span>
            <span className="env-access" style={{ color: accessColor }}>{accessLabel}</span>
          </div>
        ),
      },
      progress: {
        title: 'Progress',
        icon: <ListPlus size={14} />,
        summary: null,
        body: (
          <div className="env-card-section-empty">
            No active run progress.
          </div>
        ),
      },
      sources: {
        title: 'Sources',
        icon: <ListPlus size={14} />,
        summary: null,
        body: (
          <div className="env-card-section-empty">
            No source context attached.
          </div>
        ),
      },
    };
    return defs;
  }, [branch, fileCount, additions, deletions, clean, totalAgents, runningCount, trustMode, accessLabel, accessColor, onReviewChanges, onFocusAgents]);

  return (
    <aside className="env-rail super-panel" data-super-panel="visible" aria-label="Super Panel">
      <div className="env-card">
        <div className="env-card-header">
          <div>
            <div className="env-card-title super-panel-title">Super Panel</div>
            <div className="env-card-subtitle">{projectName}</div>
          </div>
          <div className="env-card-header-actions">
            <button className="env-icon-btn" type="button" title="Super Panel settings" aria-label="Super Panel settings">
              <Settings size={17} />
            </button>
            {!rightRailPinned && (
              <button
                className="env-icon-btn super-panel-hide"
                type="button"
                onClick={onHide}
                title="Hide Super Panel (⇧⌘S)"
                aria-label="Hide Super Panel"
              >
                <PanelRightClose size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="super-panel-quickbar">
          <span className="super-panel-quickbar-label">
            {rightRailPinned ? 'Pinned while no workspace panel is open' : 'Quickly hide'}
          </span>
          {!rightRailPinned && (
            <button
              className="super-panel-hide-labeled"
              type="button"
              onClick={onHide}
              title="Hide Super Panel (⇧⌘S)"
              aria-label="Hide Super Panel"
            >
              <PanelRightClose size={14} />
              <span>Hide Super Panel</span>
              <kbd className="super-panel-kbd" aria-hidden="true">⇧⌘S</kbd>
            </button>
          )}
        </div>

        <div className="env-card-sections">
          {order.map((id) => {
            const def = sectionDefs[id];
            const isCollapsed = !!collapsed[id];
            const isDragOver = dragOverId === id && dragId && dragId !== id;
            return (
              <div
                key={id}
                className={`env-section ${isDragOver ? 'env-section-drop-target' : ''} ${dragId === id ? 'env-section-dragging' : ''}`}
                onDragOver={onDragOver(id)}
                onDragLeave={onDragLeave(id)}
                onDrop={onDrop(id)}
              >
                <div className="env-section-header">
                  <span
                    className="env-section-grip"
                    draggable
                    onDragStart={onDragStart(id)}
                    onDragEnd={onDragEnd}
                    title="Drag to reorder"
                    role="button"
                    aria-label={`Reorder ${def.title} section`}
                  >
                    <GripVertical size={12} />
                  </span>
                  <button
                    type="button"
                    className="env-section-toggle"
                    onClick={() => toggleCollapse(id)}
                    aria-expanded={!isCollapsed}
                  >
                    <span className="env-section-toggle-icon">
                      {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </span>
                    <span className="env-section-icon">{def.icon}</span>
                    <span className="env-section-title">{def.title}</span>
                    <span className="env-section-summary">{def.summary}</span>
                  </button>
                </div>
                {!isCollapsed && <div className="env-section-body">{def.body}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
