import { useState } from 'react';
import {
  MessageSquare, FileCode, Zap, Brain, Settings, Plus, Clock,
  Sparkles, Globe, Search, FileText,
  Command, Layout, Grid, Layers, Wrench, Palette, Image, PlayCircle, ShieldCheck, KeyRound, SlidersHorizontal,
  Server, MessageCircle, Check,
  ChevronDown, ChevronRight, Loader, CheckCircle2, Circle, Bot, AlertCircle, FolderOpen,
} from 'lucide-react';
import type { SidebarTab, Session, Skill, Plugin, MemoryEntry, SubAgent, ProviderConfig, CodingRoleAssignment } from '../types';
import { mockSkills, mockPlugins, mockMemoryEntries } from '../utils/mockData';

interface Props {
  isOpen: boolean;
  sessions: Session[];
  activeSessionId?: string;
  activeSubAgents: SubAgent[];
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  activeModel: string;
  providers: ProviderConfig[];
  roleAssignments: CodingRoleAssignment[];
  activeTheme: string;
  personalityText: string;
  onSelectModel: (modelId: string) => void;
  onToggleProviderModel: (providerId: string, modelId: string) => void;
  onAssignRoleModel: (roleId: string, modelId: string) => void;
  onSelectTheme: (themeId: string) => void;
  onPersonalityChange: (text: string) => void;
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

export function Sidebar({ isOpen, sessions, activeSessionId, activeSubAgents, activeModel, providers, roleAssignments, activeTheme, personalityText, onSelectModel, onToggleProviderModel, onAssignRoleModel, onSelectTheme, onPersonalityChange, onSelectSession, onNewSession, onOpenFolder }: Props) {
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
        {activeTab === 'settings' && (
          <SettingsTab
            activeModel={activeModel}
            providers={providers}
            roleAssignments={roleAssignments}
            activeTheme={activeTheme}
            personalityText={personalityText}
            onSelectModel={onSelectModel}
            onToggleProviderModel={onToggleProviderModel}
            onAssignRoleModel={onAssignRoleModel}
            onSelectTheme={onSelectTheme}
            onPersonalityChange={onPersonalityChange}
          />
        )}
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
  activeModel: string;
  providers: ProviderConfig[];
  roleAssignments: CodingRoleAssignment[];
  activeTheme: string;
  personalityText: string;
  onSelectModel: (modelId: string) => void;
  onToggleProviderModel: (providerId: string, modelId: string) => void;
  onAssignRoleModel: (roleId: string, modelId: string) => void;
  onSelectTheme: (themeId: string) => void;
  onPersonalityChange: (text: string) => void;
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

function SettingsTab({
  activeModel,
  providers,
  roleAssignments,
  activeTheme,
  personalityText,
  onSelectModel,
  onToggleProviderModel,
  onAssignRoleModel,
  onSelectTheme,
  onPersonalityChange,
}: {
  activeModel: string;
  providers: ProviderConfig[];
  roleAssignments: CodingRoleAssignment[];
  activeTheme: string;
  personalityText: string;
  onSelectModel: (modelId: string) => void;
  onToggleProviderModel: (providerId: string, modelId: string) => void;
  onAssignRoleModel: (roleId: string, modelId: string) => void;
  onSelectTheme: (themeId: string) => void;
  onPersonalityChange: (text: string) => void;
}) {
  const [settings, setSettings] = useState({
    streamResponses: true,
    showToolCalls: true,
    autoScroll: true,
    soundEffects: false,
  });
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddMcp, setShowAddMcp] = useState(false);

  const toggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledModels = providers.flatMap((provider) =>
    provider.models
      .filter((model) => model.enabled)
      .map((model) => ({ ...model, providerId: provider.id, providerName: provider.name }))
  );
  const activeModelMeta = enabledModels.find((model) => model.id === activeModel) || enabledModels[0];

  // Theme swatch data
  const themes = [
    { id: 'midnight', label: 'Midnight', color: '#6366f1', group: 'dark' as const },
    { id: 'charcoal', label: 'Charcoal', color: '#a1a1aa', group: 'dark' as const },
    { id: 'forest', label: 'Forest', color: '#10b981', group: 'dark' as const },
    { id: 'crimson', label: 'Crimson', color: '#f43f5e', group: 'dark' as const },
    { id: 'daylight', label: 'Daylight', color: '#6366f1', group: 'light' as const },
    { id: 'silver', label: 'Silver', color: '#3b82f6', group: 'light' as const },
    { id: 'sage', label: 'Sage', color: '#10b981', group: 'light' as const },
    { id: 'blush', label: 'Blush', color: '#f43f5e', group: 'light' as const },
  ];
  const darkThemes = themes.filter((t) => t.group === 'dark');
  const lightThemes = themes.filter((t) => t.group === 'light');

  // Personality presets
  const personalityPresets = [
    { id: 'professional', label: 'Professional', text: 'You are a professional software engineering assistant. Be thorough, well-structured, and prioritize code quality and best practices.' },
    { id: 'concise', label: 'Concise', text: 'Be brief and direct. Show code, skip preamble. Focus on what changed and why.' },
    { id: 'detailed', label: 'Detailed', text: 'Explain your reasoning step by step. Include context, alternatives considered, and tradeoffs. Teach while you code.' },
    { id: 'creative', label: 'Creative', text: 'Think outside the box. Suggest unconventional approaches when appropriate. Prioritize elegance and developer experience.' },
  ];

  return (
    <>
      {/* ── Hero ── */}
      <div className="settings-hero">
        <div>
          <div className="settings-hero-kicker">Model routing</div>
          <div className="settings-hero-title">Configured providers only</div>
          <div className="settings-hero-copy">
            Open-Harness will only show models from providers you have actually added and enabled.
          </div>
        </div>
        <div className="settings-hero-pill">{providers.length} provider{providers.length !== 1 ? 's' : ''}</div>
      </div>

      {/* ── Active Chat Model ── */}
      <div className="settings-section">
        <div className="settings-section-title">Active chat model</div>
        <div className="settings-card settings-current-model">
          <div>
            <div className="settings-item-label">{activeModelMeta?.name || activeModel}</div>
            <div className="settings-item-desc">
              {activeModelMeta ? `${activeModelMeta.providerName} • enabled for chat` : 'No enabled provider model found'}
            </div>
          </div>
          <select
            className="settings-select settings-select-wide"
            value={activeModel}
            onChange={(e) => onSelectModel(e.target.value)}
          >
            {enabledModels.map((model) => (
              <option key={`${model.providerId}:${model.id}`} value={model.id}>{model.providerName} — {model.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Providers ── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">Providers</div>
          <button className="settings-mini-button" onClick={() => setShowAddProvider((value) => !value)}>
            <Plus size={12} /> Add Provider
          </button>
        </div>

        {providers.map((provider) => (
          <div key={provider.id} className="provider-card">
            <div className="provider-card-header">
              <div className="provider-logo"><KeyRound size={14} /></div>
              <div className="provider-title-block">
                <div className="provider-title-row">
                  <span className="provider-name">{provider.name}</span>
                  <span className={`provider-status ${provider.configured ? 'ready' : 'missing'}`}>
                    {provider.configured ? 'Configured' : 'Needs key'}
                  </span>
                </div>
                <div className="provider-meta">{provider.type} • {provider.endpointLabel}</div>
              </div>
            </div>
            <div className="provider-model-list">
              {provider.models.map((model) => (
                <div key={model.id} className="provider-model-row">
                  <div>
                    <div className="provider-model-name">{model.name}</div>
                    <div className="provider-model-id">{model.id}</div>
                  </div>
                  <div
                    className={`toggle ${model.enabled ? 'active' : ''}`}
                    onClick={() => onToggleProviderModel(provider.id, model.id)}
                    title={model.enabled ? 'Hide this model from selectors' : 'Enable this model'}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {showAddProvider && (
          <div className="add-provider-card">
            <div className="add-provider-title"><SlidersHorizontal size={14} /> Add Provider skeleton</div>
            <div className="add-provider-grid">
              <label>Provider name<input value="" placeholder="OpenAI, Z.AI, DeepSeek, local Ollama..." readOnly /></label>
              <label>API key<input value="" placeholder="Paste key when secure storage is wired" readOnly /></label>
              <label>Endpoint<input value="" placeholder="https://api.example.com/v1" readOnly /></label>
              <label>Type<select value="openai-compatible" disabled><option value="openai-compatible">OpenAI-compatible</option></select></label>
            </div>
            <div className="settings-note">
              Next wiring step: save providers securely, test the connection, then fetch or enter available models.
            </div>
          </div>
        )}
      </div>

      {/* ── Coding Role Buckets ── */}
      <div className="settings-section">
        <div className="settings-section-title">Coding role buckets</div>
        <div className="settings-note">
          Assign enabled models to the roles Open-Harness will use for efficient coding work. Recommendations will come from the model research task.
        </div>
        <div className="role-bucket-list">
          {roleAssignments.map((role) => {
            const Icon = roleIconMap[role.id] || Bot;
            return (
              <div key={role.id} className="role-bucket-card">
                <div className="role-bucket-icon"><Icon size={15} /></div>
                <div className="role-bucket-body">
                  <div className="role-bucket-name">{role.name}</div>
                  <div className="role-bucket-desc">{role.description}</div>
                  <select
                    className="settings-select settings-select-wide"
                    value={role.modelId}
                    onChange={(e) => onAssignRoleModel(role.id, e.target.value)}
                  >
                    {enabledModels.map((model) => (
                      <option key={`${role.id}:${model.providerId}:${model.id}`} value={model.id}>{model.providerName} — {model.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MCP Servers ── */}
      <div className="settings-section">
        <div className="settings-section-header">
          <div className="settings-section-title">MCP Servers</div>
          <button className="settings-mini-button" onClick={() => setShowAddMcp((value) => !value)}>
            <Plus size={12} /> Add Server
          </button>
        </div>
        <div className="settings-note" style={{ marginBottom: 8 }}>
          Model Context Protocol servers give the agent tools, resources, and prompts. DOCK_MPC is the built-in server.
        </div>

        {/* DOCK_MPC preset card */}
        <div className="provider-card">
          <div className="provider-card-header">
            <div className="provider-logo"><Server size={14} /></div>
            <div className="provider-title-block">
              <div className="provider-title-row">
                <span className="provider-name">DOCK_MPC</span>
                <span className="provider-status ready">Built-in</span>
              </div>
              <div className="provider-meta">mcp • stdio://dock-mpc</div>
            </div>
          </div>
          <div style={{ padding: '6px 0 2px', borderTop: '1px solid var(--border-primary)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Provides filesystem access, terminal commands, code search, and git operations.
              Enabled by default — no configuration needed.
            </div>
          </div>
        </div>

        {/* Custom server list placeholder */}
        <div className="settings-card" style={{ textAlign: 'center', padding: '12px 8px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            No custom MCP servers configured
          </div>
        </div>

        {/* Add server skeleton */}
        {showAddMcp && (
          <div className="add-provider-card">
            <div className="add-provider-title"><Server size={14} /> Add MCP Server</div>
            <div className="add-provider-grid">
              <label>Server name<input value="" placeholder="my-tools-server" readOnly /></label>
              <label>Endpoint<input value="" placeholder="stdio://./my-server or http://..." readOnly /></label>
              <label>Auth type<select value="none" disabled><option value="none">None</option><option value="bearer">Bearer token</option></select></label>
              <label>Status<select value="disabled" disabled><option value="disabled">Disabled</option><option value="enabled">Enabled</option></select></label>
            </div>
            <div className="settings-note">
              Future: test connection, auto-discover tools, persist config.
            </div>
          </div>
        )}
      </div>

      {/* ── Personality ── */}
      <div className="settings-section">
        <div className="settings-section-title">Agent personality</div>
        <div className="settings-note" style={{ marginBottom: 6 }}>
          Customize how the agent communicates with you.
        </div>
        {/* Preset pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {personalityPresets.map((preset) => (
            <button
              key={preset.id}
              className="settings-mini-button"
              style={personalityText === preset.text ? { background: 'var(--accent-primary)', color: 'white' } : {}}
              onClick={() => onPersonalityChange(personalityText === preset.text ? '' : preset.text)}
            >
              <MessageCircle size={11} /> {preset.label}
            </button>
          ))}
        </div>
        <textarea
          className="personality-textarea"
          placeholder="E.g., Be concise and direct. Focus on code quality over explanation."
          value={personalityText}
          onChange={(e) => onPersonalityChange(e.target.value)}
          rows={3}
        />
      </div>

      {/* ── Theme ── */}
      <div className="settings-section">
        <div className="settings-section-title">Theme</div>
        <div className="settings-note" style={{ marginBottom: 8 }}>
          Choose a colorway. Dark themes are on the left, light themes on the right.
        </div>
        <div className="theme-swatches">
          <div className="theme-swatch-group">
            <div className="theme-swatch-group-label">Dark</div>
            <div className="theme-swatch-row">
              {darkThemes.map((t) => (
                <button
                  key={t.id}
                  className={`theme-swatch ${activeTheme === t.id ? 'active' : ''}`}
                  style={{ background: t.color }}
                  onClick={() => onSelectTheme(t.id)}
                  title={t.label}
                >
                  {activeTheme === t.id && <Check size={10} />}
                </button>
              ))}
            </div>
          </div>
          <div className="theme-swatch-group">
            <div className="theme-swatch-group-label">Light</div>
            <div className="theme-swatch-row">
              {lightThemes.map((t) => (
                <button
                  key={t.id}
                  className={`theme-swatch ${activeTheme === t.id ? 'active' : ''}`}
                  style={{ background: t.color }}
                  onClick={() => onSelectTheme(t.id)}
                  title={t.label}
                >
                  {activeTheme === t.id && <Check size={10} />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'capitalize' }}>
          Active: {themes.find((t) => t.id === activeTheme)?.label}
        </div>
      </div>

      {/* ── Chat settings ── */}
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

      {/* ── Future research ── */}
      <div className="settings-section">
        <div className="settings-section-title">Future research task</div>
        <div className="research-task-card">
          <Sparkles size={15} />
          <div>
            <div className="research-task-title">Top 30 coding model map</div>
            <div className="research-task-copy">
              Research model strengths, weaknesses, pricing boundaries, context limits, tool-use quality, and best-fit coding buckets before showing suggestions here.
            </div>
          </div>
        </div>
      </div>

      {/* ── About ── */}
      <div className="settings-section">
        <div className="settings-section-title">About</div>
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Open-Harness v1.0.0<br />
          A universal AI provider harness<br />
          Current live provider: MiniMax
        </div>
      </div>
    </>
  );
}


const roleIconMap: Record<string, typeof Bot> = {
  planning: Brain,
  implementation: FileCode,
  bugfix: Wrench,
  design: Palette,
  image: Image,
  toolrunning: PlayCircle,
  review: ShieldCheck,
};
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
