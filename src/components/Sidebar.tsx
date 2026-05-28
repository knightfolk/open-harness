import { useState } from 'react';
import {
  MessageSquare, FileCode, Zap, Brain, Settings, Plus, Clock,
  Sparkles, Globe, Search, FileText,
  Command, Layout, Grid, Layers,
  ChevronDown, ChevronRight, Loader, CheckCircle2, Circle, Bot, AlertCircle, FolderOpen,
} from 'lucide-react';
import type { SidebarTab, Session, Skill, Plugin, MemoryEntry, SubAgent } from '../types';
import { mockSkills, mockPlugins, mockMemoryEntries } from '../utils/mockData';

interface Props {
  isOpen: boolean;
  sessions: Session[];
  activeSessionId?: string;
  activeSubAgents: SubAgent[];
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onOpenFolder?: () => void;
}

const tabConfig = [
  { key: 'chat' as SidebarTab, icon: MessageSquare, label: 'Chat' },
  { key: 'skills' as SidebarTab, icon: Zap, label: 'Skills' },
  { key: 'memory' as SidebarTab, icon: Brain, label: 'Memory' },
  { key: 'settings' as SidebarTab, icon: Settings, label: 'Settings' },
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

export function Sidebar({ isOpen, sessions, activeSessionId, activeSubAgents, onSelectSession, onNewSession, onOpenFolder }: Props) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('chat');

  if (!isOpen) return null;

  return (
    <aside className="sidebar">
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
          />
        )}
        {activeTab === 'skills' && <SkillsTab skills={mockSkills} plugins={mockPlugins} />}
        {activeTab === 'memory' && <MemoryTab entries={mockMemoryEntries} />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Chat Tab — sessions with nested sub-agents                        */
/* ------------------------------------------------------------------ */

function ChatTab({ sessions, activeSessionId, activeSubAgents, onSelectSession, onNewSession, onOpenFolder }: {
  sessions: Session[];
  activeSessionId?: string;
  activeSubAgents: SubAgent[];
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onOpenFolder?: () => void;
}) {
  return (
    <>
      <button className="new-session-btn" onClick={onNewSession}>
        <Plus size={15} />
        New Session
      </button>
      {onOpenFolder && (
        <button className="new-session-btn" onClick={onOpenFolder} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
          <FolderOpen size={15} />
          Open Folder
        </button>
      )}
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId;
        const isRunning = isActive && activeSubAgents.length > 0;
        return (
          <div key={session.id}>
            {/* Main session row */}
            <div
              className={`session-item ${isActive ? 'active' : ''} ${isActive && activeSubAgents.length > 0 ? 'has-agents' : ''}`}
              onClick={() => onSelectSession(session.id)}
            >
              <div className="session-item-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isActive && isRunning && (
                  <div className="session-running-dot" />
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.title}
                </span>
              </div>
              <div className="session-item-preview">
                {session.messages.length > 0
                  ? session.messages[session.messages.length - 1].content.slice(0, 60) + '...'
                  : 'Empty session'}
              </div>
              <div className="session-item-time">
                <Clock size={10} style={{ marginRight: 4, verticalAlign: -1 }} />
                {formatRelativeTime(session.updatedAt)}
              </div>
            </div>

            {/* Sub-agents nested under the active session */}
            {isActive && activeSubAgents.length > 0 && (
              <div className="sub-agent-tree">
                {activeSubAgents.map((agent) => (
                  <SubAgentRow key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Single sub-agent row in sidebar                                    */
/* ------------------------------------------------------------------ */

function SubAgentRow({ agent }: { agent: SubAgent }) {
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
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
          : <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-tertiary)' }} />
        }
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

/* ------------------------------------------------------------------ */
/*  Settings Tab                                                       */
/* ------------------------------------------------------------------ */

function SettingsTab() {
  const [settings, setSettings] = useState({
    streamResponses: true,
    showToolCalls: true,
    autoScroll: true,
    soundEffects: false,
    model: 'o3',
    theme: 'dark',
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <div className="settings-section">
        <div className="settings-section-title">General</div>
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Model</div>
          </div>
          <select className="settings-select" value={settings.model} onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}>
            <option value="o3">o3</option>
            <option value="o4-mini">o4-mini</option>
            <option value="gpt-4.1">gpt-4.1</option>
            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            <option value="gpt-4.1-nano">gpt-4.1-nano</option>
          </select>
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Theme</div>
          </div>
          <select className="settings-select" value={settings.theme} onChange={(e) => setSettings((s) => ({ ...s, theme: e.target.value }))}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Chat</div>
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Stream responses</div>
            <div className="settings-item-desc">Show text as it generates</div>
          </div>
          <div className={`toggle ${settings.streamResponses ? 'active' : ''}`} onClick={() => toggle('streamResponses')} />
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Show tool calls</div>
            <div className="settings-item-desc">Display agent tool usage inline</div>
          </div>
          <div className={`toggle ${settings.showToolCalls ? 'active' : ''}`} onClick={() => toggle('showToolCalls')} />
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Auto-scroll</div>
            <div className="settings-item-desc">Follow new messages automatically</div>
          </div>
          <div className={`toggle ${settings.autoScroll ? 'active' : ''}`} onClick={() => toggle('autoScroll')} />
        </div>
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Sound effects</div>
            <div className="settings-item-desc">Play sounds on completion</div>
          </div>
          <div className={`toggle ${settings.soundEffects ? 'active' : ''}`} onClick={() => toggle('soundEffects')} />
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">About</div>
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          CMDui v1.0.0<br />
          A polished, modern agent desktop UI<br />
          Inspired by Codex Desktop
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
