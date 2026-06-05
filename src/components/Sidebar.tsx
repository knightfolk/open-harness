import { useState } from 'react';
import {
  MessageSquare, FileCode, Zap, Brain, Settings, Plus, Clock,
  Sparkles, Globe, Search, FileText,
  Command, Layout, Grid, Layers, Loader,
  ChevronDown, ChevronRight, CheckCircle2, Circle, Bot, AlertCircle, FolderOpen,
  Trash2,
} from 'lucide-react';
import type { SidebarTab, Skill, Plugin, MemoryEntry, SubAgent, ProviderConfig, CodingRoleAssignment, MCPServerItem } from '../types';
import type { SessionInfo } from '../utils/api';
import { mockSkills, mockPlugins, mockMemoryEntries } from '../utils/mockData';

interface Props {
  isOpen: boolean;
  sessions: SessionInfo[];
  activeSessionId?: string;
  activeSubAgents: SubAgent[];
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
}

const tabConfig = [
  { key: 'chat' as SidebarTab, icon: MessageSquare, label: 'Chat' },
  { key: 'skills' as SidebarTab, icon: Zap, label: 'Skills' },
  { key: 'memory' as SidebarTab, icon: Brain, label: 'Memory' },
];

const skillCategoryIcons: Record<string, typeof Sparkles> = {
  media: Sparkles,
  reference: FileText,
  meta: Settings,
  automation: Globe,
  web: Layout,
  review: Search,
  tools: Command,
  browser: Globe,
};

const memoryTypeIcons: Record<string, typeof Brain> = {
  file: FileCode,
  skill: Zap,
  context: Brain,
  plugin: Layers,
};

export function Sidebar({ isOpen, sessions, activeSessionId, activeSubAgents, onOpenSettings, onSelectSession, onNewSession, onOpenFolder, onFocusAgent, width, onDeleteSession, onDeleteProject }: Props) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('chat');

  if (!isOpen) return null;

  return (
    <aside className="sidebar" style={width ? { width, minWidth: width } : undefined}>
      <div className="sidebar-tabs">
        {tabConfig.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            className={`sidebar-tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {activeTab === 'chat' && (
          <ChatTab
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
        )}
        {activeTab === 'skills' && <SkillsTab skills={mockSkills} plugins={mockPlugins} />}
        {activeTab === 'memory' && <MemoryTab entries={mockMemoryEntries} />}
      </div>

      {/* Settings button pinned to sidebar bottom */}
      <div style={{ borderTop: '1px solid var(--border-primary)', padding: '8px 12px' }}>
        <button
          onClick={onOpenSettings}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-sm)', padding: '8px 12px', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
            transition: 'all var(--transition-fast)',
          }}
        >
          <Settings size={14} />
          Settings
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat Tab — sessions with nested sub-agents                        */
/* ------------------------------------------------------------------ */

function ChatTab({ sessions, activeSessionId, activeSubAgents, onSelectSession, onNewSession, onOpenFolder, onFocusAgent, onDeleteSession, onDeleteProject }: {
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
  const projectGroups = groupSessionsByProject(sessions);
  return (
    <>
      <button className="new-session-btn" onClick={() => onNewSession()}>
        <Plus size={15} />
        New Session
      </button>
      {onOpenFolder && (
        <button className="new-session-btn" onClick={onOpenFolder} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
          <FolderOpen size={15} />
          Open Folder
        </button>
      )}
      {projectGroups.map((group) => (
        <div className="project-group" key={group.key}>
          <div className="project-group-header">
            <div className="project-group-title">
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
          {group.sessions.map((session) => {
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
      ))}
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

/* ------------------------------------------------------------------ */
/*  Single sub-agent row in sidebar                                    */
/* ------------------------------------------------------------------ */

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
        role={onFocus ? "button" : undefined}
        tabIndex={onFocus ? 0 : undefined}
        title={onFocus ? "Focus on this agent" : undefined}
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

/* ------------------------------------------------------------------ */
/*  Skills Tab                                                         */
/* ------------------------------------------------------------------ */

function SkillsTab({ skills, plugins }: { skills: Skill[]; plugins: Plugin[] }) {
  const [showPlugins, setShowPlugins] = useState(false);

  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 4px 8px' }}>
        Skills ({skills.length})
      </div>
      {skills.map((skill) => {
        const Icon = skillCategoryIcons[skill.category] || Command;
        return (
          <div key={skill.name} className="skill-item">
            <div className="skill-icon">
              <Icon size={13} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div className="skill-info">
              <div className="skill-name">{skill.name}</div>
              <div className="skill-desc">{skill.description}</div>
            </div>
          </div>
        );
      })}

      <div
        style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '16px 4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={() => setShowPlugins(!showPlugins)}
      >
        Plugins ({plugins.length})
        {showPlugins ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </div>
      {showPlugins && plugins.map((plugin) => (
        <div key={plugin.name} className="skill-item" style={{ opacity: plugin.enabled ? 1 : 0.5 }}>
          <div className="skill-icon">
            <Grid size={13} style={{ color: plugin.enabled ? 'var(--accent-success)' : 'var(--text-tertiary)' }} />
          </div>
          <div className="skill-info">
            <div className="skill-name">{plugin.name}</div>
            <div className="skill-desc">{plugin.description}</div>
          </div>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Memory Tab                                                         */
/* ------------------------------------------------------------------ */

function MemoryTab({ entries }: { entries: MemoryEntry[] }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 4px 8px' }}>
        Active Memory
      </div>
      {entries.map((entry) => {
        const Icon = memoryTypeIcons[entry.type] || Brain;
        return (
          <div key={entry.id} className="memory-item">
            <div className="memory-type-icon">
              <Icon size={12} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div className="memory-info">
              <div className="memory-name">{entry.name}</div>
              <div className="memory-desc">{entry.description}</div>
              {entry.path && <div className="memory-path">{entry.path}</div>}
            </div>
          </div>
        );
      })}
    </>
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
