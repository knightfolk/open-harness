import { useState } from 'react';
import {
  MessageSquare, FileCode, Zap, Brain, Settings, Plus, Clock,
  Sparkles, Globe, Search, FileText,
  Command, Layout, Grid, Layers, Wrench, Palette, Image, PlayCircle, ShieldCheck, KeyRound, SlidersHorizontal,
  Server, MessageCircle, Check, Trash2, RefreshCw, Loader, Wifi,
  ChevronDown, ChevronRight, CheckCircle2, Circle, Bot, AlertCircle, FolderOpen,
} from 'lucide-react';
import type { SidebarTab, Session, Skill, Plugin, MemoryEntry, SubAgent, ProviderConfig, CodingRoleAssignment, MCPServerItem } from '../types';
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

export function Sidebar({ isOpen, sessions, activeSessionId, activeSubAgents, activeModel, providers, roleAssignments, activeTheme, personalityText, mcpServers, mcpStatus, onOpenSettings, onAddProvider, onTestProvider, onFetchModels, onRemoveProvider, onAddMCPServer, onRemoveMCPServer, onSelectModel, onToggleProviderModel, onAssignRoleModel, onSelectTheme, onPersonalityChange, onSelectSession, onNewSession, onOpenFolder }: Props) {
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
  mcpServers: MCPServerItem[];
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
  mcpServers,
  mcpStatus,
  onAddProvider,
  onTestProvider,
  onFetchModels,
  onRemoveProvider,
  onAddMCPServer,
  onRemoveMCPServer,
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
  mcpServers: MCPServerItem[];
  mcpStatus: any[];
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
}) {
  const [settings, setSettings] = useState({ streamResponses: true, showToolCalls: true, autoScroll: true, soundEffects: false });
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [showAddMcp, setShowAddMcp] = useState(false);

  // Add Provider form state
  const [newProvName, setNewProvName] = useState('');
  const [newProvKey, setNewProvKey] = useState('');
  const [newProvURL, setNewProvURL] = useState('');
  const [newProvType, setNewProvType] = useState('openai-compatible');
  const [provSaving, setProvSaving] = useState(false);
  const [provError, setProvError] = useState('');

  // Provider test/fetch state: providerId -> status
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latencyMs?: number; modelsCount?: number; error?: string }>>({});
  const [fetchingModels, setFetchingModels] = useState<string | null>(null);

  // Add MCP form state
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpEndpoint, setNewMcpEndpoint] = useState('');
  const [newMcpAuthType, setNewMcpAuthType] = useState('none');
  const [newMcpAuthToken, setNewMcpAuthToken] = useState('');
  const [mcpSaving, setMcpSaving] = useState(false);
  const [mcpError, setMcpError] = useState('');

  const toggle = (key: keyof typeof settings) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const enabledModels = providers.flatMap((provider) =>
    provider.models.filter((model) => model.enabled).map((model) => ({ ...model, providerId: provider.id, providerName: provider.name }))
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

  const personalityPresets = [
    { id: 'professional', label: 'Professional', text: 'You are a professional software engineering assistant. Be thorough, well-structured, and prioritize code quality and best practices.' },
    { id: 'concise', label: 'Concise', text: 'Be brief and direct. Show code, skip preamble. Focus on what changed and why.' },
    { id: 'detailed', label: 'Detailed', text: 'Explain your reasoning step by step. Include context, alternatives considered, and tradeoffs. Teach while you code.' },
    { id: 'creative', label: 'Creative', text: 'Think outside the box. Suggest unconventional approaches when appropriate. Prioritize elegance and developer experience.' },
  ];

  // ── Handler: save new provider ──
  const handleSaveProvider = async () => {
    if (!newProvName.trim() || !newProvURL.trim()) { setProvError('Name and endpoint are required'); return; }
    setProvSaving(true); setProvError('');
    try {
      await onAddProvider({ name: newProvName.trim(), type: newProvType, apiKey: newProvKey, baseURL: newProvURL.trim() });
      setNewProvName(''); setNewProvKey(''); setNewProvURL(''); setShowAddProvider(false);
    } catch (e: any) {
      setProvError(e.message || 'Failed to add provider');
    } finally { setProvSaving(false); }
  };

  // ── Handler: test provider ──
  const handleTestProvider = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const result = await onTestProvider(providerId);
      setTestResults((prev) => ({ ...prev, [providerId]: result }));
    } catch (e: any) {
      setTestResults((prev) => ({ ...prev, [providerId]: { ok: false, error: e.message || 'Test failed' } }));
    } finally { setTestingProvider(null); }
  };

  // ── Handler: fetch models ──
  const handleFetchModels = async (providerId: string) => {
    setFetchingModels(providerId);
    try { await onFetchModels(providerId); } catch { /* error shown in UI via provider.models */ }
    finally { setFetchingModels(null); }
  };

  // ── Handler: save new MCP server ──
  const handleSaveMcp = async () => {
    if (!newMcpName.trim() || !newMcpEndpoint.trim()) { setMcpError('Name and endpoint are required'); return; }
    setMcpSaving(true); setMcpError('');
    try {
      await onAddMCPServer({ name: newMcpName.trim(), endpoint: newMcpEndpoint.trim(), authType: newMcpAuthType, authToken: newMcpAuthToken });
      setNewMcpName(''); setNewMcpEndpoint(''); setNewMcpAuthToken(''); setShowAddMcp(false);
    } catch (e: any) {
      setMcpError(e.message || 'Failed to add server');
    } finally { setMcpSaving(false); }
  };

  const customMcpServers = mcpServers.filter((s) => !s.builtIn);
  const dockerMcp = mcpServers.find((s) => s.builtIn);

  return (
    <>
      {/* ── Hero ── */}
      <div className="settings-hero">
        <div>
          <div className="settings-hero-kicker">Model routing</div>
          <div className="settings-hero-title">Configured providers only</div>
          <div className="settings-hero-copy">Open-Harness will only show models from providers you have actually added and enabled.</div>
        </div>
        <div className="settings-hero-pill">{providers.length} provider{providers.length !== 1 ? 's' : ''}</div>
      </div>

      {/* ── Active Chat Model ── */}
      <div className="settings-section">
        <div className="settings-section-title">Active chat model</div>
        <div className="settings-card settings-current-model">
          <div>
            <div className="settings-item-label">{activeModelMeta?.name || activeModel}</div>
            <div className="settings-item-desc">{activeModelMeta ? `${activeModelMeta.providerName} • enabled for chat` : 'No enabled model found'}</div>
          </div>
          <select className="settings-select settings-select-wide" value={activeModel} onChange={(e) => onSelectModel(e.target.value)}>
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
          <button className="settings-mini-button" onClick={() => setShowAddProvider((v) => !v)}>
            <Plus size={12} /> Add Provider
          </button>
        </div>

        {providers.map((provider) => {
          const testResult = testResults[provider.id];
          return (
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

              {/* Test / Fetch / Remove row */}
              <div className="provider-actions-row">
                <button className="settings-mini-button" onClick={() => handleTestProvider(provider.id)} disabled={testingProvider === provider.id}>
                  {testingProvider === provider.id ? <Loader size={11} className="spin" /> : <Wifi size={11} />}
                  {testingProvider === provider.id ? 'Testing...' : 'Test'}
                </button>
                <button className="settings-mini-button" onClick={() => handleFetchModels(provider.id)} disabled={fetchingModels === provider.id}>
                  {fetchingModels === provider.id ? <Loader size={11} className="spin" /> : <RefreshCw size={11} />}
                  {fetchingModels === provider.id ? 'Fetching...' : 'Fetch Models'}
                </button>
                <button className="settings-mini-button" style={{ marginLeft: 'auto', color: 'var(--accent-error)', background: 'var(--accent-error-muted)' }} onClick={() => onRemoveProvider(provider.id)}>
                  <Trash2 size={11} /> Remove
                </button>
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`test-result ${testResult.ok ? 'success' : 'error'}`}>
                  {testResult.ok
                    ? `✓ Connected in ${testResult.latencyMs}ms — ${testResult.modelsCount} models available`
                    : `✗ ${testResult.error || 'Connection failed'}`}
                </div>
              )}

              {/* Model list */}
              {provider.models.length > 0 && (
                <div className="provider-model-list">
                  {provider.models.map((model) => (
                    <div key={model.id} className="provider-model-row">
                      <div>
                        <div className="provider-model-name">{model.name}</div>
                        <div className="provider-model-id">{model.id}</div>
                      </div>
                      <div className={`toggle ${model.enabled ? 'active' : ''}`} onClick={() => onToggleProviderModel(provider.id, model.id)} title={model.enabled ? 'Hide from selectors' : 'Enable'} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Provider form */}
        {showAddProvider && (
          <div className="add-provider-card">
            <div className="add-provider-title"><SlidersHorizontal size={14} /> Add new provider</div>
            <div className="add-provider-grid">
              <label>Provider name<input value={newProvName} onChange={(e) => setNewProvName(e.target.value)} placeholder="OpenAI, Z.AI, DeepSeek, Ollama..." /></label>
              <label>API key<input type="password" value={newProvKey} onChange={(e) => setNewProvKey(e.target.value)} placeholder="Paste your API key" /></label>
              <label>Endpoint<input value={newProvURL} onChange={(e) => setNewProvURL(e.target.value)} placeholder="https://api.example.com/v1" /></label>
              <label>Type
                <select value={newProvType} onChange={(e) => setNewProvType(e.target.value)}>
                  <option value="openai-compatible">OpenAI-compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="local">Local (Ollama, LM Studio)</option>
                </select>
              </label>
            </div>
            {provError && <div className="test-result error">{provError}</div>}
            <div className="add-provider-actions">
              <button className="settings-mini-button" onClick={() => { setShowAddProvider(false); setProvError(''); }}>Cancel</button>
              <button className="settings-mini-button" style={{ background: 'var(--accent-primary)', color: 'white' }} onClick={handleSaveProvider} disabled={provSaving}>
                {provSaving ? <Loader size={11} className="spin" /> : <Check size={11} />}
                {provSaving ? 'Saving...' : 'Save & Test'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Coding Role Buckets ── */}
      <div className="settings-section">
        <div className="settings-section-title">Coding role buckets</div>
        <div className="settings-note">Assign enabled models to coding-specific roles. Models marked ✓ Recommended are good fits based on their capabilities.</div>
        <div className="role-bucket-list">
          {roleAssignments.map((role) => {
            const Icon = roleIconMap[role.id] || Bot;
            return (
              <div key={role.id} className="role-bucket-card">
                <div className="role-bucket-icon"><Icon size={15} /></div>
                <div className="role-bucket-body">
                  <div className="role-bucket-name">{role.name}</div>
                  <div className="role-bucket-desc">{role.description}</div>
                  <select className="settings-select settings-select-wide" value={role.modelId} onChange={(e) => onAssignRoleModel(role.id, e.target.value)}>
                    {enabledModels.map((model) => {
                      const recommended = isModelRecommended(role.id, model.id);
                      return (
                        <option key={`${role.id}:${model.providerId}:${model.id}`} value={model.id}>
                          {recommended ? '✓ ' : ''}{model.providerName} — {model.name}{recommended ? ' (Recommended)' : ''}
                        </option>
                      );
                    })}
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
          <button className="settings-mini-button" onClick={() => setShowAddMcp((v) => !v)}>
            <Plus size={12} /> Add Server
          </button>
        </div>
        <div className="settings-note" style={{ marginBottom: 8 }}>
          Model Context Protocol servers provide tools, resources, and prompts to the agent.
        </div>

        {/* Docker MCP built-in */}
        {dockerMcp && (
          <DockerMCPCard dockerMcp={dockerMcp} mcpStatus={mcpStatus} />
        )}

        {/* Custom servers */}
        {customMcpServers.map((server) => (
          <div key={server.id} className="provider-card">
            <div className="provider-card-header">
              <div className="provider-logo"><Server size={14} /></div>
              <div className="provider-title-block">
                <div className="provider-title-row">
                  <span className="provider-name">{server.name}</span>
                  <span className={`provider-status ${server.enabled ? 'ready' : 'missing'}`}>
                    {server.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="provider-meta">{server.authType} • {server.endpoint}</div>
              </div>
            </div>
            <div className="provider-actions-row">
              <button className="settings-mini-button" style={{ marginLeft: 'auto', color: 'var(--accent-error)', background: 'var(--accent-error-muted)' }} onClick={() => onRemoveMCPServer(server.id)}>
                <Trash2 size={11} /> Remove
              </button>
            </div>
          </div>
        ))}

        {customMcpServers.length === 0 && !showAddMcp && (
          <div className="settings-card" style={{ textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No custom MCP servers configured</div>
          </div>
        )}

        {/* Add MCP server form */}
        {showAddMcp && (
          <div className="add-provider-card">
            <div className="add-provider-title"><Server size={14} /> Add MCP Server</div>
            <div className="add-provider-grid">
              <label>Server name<input value={newMcpName} onChange={(e) => setNewMcpName(e.target.value)} placeholder="my-tools-server" /></label>
              <label>Endpoint<input value={newMcpEndpoint} onChange={(e) => setNewMcpEndpoint(e.target.value)} placeholder="stdio://./my-server or http://..." /></label>
              <label>Auth type
                <select value={newMcpAuthType} onChange={(e) => setNewMcpAuthType(e.target.value)}>
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                </select>
              </label>
              {newMcpAuthType === 'bearer' && (
                <label>Auth token<input type="password" value={newMcpAuthToken} onChange={(e) => setNewMcpAuthToken(e.target.value)} placeholder="Paste bearer token" /></label>
              )}
            </div>
            {mcpError && <div className="test-result error">{mcpError}</div>}
            <div className="add-provider-actions">
              <button className="settings-mini-button" onClick={() => { setShowAddMcp(false); setMcpError(''); }}>Cancel</button>
              <button className="settings-mini-button" style={{ background: 'var(--accent-primary)', color: 'white' }} onClick={handleSaveMcp} disabled={mcpSaving}>
                {mcpSaving ? <Loader size={11} className="spin" /> : <Check size={11} />}
                {mcpSaving ? 'Saving...' : 'Add Server'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Personality ── */}
      <div className="settings-section">
        <div className="settings-section-title">Agent personality</div>
        <div className="settings-note" style={{ marginBottom: 6 }}>Customize how the agent communicates with you.</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {personalityPresets.map((preset) => (
            <button key={preset.id} className="settings-mini-button" style={personalityText === preset.text ? { background: 'var(--accent-primary)', color: 'white' } : {}} onClick={() => onPersonalityChange(personalityText === preset.text ? '' : preset.text)}>
              <MessageCircle size={11} /> {preset.label}
            </button>
          ))}
        </div>
        <textarea className="personality-textarea" placeholder="E.g., Be concise and direct. Focus on code quality over explanation." value={personalityText} onChange={(e) => onPersonalityChange(e.target.value)} rows={3} />
      </div>

      {/* ── Theme ── */}
      <div className="settings-section">
        <div className="settings-section-title">Theme</div>
        <div className="settings-note" style={{ marginBottom: 8 }}>Choose a colorway. Dark on the left, light on the right.</div>
        <div className="theme-swatches">
          <div className="theme-swatch-group">
            <div className="theme-swatch-group-label">Dark</div>
            <div className="theme-swatch-row">
              {darkThemes.map((t) => (<button key={t.id} className={`theme-swatch ${activeTheme === t.id ? 'active' : ''}`} style={{ background: t.color }} onClick={() => onSelectTheme(t.id)} title={t.label}>{activeTheme === t.id && <Check size={10} />}</button>))}
            </div>
          </div>
          <div className="theme-swatch-group">
            <div className="theme-swatch-group-label">Light</div>
            <div className="theme-swatch-row">
              {lightThemes.map((t) => (<button key={t.id} className={`theme-swatch ${activeTheme === t.id ? 'active' : ''}`} style={{ background: t.color }} onClick={() => onSelectTheme(t.id)} title={t.label}>{activeTheme === t.id && <Check size={10} />}</button>))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'capitalize' }}>Active: {themes.find((t) => t.id === activeTheme)?.label}</div>
      </div>

      {/* ── Chat ── */}
      <div className="settings-section">
        <div className="settings-section-title">Chat</div>
        <div className="settings-item"><div><div className="settings-item-label">Stream responses</div><div className="settings-item-desc">Show text as it generates</div></div><div className={`toggle ${settings.streamResponses ? 'active' : ''}`} onClick={() => toggle('streamResponses')} /></div>
        <div className="settings-item"><div><div className="settings-item-label">Show tool calls</div><div className="settings-item-desc">Display agent tool usage inline</div></div><div className={`toggle ${settings.showToolCalls ? 'active' : ''}`} onClick={() => toggle('showToolCalls')} /></div>
        <div className="settings-item"><div><div className="settings-item-label">Auto-scroll</div><div className="settings-item-desc">Follow new messages automatically</div></div><div className={`toggle ${settings.autoScroll ? 'active' : ''}`} onClick={() => toggle('autoScroll')} /></div>
        <div className="settings-item"><div><div className="settings-item-label">Sound effects</div><div className="settings-item-desc">Play sounds on completion</div></div><div className={`toggle ${settings.soundEffects ? 'active' : ''}`} onClick={() => toggle('soundEffects')} /></div>
      </div>

      {/* ── About ── */}
      <div className="settings-section">
        <div className="settings-section-title">About</div>
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Open-Harness v1.0.0<br />A universal AI provider harness<br />Current live provider: MiniMax
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

// ── Model recommendation map (from docs/MODEL_LANDSCAPE.md) ──
const MODEL_RECOMMENDATIONS: Record<string, string[]> = {
  planning: ['o3', 'claude-opus-4', 'gemini-2.5-pro', 'glm-5.1', 'deepseek-r2', 'deepseek-v4', 'llama-4-scout', 'kimi-k2.5', 'gpt-5.4', 'MiniMax-M2.7'],
  implementation: ['claude-sonnet-4', 'deepseek-v4', 'gpt-4.1', 'llama-4-maverick', 'MiniMax-M2.7', 'qwen-3-235b', 'glm-5', 'kimi-k2.6', 'grok-3', 'codestral', 'gpt-5.3-codex'],
  bugfix: ['claude-sonnet-4', 'gpt-4.1-mini', 'o4-mini', 'deepseek-v4-flash', 'deepseek-v3', 'qwen-3-32b', 'codestral'],
  design: ['grok-3', 'gemini-2.5-pro', 'gpt-4.1', 'grok-3-mini'],
  image: ['gpt-4.1', 'gemini-2.5-pro', 'grok-3'],
  toolrunning: ['gpt-4.1-nano', 'gemini-2.5-flash', 'glm-4.7', 'deepseek-v4-flash', 'qwen-3-32b'],
  review: ['o3', 'claude-opus-4', 'mistral-large', 'o4-mini', 'deepseek-r2', 'qwen-3-235b', 'mimo-v2.5-pro'],
};

function isModelRecommended(roleId: string, modelId: string): boolean {
  const recs = MODEL_RECOMMENDATIONS[roleId];
  if (!recs) return false;
  // Match case-insensitively on model ID substrings
  const lower = modelId.toLowerCase();
  return recs.some((rec) => lower.includes(rec.toLowerCase().replace(/[-\s]/g, '')));
}

// ── Docker MCP Lifecycle Card ──────────────────────────
function DockerMCPCard({ dockerMcp, mcpStatus }: { dockerMcp: any; mcpStatus: any[] }) {
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const dockerStatus = mcpStatus.find((s: any) => s.id === 'docker-mcp');
  const isRunning = dockerStatus?.running ?? false;
  const toolCount = dockerStatus?.toolCount ?? 0;
  const tools = dockerStatus?.tools ?? [];

  return (
    <div className="provider-card">
      <div className="provider-card-header">
        <div className="provider-logo"><Server size={14} /></div>
        <div className="provider-title-block">
          <div className="provider-title-row">
            <span className="provider-name">{dockerMcp.name}</span>
            <span className={`provider-status ${isRunning ? 'ready' : 'missing'}`}>
              {isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="provider-meta">
            mcp • {dockerMcp.endpoint}
            {toolCount > 0 && <span style={{ marginLeft: 8, color: 'var(--accent-primary)', fontWeight: 600 }}>{toolCount} tools</span>}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ padding: '6px 0 2px', borderTop: '1px solid var(--border-primary)' }}>
        {isRunning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-secondary)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-success)' }} />
            <span>Connected — {toolCount} tools available</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
            <span>Not connected — start Docker MCP to enable tools in chat</span>
          </div>
        )}
      </div>

      {/* Collapsible tool list */}
      {isRunning && toolCount > 0 && (
        <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 4 }}>
          <button
            onClick={() => setToolsExpanded(!toolsExpanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 10, color: 'var(--text-tertiary)', padding: '2px 0',
            }}
          >
            {toolsExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {toolsExpanded ? 'Hide tools' : 'Show tools'}
          </button>
          {toolsExpanded && (
            <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
              {tools.map((tool: any) => (
                <div key={tool.name} style={{ padding: '2px 0', fontSize: 10, display: 'flex', gap: 4 }}>
                  <span style={{ color: 'var(--accent-primary)', fontFamily: 'monospace', flexShrink: 0 }}>{tool.name}</span>
                  {tool.description && (
                    <span style={{ color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      — {tool.description}
                    </span>
                  )}
                </div>
              ))}
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
