import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FolderOpen,
  Loader,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { SidebarTab, SubAgent, ProviderConfig, CodingRoleAssignment, MCPServerItem, HarnessRunStep } from '../types';
import type { Message } from '../types';
import type { SessionInfo } from '../utils/api';
import { SideChatPanel } from './SideChatPanel';
import { buildRunTree, phaseLabel, runLabel } from '../utils/agentWorkState';
import { agentIdentityForRole } from '../utils/agentIdentity';

interface Props {
  isOpen: boolean;
  sessions: SessionInfo[];
  activeSessionId?: string;
  workingDir?: string | null;
  activeTab: SidebarTab;
  activeSubAgents: SubAgent[];
  mainMessages?: Message[];
  onActiveTabChange: (tab: SidebarTab) => void;
  onSelectSession: (id: string) => void;
  onNewSession: (workingDir?: string | null) => void;
  activeModel: string;
  providers: ProviderConfig[];
  roleAssignments: CodingRoleAssignment[];
  activeTheme: string;
  personalityText: string;
  mcpServers: MCPServerItem[];
  mcpStatus: any[];
  onOpenSettings: () => void;
  onAddProvider: (provider: { name: string; type: string; apiKey: string; baseURL: string }) => Promise<any>;
  onTestProvider: (providerId: string) => Promise<any>;
  onFetchModels: (providerId: string) => Promise<any>;
  onRemoveProvider: (providerId: string) => void;
  onAddMCPServer: (server: { name: string; endpoint: string; authType: string; authToken: string }) => Promise<any>;
  onRemoveMCPServer: (serverId: string) => void;
  onSelectModel: (modelId: string) => void;
  onToggleProviderModel: (providerId: string, modelId: string) => void;
  onAssignRoleModel: (roleId: string, modelId: string) => void;
  onSelectTheme: (themeId: string) => void;
  onPersonalityChange: (text: string) => void;
  onOpenFolder?: () => void;
  onFocusAgent?: (agentId: string) => void;
  width?: number;
  onResizeStart?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDeleteSession?: (id: string) => void;
  onDeleteProject?: (workingDir: string | null) => void;
  clickyEnabled: boolean;
}

function normalizeRunLabel(run: SubAgent): string {
  return runLabel(run);
}

function normalizePhaseLabel(phase: SubAgent): string {
  return phaseLabel(phase);
}

function formatRunStatus(status: SubAgent['status']): string {
  if (status === 'idle') return 'waiting';
  if (status === 'blocked') return 'blocked';
  if (status === 'error') return 'failed';
  return status;
}

function latestRunArtifactStep(run: SubAgent): Extract<HarnessRunStep, { type: 'artifact' }> | null {
  return run.runTrace?.steps
    ?.slice()
    .reverse()
    .find((step): step is Extract<HarnessRunStep, { type: 'artifact' }> => step.type === 'artifact') || null;
}

function latestRunArtifact(run: SubAgent): string | null {
  const artifactStep = latestRunArtifactStep(run);
  if (!artifactStep) return null;
  if (artifactStep.artifact.type === 'validation_proof') {
    return `${artifactStep.artifact.title} (${artifactStep.artifact.summary})`;
  }
  return artifactStep.artifact.title;
}

function latestRunArtifactCue(run: SubAgent): string | null {
  const artifactStep = latestRunArtifactStep(run);
  if (!artifactStep) return null;
  const label = artifactStep.artifact.type === 'validation_proof' ? 'validation proof' : 'artifact';
  return `${label}: ${latestRunArtifact(run)}`;
}

function latestRunProof(run: SubAgent): { label: string; value: string } | null {
  const artifactStep = latestRunArtifactStep(run);
  if (artifactStep) {
    return {
      label: artifactStep.artifact.type === 'validation_proof' ? 'Validation proof' : 'Artifact',
      value: latestRunArtifact(run) || artifactStep.artifact.title,
    };
  }
  const proofStep = run.runTrace?.steps
    ?.slice()
    .reverse()
    .find((step) => step.type === 'final_answer' || step.type === 'tool_call' || step.type === 'error');
  if (!proofStep) return null;
  if (proofStep.type === 'final_answer') return { label: 'Proof', value: `Final answer ready (${proofStep.chars} chars)` };
  if (proofStep.type === 'tool_call') return { label: 'Proof', value: proofStep.durationMs == null ? `Started ${proofStep.name}` : `Finished ${proofStep.name}` };
  return { label: 'Proof', value: proofStep.message };
}

function canSteerRun(run: SubAgent): boolean {
  return run.status === 'running' || run.status === 'blocked' || run.status === 'idle';
}

const tabConfig = [
  { key: 'chat' as SidebarTab, icon: MessageSquare, label: 'Chat' },
  { key: 'projects' as SidebarTab, icon: FolderOpen, label: 'Projects' },
];

function safeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function Sidebar({
  isOpen,
  sessions,
  activeSessionId,
  workingDir,
  activeTab,
  activeSubAgents,
  mainMessages = [],
  onActiveTabChange,
  onOpenSettings,
  onSelectSession,
  onNewSession,
  onOpenFolder,
  onFocusAgent,
  width,
  onResizeStart,
  onDeleteSession,
  onDeleteProject,
  activeModel,
  providers,
  clickyEnabled,
}: Props) {
  const [clickyOpen, setClickyOpen] = useState(false);
  const [visiblePanels, setVisiblePanels] = useState({ chat: false, projects: true });
  const sideChatModels = providers.flatMap((provider) =>
    provider.models
      .filter((model) => model.enabled)
      .map((model) => ({ id: model.id, name: model.name || model.id }))
  );

  useEffect(() => {
    setVisiblePanels((prev) => ({ ...prev, [activeTab]: true }));
  }, [activeTab]);

  const togglePanel = (panel: SidebarTab) => {
    if (visiblePanels[panel] && Object.values(visiblePanels).filter(Boolean).length === 1) return;
    const nextVisible = !visiblePanels[panel];
    setVisiblePanels({ ...visiblePanels, [panel]: nextVisible });
    onActiveTabChange(nextVisible ? panel : panel === 'chat' ? 'projects' : 'chat');
  };

  if (!isOpen) return null;

  return (
    <aside
      className="sidebar"
      aria-label="Project and chat navigation"
      style={width ? ({ width, minWidth: width, ['--sidebar-width']: `${width}px` } as CSSProperties & { '--sidebar-width'?: string }) : undefined}
    >
      {onResizeStart && (
        <button
          type="button"
          className="sidebar-resize-handle"
          aria-label="Resize left sidebar"
          title="Resize left sidebar"
          onPointerDown={onResizeStart}
        />
      )}
      <div className="sidebar-tabs" role="group" aria-label="Sidebar panels">
        {tabConfig.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            className={`sidebar-tab ${visiblePanels[key] ? 'active' : ''}`}
            onClick={() => togglePanel(key)}
            title={`${visiblePanels[key] ? 'Hide' : 'Show'} ${label}`}
            aria-label={`${visiblePanels[key] ? 'Hide' : 'Show'} ${label} panel`}
            aria-expanded={visiblePanels[key]}
            aria-controls={`sidebar-panel-${key}`}
          >
            <Icon size={13} aria-hidden="true" />
            {label}
          </button>
        ))}
        <button
          className="sidebar-tab sidebar-gear-tab"
          onClick={onOpenSettings}
          title="Open settings"
          aria-label="Open settings"
        >
          <Settings size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="sidebar-content" role="region" aria-label="Sidebar panel content">
        {visiblePanels.chat && (
          <div id="sidebar-panel-chat" className="sidebar-panel sidebar-panel--chat">
            <SideChatPanel
              activeModel={activeModel}
              models={sideChatModels}
              activeSessionId={activeSessionId}
              workingDir={workingDir}
              mainMessages={mainMessages}
            />
          </div>
        )}
        {visiblePanels.projects && (
          <div id="sidebar-panel-projects" className="sidebar-panel sidebar-panel--projects">
            <ProjectsTab
              sessions={sessions}
              activeSessionId={activeSessionId}
              activeSubAgents={activeSubAgents}
              onSelectSession={onSelectSession}
              onNewSession={onNewSession}
              onOpenFolder={onOpenFolder}
              onFocusAgent={onFocusAgent}
              onDeleteSession={onDeleteSession}
              onDeleteProject={onDeleteProject}
            />
          </div>
        )}
      </div>

      {clickyEnabled && (
        <div className="clicky-wrap">
          {clickyOpen && (
            <div className="clicky-popover" role="status">
              <div className="clicky-popover-title">Clicky tip</div>
              <div>Use Projects for sessions, and keep quick questions in Chat.</div>
            </div>
          )}
          <button
            className={`clicky-button ${clickyOpen ? 'active' : ''}`}
            type="button"
            onClick={() => setClickyOpen((open) => !open)}
            title="Clicky tips"
            aria-label="Open Clicky tips"
          >
            <Bot size={17} aria-hidden="true" />
            <Sparkles size={10} className="clicky-spark" aria-hidden="true" />
          </button>
        </div>
      )}
    </aside>
  );
}

function ProjectsTab({ sessions, activeSessionId, activeSubAgents, onSelectSession, onNewSession, onOpenFolder, onFocusAgent, onDeleteSession, onDeleteProject }: {
  sessions: SessionInfo[];
  activeSessionId?: string;
  activeSubAgents: SubAgent[];
  onSelectSession: (id: string) => void;
  onNewSession: (workingDir?: string | null) => void;
  onOpenFolder?: () => void;
  onFocusAgent?: (agentId: string) => void;
  onDeleteSession?: (id: string) => void;
  onDeleteProject?: (workingDir: string | null) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());
  const projectGroups = useMemo(() => groupSessionsByProject(sessions), [sessions]);
  const runTree = useMemo(() => buildRunTree(activeSubAgents), [activeSubAgents]);

  useEffect(() => {
    if (!activeSessionId) return;
    const activeGroup = projectGroups.find((group) => group.sessions.some((session) => session.id === activeSessionId));
    if (!activeGroup) return;
    setCollapsedGroups((prev) => {
      if (!prev.has(activeGroup.key)) return prev;
      const next = new Set(prev);
      next.delete(activeGroup.key);
      return next;
    });
  }, [activeSessionId, projectGroups]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      {onOpenFolder && (
        <button className="new-project-btn" type="button" onClick={onOpenFolder} aria-label="Open a new project folder">
          <FolderOpen size={15} aria-hidden="true" />
          New Project
        </button>
      )}
      {projectGroups.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        const groupSessionsId = `project-group-sessions-${safeDomId(group.key)}`;
        return (
        <div className={`project-group ${collapsed ? 'collapsed' : ''}`} key={group.key}>
          <div className="project-group-header">
            <button
              type="button"
              className="project-group-title project-group-toggle"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={!collapsed}
              aria-controls={groupSessionsId}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}, ${group.sessions.length} chat${group.sessions.length !== 1 ? 's' : ''}`}
              title={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}`}
            >
              {collapsed ? <ChevronRight size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
              <FolderOpen size={13} aria-hidden="true" />
              <span>{group.name}</span>
            </button>
            <div className="project-group-actions">
              <button
                className="sidebar-icon-button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewSession(group.workingDir);
                }}
                title={`New chat in ${group.name}`}
                aria-label={`New chat in ${group.name}`}
              >
                <Plus size={12} aria-hidden="true" />
              </button>
              <span aria-label={`${group.sessions.length} chat${group.sessions.length !== 1 ? 's' : ''} in ${group.name}`}>
                {group.sessions.length}
              </span>
              {onDeleteProject && (
                <button
                  className="sidebar-icon-button danger"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete all chats for ${group.name}?`)) onDeleteProject(group.workingDir);
                  }}
                  title={`Delete ${group.name}`}
                  aria-label={`Delete ${group.name}`}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
            {!collapsed && (
              <div id={groupSessionsId} role="list" aria-label={`${group.name} chats`}>
              {group.sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isRunning = isActive && activeSubAgents.some((agent) => agent.status === 'running' || agent.status === 'blocked');
            const activeRunTree = isActive ? runTree : [];
            const sessionLabel = [
              `${isActive ? 'Current chat' : 'Open chat'} ${session.title}`,
              session.preview || 'Empty session',
              `updated ${formatRelativeTime(new Date(session.updatedAt))}`,
              isActive && activeRunTree.length > 0 ? `${activeRunTree.length} active work item${activeRunTree.length === 1 ? '' : 's'}` : null,
            ].filter(Boolean).join('. ');
            return (
              <div key={session.id} role="listitem">
                <div
                  className={`session-item ${isActive ? 'active' : ''} ${isActive && activeSubAgents.length > 0 ? 'has-agents' : ''}`}
                >
                  <button
                    type="button"
                    className="session-select-button"
                    onClick={() => onSelectSession(session.id)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={sessionLabel}
                  >
                    <span className="session-item-topline">
                      <span className="session-item-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isActive && isRunning && <span className="session-running-dot" aria-hidden="true" />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {session.title}
                        </span>
                      </span>
                    </span>
                    <span className="session-item-preview">
                      {session.preview || 'Empty session'}
                    </span>
                    <span className="session-item-time">
                      <Clock size={10} style={{ marginRight: 4, verticalAlign: -1 }} aria-hidden="true" />
                      {formatRelativeTime(new Date(session.updatedAt))}
                    </span>
                  </button>
                  {onDeleteSession && (
                    <button
                      className="sidebar-icon-button danger session-delete"
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete chat "${session.title}"?`)) onDeleteSession(session.id);
                      }}
                      title="Delete chat"
                      aria-label={`Delete chat ${session.title}`}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>

                {isActive && activeRunTree.length > 0 && (
                    <div className="session-run-tree" role="list" aria-label={`Active work for ${session.title}`}>
                    {activeRunTree.map(({ run, phases }) => {
                      const needsAttention = run.status === 'error' || run.status === 'blocked';
                      const steeringAvailable = canSteerRun(run);
                      const proof = latestRunProof(run);
                      const statusText = formatRunStatus(run.status);
                      const agent = agentIdentityForRole(run.runTrace?.role);
                      const runChildrenId = `session-run-children-${safeDomId(run.id)}`;
                      const runAccessibleLabel = [
                        `Focus ${normalizeRunLabel(run)}`,
                        `status ${statusText}`,
                        run.task ? `task ${run.task}` : null,
                        run.model ? `model ${run.model}` : null,
                        run.runTrace?.providerId ? `provider ${run.runTrace.providerId}` : null,
                        `elapsed ${formatAgentDuration(run.startTime)}`,
                        proof ? `${proof.label}: ${proof.value}` : null,
                      ].filter(Boolean).join('. ');
                      return (
                        <div key={run.id} className="session-run-group" role="listitem">
                        <button
                          type="button"
                          className={`session-run-row ${run.status}`}
                          onClick={() => onFocusAgent?.(run.id)}
                          title={`Focus ${normalizeRunLabel(run)}`}
                          aria-label={runAccessibleLabel}
                        >
                          <span className={`session-run-dot session-run-dot-${run.status}`} aria-hidden="true" />
                          <span className="session-run-avatar agent-id-badge" aria-hidden="true">{agent.avatar}</span>
                          <span className="session-run-copy">
                            <span className="session-run-mainline">
                              <span className="session-run-name">{agent.name}<span className="session-run-role">{run.runTrace?.role || 'agent'}</span></span>
                              <span className={`session-run-status ${run.status === 'error' ? 'session-run-status-needs-attention' : `session-run-status-${run.status}`}`}>
                                <span aria-label={`${normalizeRunLabel(run)} status: ${statusText}`}>{statusText}</span>
                              </span>
                              {needsAttention ? (
                                <span className="session-run-attention" title="Needs attention" aria-label={`${normalizeRunLabel(run)} needs attention`}>
                                  <AlertCircle size={10} aria-hidden="true" />
                                </span>
                              ) : null}
                              {steeringAvailable ? (
                                <span className="session-run-steerable" title="Steering available" aria-label={`Steering available for ${normalizeRunLabel(run)}`}>
                                  steerable
                                </span>
                              ) : null}
                            </span>
                            <span className="session-run-task" aria-label={`Current task: ${run.task || 'Working'}`}>{run.task || 'Working...'}</span>
                            {proof && (
                              <span className="session-run-proof" role="group" aria-label={`${proof.label}: ${proof.value}`}>
                                <span>{proof.label}</span>
                                <span>{proof.value}</span>
                              </span>
                            )}
                          </span>
                          <span
                            className="session-run-meta"
                            role="group"
                            aria-label={[
                              `model ${run.model}`,
                              run.runTrace?.providerId ? `provider ${run.runTrace.providerId}` : null,
                              `elapsed ${formatAgentDuration(run.startTime)}`,
                            ].filter(Boolean).join('. ')}
                          >
                            <span>
                              {run.model}
                              {run.runTrace?.providerId ? ` / ${run.runTrace.providerId}` : ''}
                            </span>
                            <span>{formatAgentDuration(run.startTime)}</span>
                          </span>
                        </button>
                        <div id={runChildrenId} className="session-run-children sub-agent-tree" role="list" aria-label={`${normalizeRunLabel(run)} phases`}>
                          {phases.length === 0 && (
                            <div className="session-run-empty" role="status" aria-live="polite">
                              No phase updates yet.
                            </div>
                          )}
                          {phases.map((agent) => (
                            <SubAgentRow
                              key={agent.id}
                              agent={agent}
                              onFocus={onFocusAgent ? () => onFocusAgent(agent.id) : undefined}
                              label={normalizePhaseLabel(agent)}
                              parentRole={run.runTrace?.role}
                              compact
                            />
                          ))}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
              </div>
            )}
        </div>
        );
      })}
    </>
  );
}

function groupSessionsByProject(sessions: SessionInfo[]) {
  const groups = new Map<string, { key: string; name: string; workingDir: string | null; sessions: SessionInfo[] }>();
  for (const session of sessions) {
    const workingDir = session.workingDir || null;
    const key = workingDir || '__no_project__';
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: workingDir ? basename(workingDir) : 'No Project',
        workingDir,
        sessions: [],
      });
    }
    groups.get(key)!.sessions.push(session);
  }
  return Array.from(groups.values());
}

function basename(path: string) {
  return path.split('/').filter(Boolean).pop() || path;
}

function SubAgentRow({
  agent,
  onFocus,
  label,
  parentRole,
  compact,
}: {
  agent: SubAgent;
  onFocus?: () => void;
  label?: string;
  parentRole?: string | null;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const phaseAgent = agentIdentityForRole(parentRole);
  const statusColor = {
    idle: 'var(--text-tertiary)',
    running: 'var(--accent-primary)',
    complete: 'var(--accent-success)',
    error: 'var(--accent-error)',
    blocked: 'var(--accent-error)',
  }[agent.status];

  const StatusIcon = {
    idle: Clock,
    running: Loader,
    complete: CheckCircle2,
    error: AlertCircle,
    blocked: AlertCircle,
  }[agent.status];
  const detailId = `sub-agent-detail-${safeDomId(agent.id)}`;
  const phaseAccessibleLabel = [
    `Focus ${label || agent.name}`,
    `status ${formatRunStatus(agent.status)}`,
    agent.task ? `task ${agent.task}` : null,
    agent.runTrace?.providerId ? `provider ${agent.runTrace.providerId}` : null,
    agent.model ? `model ${agent.model}` : null,
    latestRunArtifactCue(agent),
  ].filter(Boolean).join('. ');

  return (
    <div style={{ marginBottom: 2 }} role="listitem">
      <div
        className="sub-agent-row"
        style={compact ? { fontSize: 11, paddingTop: 4, paddingBottom: 4 } : undefined}
        role="group"
        aria-label={onFocus ? phaseAccessibleLabel : undefined}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          aria-expanded={expanded}
          aria-controls={detailId}
          aria-label={`${expanded ? 'Hide' : 'Show'} details for ${label || agent.name}`}
          style={{ display: 'inline-flex', cursor: 'pointer', border: 0, background: 'transparent', padding: 0 }}
        >
          {expanded
            ? <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} aria-hidden="true" />
            : <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} aria-hidden="true" />
          }
        </button>
        <span className="sub-agent-avatar agent-id-badge" aria-hidden="true">{phaseAgent.avatar}</span>
        <span className={`sub-agent-name-text ${agent.status === 'running' ? 'running' : ''}`}>
          {label || agent.name}
        </span>
            {compact && (
              <span
                className="sub-agent-name-text"
                style={{ color: 'var(--text-tertiary)' }}
                role="group"
                aria-label={[
                  agent.runTrace?.providerId ? `provider ${agent.runTrace.providerId}` : null,
                  agent.model ? `model ${agent.model}` : null,
                  latestRunArtifactCue(agent),
                  `status ${formatRunStatus(agent.status)}`,
                  `elapsed ${formatAgentDuration(agent.startTime)}`,
                  agent.task ? `task ${agent.task}` : null,
                ].filter(Boolean).join('. ')}
              >
            {(agent.status === 'error' || agent.status === 'blocked') && <span className="sub-agent-attention" title="Needs attention" aria-hidden="true">⚠ </span>}
            · {agent.runTrace?.providerId ? `${agent.runTrace.providerId} · ` : ''}{agent.model ? `${agent.model} · ` : ''}{latestRunArtifactCue(agent) ? `${latestRunArtifactCue(agent)} · ` : ''}{formatRunStatus(agent.status)} · {formatAgentDuration(agent.startTime)}
            {(agent.task ? ` · ${agent.task.slice(0, 24)}${agent.task.length > 24 ? '…' : ''}` : '')}
          </span>
        )}
        <StatusIcon
          size={12}
          aria-hidden="true"
          style={{
            color: statusColor,
            flexShrink: 0,
            ...(agent.status === 'running' ? { animation: 'spin 1s linear infinite' } : {}),
          }}
        />
        {onFocus && (
          <button
            type="button"
            className="sub-agent-row-focus-button"
            onClick={onFocus}
            aria-label={`Focus ${label || agent.name} in Agent detail`}
          >
            Focus
          </button>
        )}
      </div>

      {expanded && (
        <div id={detailId} className="sub-agent-detail" role="region" aria-label={`Details for ${label || agent.name}`}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{agent.task}</div>
          <div className="sub-agent-meta-row">
              <span>{agent.status === 'running' || agent.status === 'blocked' ? 'working' : formatRunStatus(agent.status)}</span>
            <span>{agent.model}</span>
            {agent.tokensUsed != null && <span>{(agent.tokensUsed / 1000).toFixed(1)}k tok</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatAgentDuration(startTime: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}
