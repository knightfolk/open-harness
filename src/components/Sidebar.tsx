import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  FolderOpen,
  Loader,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  SquareSplitHorizontal,
  SquareSplitVertical,
  Trash2,
} from 'lucide-react';
import type { SidebarTab, SubAgent, ProviderConfig, CodingRoleAssignment, MCPServerItem } from '../types';
import type { SessionInfo } from '../utils/api';
import { SideChatPanel } from './SideChatPanel';

interface Props {
  isOpen: boolean;
  sessions: SessionInfo[];
  activeSessionId?: string;
  activeTab: SidebarTab;
  activeSubAgents: SubAgent[];
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
  onDeleteSession?: (id: string) => void;
  onDeleteProject?: (workingDir: string | null) => void;
  clickyEnabled: boolean;
}

type SidebarSplit = 'vertical' | 'horizontal';

const tabConfig = [
  { key: 'chat' as SidebarTab, icon: MessageSquare, label: 'Chat' },
  { key: 'projects' as SidebarTab, icon: FolderOpen, label: 'Projects' },
];

export function Sidebar({
  isOpen,
  sessions,
  activeSessionId,
  activeTab,
  activeSubAgents,
  onActiveTabChange,
  onOpenSettings,
  onSelectSession,
  onNewSession,
  onOpenFolder,
  onFocusAgent,
  width,
  onDeleteSession,
  onDeleteProject,
  activeModel,
  providers,
  clickyEnabled,
}: Props) {
  const [clickyOpen, setClickyOpen] = useState(false);
  const [visiblePanels, setVisiblePanels] = useState({ chat: false, projects: true });
  const [split, setSplit] = useState<SidebarSplit>('vertical');
  const sideChatModels = providers.flatMap((provider) =>
    provider.models
      .filter((model) => model.enabled)
      .map((model) => ({ id: model.id, name: model.name || model.id }))
  );
  const splitLabel = split === 'vertical' ? 'Stack panels vertically' : 'Split panels horizontally';
  const SplitIcon = split === 'vertical' ? SquareSplitHorizontal : SquareSplitVertical;

  useEffect(() => {
    setVisiblePanels((prev) => ({ ...prev, [activeTab]: true }));
  }, [activeTab]);

  const togglePanel = (panel: SidebarTab) => {
    setVisiblePanels((prev) => {
      if (prev[panel] && Object.values(prev).filter(Boolean).length === 1) return prev;
      if (prev[panel]) {
        onActiveTabChange(panel === 'chat' ? 'projects' : 'chat');
      } else {
        onActiveTabChange(panel);
      }
      return { ...prev, [panel]: !prev[panel] };
    });
  };

  if (!isOpen) return null;

  return (
    <aside className="sidebar" style={width ? { width, minWidth: width } : undefined}>
      <div className="sidebar-tabs">
        {tabConfig.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            className={`sidebar-tab ${visiblePanels[key] ? 'active' : ''}`}
            onClick={() => togglePanel(key)}
            title={`${visiblePanels[key] ? 'Hide' : 'Show'} ${label}`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
        <button
          className="sidebar-tab sidebar-split-tab"
          onClick={() => setSplit((current) => current === 'vertical' ? 'horizontal' : 'vertical')}
          title={splitLabel}
          aria-label={splitLabel}
        >
          <SplitIcon size={14} />
        </button>
        <button
          className="sidebar-tab sidebar-gear-tab"
          onClick={onOpenSettings}
          title="Open settings"
          aria-label="Open settings"
        >
          <Settings size={14} />
        </button>
      </div>

      <div className={`sidebar-content sidebar-content--split-${split}`}>
        {visiblePanels.chat && (
          <div className="sidebar-panel sidebar-panel--chat">
            <SideChatPanel activeModel={activeModel} models={sideChatModels} />
          </div>
        )}
        {visiblePanels.projects && (
          <div className="sidebar-panel sidebar-panel--projects">
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
            onClick={() => setClickyOpen((open) => !open)}
            title="Clicky tips"
            aria-label="Open Clicky tips"
          >
            <Bot size={17} />
            <Sparkles size={10} className="clicky-spark" />
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
        <button className="new-session-btn" onClick={onOpenFolder}>
          <FolderOpen size={15} />
          New Project
        </button>
      )}
      {projectGroups.map((group) => {
        const collapsed = collapsedGroups.has(group.key);
        return (
        <div className={`project-group ${collapsed ? 'collapsed' : ''}`} key={group.key}>
          <div
            className="project-group-header"
            onClick={() => toggleGroup(group.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              toggleGroup(group.key);
            }}
            title={`${collapsed ? 'Expand' : 'Collapse'} ${group.name}`}
          >
            <div className="project-group-title">
              {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <FolderOpen size={13} />
              <span>{group.name}</span>
            </div>
            <div className="project-group-actions">
              <button
                className="sidebar-icon-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNewSession(group.workingDir);
                }}
                title={`New chat in ${group.name}`}
                aria-label={`New chat in ${group.name}`}
              >
                <Plus size={12} />
              </button>
              <span>{group.sessions.length}</span>
              {onDeleteProject && (
                <button
                  className="sidebar-icon-button danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete all chats for ${group.name}?`)) onDeleteProject(group.workingDir);
                  }}
                  title={`Delete ${group.name}`}
                  aria-label={`Delete ${group.name}`}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
          {!collapsed && group.sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isRunning = isActive && activeSubAgents.length > 0;
            return (
              <div key={session.id}>
                <div
                  className={`session-item ${isActive ? 'active' : ''} ${isActive && activeSubAgents.length > 0 ? 'has-agents' : ''}`}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="session-item-topline">
                    <div className="session-item-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isActive && isRunning && <div className="session-running-dot" />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {session.title}
                      </span>
                    </div>
                    {onDeleteSession && (
                      <button
                        className="sidebar-icon-button danger session-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete chat "${session.title}"?`)) onDeleteSession(session.id);
                        }}
                        title="Delete chat"
                        aria-label="Delete chat"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <div className="session-item-preview">
                    {session.preview || 'Empty session'}
                  </div>
                  <div className="session-item-time">
                    <Clock size={10} style={{ marginRight: 4, verticalAlign: -1 }} />
                    {formatRelativeTime(new Date(session.updatedAt))}
                  </div>
                </div>

                {isActive && activeSubAgents.length > 0 && (
                  <div className="sub-agent-tree">
                    {activeSubAgents.map((agent) => (
                      <SubAgentRow key={agent.id} agent={agent} onFocus={onFocusAgent ? () => onFocusAgent(agent.id) : undefined} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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

function SubAgentRow({ agent, onFocus }: { agent: SubAgent; onFocus?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = {
    idle: 'var(--text-tertiary)',
    running: 'var(--accent-primary)',
    complete: 'var(--accent-success)',
    error: 'var(--accent-error)',
  }[agent.status];

  const StatusIcon = {
    idle: Circle,
    running: Loader,
    complete: CheckCircle2,
    error: AlertCircle,
  }[agent.status];

  return (
    <div style={{ marginBottom: 2 }}>
      <div
        className="sub-agent-row"
        onClick={onFocus}
        role={onFocus ? 'button' : undefined}
        tabIndex={onFocus ? 0 : undefined}
        title={onFocus ? 'Focus on this agent' : undefined}
      >
        <span
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          style={{ display: 'inline-flex', cursor: 'pointer' }}
        >
          {expanded
            ? <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
            : <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
          }
        </span>
        <Bot size={13} style={{ color: statusColor, flexShrink: 0 }} />
        <span className={`sub-agent-name-text ${agent.status === 'running' ? 'running' : ''}`}>
          {agent.name}
        </span>
        <StatusIcon
          size={12}
          style={{
            color: statusColor,
            flexShrink: 0,
            ...(agent.status === 'running' ? { animation: 'spin 1s linear infinite' } : {}),
          }}
        />
      </div>

      {expanded && (
        <div className="sub-agent-detail">
          <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>{agent.task}</div>
          <div className="sub-agent-meta-row">
            <span>{agent.model}</span>
            {agent.tokensUsed != null && <span>{(agent.tokensUsed / 1000).toFixed(1)}k tok</span>}
            {agent.progress != null && agent.status === 'running' && (
              <span style={{ color: 'var(--accent-primary)' }}>{agent.progress}%</span>
            )}
          </div>
          {agent.status === 'running' && (
            <div className="sub-agent-mini-progress">
              <div className="sub-agent-mini-progress-bar" style={{ width: `${agent.progress || 0}%` }} />
            </div>
          )}
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
