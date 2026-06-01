import { useState, useEffect } from 'react';
import {
  X, KeyRound, Brain, FileCode,
  PlayCircle, ShieldCheck, Server, MessageCircle, Palette as ThemeIcon,
  Settings, SlidersHorizontal, Plus, Trash2, RefreshCw, Loader, Wifi,
  Check, ChevronDown, ChevronRight, CheckCircle2, Bot, Container,
  ArrowRight,
} from 'lucide-react';
import type { ProviderConfig, CodingRoleAssignment, MCPServerItem } from '../types';
import * as api from '../utils/api';

// ── Category definition ────────────────────────────────
interface SettingsCategory {
  id: string;
  label: string;
  icon: typeof Settings;
  subcategories?: { id: string; label: string }[];
}

const CATEGORIES: SettingsCategory[] = [
  { id: 'model', label: 'Active Model', icon: Brain },
  { id: 'providers', label: 'Providers', icon: KeyRound, subcategories: [
    { id: 'manage', label: 'Manage Providers' },
    { id: 'add', label: 'Add Provider' },
  ]},
  { id: 'roles', label: 'Role Buckets', icon: SlidersHorizontal },
  { id: 'mcp', label: 'MCP Servers', icon: Server, subcategories: [
    { id: 'docker', label: 'Docker MCP' },
    { id: 'curated', label: 'Curated Tools' },
    { id: 'custom', label: 'Custom Servers' },
    { id: 'add-mcp', label: 'Add Server' },
  ]},
  { id: 'personality', label: 'Personality', icon: MessageCircle },
  { id: 'onboarding', label: 'Onboarding', icon: ArrowRight },
  { id: 'theme', label: 'Theme', icon: ThemeIcon },
  { id: 'chat', label: 'Chat Settings', icon: Settings },
  { id: 'about', label: 'About', icon: CheckCircle2 },
];

// ── Provider presets ───────────────────────────────────
interface ProviderPreset {
  id: string;
  name: string;
  type: string;
  baseURL: string;
  description: string;
  color: string;
  featured: boolean;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { id: 'openai', name: 'OpenAI', type: 'openai-compatible', baseURL: 'https://api.openai.com/v1', description: 'GPT-4.1, o3, o4-mini, GPT-5', color: '#10a37f', featured: true },
  { id: 'minimax', name: 'MiniMax', type: 'openai-compatible', baseURL: 'https://api.minimax.io/v1', description: 'MiniMax M2.7', color: '#6366f1', featured: true },
  { id: 'deepseek', name: 'DeepSeek', type: 'openai-compatible', baseURL: 'https://api.deepseek.com/v1', description: 'DeepSeek V4, V4 Flash, R2', color: '#4a9eff', featured: true },
  { id: 'xai', name: 'xAI', type: 'openai-compatible', baseURL: 'https://api.x.ai/v1', description: 'Grok 3, Grok 3 Mini', color: '#1d9bf0', featured: true },
  { id: 'mistral', name: 'Mistral', type: 'openai-compatible', baseURL: 'https://api.mistral.ai/v1', description: 'Mistral Large, Codestral', color: '#f54e42', featured: true },
  { id: 'zhipu', name: 'Z.AI / Zhipu', type: 'openai-compatible', baseURL: 'https://api.z.ai/api/coding/paas/v4', description: 'GLM-5.1, GLM-5, GLM-4.7', color: '#3b5998', featured: true },
  { id: 'opencode-go', name: 'OpenCode Go', type: 'openai-compatible', baseURL: 'https://opencode.ai/zen/go/v1', description: 'Go subscription models via OpenCode', color: '#e11d48', featured: true },
  { id: 'moonshot', name: 'Moonshot', type: 'openai-compatible', baseURL: 'https://api.moonshot.cn/v1', description: 'Kimi K2.5, Kimi K2.6', color: '#7c3aed', featured: true },
  { id: 'alibaba', name: 'Alibaba Qwen', type: 'openai-compatible', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', description: 'Qwen 3 235B, Qwen 3 32B', color: '#ff6a00', featured: true },
  // Extended presets (shown on expand)
  { id: 'xiaomi', name: 'Xiaomi MiMo', type: 'openai-compatible', baseURL: 'https://api.xiaomi.com/v1', description: 'MiMo V2.5 Pro', color: '#ff6900', featured: false },
  { id: 'meta', name: 'Meta (via proxy)', type: 'openai-compatible', baseURL: 'https://openrouter.ai/api/v1', description: 'Llama 4 Maverick, Llama 4 Scout', color: '#0668e1', featured: false },
  { id: 'openrouter', name: 'OpenRouter', type: 'openai-compatible', baseURL: 'https://openrouter.ai/api/v1', description: 'Gateway to 200+ models', color: '#6d28d9', featured: false },
  { id: 'ollama', name: 'Ollama (local)', type: 'local', baseURL: 'http://localhost:11434/v1', description: 'Run models locally', color: '#6b7280', featured: false },
  { id: 'lmstudio', name: 'LM Studio (local)', type: 'local', baseURL: 'http://localhost:1234/v1', description: 'Run models locally', color: '#6b7280', featured: false },
];

// ── Props ──────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
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
  onRestartOnboarding: () => void;
  onMcpStatusRefresh: () => Promise<void>;
}

// ── Model recommendation map ──
const MODEL_RECOMMENDATIONS: Record<string, string[]> = {
  planner: ['o3', 'glm-5.1', 'deepseek-r2', 'deepseek-v4', 'llama-4-scout', 'kimi-k2.5', 'gpt-5.4', 'MiniMax-M2.7'],
  coder: ['deepseek-v4', 'gpt-4.1', 'llama-4-maverick', 'MiniMax-M2.7', 'qwen-3-235b', 'glm-5', 'kimi-k2.6', 'grok-3', 'codestral', 'gpt-5.3-codex'],
  reviewer: ['o3', 'mistral-large', 'o4-mini', 'deepseek-r2', 'qwen-3-235b', 'mimo-v2.5-pro'],
  reasoner: ['o3', 'deepseek-r2', 'qwen-3-235b', 'grok-3', 'MiniMax-M2.7'],
  summarizer: ['gpt-4.1-mini', 'deepseek-v4-flash', 'qwen-3-32b', 'mistral-small', 'MiniMax-M2.7'],
  worker: ['gpt-4.1-nano', 'glm-4.7', 'deepseek-v4-flash', 'qwen-3-32b', 'MiniMax-M2.7'],
};

function isModelRecommended(roleId: string, modelId: string): boolean {
  const recs = MODEL_RECOMMENDATIONS[roleId];
  if (!recs) return false;
  const lower = modelId.toLowerCase();
  return recs.some((rec) => lower.includes(rec.toLowerCase().replace(/[-\s]/g, '')));
}

const roleIconMap: Record<string, typeof Bot> = {
  planner: Brain, coder: FileCode, reviewer: ShieldCheck,
  reasoner: Brain, summarizer: MessageCircle, worker: PlayCircle,
};

// ── Main component ─────────────────────────────────────
export function SettingsModal({
  isOpen, onClose, activeModel, providers, roleAssignments, activeTheme,
  personalityText, mcpServers, mcpStatus, onAddProvider, onTestProvider,
  onFetchModels, onRemoveProvider, onAddMCPServer, onRemoveMCPServer,
  onSelectModel, onToggleProviderModel, onAssignRoleModel, onSelectTheme,
  onPersonalityChange,
  onRestartOnboarding,
  onMcpStatusRefresh,
}: Props) {
  const [selectedCat, setSelectedCat] = useState('model');
  const [selectedSub, setSelectedSub] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const enabledModels = providers.flatMap((p) =>
    p.models.filter((m) => m.enabled).map((m) => ({ ...m, providerId: p.id, providerName: p.name }))
  );

  let contentKey = selectedCat;
  if (selectedSub) contentKey = selectedCat + '/' + selectedSub;

  return (
    <div className="settings-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">Settings</h2>
          <button className="settings-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="settings-modal-body">
          <nav className="settings-nav">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const hasSubs = cat.subcategories && cat.subcategories.length > 0;
              const isActive = selectedCat === cat.id;
              const isExpanded = isActive && hasSubs;
              return (
                <div key={cat.id}>
                  <button
                    className={`settings-nav-item ${isActive && !hasSubs ? 'active' : ''} ${hasSubs ? 'has-children' : ''}`}
                    onClick={() => {
                      setSelectedCat(cat.id);
                      setSelectedSub(hasSubs ? cat.subcategories![0].id : null);
                    }}
                  >
                    <Icon size={15} />
                    <span>{cat.label}</span>
                    {hasSubs && <span className="settings-nav-chevron">{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>}
                  </button>
                  {isExpanded && cat.subcategories!.map((sub) => (
                    <button key={sub.id} className={`settings-nav-sub ${selectedSub === sub.id ? 'active' : ''}`}
                      onClick={() => { setSelectedCat(cat.id); setSelectedSub(sub.id); }}>
                      {sub.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="settings-content">
            {contentKey === 'model' && <ActiveModelPane activeModel={activeModel} enabledModels={enabledModels} onSelectModel={onSelectModel} />}
            {contentKey === 'providers/manage' && (
              <ProvidersPane providers={providers} onTest={onTestProvider} onFetch={onFetchModels}
                onRemove={onRemoveProvider} onToggleModel={onToggleProviderModel} activeModel={activeModel} />
            )}
            {contentKey === 'providers/add' && (
              <AddProviderPane onAdd={onAddProvider} existingIds={providers.map((p) => p.id)}
                onDone={() => { setSelectedCat('providers'); setSelectedSub('manage'); }} />
            )}
            {contentKey === 'roles' && <RoleBucketsPane roleAssignments={roleAssignments} enabledModels={enabledModels} onAssignRoleModel={onAssignRoleModel} />}
            {contentKey === 'mcp/docker' && <DockerMCPPane mcpServers={mcpServers} mcpStatus={mcpStatus} onRefresh={onMcpStatusRefresh} />}
            {contentKey === 'mcp/curated' && <CuratedMCPPane />}
            {contentKey === 'mcp/custom' && <CustomMCPServersPane mcpServers={mcpServers} onRemove={onRemoveMCPServer} />}
            {contentKey === 'mcp/add-mcp' && <AddMCPServerPane onAdd={onAddMCPServer} onDone={() => { setSelectedCat('mcp'); setSelectedSub('custom'); }} />}
            {contentKey === 'onboarding' && <OnboardingPane onRestartOnboarding={onRestartOnboarding} />}
            {contentKey === 'personality' && <PersonalityPane personalityText={personalityText} onChange={onPersonalityChange} />}
            {contentKey === 'theme' && <ThemePane activeTheme={activeTheme} onSelectTheme={onSelectTheme} />}
            {contentKey === 'chat' && <ChatSettingsPane />}
            {contentKey === 'about' && <AboutPane />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */

function PaneTitle({ children }: { children: React.ReactNode }) { return <div className="settings-pane-title">{children}</div>; }
function PaneDesc({ children }: { children: React.ReactNode }) { return <div className="settings-pane-desc">{children}</div>; }

/* ================================================================== */
/*  ACTIVE MODEL                                                       */
/* ================================================================== */

function ActiveModelPane({ activeModel, enabledModels, onSelectModel }: any) {
  const current = enabledModels.find((m: any) => m.id === activeModel);
  return (
    <>
      <PaneTitle>Active Chat Model</PaneTitle>
      <PaneDesc>The model used for all chat conversations. Only enabled models from configured providers appear here.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <div className="settings-item-label">{current?.name || activeModel}</div>
          <div className="settings-item-desc">{current ? `${current.providerName} • enabled for chat` : 'No enabled model found'}</div>
        </div>
        <select className="settings-select settings-select-wide" value={activeModel} onChange={(e) => onSelectModel(e.target.value)}>
          {enabledModels.map((model: any) => (
            <option key={`${model.providerId}:${model.id}`} value={model.id}>{model.providerName} — {model.name}</option>
          ))}
        </select>
      </div>
    </>
  );
}

/* ================================================================== */
/*  MANAGE PROVIDERS — collapsible cards, scales to 10+               */
/* ================================================================== */

function ProvidersPane({ providers, onTest, onFetch, onRemove, onToggleModel, activeModel }: any) {
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [fetchingModels, setFetchingModels] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <>
      <PaneTitle>Manage Providers</PaneTitle>
      <PaneDesc>{providers.length} provider{providers.length !== 1 ? 's' : ''} configured. Click a provider to expand models and actions.</PaneDesc>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {providers.map((provider: ProviderConfig) => {
          const tr = testResults[provider.id];
          const isExpanded = expandedProviders.has(provider.id);
          const enabledCount = provider.models.filter((m: any) => m.enabled).length;
          const totalCount = provider.models.length;
          const isActive = provider.models.some((m: any) => m.id === activeModel);

          return (
            <div key={provider.id} className="prov-card" data-expanded={isExpanded || undefined}>
              {/* ── Collapsed header row ── */}
              <div className="prov-card-header" onClick={() => toggleExpand(provider.id)} style={{ cursor: 'pointer' }}>
                <div className="prov-card-summary">
                  <div className={`prov-card-status ${provider.configured ? 'ok' : 'warn'}`} />
                  <div>
                    <div className="prov-card-name">
                      {provider.name}
                      {isActive && <span className="prov-card-badge active-badge">Active</span>}
                    </div>
                    <div className="prov-card-meta">
                      {provider.type}
                      {totalCount > 0 && <span> • {enabledCount}/{totalCount} models enabled</span>}
                      <span style={{ color: 'var(--text-tertiary)' }}> • {provider.endpointLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="prov-card-chevron">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </div>

              {/* ── Test result inline (always visible if present) ── */}
              {tr && !isExpanded && (
                <div className={`test-result ${tr.ok ? 'success' : 'error'}`} style={{ marginTop: 0, borderRadius: 0 }}>
                  {tr.ok ? `✓ Connected in ${tr.latencyMs}ms — ${tr.modelsCount} models` : `✗ ${tr.error || 'Failed'}`}
                </div>
              )}

              {/* ── Expanded body ── */}
              {isExpanded && (
                <div className="prov-card-body">
                  {/* Quick actions */}
                  <div className="prov-card-actions">
                    <button className="settings-mini-button" onClick={() => { setTestingProvider(provider.id); onTest(provider.id).then((r: any) => setTestResults((p) => ({ ...p, [provider.id]: r }))).catch((e: any) => setTestResults((p) => ({ ...p, [provider.id]: { ok: false, error: e.message } }))).finally(() => setTestingProvider(null)); }} disabled={testingProvider === provider.id}>
                      {testingProvider === provider.id ? <Loader size={11} className="spin" /> : <Wifi size={11} />}
                      {testingProvider === provider.id ? 'Testing...' : 'Test'}
                    </button>
                    <button className="settings-mini-button" onClick={() => { setFetchingModels(provider.id); onFetch(provider.id).finally(() => setFetchingModels(null)); }} disabled={fetchingModels === provider.id}>
                      {fetchingModels === provider.id ? <Loader size={11} className="spin" /> : <RefreshCw size={11} />}
                      {fetchingModels === provider.id ? 'Fetching...' : 'Fetch Models'}
                    </button>
                    {confirmRemove === provider.id ? (
                      <>
                        <span style={{ fontSize: 11, color: 'var(--accent-error)', marginLeft: 8 }}>Remove?</span>
                        <button className="settings-mini-button" style={{ color: 'var(--accent-error)', background: 'var(--accent-error-muted)' }} onClick={() => { onRemove(provider.id); setConfirmRemove(null); }}>Yes</button>
                        <button className="settings-mini-button" onClick={() => setConfirmRemove(null)}>No</button>
                      </>
                    ) : (
                      <button className="settings-mini-button" style={{ marginLeft: 8, color: 'var(--text-tertiary)' }} onClick={() => setConfirmRemove(provider.id)}>
                        <Trash2 size={11} /> Remove
                      </button>
                    )}
                  </div>

                  {/* Test result */}
                  {tr && (
                    <div className={`test-result ${tr.ok ? 'success' : 'error'}`}>
                      {tr.ok ? `✓ Connected in ${tr.latencyMs}ms — ${tr.modelsCount} models available` : `✗ ${tr.error || 'Connection failed'}`}
                    </div>
                  )}

                  {/* Model list — collapsible if 5+ models */}
                  {totalCount > 0 && (
                    <ModelList
                      models={provider.models}
                      providerId={provider.id}
                      activeModel={activeModel}
                      onToggle={onToggleModel}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Model list with collapse for large sets ──
function ModelList({ models, providerId, activeModel, onToggle }: any) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
        Models ({models.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {models.map((model: any) => (
          <div key={model.id} className="prov-model-row">
            <div className="prov-model-info">
              <span className="prov-model-name">{model.name}</span>
              <span className="prov-model-id">{model.id}</span>
            </div>
            {model.id === activeModel && <span className="prov-model-active">Active</span>}
            <div className={`toggle compact-toggle ${model.enabled ? 'active' : ''}`}
              onClick={() => onToggle(providerId, model.id)}
              title={model.enabled ? 'Disable' : 'Enable'} />
          </div>
        ))}
      </div>
    </div>
  );
}


/* ================================================================== */
/*  ADD PROVIDER — preset gallery + custom form                       */
/* ================================================================== */

function AddProviderPane({ onAdd, existingIds, onDone }: any) {
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable preset fields (pre-filled from preset, user can override)
  const [presetName, setPresetName] = useState('');
  const [presetURL, setPresetURL] = useState('');
  const [presetType, setPresetType] = useState('openai-compatible');

  // Custom form state
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customURL, setCustomURL] = useState('');
  const [customType, setCustomType] = useState('openai-compatible');

  const featured = PROVIDER_PRESETS.filter((p) => p.featured);
  const extended = PROVIDER_PRESETS.filter((p) => !p.featured);
  const isAlreadyAdded = (presetId: string) => existingIds.includes(presetId);

  // When a preset is selected, populate editable fields
  useEffect(() => {
    if (selectedPreset) {
      setPresetName(selectedPreset.name);
      setPresetURL(selectedPreset.baseURL);
      setPresetType(selectedPreset.type);
    }
  }, [selectedPreset]);

  const handlePresetSave = async () => {
    if (!apiKey.trim() && selectedPreset?.type !== 'local') { setError('API key is required'); return; }
    if (!presetURL.trim()) { setError('Endpoint is required'); return; }
    setSaving(true); setError('');
    try {
      await onAdd({ name: presetName.trim() || selectedPreset!.name, type: presetType, apiKey: apiKey.trim(), baseURL: presetURL.trim() });
      onDone();
    } catch (e: any) { setError(e.message || 'Failed to add'); }
    finally { setSaving(false); }
  };

  const handleCustomSave = async () => {
    if (!customName.trim() || !customURL.trim()) { setError('Name and endpoint are required'); return; }
    setSaving(true); setError('');
    try {
      await onAdd({ name: customName.trim(), type: customType, apiKey: apiKey.trim(), baseURL: customURL.trim() });
      onDone();
    } catch (e: any) { setError(e.message || 'Failed to add'); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setSelectedPreset(null); setCustomMode(false);
    setApiKey(''); setError('');
    setPresetName(''); setPresetURL(''); setPresetType('openai-compatible');
    setCustomName(''); setCustomURL(''); setCustomType('openai-compatible');
  };

  // ── Preset selected → show full form with pre-filled defaults ──
  if (selectedPreset) {
    return (
      <>
        <PaneTitle>Add {selectedPreset.name}</PaneTitle>
        <PaneDesc>{selectedPreset.description}. All fields are pre-filled with defaults — edit any to override.</PaneDesc>
        <div style={{ marginTop: 16, maxWidth: 480 }}>
          <div className="add-provider-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-primary)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: selectedPreset.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                {selectedPreset.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{selectedPreset.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Pre-configured defaults — editable below</div>
              </div>
            </div>
            <div className="add-provider-grid">
              <label>Provider name<input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder={selectedPreset.name} /></label>
              <label>API key
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder={selectedPreset.type === 'local' ? 'No key needed for local providers' : 'Paste your API key'}
                  disabled={selectedPreset.type === 'local'} />
              </label>
              <label>Endpoint<input value={presetURL} onChange={(e) => setPresetURL(e.target.value)} placeholder={selectedPreset.baseURL} /></label>
              <label>Type
                <select value={presetType} onChange={(e) => setPresetType(e.target.value)}>
                  <option value="openai-compatible">OpenAI-compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="local">Local (Ollama, LM Studio)</option>
                </select>
              </label>
            </div>
            {error && <div className="test-result error">{error}</div>}
            <div className="add-provider-actions">
              <button className="settings-mini-button" onClick={resetForm}>Back</button>
              <button className="settings-mini-button" style={{ background: 'var(--accent-primary)', color: 'white' }} onClick={handlePresetSave} disabled={saving}>
                {saving ? <Loader size={11} className="spin" /> : <Check size={11} />}
                {saving ? 'Saving...' : 'Add Provider'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Custom form ──
  if (customMode) {
    return (
      <>
        <PaneTitle>Add Custom Provider</PaneTitle>
        <PaneDesc>Manually configure a provider with a custom name, endpoint, and type.</PaneDesc>
        <div style={{ marginTop: 16, maxWidth: 440 }}>
          <div className="add-provider-card">
            <div className="add-provider-grid">
              <label>Provider name<input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="My Provider" /></label>
              <label>API key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key" /></label>
              <label>Endpoint<input value={customURL} onChange={(e) => setCustomURL(e.target.value)} placeholder="https://api.example.com/v1" /></label>
              <label>Type
                <select value={customType} onChange={(e) => setCustomType(e.target.value)}>
                  <option value="openai-compatible">OpenAI-compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="local">Local (Ollama, LM Studio)</option>
                </select>
              </label>
            </div>
            {error && <div className="test-result error">{error}</div>}
            <div className="add-provider-actions">
              <button className="settings-mini-button" onClick={resetForm}>Back</button>
              <button className="settings-mini-button" style={{ background: 'var(--accent-primary)', color: 'white' }} onClick={handleCustomSave} disabled={saving}>
                {saving ? <Loader size={11} className="spin" /> : <Check size={11} />}
                {saving ? 'Saving...' : 'Add Provider'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Default: preset gallery ──
  return (
    <>
      <PaneTitle>Add Provider</PaneTitle>
      <PaneDesc>Choose a provider to get started. You'll just need your API key. All defaults are editable after selecting.</PaneDesc>
      <div style={{ marginTop: 16 }}>
        <div className="prov-preset-grid">
          {[...featured, ...extended].map((preset) => {
            const added = isAlreadyAdded(preset.id);
            return (
              <button key={preset.id}
                className={`prov-preset-card ${added ? 'added' : ''}`}
                onClick={() => { if (!added) setSelectedPreset(preset); }}
                disabled={added}
              >
                <div className="prov-preset-icon" style={{ background: preset.color }}>
                  {preset.name.charAt(0)}
                </div>
                <div className="prov-preset-info">
                  <div className="prov-preset-name">{preset.name}</div>
                  <div className="prov-preset-desc">{preset.description}</div>
                </div>
                {added ? (
                  <span className="prov-preset-added"><Check size={12} /> Added</span>
                ) : (
                  <ArrowRight size={14} className="prov-preset-arrow" />
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-primary)', paddingTop: 16 }}>
          <button className="settings-mini-button" onClick={() => setCustomMode(true)} style={{ fontSize: 12 }}>
            <Plus size={12} /> Add custom provider manually
          </button>
        </div>
      </div>
    </>
  );
}


function RoleBucketsPane({ roleAssignments, enabledModels, onAssignRoleModel }: any) {
  return (
    <>
      <PaneTitle>Coding Role Buckets</PaneTitle>
      <PaneDesc>Assign models to specialized coding roles. Models marked ✓ are recommended based on capabilities.</PaneDesc>
      <div className="role-bucket-list" style={{ marginTop: 16 }}>
        {roleAssignments.map((role: CodingRoleAssignment) => {
          const Icon = roleIconMap[role.id] || Bot;
          return (
            <div key={role.id} className="role-bucket-card">
              <div className="role-bucket-icon"><Icon size={15} /></div>
              <div className="role-bucket-body">
                <div className="role-bucket-name">{role.name}</div>
                <div className="role-bucket-desc">{role.description}</div>
                <select className="settings-select settings-select-wide" value={role.modelId} onChange={(e) => onAssignRoleModel(role.id, e.target.value)}>
                  {enabledModels.map((model: any) => {
                    const rec = isModelRecommended(role.id, model.id);
                    return (
                      <option key={`${role.id}:${model.providerId}:${model.id}`} value={model.id}>
                        {rec ? '✓ ' : ''}{model.providerName} — {model.name}{rec ? ' (Recommended)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ================================================================== */
/*  DOCKER MCP                                                         */
/* ================================================================== */

function DockerMCPPane({ mcpServers, mcpStatus, onRefresh }: { mcpServers: any[]; mcpStatus: any[]; onRefresh: () => Promise<void> }) {
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [readiness, setReadiness] = useState<any>(null);
  const [busy, setBusy] = useState<'start' | 'stop' | 'restart' | 'readiness' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const dockerMcp = mcpServers.find((s: any) => s.builtIn);
  const dockerStatus = mcpStatus.find((s: any) => s.id === 'docker-mcp');
  const isRunning = dockerStatus?.running ?? false;
  const toolCount = dockerStatus?.toolCount ?? 0;
  const tools = dockerStatus?.tools ?? [];

  const refreshReadiness = async () => {
    setBusy('readiness');
    try {
      const r = await api.getDockerReadiness();
      setReadiness(r);
    } catch { /* ignore */ }
    setBusy(null);
  };

  useEffect(() => { refreshReadiness(); }, []);

  const handleStart = async () => {
    setBusy('start'); setFeedback(null);
    try { await api.startMCPServer('docker-mcp'); setFeedback('Docker MCP started.'); await onRefresh(); }
    catch (e: any) { setFeedback(e.message || 'Failed to start'); }
    setBusy(null);
  };
  const handleStop = async () => {
    setBusy('stop'); setFeedback(null);
    try { await api.stopMCPServer('docker-mcp'); setFeedback('Docker MCP stopped.'); await onRefresh(); }
    catch (e: any) { setFeedback(e.message || 'Failed to stop'); }
    setBusy(null);
  };
  const handleRestart = async () => {
    setBusy('restart'); setFeedback(null);
    try { await api.restartMCPServer('docker-mcp'); setFeedback('Docker MCP restarted.'); await onRefresh(); }
    catch (e: any) { setFeedback(e.message || 'Failed to restart'); }
    setBusy(null);
  };

  if (!dockerMcp) return <><PaneTitle>Docker MCP</PaneTitle><PaneDesc>No Docker MCP configured.</PaneDesc></>;

  const ready = readiness?.dockerInstalled && readiness?.daemonRunning && readiness?.dockerMcpAvailable && readiness?.profileReady;
  const readyLabel = !readiness ? 'Checking…' : ready ? 'Ready' : !readiness.dockerInstalled ? 'Not installed' : !readiness.daemonRunning ? 'Daemon stopped' : !readiness.dockerMcpAvailable ? 'MCP Toolkit missing' : 'Profile not ready';

  return (
    <>
      <PaneTitle>Docker MCP</PaneTitle>
      <PaneDesc>Containerized tool execution via Docker MCP server. Provides browser automation, code search, sequential thinking, and more.</PaneDesc>

      {/* Readiness card */}
      <div className="provider-card" style={{ marginTop: 16 }}>
        <div className="provider-card-header">
          <div className="provider-logo"><Container size={14} /></div>
          <div className="provider-title-block">
            <div className="provider-title-row">
              <span className="provider-name">Docker readiness</span>
              <span className={`provider-status ${ready ? 'ready' : 'missing'}`}>{readyLabel}</span>
            </div>
            <div className="provider-meta">
              {readiness?.version && <>Docker {readiness.version} · </>}
              {readiness?.mcpVersion && <>MCP {readiness.mcpVersion}</>}
              {!readiness && 'Probing local Docker…'}
            </div>
          </div>
        </div>
        {readiness?.hints && readiness.hints.length > 0 && (
          <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-primary)' }}>
            {readiness.hints.map((h: string, i: number) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>· {h}</div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border-primary)' }}>
          <button className="settings-mini-button" onClick={refreshReadiness} disabled={busy === 'readiness'}>
            <RefreshCw size={11} className={busy === 'readiness' ? 'spin' : ''} /> Recheck
          </button>
        </div>
      </div>

      {/* Lifecycle card */}
      <div className="provider-card" style={{ marginTop: 12 }}>
        <div className="provider-card-header">
          <div className="provider-logo"><Server size={14} /></div>
          <div className="provider-title-block">
            <div className="provider-title-row">
              <span className="provider-name">{dockerMcp.name}</span>
              <span className={`provider-status ${isRunning ? 'ready' : 'missing'}`}>{isRunning ? 'Running' : 'Stopped'}</span>
            </div>
            <div className="provider-meta">
              {dockerMcp.endpoint}
              {toolCount > 0 && <span style={{ marginLeft: 8, color: 'var(--accent-primary)', fontWeight: 600 }}>{toolCount} tools</span>}
            </div>
          </div>
        </div>
        <div className="provider-actions-row" style={{ display: 'flex', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border-primary)' }}>
          {!isRunning && <button className="settings-mini-button" onClick={handleStart} disabled={busy === 'start' || !ready}>
            <PlayCircle size={11} /> {busy === 'start' ? 'Starting…' : 'Start'}
          </button>}
          {isRunning && <button className="settings-mini-button" onClick={handleStop} disabled={busy === 'stop'}>
            <X size={11} /> {busy === 'stop' ? 'Stopping…' : 'Stop'}
          </button>}
          <button className="settings-mini-button" onClick={handleRestart} disabled={busy === 'restart' || !ready}>
            <RefreshCw size={11} className={busy === 'restart' ? 'spin' : ''} /> {busy === 'restart' ? 'Restarting…' : 'Restart'}
          </button>
          {feedback && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center' }}>{feedback}</span>}
        </div>
        {isRunning && toolCount > 0 && (
          <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: 8 }}>
            <button onClick={() => setToolsExpanded(!toolsExpanded)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent-primary)', padding: '4px 0' }}>
              {toolsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {toolsExpanded ? 'Hide tools' : 'Show all tools'}
            </button>
            {toolsExpanded && (
              <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {tools.map((tool: any) => (
                  <div key={tool.name} style={{ padding: '4px 0', fontSize: 11, display: 'flex', gap: 8, borderBottom: '1px solid var(--border-primary)' }}>
                    <code style={{ color: 'var(--accent-primary)', flexShrink: 0, fontSize: 11 }}>{tool.name}</code>
                    <span style={{ color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{tool.description?.slice(0, 120)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ================================================================== */
/*  CURATED MCP RECOMMENDATIONS                                        */
/* ================================================================== */

function CuratedMCPPane() {
  const [catalog, setCatalog] = useState<api.CuratedMcpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.getCuratedMcpServers();
      setCatalog(list);
    } catch (e: any) { setError(e.message || 'Failed to load catalog'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleInstall = async (id: string) => {
    setInstalling(id); setError(null);
    try { await api.installCuratedMcpServer(id); await load(); }
    catch (e: any) { setError(e.message || 'Install failed'); }
    finally { setInstalling(null); }
  };

  const filtered = catalog.filter((s) =>
    !query || s.name.toLowerCase().includes(query.toLowerCase()) || s.description.toLowerCase().includes(query.toLowerCase()) || s.category.includes(query.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, api.CuratedMcpServer[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s); return acc;
  }, {});

  return (
    <>
      <PaneTitle>Curated MCP Tools</PaneTitle>
      <PaneDesc>One-click install for safe, free MCP servers. Each card shows what the server can access.</PaneDesc>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="onboarding-input"
          style={{ flex: 1 }}
          placeholder="Search by name, description, or category (files, git, web, database, memory, browser, thinking)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="settings-mini-button" onClick={load}><RefreshCw size={11} /> Refresh</button>
      </div>

      {error && <div className="onboarding-result error" style={{ marginTop: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}><Loader size={16} className="spin" /> Loading catalog…</div>
      ) : (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {Object.entries(grouped).map(([cat, servers]) => (
            <div key={cat}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>{cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {servers.map((s) => (
                  <div key={s.id} className="provider-card">
                    <div className="provider-card-header">
                      <div className="provider-logo"><Server size={14} /></div>
                      <div className="provider-title-block">
                        <div className="provider-title-row">
                          <span className="provider-name">{s.name}</span>
                          {s.installed
                            ? <span className="provider-status ready">Installed</span>
                            : <span className={`provider-status ${s.requiresTrustMode === 'chat-only' || s.requiresTrustMode === 'read-only' ? 'ready' : 'missing'}`}>{s.requiresTrustMode === 'chat-only' || s.requiresTrustMode === 'read-only' ? 'Safe' : 'Trust required'}</span>}
                        </div>
                        <div className="provider-meta">{s.tagline}</div>
                      </div>
                    </div>
                    <div style={{ padding: '6px 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45, borderTop: '1px solid var(--border-primary)' }}>
                      {s.description}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border-primary)' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Permissions:</span>
                      <span style={{ fontSize: 10, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{s.permissionSummary}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>·</span>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Needs: {s.requiresTrustMode}</span>
                    </div>
                    {s.installHint && (
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '4px 0', borderTop: '1px solid var(--border-primary)' }}>
                        {s.installHint}
                      </div>
                    )}
                    <div className="provider-actions-row" style={{ padding: '8px 0', borderTop: '1px solid var(--border-primary)' }}>
                      {s.installed ? (
                        <span style={{ fontSize: 11, color: 'var(--accent-success)' }}><Check size={11} /> Available — see Custom Servers to remove</span>
                      ) : (
                        <button className="settings-mini-button" onClick={() => handleInstall(s.id)} disabled={installing === s.id}>
                          {installing === s.id ? <><Loader size={11} className="spin" /> Installing…</> : <><Plus size={11} /> Install</>}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ================================================================== */
/*  ONBOARDING PANE                                                    */
/* ================================================================== */

function OnboardingPane({ onRestartOnboarding }: { onRestartOnboarding: () => void }) {
  return (
    <>
      <PaneTitle>Onboarding</PaneTitle>
      <PaneDesc>Re-run the guided setup at any time. Your existing providers, keys, and settings will be preserved.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Restart guided setup</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 12 }}>
          The wizard will close any open chat and walk you through provider, personality, trust mode, and project setup again.
        </div>
        <button className="onboarding-btn-primary" onClick={onRestartOnboarding}>
          <ArrowRight size={14} /> Restart onboarding
        </button>
      </div>
    </>
  );
}

function CustomMCPServersPane({ mcpServers, onRemove }: any) {
  const custom = mcpServers.filter((s: any) => !s.builtIn);
  return (
    <>
      <PaneTitle>Custom MCP Servers</PaneTitle>
      <PaneDesc>Additional Model Context Protocol servers for tools, resources, and prompts.</PaneDesc>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {custom.map((server: any) => (
          <div key={server.id} className="provider-card">
            <div className="provider-card-header">
              <div className="provider-logo"><Server size={14} /></div>
              <div className="provider-title-block">
                <div className="provider-title-row">
                  <span className="provider-name">{server.name}</span>
                  <span className={`provider-status ${server.enabled ? 'ready' : 'missing'}`}>{server.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="provider-meta">{server.authType} • {server.endpoint}</div>
              </div>
            </div>
            <div className="provider-actions-row">
              <button className="settings-mini-button" style={{ marginLeft: 'auto', color: 'var(--accent-error)', background: 'var(--accent-error-muted)' }} onClick={() => onRemove(server.id)}>
                <Trash2 size={11} /> Remove
              </button>
            </div>
          </div>
        ))}
        {custom.length === 0 && (
          <div className="settings-card" style={{ textAlign: 'center', padding: '24px 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No custom MCP servers configured</div>
          </div>
        )}
      </div>
    </>
  );
}

/* ================================================================== */
/*  ADD MCP SERVER                                                     */
/* ================================================================== */

function AddMCPServerPane({ onAdd, onDone }: any) {
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !endpoint.trim()) { setError('Name and endpoint are required'); return; }
    setSaving(true); setError('');
    try { await onAdd({ name: name.trim(), endpoint: endpoint.trim(), authType, authToken }); onDone(); }
    catch (e: any) { setError(e.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PaneTitle>Add MCP Server</PaneTitle>
      <PaneDesc>Connect a Model Context Protocol server via stdio or HTTP transport.</PaneDesc>
      <div className="add-provider-card" style={{ marginTop: 16, maxWidth: 440 }}>
        <div className="add-provider-grid">
          <label>Server name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-tools-server" /></label>
          <label>Endpoint<input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="stdio://./my-server or http://..." /></label>
          <label>Auth type
            <select value={authType} onChange={(e) => setAuthType(e.target.value)}>
              <option value="none">None</option>
              <option value="bearer">Bearer token</option>
            </select>
          </label>
          {authType === 'bearer' && (
            <label>Auth token<input type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="Bearer token" /></label>
          )}
        </div>
        {error && <div className="test-result error">{error}</div>}
        <div className="add-provider-actions">
          <button className="settings-mini-button" onClick={onDone}>Cancel</button>
          <button className="settings-mini-button" style={{ background: 'var(--accent-primary)', color: 'white' }} onClick={handleSave} disabled={saving}>
            {saving ? <Loader size={11} className="spin" /> : <Check size={11} />}
            {saving ? 'Saving...' : 'Add Server'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/*  PERSONALITY                                                        */
/* ================================================================== */

function PersonalityPane({ personalityText, onChange }: any) {
  const presets = [
    { id: 'professional', label: 'Professional', text: 'You are a professional software engineering assistant. Be thorough, well-structured, and prioritize code quality and best practices.' },
    { id: 'concise', label: 'Concise', text: 'Be brief and direct. Show code, skip preamble. Focus on what changed and why.' },
    { id: 'detailed', label: 'Detailed', text: 'Explain your reasoning step by step. Include context, alternatives considered, and tradeoffs. Teach while you code.' },
    { id: 'creative', label: 'Creative', text: 'Think outside the box. Suggest unconventional approaches when appropriate. Prioritize elegance and developer experience.' },
  ];
  return (
    <>
      <PaneTitle>Agent Personality</PaneTitle>
      <PaneDesc>Customize how the AI assistant communicates. Choose a preset or write your own instructions.</PaneDesc>
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {presets.map((p) => (
            <button key={p.id} className="settings-mini-button" style={personalityText === p.text ? { background: 'var(--accent-primary)', color: 'white' } : {}}
              onClick={() => onChange(personalityText === p.text ? '' : p.text)}>
              <MessageCircle size={11} /> {p.label}
            </button>
          ))}
        </div>
        <textarea className="personality-textarea" placeholder="E.g., Be concise and direct. Focus on code quality over explanation." value={personalityText} onChange={(e) => onChange(e.target.value)} rows={6} />
      </div>
    </>
  );
}

/* ================================================================== */
/*  THEME                                                              */
/* ================================================================== */

function ThemePane({ activeTheme, onSelectTheme }: any) {
  const themes = [
    { id: 'midnight', label: 'Midnight', color: '#6366f1', group: 'dark' },
    { id: 'charcoal', label: 'Charcoal', color: '#a1a1aa', group: 'dark' },
    { id: 'forest', label: 'Forest', color: '#10b981', group: 'dark' },
    { id: 'crimson', label: 'Crimson', color: '#f43f5e', group: 'dark' },
    { id: 'daylight', label: 'Daylight', color: '#6366f1', group: 'light' },
    { id: 'silver', label: 'Silver', color: '#3b82f6', group: 'light' },
    { id: 'sage', label: 'Sage', color: '#10b981', group: 'light' },
    { id: 'blush', label: 'Blush', color: '#f43f5e', group: 'light' },
  ];
  return (
    <>
      <PaneTitle>Theme</PaneTitle>
      <PaneDesc>Choose a colorway. Changes apply instantly.</PaneDesc>
      <div style={{ marginTop: 16 }}>
        {['dark', 'light'].map((group) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              {group === 'dark' ? 'Dark themes' : 'Light themes'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {themes.filter((t) => t.group === group).map((t) => (
                <button key={t.id} className={`settings-card ${activeTheme === t.id ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', border: activeTheme === t.id ? '2px solid var(--accent-primary)' : undefined }}
                  onClick={() => onSelectTheme(t.id)}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: t.color, flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                    {activeTheme === t.id && <div style={{ fontSize: 10, color: 'var(--accent-primary)' }}>Active</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ================================================================== */
/*  CHAT SETTINGS                                                      */
/* ================================================================== */

function ChatSettingsPane() {
  const [settings, setSettings] = useState({ streamResponses: true, showToolCalls: true, autoScroll: true, soundEffects: false });
  const toggle = (key: keyof typeof settings) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  const items = [
    { key: 'streamResponses' as const, label: 'Stream responses', desc: 'Show text as it generates' },
    { key: 'showToolCalls' as const, label: 'Show tool calls', desc: 'Display agent tool usage inline' },
    { key: 'autoScroll' as const, label: 'Auto-scroll', desc: 'Follow new messages automatically' },
    { key: 'soundEffects' as const, label: 'Sound effects', desc: 'Play sounds on completion' },
  ];
  return (
    <>
      <PaneTitle>Chat Settings</PaneTitle>
      <PaneDesc>Configure chat behavior and display preferences.</PaneDesc>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => (
          <div key={item.key} className="settings-item">
            <div>
              <div className="settings-item-label">{item.label}</div>
              <div className="settings-item-desc">{item.desc}</div>
            </div>
            <div className={`toggle ${settings[item.key] ? 'active' : ''}`} onClick={() => toggle(item.key)} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ================================================================== */
/*  ABOUT                                                              */
/* ================================================================== */

function AboutPane() {
  return (
    <>
      <PaneTitle>About OpenHarness</PaneTitle>
      <PaneDesc>A universal AI provider harness for desktop.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>OpenHarness</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>Version 1.0.0</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          An Electron + React + Express desktop app that provides a universal interface for AI providers with MCP tool integration, role-based model routing, and a tiling panel layout.
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <div>• 8 built-in themes (4 dark + 4 light)</div>
          <div>• OpenAI-compatible provider support</div>
          <div>• Docker MCP integration with 34+ tools</div>
          <div>• 7 coding role buckets with model recommendations</div>
        </div>
      </div>
    </>
  );
}
