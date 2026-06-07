import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import { ContextBudgetControls } from './ContextBudgetControls';
import { RoutingLearningPane } from './RoutingLearningPane';
import {
  X, KeyRound, Brain, FileCode,
  PlayCircle, ShieldCheck, Server, MessageCircle, Palette as ThemeIcon,
  Settings, SlidersHorizontal, Plus, Trash2, RefreshCw, Loader, Wifi,
  Check, ChevronDown, ChevronRight, CheckCircle2, Bot, Container,
  ArrowRight, BookOpen, Search, Sparkles, Zap, FileText, Globe, Layout, Command,
  Grid, Layers, Eye, Wrench,
} from 'lucide-react';
import type { ProviderConfig, CodingRoleAssignment, MCPServerItem, Skill, Plugin, MemoryEntry } from '../types';
import type { ThinkingEffort } from '../types';
import * as api from '../utils/api';
import { modelAbilityStates, modelSupportsThinking, THINKING_EFFORTS } from '../utils/modelCapabilities';
import { mockSkills, mockPlugins, mockMemoryEntries } from '../utils/mockData';
import {
  findModelCatalogCard,
  formatContextWindow,
  formatModelCost,
  MODEL_CATALOG_MAINTENANCE_NOTE,
  MODEL_CATALOG_SOURCES,
  MODEL_CATALOG_UPDATED_AT,
  MODEL_CATEGORY_META,
  modelBestCategory,
  modelCatalogTooltip,
  normalizeModelCatalogKey,
  TOP_MODEL_CATALOG,
} from '../data/modelCatalog';
import {
  defaultProviderPlan,
  providerPlanCatalogFor,
  providerPlanLabel,
  type ProviderAccessMode,
} from '../data/providerPlans';
import {
  getThemeById,
  getThemesByMode,
  importThemePluginFromJson,
  getInstalledThemePluginManifests,
  resolveThemeId,
} from '../theme/builtins';

// ── Category definition ────────────────────────────────
interface SettingsCategory {
  id: string;
  label: string;
  icon: typeof Settings;
  subcategories?: { id: string; label: string }[];
}

const CATEGORIES: SettingsCategory[] = [
  { id: 'model', label: 'Active Model', icon: Brain },
  { id: 'model-library', label: 'Model Library', icon: BookOpen },
  { id: 'providers', label: 'Providers', icon: KeyRound, subcategories: [
    { id: 'manage', label: 'Manage Providers' },
    { id: 'add', label: 'Add Provider' },
  ]},
  { id: 'roles', label: 'Agent Roles', icon: SlidersHorizontal },
  { id: 'assistant', label: 'Assistant', icon: Sparkles, subcategories: [
    { id: 'clicky', label: 'Clicky' },
    { id: 'skills', label: 'Skills' },
    { id: 'memory', label: 'Memory' },
  ]},
  { id: 'mcp', label: 'MCP Servers', icon: Server, subcategories: [
    { id: 'docker', label: 'Docker MCP' },
    { id: 'curated', label: 'Curated Tools' },
    { id: 'custom', label: 'Custom Servers' },
    { id: 'add-mcp', label: 'Add Server' },
  ]},
  { id: 'personality', label: 'Personality', icon: MessageCircle },
  { id: 'onboarding', label: 'Onboarding', icon: ArrowRight },
  { id: 'theme', label: 'Theme', icon: ThemeIcon },
  { id: 'routing', label: 'Routing Learning', icon: Brain },
  { id: 'auto-router', label: 'Auto-Router', icon: SlidersHorizontal },
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
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic', baseURL: 'https://api.anthropic.com/v1', description: 'Claude Sonnet, Opus, Haiku', color: '#d97706', featured: true },
  { id: 'google', name: 'Google Gemini', type: 'google', baseURL: 'https://generativelanguage.googleapis.com/v1beta', description: 'Gemini Pro, Flash, multimodal models', color: '#4285f4', featured: true },
  { id: 'minimax', name: 'MiniMax', type: 'openai-compatible', baseURL: 'https://api.minimax.io/v1', description: 'MiniMax M3, M2.7', color: '#6366f1', featured: true },
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
  configPath?: string;
  activeModel: string;
  thinkingEffort: ThinkingEffort;
  providers: ProviderConfig[];
  roleAssignments: CodingRoleAssignment[];
  roleThinking: Record<string, ThinkingEffort>;
  activeTheme: string;
  personalityText: string;
  mcpServers: MCPServerItem[];
  mcpStatus: any[];
  onAddProvider: (provider: { name: string; type: string; apiKey: string; baseURL: string; accessMode?: ProviderAccessMode; planId?: string }) => Promise<any>;
  onTestProvider: (providerId: string, tempKey?: string) => Promise<any>;
  onFetchModels: (providerId: string, tempKey?: string) => Promise<any>;
  onUpdateProvider: (providerId: string, updates: { apiKey?: string; baseURL?: string; type?: string; accessMode?: ProviderAccessMode; planId?: string; models?: any[] }) => Promise<void>;
  onRemoveProvider: (providerId: string) => void;
  onAddMCPServer: (server: { name: string; endpoint: string; authType: string; authToken: string }) => Promise<any>;
  onRemoveMCPServer: (serverId: string) => void;
  onSelectModel: (modelId: string) => void;
  onThinkingEffortChange: (effort: ThinkingEffort) => void;
  onToggleProviderModel: (providerId: string, modelId: string) => void;
  onAssignRoleModel: (roleId: string, modelId: string) => void;
  onAssignRoleThinking: (roleId: string, effort: ThinkingEffort) => void;
  onSelectTheme: (themeId: string) => void;
  onThemePluginManifestsChange: (themeManifests: string[]) => void;
  onRemoveTheme: (themeId: string) => void;
  onPersonalityChange: (text: string) => void;
  onRestartOnboarding: () => void;
  onMcpStatusRefresh: () => Promise<void>;
  clickyEnabled: boolean;
  onClickyEnabledChange: (enabled: boolean) => void;
}

// ── Model recommendation map ──
const MODEL_RECOMMENDATIONS: Record<string, string[]> = {
  planner: ['o3', 'glm-5.1', 'deepseek-r2', 'deepseek-v4', 'llama-4-scout', 'kimi-k2.5', 'gpt-5.4', 'MiniMax-M3'],
  coder: ['deepseek-v4', 'gpt-4.1', 'llama-4-maverick', 'MiniMax-M3', 'qwen-3-235b', 'glm-5', 'kimi-k2.6', 'grok-3', 'codestral', 'gpt-5.3-codex'],
  reviewer: ['o3', 'mistral-large', 'o4-mini', 'deepseek-r2', 'qwen-3-235b', 'mimo-v2.5-pro'],
  reasoner: ['o3', 'deepseek-r2', 'qwen-3-235b', 'grok-3', 'MiniMax-M3'],
  summarizer: ['gpt-4.1-mini', 'deepseek-v4-flash', 'qwen-3-32b', 'mistral-small', 'MiniMax-M3'],
  worker: ['gpt-4.1-nano', 'glm-4.7', 'deepseek-v4-flash', 'qwen-3-32b', 'MiniMax-M3'],
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

// ── Main component ─────────────────────────────────────
export function SettingsModal({
  isOpen, onClose, activeModel, thinkingEffort, providers, roleAssignments, roleThinking, activeTheme,
  configPath, personalityText, mcpServers, mcpStatus, onAddProvider, onTestProvider,
  onUpdateProvider,
  onFetchModels, onRemoveProvider, onAddMCPServer, onRemoveMCPServer,
  onSelectModel, onThinkingEffortChange, onToggleProviderModel, onAssignRoleModel, onAssignRoleThinking, onSelectTheme,
  onThemePluginManifestsChange, onRemoveTheme,
  onPersonalityChange,
  onRestartOnboarding,
  onMcpStatusRefresh,
  clickyEnabled,
  onClickyEnabledChange,
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
    p.configured
      ? p.models.filter((m) => m.enabled).map((m) => ({ ...m, providerId: p.id, providerName: p.name }))
      : []
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
            {contentKey === 'model' && <ActiveModelPane activeModel={activeModel} thinkingEffort={thinkingEffort} enabledModels={enabledModels} onSelectModel={onSelectModel} onThinkingEffortChange={onThinkingEffortChange} />}
            {contentKey === 'model-library' && <ModelLibraryPane providers={providers} />}
            {contentKey === 'providers/manage' && (
              <ProvidersPane
                providers={providers}
                onTest={onTestProvider}
                onFetch={onFetchModels}
                onUpdateProvider={onUpdateProvider}
                onRemove={onRemoveProvider}
                onToggleModel={onToggleProviderModel}
                activeModel={activeModel}
              />
            )}
            {contentKey === 'providers/add' && (
              <AddProviderPane onAdd={onAddProvider} existingIds={providers.map((p) => p.id)}
                onDone={() => { setSelectedCat('providers'); setSelectedSub('manage'); }} />
            )}
            {contentKey === 'roles' && <AgentRolesPane roleAssignments={roleAssignments} roleThinking={roleThinking} enabledModels={enabledModels} onAssignRoleModel={onAssignRoleModel} onAssignRoleThinking={onAssignRoleThinking} />}
            {contentKey === 'assistant/clicky' && <ClickySettingsPane enabled={clickyEnabled} onChange={onClickyEnabledChange} />}
            {contentKey === 'assistant/skills' && <AssistantSkillsPane skills={mockSkills} plugins={mockPlugins} />}
            {contentKey === 'assistant/memory' && <AssistantMemoryPane entries={mockMemoryEntries} />}
            {contentKey === 'mcp/docker' && <DockerMCPPane mcpServers={mcpServers} mcpStatus={mcpStatus} onRefresh={onMcpStatusRefresh} />}
            {contentKey === 'mcp/curated' && <CuratedMCPPane />}
            {contentKey === 'mcp/custom' && <CustomMCPServersPane mcpServers={mcpServers} onRemove={onRemoveMCPServer} />}
            {contentKey === 'mcp/add-mcp' && <AddMCPServerPane onAdd={onAddMCPServer} onDone={() => { setSelectedCat('mcp'); setSelectedSub('custom'); }} />}
            {contentKey === 'onboarding' && <OnboardingPane onRestartOnboarding={onRestartOnboarding} />}
            {contentKey === 'personality' && <PersonalityPane personalityText={personalityText} onChange={onPersonalityChange} />}
            {contentKey === 'theme' && (
              <ThemePane
                activeTheme={activeTheme}
                onSelectTheme={onSelectTheme}
                onThemePluginManifestsChange={onThemePluginManifestsChange}
                onRemoveTheme={onRemoveTheme}
              />
            )}
            {contentKey === 'routing' && <RoutingLearningPane enabledModels={enabledModels} onApplyRoleRecommendation={onAssignRoleModel} />}
            {contentKey === 'auto-router' && <AutoRouterPane />}
            {contentKey === 'chat' && <ChatSettingsPane />}
            {contentKey === 'about' && <AboutPane configPath={configPath} />}
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

function ModelAbilityIcons({ modelId, providerId }: { modelId: string; providerId?: string }) {
  const abilities = modelAbilityStates(modelId, providerId);
  const isAuto = modelId.trim().toLowerCase() === 'auto';
  return (
    <div className="model-ability-icons" aria-label="Model abilities">
      {abilities.map(({ id, active, title }) => {
        const Icon = id === 'thinking' ? Brain : id === 'vision' ? Eye : id === 'tools' ? Wrench : Layers;
        return (
        <span
          key={id}
          className={`model-ability-icon ${active ? 'active' : 'disabled'} ${isAuto ? 'auto' : ''}`}
          title={title}
        >
          <Icon size={13} />
        </span>
        );
      })}
    </div>
  );
}

const ROLE_DEFAULT_EFFORT: Record<string, ThinkingEffort> = {
  planner: 'medium',
  coder: 'medium',
  reviewer: 'high',
  reasoner: 'xhigh',
  summarizer: 'low',
  worker: 'low',
};

const COST_SCORE: Record<string, number> = {
  free: 0,
  budget: 1,
  low: 2,
  mid: 3,
  premium: 4,
  luxury: 5,
};

function scoreModelForEffort(model: any, effort: ThinkingEffort): number {
  const card = findModelCatalogCard(model.id, model.providerId);
  const cost = COST_SCORE[card?.relativeCost || 'mid'] ?? 3;
  const context = card?.contextWindowTokens || model.contextWindowTokens || 0;
  const longContext = context >= 200_000 ? 8 : 0;
  const hugeContext = context >= 1_000_000 ? 10 : 0;
  const thinking = modelSupportsThinking(model.id, model.providerId) ? 16 : 0;
  const tools = card?.supportsTools ? 8 : 0;
  const category = card ? modelBestCategory(card) : undefined;
  const bestFor = (card?.bestFor || []).join(' ').toLowerCase();
  const workerFit = category === 'worker' || /worker|summary|summaries|title|classification|fast/.test(bestFor);
  const codingFit = category === 'coding' || /coding|code|implementation|bug fix|refactor/.test(bestFor);
  const reviewFit = category === 'review' || /review|audit|security|correctness/.test(bestFor);
  const reasoningFit = category === 'reasoning' || /reasoning|planning|analysis|tradeoff/.test(bestFor);

  if (effort === 'low') {
    return 60 - cost * 12 + (workerFit ? 28 : 0) + tools + (thinking ? -10 : 8) - hugeContext;
  }
  if (effort === 'medium') {
    return 35 - cost * 3 + tools + (codingFit ? 34 : 0) + (workerFit ? 8 : 0) + (thinking && codingFit ? 4 : 0);
  }
  if (effort === 'high') {
    return 25 - cost + tools + (reviewFit ? 30 : 0) + (reasoningFit ? 22 : 0) + (codingFit ? 14 : 0) + (thinking ? 10 : 0);
  }
  return 10 + thinking * 1.8 + tools + longContext + hugeContext * 1.5 + (reasoningFit ? 22 : 0) + (category === 'long-context' || category === 'rag' ? 12 : 0) - cost * 0.5;
}

function bestModelForEffort(enabledModels: any[], effort: ThinkingEffort): any | null {
  return ([...enabledModels]
    .sort((a, b) => scoreModelForEffort(b, effort) - scoreModelForEffort(a, effort))[0]) || null;
}

/* ================================================================== */
/*  ASSISTANT                                                          */
/* ================================================================== */

function ClickySettingsPane({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <>
      <PaneTitle>Clicky</PaneTitle>
      <PaneDesc>A small animated helper for quick tips in the left sidebar.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Show Clicky</div>
            <div className="settings-item-desc">Display the helper icon and tip popover in the sidebar</div>
          </div>
          <div className={`toggle ${enabled ? 'active' : ''}`} onClick={() => onChange(!enabled)} />
        </div>
      </div>
    </>
  );
}

function AssistantSkillsPane({ skills, plugins }: { skills: Skill[]; plugins: Plugin[] }) {
  const [showPlugins, setShowPlugins] = useState(false);
  return (
    <>
      <PaneTitle>Skills</PaneTitle>
      <PaneDesc>Assistant capabilities and available plugin bundles.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div className="settings-section-header">
          <div className="settings-section-title">Skills ({skills.length})</div>
        </div>
        <div className="assistant-capability-list">
          {skills.map((skill) => {
            const Icon = skillCategoryIcons[skill.category] || Command;
            return (
              <div key={skill.name} className="assistant-capability-row">
                <span className="assistant-capability-icon"><Icon size={14} /></span>
                <span className="assistant-capability-main">
                  <span className="assistant-capability-name">{skill.name}</span>
                  <span className="assistant-capability-desc">{skill.description}</span>
                </span>
              </div>
            );
          })}
        </div>
        <button className="settings-mini-button" style={{ marginTop: 12 }} onClick={() => setShowPlugins(!showPlugins)}>
          {showPlugins ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Plugins ({plugins.length})
        </button>
        {showPlugins && (
          <div className="assistant-capability-list" style={{ marginTop: 8 }}>
            {plugins.map((plugin) => (
              <div key={plugin.name} className={`assistant-capability-row ${plugin.enabled ? '' : 'muted'}`}>
                <span className="assistant-capability-icon"><Grid size={14} /></span>
                <span className="assistant-capability-main">
                  <span className="assistant-capability-name">{plugin.name}</span>
                  <span className="assistant-capability-desc">{plugin.description}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AssistantMemoryPane({ entries }: { entries: MemoryEntry[] }) {
  return (
    <>
      <PaneTitle>Memory</PaneTitle>
      <PaneDesc>Reference context currently surfaced to the assistant.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div className="settings-section-header">
          <div className="settings-section-title">Active Memory</div>
        </div>
        <div className="assistant-capability-list">
          {entries.map((entry) => {
            const Icon = memoryTypeIcons[entry.type] || Brain;
            return (
              <div key={entry.id} className="assistant-capability-row">
                <span className="assistant-capability-icon"><Icon size={14} /></span>
                <span className="assistant-capability-main">
                  <span className="assistant-capability-name">{entry.name}</span>
                  <span className="assistant-capability-desc">{entry.description}</span>
                  {entry.path && <span className="assistant-capability-path">{entry.path}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/*  ACTIVE MODEL                                                       */
/* ================================================================== */

function ActiveModelPane({ activeModel, thinkingEffort, enabledModels, onSelectModel, onThinkingEffortChange }: any) {
  const current = enabledModels.find((m: any) => m.id === activeModel);
  const effectiveCurrent = current || (activeModel === 'Auto'
    ? { id: 'Auto', name: 'Auto', providerName: 'Router' }
    : null);
  const supportsThinking = modelSupportsThinking(activeModel, current?.providerId);
  const thinkingTitle = activeModel === 'Auto'
    ? 'Thinking biases Auto toward cheaper or deeper routing.'
    : 'Thinking effort for this reasoning-capable model.';
  return (
    <>
      <PaneTitle>Active Chat Model</PaneTitle>
      <PaneDesc>The model used for all chat conversations. Select Auto to let routing pick a candidate per request.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <div className="settings-item-label">{effectiveCurrent?.name || activeModel}</div>
          <div className="settings-item-desc">{activeModel === 'Auto' ? 'Router mode • per-request auto-selection' : (current ? `${current.providerName} • enabled for chat` : 'No enabled model found')}</div>
        </div>
        <div className="settings-model-controls">
          <select className="settings-select settings-select-wide" value={activeModel} onChange={(e) => onSelectModel(e.target.value)}>
            <option value="Auto">Auto</option>
            {enabledModels.map((model: any) => (
              <option key={`${model.providerId}:${model.id}`} value={model.id} title={modelCatalogTooltip(model.id, model.providerId)}>{model.providerName} — {model.name}</option>
            ))}
          </select>
          {supportsThinking && (
            <label className="settings-thinking-control" title={thinkingTitle}>
              <span><Brain size={12} /> Thinking</span>
              <select className="settings-select" value={thinkingEffort} onChange={(e) => onThinkingEffortChange(e.target.value as ThinkingEffort)} aria-label="Thinking effort">
                {THINKING_EFFORTS.map((effort) => (
                  <option key={effort.id} value={effort.id}>{effort.label}</option>
                ))}
              </select>
            </label>
          )}
          <ModelAbilityIcons modelId={activeModel} providerId={current?.providerId} />
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/*  MODEL LIBRARY                                                      */
/* ================================================================== */

function modelMatchesCatalogId(modelId: string, providerId: string, catalogId: string) {
  return findModelCatalogCard(modelId, providerId)?.id === catalogId;
}

function getCatalogAccess(cardId: string, providers: ProviderConfig[]) {
  const card = TOP_MODEL_CATALOG.find((candidate) => candidate.id === cardId);
  const matches = providers.flatMap((provider) =>
    provider.models
      .filter((model) => modelMatchesCatalogId(model.id, provider.id, cardId))
      .map((model) => ({
        providerName: provider.name,
        providerId: provider.id,
        configured: provider.configured,
        enabled: model.enabled,
        modelName: model.name,
      }))
  );
  const providerAccess = card
    ? providers
      .filter((provider) => {
        if (!provider.configured) return false;
        const providerKeys = [provider.id, provider.name].map((value) => normalizeModelCatalogKey(value || ''));
        const cardProviderKeys = [card.provider, ...card.providerHints].map((value) => normalizeModelCatalogKey(value || ''));
        return providerKeys.some((providerKey) =>
          cardProviderKeys.some((cardProviderKey) => providerKey.includes(cardProviderKey) || cardProviderKey.includes(providerKey))
        );
      })
      .map((provider) => ({
        providerName: provider.name,
        providerId: provider.id,
        configured: provider.configured,
      }))
    : [];
  const enabled = matches.filter((match) => match.configured && match.enabled);
  const configured = matches.filter((match) => match.configured);
  const available = configured.length > 0 || providerAccess.length > 0;
  return {
    matches,
    enabled,
    providerAccess,
    label: enabled.length > 0 ? 'Enabled' : available ? 'Available' : matches.length > 0 ? 'Fetched' : 'Catalog',
    providerLabel: (enabled[0] || configured[0] || matches[0] || providerAccess[0])?.providerName || '',
  };
}

function ModelLibraryPane({ providers }: { providers: ProviderConfig[] }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | keyof typeof MODEL_CATEGORY_META>('all');
  const [accessOnly, setAccessOnly] = useState(false);

  const categoryCounts = TOP_MODEL_CATALOG.reduce<Record<string, number>>((acc, card) => {
    const category = modelBestCategory(card);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const filtered = TOP_MODEL_CATALOG.filter((card) => {
    const access = getCatalogAccess(card.id, providers);
    const category = modelBestCategory(card);
    const haystack = [
      card.displayName,
      card.provider,
      card.family,
      card.compactDescription,
      card.reviewSummary,
      ...card.strengths,
      ...card.weaknesses,
      ...card.bestFor,
      ...card.comparableTo,
    ].join(' ').toLowerCase();
    const queryMatch = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const categoryMatch = categoryFilter === 'all' || category === categoryFilter;
    const accessMatch = !accessOnly || access.enabled.length > 0;
    return queryMatch && categoryMatch && accessMatch;
  });

  return (
    <>
      <PaneTitle>Model Library</PaneTitle>
      <PaneDesc>
        Compare tracked model cards with strengths, weaknesses, context, cost, and live availability across your configured providers.
      </PaneDesc>

      <div className="model-library-toolbar">
        <label className="model-library-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models, strengths, providers, comparisons"
          />
        </label>
        <select
          className="settings-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | keyof typeof MODEL_CATEGORY_META)}
          title="Filter by best-rated category"
        >
          <option value="all">All categories</option>
          {Object.entries(MODEL_CATEGORY_META).map(([id, meta]) => (
            <option key={id} value={id}>{meta.label} ({categoryCounts[id] || 0})</option>
          ))}
        </select>
        <button
          className={`settings-mini-button model-library-access-button ${accessOnly ? 'active' : ''}`}
          onClick={() => setAccessOnly((prev) => !prev)}
          title="Show enabled models from configured providers"
        >
          {accessOnly ? <Check size={11} /> : <Bot size={11} />}
          My Models
        </button>
      </div>

      <div className="model-library-summary">
        <div><strong>{TOP_MODEL_CATALOG.length}</strong> catalog cards</div>
        <div><strong>{providers.flatMap((p) => p.configured ? p.models.filter((m) => m.enabled) : []).length}</strong> enabled provider models</div>
        <div>Updated {MODEL_CATALOG_UPDATED_AT}</div>
      </div>

      <div className="model-category-legend">
        {Object.entries(MODEL_CATEGORY_META).map(([id, meta]) => (
          <button
            key={id}
            className={`model-category-chip ${categoryFilter === id ? 'active' : ''}`}
            style={{ ['--category-color' as any]: meta.color, ['--category-bg' as any]: meta.background }}
            onClick={() => setCategoryFilter(categoryFilter === id ? 'all' : id as keyof typeof MODEL_CATEGORY_META)}
            title={`Best-rated category: ${meta.label}`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <div className="model-library-grid">
        {filtered.map((card) => {
          const access = getCatalogAccess(card.id, providers);
          const category = modelBestCategory(card);
          const categoryMeta = MODEL_CATEGORY_META[category];
          const accessClass = access.label.toLowerCase();
          return (
            <article
              key={card.id}
              className="model-card"
              style={{ ['--model-category-color' as any]: categoryMeta.color, ['--model-category-bg' as any]: categoryMeta.background }}
              title={modelCatalogTooltip(card.id)}
            >
              <div className="model-card-top">
                <div className="model-card-title-block">
                  <div className="model-card-provider">{card.provider}</div>
                  <h3>{card.displayName}</h3>
                </div>
                <div className={`model-card-access ${accessClass}`}>
                  {access.label}
                  {access.providerLabel && <span>{access.providerLabel}</span>}
                </div>
              </div>
              <div className="model-card-category">{categoryMeta.label}</div>
              <p className="model-card-compact">{card.compactDescription}</p>
              <div className="model-card-metrics">
                <div><span>Context</span><strong>{formatContextWindow(card.contextWindowTokens)}</strong></div>
                <div><span>Cost</span><strong>{formatModelCost(card)}</strong></div>
                <div><span>Tools</span><strong>{card.supportsTools ? 'Yes' : 'Basic'}</strong></div>
                <div><span>Vision</span><strong>{card.supportsImages ? 'Yes' : 'No'}</strong></div>
              </div>
              <div className="model-card-review">{card.reviewSummary}</div>
              <div className="model-card-columns">
                <div>
                  <span>Good at</span>
                  <p>{card.strengths.join(', ')}</p>
                </div>
                <div>
                  <span>Bad at</span>
                  <p>{card.weaknesses.join(', ')}</p>
                </div>
              </div>
              <div className="model-card-compare">
                Comparable to: {card.comparableTo.join(', ')}
              </div>
              <div className="model-card-benchmark">{card.benchmarkHighlights[0]}</div>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="settings-card" style={{ marginTop: 16, textAlign: 'center' }}>
          <div className="settings-item-label">No matching model cards</div>
          <div className="settings-item-desc">Clear filters or fetch models from a configured provider.</div>
        </div>
      )}

      <div className="model-library-sources">
        <div className="model-library-sources-title">Research and maintenance</div>
        {MODEL_CATALOG_SOURCES.map((source) => (
          <div key={source.label}>
            <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
            <span>{source.note}</span>
          </div>
        ))}
        <p>{MODEL_CATALOG_MAINTENANCE_NOTE}</p>
      </div>
    </>
  );
}

function ProviderPlanControls({
  providerId,
  providerName,
  accessMode,
  planId,
  onChange,
}: {
  providerId?: string;
  providerName?: string;
  accessMode: ProviderAccessMode;
  planId?: string;
  onChange: (next: { accessMode: ProviderAccessMode; planId: string }) => void;
}) {
  const catalog = providerPlanCatalogFor(providerId, providerName);
  const fallback = defaultProviderPlan(providerId, providerName);
  const plans = catalog?.plans || [fallback];
  const selectedPlan = plans.find((plan) => plan.id === planId) || plans.find((plan) => plan.accessMode === accessMode) || plans[0];
  const selectedMode = selectedPlan?.accessMode || accessMode;

  const setAccessMode = (nextMode: ProviderAccessMode) => {
    const nextPlan = plans.find((plan) => plan.accessMode === nextMode) || selectedPlan || plans[0];
    onChange({ accessMode: nextMode, planId: nextPlan.id });
  };

  return (
    <div className="provider-plan-controls">
      <label className="provider-access-toggle">
        <input
          type="checkbox"
          checked={selectedMode === 'subscription'}
          onChange={(e) => setAccessMode(e.target.checked ? 'subscription' : 'api-key')}
        />
        <span>Subscription access</span>
      </label>
      <label>
        Plan level
        <select
          value={selectedPlan.id}
          onChange={(e) => {
            const nextPlan = plans.find((plan) => plan.id === e.target.value) || plans[0];
            onChange({ accessMode: nextPlan.accessMode, planId: nextPlan.id });
          }}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.label} — {plan.accessMode === 'subscription' ? 'subscription' : 'API key'}
            </option>
          ))}
        </select>
      </label>
      <div className="provider-plan-note">
        {selectedPlan.description}
        {catalog && (
          <>
            {' '}Source: <a href={catalog.sourceUrl} target="_blank" rel="noreferrer">{catalog.sourceLabel}</a>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  MANAGE PROVIDERS — collapsible cards, scales to 10+               */
/* ================================================================== */

function ProvidersPane({
  providers,
  onTest,
  onFetch,
  onUpdateProvider,
  onRemove,
  onToggleModel,
  activeModel,
}: any) {
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [fetchingModels, setFetchingModels] = useState<string | null>(null);
  const [fetchResults, setFetchResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [providerKeyDraft, setProviderKeyDraft] = useState<Record<string, string>>({});
  const [updatingProviderKey, setUpdatingProviderKey] = useState<string | null>(null);
  const [healthByProvider, setHealthByProvider] = useState<Record<string, { summary: api.ProviderHealthSummary; history: api.ProviderHealthRecord[] }>>({});
  const [probingHealth, setProbingHealth] = useState<string | null>(null);

  // Load provider health history for the badge.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, { summary: api.ProviderHealthSummary; history: api.ProviderHealthRecord[] }> = {};
      await Promise.all(providers.map(async (p: any) => {
        try {
          const res = await api.getProviderHealth(p.id);
          if (!cancelled) out[p.id] = res;
        } catch { /* ignore */ }
      }));
      if (!cancelled) setHealthByProvider(out);
    })();
    return () => { cancelled = true; };
  }, [providers]);

  const probeHealth = async (providerId: string) => {
    setProbingHealth(providerId);
    try {
      await api.probeProviderHealth(providerId);
      const res = await api.getProviderHealth(providerId);
      setHealthByProvider((prev) => ({ ...prev, [providerId]: res }));
    } finally {
      setProbingHealth(null);
    }
  };

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
                      <span> • {provider.accessMode === 'subscription' ? 'subscription' : 'API key'}</span>
                      <span> • {providerPlanLabel(provider.id, provider.planId, provider.name)}</span>
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
                  <ProviderPlanControls
                    providerId={provider.id}
                    providerName={provider.name}
                    accessMode={provider.accessMode || 'api-key'}
                    planId={provider.planId}
                    onChange={(next) => onUpdateProvider(provider.id, next)}
                  />
                  {/* Quick actions */}
                  <div className="prov-card-actions">
                    {provider.type !== 'local' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            API key
                            <span style={{ color: provider.configured ? 'var(--text-secondary)' : 'var(--warning)' }}>
                              {provider.configured ? ' (stored)' : ' (not configured)'}
                            </span>
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input
                              type="password"
                              value={providerKeyDraft[provider.id] || ''}
                              onChange={(e) => setProviderKeyDraft((prev) => ({ ...prev, [provider.id]: e.target.value }))}
                              placeholder={provider.configured ? 'Update key (optional)' : 'Add API key'}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 11,
                                borderRadius: 4,
                                border: '1px solid var(--border-primary)',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                padding: '4px 6px',
                              }}
                            />
                            <button
                              className="settings-mini-button"
                              disabled={updatingProviderKey === provider.id}
                              onClick={async () => {
                                const apiKey = (providerKeyDraft[provider.id] || '').trim();
                                if (!apiKey) return;
                                setUpdatingProviderKey(provider.id);
                                try {
                                  await onUpdateProvider(provider.id, { apiKey });
                                  const result = await onTest(provider.id, apiKey);
                                  setTestResults((p) => ({ ...p, [provider.id]: result }));
                                  setProviderKeyDraft((prev) => ({ ...prev, [provider.id]: '' }));
                                } catch (err: any) {
                                  setTestResults((p) => ({ ...p, [provider.id]: { ok: false, error: err?.message || 'Failed to save or validate key' } }));
                                } finally {
                                  setUpdatingProviderKey(null);
                                }
                              }}
                            >
                              {updatingProviderKey === provider.id ? <Loader size={11} className="spin" /> : <KeyRound size={11} />}
                              {updatingProviderKey === provider.id ? 'Saving' : 'Save'}
                            </button>
                          </div>
                        </label>
                      </div>
                    )}
                    {(healthByProvider[provider.id]?.summary || tr) && (
                      <ProviderHealthBadge
                        summary={healthByProvider[provider.id]?.summary}
                        lastTest={tr}
                        onProbe={() => probeHealth(provider.id)}
                        probing={probingHealth === provider.id}
                      />
                    )}
                    <button
                      className="settings-mini-button"
                      onClick={() => {
                        const tempKey = (providerKeyDraft[provider.id] || '').trim() || undefined;
                        setTestingProvider(provider.id);
                        onTest(provider.id, tempKey)
                          .then((r: any) => setTestResults((p) => ({ ...p, [provider.id]: r })))
                          .catch((e: any) => setTestResults((p) => ({ ...p, [provider.id]: { ok: false, error: e.message } })))
                          .finally(() => setTestingProvider(null));
                      }}
                      disabled={testingProvider === provider.id}
                    >
                      {testingProvider === provider.id ? <Loader size={11} className="spin" /> : <Wifi size={11} />}
                      {testingProvider === provider.id ? 'Testing...' : 'Test'}
                    </button>
                    <button className="settings-mini-button" onClick={async () => {
                      const tempKey = (providerKeyDraft[provider.id] || '').trim() || undefined;
                      setFetchingModels(provider.id);
                      try {
                        const result = await onFetch(provider.id, tempKey);
                        const count = Array.isArray(result) ? result.length : (result?.length || 0);
                        setFetchResults((prev) => ({ ...prev, [provider.id]: { ok: true, msg: 'Found ' + count + ' model' + (count === 1 ? '' : 's') } }));
                      } catch (err: any) {
                        setFetchResults((prev) => ({ ...prev, [provider.id]: { ok: false, msg: err?.message || 'Failed' } }));
                      }
                      setFetchingModels(null);
                    }} disabled={fetchingModels === provider.id}>
                      {fetchingModels === provider.id ? <Loader size={11} className="spin" /> : <RefreshCw size={11} />}
                      {fetchingModels === provider.id ? 'Fetching...' : 'Fetch Models'}
                    </button>
                    {fetchResults[provider.id] && fetchingModels !== provider.id && (
                      <span style={{
                        fontSize: 11, marginLeft: 4,
                        color: fetchResults[provider.id].ok ? 'var(--accent-color, #16a34a)' : 'var(--accent-error, #ef4444)',
                      }}>
                        {fetchResults[provider.id].ok ? "\u2713" : "\u2717"} {fetchResults[provider.id].msg}
                      </span>
                    )}
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
          <div key={model.id} className="prov-model-row" title={modelCatalogTooltip(model.id, providerId)}>
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
  const [presetAccessMode, setPresetAccessMode] = useState<ProviderAccessMode>('api-key');
  const [presetPlanId, setPresetPlanId] = useState('');

  // Custom form state
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customURL, setCustomURL] = useState('');
  const [customType, setCustomType] = useState('openai-compatible');
  const [customAccessMode, setCustomAccessMode] = useState<ProviderAccessMode>('api-key');
  const [customPlanId, setCustomPlanId] = useState('');

  const featured = PROVIDER_PRESETS.filter((p) => p.featured);
  const extended = PROVIDER_PRESETS.filter((p) => !p.featured);
  const isAlreadyAdded = (presetId: string) => existingIds.includes(presetId);

  // When a preset is selected, populate editable fields
  useEffect(() => {
    if (selectedPreset) {
      setPresetName(selectedPreset.name);
      setPresetURL(selectedPreset.baseURL);
      setPresetType(selectedPreset.type);
      const defaultPlan = defaultProviderPlan(selectedPreset.id, selectedPreset.name);
      setPresetAccessMode(defaultPlan.accessMode);
      setPresetPlanId(defaultPlan.id);
    }
  }, [selectedPreset]);

  const handlePresetSave = async () => {
    if (!apiKey.trim() && selectedPreset?.type !== 'local' && presetAccessMode !== 'subscription') { setError('API key is required'); return; }
    if (!presetURL.trim()) { setError('Endpoint is required'); return; }
    setSaving(true); setError('');
    try {
      await onAdd({
        name: presetName.trim() || selectedPreset!.name,
        type: presetType,
        apiKey: apiKey.trim(),
        baseURL: presetURL.trim(),
        accessMode: selectedPreset!.type === 'local' ? 'api-key' : presetAccessMode,
        planId: selectedPreset!.type === 'local' ? undefined : presetPlanId,
      });
      onDone();
    } catch (e: any) { setError(e.message || 'Failed to add'); }
    finally { setSaving(false); }
  };

  const handleCustomSave = async () => {
    if (!customName.trim() || !customURL.trim()) { setError('Name and endpoint are required'); return; }
    setSaving(true); setError('');
    try {
      const plan = customType === 'local' ? undefined : (customPlanId
        ? { accessMode: customAccessMode, id: customPlanId }
        : defaultProviderPlan(undefined, customName.trim()));
      await onAdd({
        name: customName.trim(),
        type: customType,
        apiKey: apiKey.trim(),
        baseURL: customURL.trim(),
        accessMode: plan?.accessMode,
        planId: plan?.id,
      });
      onDone();
    } catch (e: any) { setError(e.message || 'Failed to add'); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setSelectedPreset(null); setCustomMode(false);
    setApiKey(''); setError('');
    setPresetName(''); setPresetURL(''); setPresetType('openai-compatible'); setPresetAccessMode('api-key'); setPresetPlanId('');
    setCustomName(''); setCustomURL(''); setCustomType('openai-compatible'); setCustomAccessMode('api-key'); setCustomPlanId('');
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
                  placeholder={selectedPreset.type === 'local' ? 'No key needed for local providers' : presetAccessMode === 'subscription' ? 'Optional for subscription access' : 'Paste your API key'}
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
            {selectedPreset.type !== 'local' && (
              <ProviderPlanControls
                providerId={selectedPreset.id}
                providerName={presetName || selectedPreset.name}
                accessMode={presetAccessMode}
                planId={presetPlanId}
                onChange={(next) => {
                  setPresetAccessMode(next.accessMode);
                  setPresetPlanId(next.planId);
                }}
              />
            )}
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
            {customType !== 'local' && (
              <ProviderPlanControls
                providerName={customName}
                accessMode={customAccessMode}
                planId={customPlanId}
                onChange={(next) => {
                  setCustomAccessMode(next.accessMode);
                  setCustomPlanId(next.planId);
                }}
              />
            )}
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


function AgentRolesPane({ roleAssignments, roleThinking, enabledModels, onAssignRoleModel, onAssignRoleThinking }: any) {
  const autoDefaultedRef = useRef(false);
  const effortCopy: Record<ThinkingEffort, { summary: string; intent: string }> = {
    low: {
      summary: 'Fast and inexpensive',
      intent: 'Best for routine tool use, small edits, summaries, and other low-risk work.',
    },
    medium: {
      summary: 'Balanced default',
      intent: 'A good everyday setting for planning, coding, reviewing, and mixed tasks.',
    },
    high: {
      summary: 'Deeper reasoning',
      intent: 'Use for tricky debugging, architecture choices, security review, and tradeoffs.',
    },
    xhigh: {
      summary: 'Maximum effort',
      intent: 'Reserve for the hardest investigations where quality matters more than speed.',
    },
  };

  const modelOptions = (
    <>
      <option value="Auto">Auto</option>
      {enabledModels.map((model: any) => (
        <option key={`${model.providerId}:${model.id}`} value={model.id}>
          {model.providerName} — {model.name}
        </option>
      ))}
    </>
  );

  const assignModelToEffort = useCallback((effortId: ThinkingEffort, modelId: string) => {
    roleAssignments
      .filter((role: CodingRoleAssignment) => (roleThinking?.[role.id] || 'medium') === effortId)
      .forEach((role: CodingRoleAssignment) => onAssignRoleModel(role.id, modelId));
  }, [onAssignRoleModel, roleAssignments, roleThinking]);

  const recommendedModels = Object.fromEntries(
    THINKING_EFFORTS.map((effort) => [effort.id, bestModelForEffort(enabledModels, effort.id)])
  ) as Record<ThinkingEffort, any | null>;

  const applyRecommendedDefaults = useCallback(() => {
    roleAssignments.forEach((role: CodingRoleAssignment) => {
      const effort = ROLE_DEFAULT_EFFORT[role.id] || 'medium';
      onAssignRoleThinking(role.id, effort);
      const recommended = recommendedModels[effort];
      if (recommended) onAssignRoleModel(role.id, recommended.id);
    });
  }, [onAssignRoleModel, onAssignRoleThinking, recommendedModels, roleAssignments]);

  useEffect(() => {
    if (autoDefaultedRef.current || enabledModels.length === 0) return;
    const allRolesAreAuto = roleAssignments.every((role: CodingRoleAssignment) => role.modelId === 'Auto');
    if (!allRolesAreAuto) return;
    autoDefaultedRef.current = true;
    applyRecommendedDefaults();
  }, [applyRecommendedDefaults, enabledModels.length, roleAssignments]);

  return (
    <>
      <PaneTitle>Agent Roles</PaneTitle>
      <PaneDesc>Pick how much thinking each kind of work deserves. Use Auto for the model unless you want a specific role override.</PaneDesc>
      <div className="role-recommendation-bar">
        <div>
          <div className="role-recommendation-title">Recommended setup</div>
          <div className="role-recommendation-copy">Uses only enabled provider models: Low for quick work, Medium for day-to-day coding, High for review, xHigh for hardest reasoning.</div>
        </div>
        <button className="settings-mini-button" onClick={applyRecommendedDefaults} disabled={enabledModels.length === 0}>
          <Sparkles size={12} /> Apply defaults
        </button>
      </div>
      <div className="role-effort-list">
        {THINKING_EFFORTS.map((effort) => {
          const rolesForEffort = roleAssignments.filter((role: CodingRoleAssignment) => (roleThinking?.[role.id] || 'medium') === effort.id);
          const sharedModel = rolesForEffort.length > 0 && rolesForEffort.every((role: CodingRoleAssignment) => role.modelId === rolesForEffort[0].modelId)
            ? rolesForEffort[0].modelId
            : '';
          return (
            <section key={effort.id} className="role-effort-section">
              <div className="role-effort-header">
                <div className="role-effort-title-row">
                  <span className="role-effort-icon"><Brain size={14} /></span>
                  <div>
                    <div className="role-effort-title">{effort.label}</div>
                    <div className="role-effort-summary">{effortCopy[effort.id].summary}</div>
                  </div>
                  <span className="role-effort-count">{rolesForEffort.length}</span>
                </div>
                <div className="role-effort-controls">
                  <span>Use model</span>
                  <select
                    className="settings-select settings-select-wide"
                    value={sharedModel}
                    onChange={(e) => assignModelToEffort(effort.id, e.target.value)}
                    disabled={rolesForEffort.length === 0}
                    aria-label={`Model for ${effort.label} roles`}
                  >
                    {rolesForEffort.length > 0 && sharedModel === '' && <option value="">Mixed</option>}
                    {modelOptions}
                  </select>
                </div>
              </div>
              <div className="role-effort-intent">{effortCopy[effort.id].intent}</div>
              {recommendedModels[effort.id] && (
                <div className="role-effort-recommendation">
                  Best available: {recommendedModels[effort.id]?.providerName} — {recommendedModels[effort.id]?.name}
                </div>
              )}
              <div className="role-bucket-list">
                {rolesForEffort.length === 0 && (
                  <div className="role-effort-empty">No roles are using {effort.label.toLowerCase()} thinking.</div>
                )}
                {rolesForEffort.map((role: CodingRoleAssignment) => {
                  const Icon = roleIconMap[role.id] || Bot;
                  const selectedModel = enabledModels.find((model: any) => model.id === role.modelId);
                  const supportsThinking = modelSupportsThinking(role.modelId, selectedModel?.providerId);
                  const thinkingTitle = role.modelId === 'Auto'
                    ? `${role.name} uses Thinking to bias Auto routing depth and cost.`
                    : `${role.name} thinking effort for this reasoning-capable model.`;
                  return (
                    <div key={role.id} className="role-bucket-card">
                      <div className="role-bucket-icon"><Icon size={15} /></div>
                      <div className="role-bucket-body">
                        <div className="role-bucket-topline">
                          <div>
                            <div className="role-bucket-name">{role.name}</div>
                            <div className="role-bucket-desc">{role.description}</div>
                          </div>
                          <ModelAbilityIcons modelId={role.modelId} providerId={selectedModel?.providerId} />
                        </div>
                        <div className="settings-model-controls">
                          <select className="settings-select settings-select-wide" value={role.modelId} onChange={(e) => onAssignRoleModel(role.id, e.target.value)} aria-label={`${role.name} model`}>
                            <option value="Auto">Auto</option>
                            {enabledModels.map((model: any) => {
                              const rec = isModelRecommended(role.id, model.id);
                              return (
                                <option key={`${role.id}:${model.providerId}:${model.id}`} value={model.id}>
                                  {rec ? '✓ ' : ''}{model.providerName} — {model.name}{rec ? ' (Recommended)' : ''}
                                </option>
                              );
                            })}
                          </select>
                          {supportsThinking && (
                            <label className="settings-thinking-control" title={thinkingTitle}>
                              <span><Brain size={12} /> Move to</span>
                              <select className="settings-select" value={roleThinking?.[role.id] || 'medium'} onChange={(e) => onAssignRoleThinking(role.id, e.target.value as ThinkingEffort)} aria-label={`${role.name} thinking effort`}>
                                {THINKING_EFFORTS.map((option) => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                        {findModelCatalogCard(role.modelId) && (
                          <div className="role-bucket-model-note" title={modelCatalogTooltip(role.modelId)}>
                            {findModelCatalogCard(role.modelId)?.compactDescription}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
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
  const usableToolCount = dockerStatus?.usableToolCount ?? toolCount;
  const blockedToolCount = dockerStatus?.blockedToolCount ?? 0;
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
              {toolCount > 0 && (
                <span style={{ marginLeft: 8, color: 'var(--accent-primary)', fontWeight: 600 }}>
                  {usableToolCount} usable tools
                </span>
              )}
              {blockedToolCount > 0 && (
                <span style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>
                  {blockedToolCount} blocked by trust mode
                </span>
              )}
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
              {toolsExpanded ? 'Hide tools' : 'Show tool policy'}
            </button>
            {toolsExpanded && (
              <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {tools.map((tool: any) => (
                  <div key={tool.name} style={{ padding: '4px 0', fontSize: 11, display: 'flex', gap: 8, borderBottom: '1px solid var(--border-primary)', opacity: tool.allowed === false ? 0.55 : 1 }}>
                    <code style={{ color: tool.allowed === false ? 'var(--text-tertiary)' : 'var(--accent-primary)', flexShrink: 0, fontSize: 11 }}>{tool.name}</code>
                    {tool.allowed === false && <span style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>blocked</span>}
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
    { id: 'detailed', label: 'Detailed', text: 'Provide a concise rationale. Include relevant context, alternatives considered, and tradeoffs when useful. Teach while you code.' },
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

function ThemePane({ activeTheme, onSelectTheme, onThemePluginManifestsChange, onRemoveTheme }: any) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resolvedActiveTheme = resolveThemeId(activeTheme);
  const hasRepair = activeTheme !== resolvedActiveTheme;
  const [importFeedback, setImportFeedback] = useState<{ kind: 'error' | 'success'; message: string; details?: string[] } | null>(null);
  const themeGroups = [
    { mode: 'dark', label: 'Dark themes', themes: getThemesByMode('dark') },
    { mode: 'light', label: 'Light themes', themes: getThemesByMode('light') },
  ] as const;

  const handleImportThemes = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFeedback(null);
    try {
      const payload = await file.text();
      const importResult = importThemePluginFromJson(payload);
      if (!importResult.ok || importResult.errors.length > 0) {
        setImportFeedback({
          kind: 'error',
          message: `Theme import failed: ${importResult.errors[0] || 'unknown error'}`,
          details: importResult.errors.slice(1),
        });
      } else {
        onThemePluginManifestsChange(getInstalledThemePluginManifests());
        const imported = importResult.importedThemeIds.length > 0
          ? importResult.importedThemeIds
            .map((id) => `${id} (${getThemeById(id)?.label || id})`)
            .join(', ')
          : 'No themes';
        setImportFeedback({
          kind: 'success',
          message: `Imported ${importResult.importedThemeIds.length} theme variant(s).`,
          details: [imported, ...importResult.warnings],
        });
      }
    } catch (error) {
      setImportFeedback({
        kind: 'error',
        message: 'Could not read theme manifest file.',
        details: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const showImportPicker = () => fileInputRef.current?.click();

  return (
    <>
      <PaneTitle>Theme</PaneTitle>
      <PaneDesc>Choose a colorway. Changes apply instantly.</PaneDesc>
      <div style={{ marginTop: 16 }}>
        {hasRepair && (
          <div style={{ color: 'var(--accent-warning)', fontSize: 12, marginBottom: 12 }}>
            Saved theme "{activeTheme}" is unavailable. Reverted to "{resolvedActiveTheme}".
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Import a validated theme manifest (.json) to add community themes.
          </div>
          <button className="settings-mini-button" onClick={showImportPicker}>
            <Plus size={11} /> Import theme
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportThemes}
          style={{ display: 'none' }}
        />
        {importFeedback && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: importFeedback.kind === 'error' ? 'var(--accent-error)' : 'var(--accent-success)', fontSize: 12 }}>
              {importFeedback.message}
            </div>
            {importFeedback.details && importFeedback.details.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: 'var(--text-tertiary)', fontSize: 11 }}>
                {importFeedback.details.filter(Boolean).map((line) => (
                  <li key={`${importFeedback.kind}-${line}`}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {themeGroups.map((group) => (
          <div key={group.mode} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
              {group.themes.map((t) => (
                <button key={t.id} className={`settings-card ${resolvedActiveTheme === t.id ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    padding: '10px 12px',
                    border: resolvedActiveTheme === t.id ? '2px solid var(--accent-primary)' : undefined,
                    position: 'relative',
                  }}
                  onClick={() => onSelectTheme(t.id)}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: t.color, flexShrink: 0 }} />
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                    {resolvedActiveTheme === t.id && <div style={{ fontSize: 10, color: 'var(--accent-primary)' }}>Active</div>}
                  </div>
                  {!t.tags?.includes('builtin') && (
                    <button
                      className="settings-mini-button"
                      title={`Remove ${t.label}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveTheme(t.id);
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        minWidth: 'auto',
                        padding: '2px 6px',
                      }}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
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
/*  AUTO-ROUTER                                                        */
/* ================================================================== */

type RouterModelCard = {
  id: string;
  aliases: string[];
  providerHints: string[];
  cost: number;
  supportsImages: boolean;
  supportsThinking: boolean;
  card: string;
};

const TOP_ROUTER_MODEL_CARDS: RouterModelCard[] = TOP_MODEL_CATALOG.map((card) => ({
  id: card.id,
  aliases: [card.displayName, ...card.aliases],
  providerHints: card.providerHints,
  cost: card.routerCost,
  supportsImages: card.supportsImages,
  supportsThinking: card.supportsThinking,
  card: card.compactDescription,
}));

const normalizeModelKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

function getProviderIdFromModelId(modelId: string) {
  return modelId.includes(':') ? modelId.split(':')[0] : '';
}

function getProviderBillingMode(providerId: string, accessMode?: string): 'subscription' | 'metered' {
  if (accessMode === 'subscription') return 'subscription';
  if (accessMode === 'api-key') return 'metered';
  const normalized = providerId.toLowerCase();
  if (
    normalized === 'minimax' ||
    normalized === 'z-ai-zhipu' ||
    normalized === 'zhipu' ||
    normalized === 'opencode-go'
  ) {
    return 'subscription';
  }
  return 'metered';
}

function getEffectiveRouterCost(modelId: string, providerId: string, baseCost: number, accessMode?: string) {
  if (getProviderBillingMode(providerId, accessMode) !== 'subscription') return baseCost;
  const lower = modelId.toLowerCase();

  if (providerId === 'minimax') {
    if (lower.includes('m3')) return 0.05;
    if (lower.includes('m2.7')) return 0.2;
    return 0.12;
  }

  if (providerId === 'z-ai-zhipu' || providerId === 'zhipu') {
    if (lower.includes('glm-4.7')) return 0.05;
    if (lower.includes('glm-5.1')) return 0.08;
    if (lower.includes('glm-5')) return 0.08;
    return 0.1;
  }

  if (providerId === 'opencode-go') {
    if (lower.includes('flash') || lower.includes('qwen') || lower.includes('mimo')) return 0.08;
    if (lower.includes('deepseek') || lower.includes('kimi')) return 0.12;
    return 0.15;
  }

  return baseCost;
}

function findRouterModelCard(modelId: string, providerId = '') {
  const bareId = modelId.includes(':') ? modelId.split(':').slice(1).join(':') : modelId;
  const normalized = normalizeModelKey(bareId);
  const provider = providerId.toLowerCase();
  return TOP_ROUTER_MODEL_CARDS.find((card) => {
    const ids = [card.id, ...card.aliases].map(normalizeModelKey);
    const providerMatches = card.providerHints.length === 0 || card.providerHints.some((hint) => provider.includes(hint));
    return ids.some((id) => normalized === id || normalized.includes(id) || id.includes(normalized)) && providerMatches;
  }) || TOP_ROUTER_MODEL_CARDS.find((card) => {
    const ids = [card.id, ...card.aliases].map(normalizeModelKey);
    return ids.some((id) => normalized === id || normalized.includes(id) || id.includes(normalized));
  });
}

function fallbackRouterCard(modelId: string) {
  const lower = modelId.toLowerCase();
  if (lower.includes('claude')) return { cost: 1.0, supportsImages: true, supportsThinking: false, card: 'Claude-family model. Usually strong at code quality and tool use; cost and exact strengths depend on variant.' };
  if (lower.includes('gemini')) return { cost: 0.6, supportsImages: true, supportsThinking: false, card: 'Gemini-family model. Good for large-context and multimodal tasks; use Pro for harder reasoning.' };
  if (lower.includes('deepseek')) return { cost: 0.25, supportsImages: false, supportsThinking: /\b(r1|r2|reasoner)\b/.test(lower), card: 'DeepSeek-family model. Strong low-cost text coding; image support depends on provider variant.' };
  if (lower.includes('qwen')) return { cost: 0.25, supportsImages: false, supportsThinking: /thinking|think|qwen3.*max/.test(lower), card: 'Qwen-family model. Strong open coding and reasoning; hosting quality and variant matter.' };
  if (lower.includes('mistral') || lower.includes('codestral') || lower.includes('devstral')) return { cost: 0.45, supportsImages: false, supportsThinking: false, card: 'Mistral-family model. Good structured coding and review; reserve small models for routine tasks.' };
  if (lower.includes('grok')) return { cost: 0.8, supportsImages: true, supportsThinking: lower.includes('grok-4'), card: 'Grok-family model. Good creative coding and UI tasks; can be opinionated.' };
  if (lower.includes('minimax')) return { cost: 0.3, supportsImages: true, supportsThinking: lower.includes('m3'), card: 'MiniMax-family model. Good low-cost long-context coding; validate hard reviews with stronger specialists.' };
  if (lower.includes('llama')) return { cost: 0.2, supportsImages: false, supportsThinking: false, card: 'Llama-family model. Useful local/proxy coding option; exact reliability depends on host and size.' };
  return { cost: 0.5, supportsImages: false, supportsThinking: false, card: 'Configured model. No detailed catalog card matched, so use this for general text tasks and validate routing quality.' };
}

function routerCapabilityCard(baseCard: string, supportsThinking: boolean) {
  const trimmed = baseCard.trim();
  const thinkingLine = `Native thinking: ${supportsThinking ? 'yes' : 'no'}.`;
  return /native thinking:/i.test(trimmed) ? trimmed : `${trimmed} ${thinkingLine}`;
}

function enrichRouterCandidate(candidate: api.AutoRouterCandidateConfig, providerId = ''): api.AutoRouterCandidateConfig {
  const resolvedProviderId = providerId || getProviderIdFromModelId(candidate.modelId);
  const card = findRouterModelCard(candidate.modelId, resolvedProviderId);
  const fallback = fallbackRouterCard(candidate.modelId);
  const baseCost = Number.isFinite(candidate.cost) && candidate.cost > 0 ? candidate.cost : (card?.cost ?? fallback.cost);
  return {
    modelId: candidate.modelId,
    cost: getEffectiveRouterCost(candidate.modelId, resolvedProviderId, baseCost),
    supportsImages: candidate.supportsImages || card?.supportsImages || fallback.supportsImages,
    supportsThinking: candidate.supportsThinking ?? card?.supportsThinking ?? fallback.supportsThinking,
    card: routerCapabilityCard(candidate.card?.trim() || card?.card || fallback.card, candidate.supportsThinking ?? card?.supportsThinking ?? fallback.supportsThinking),
  };
}

function refreshConfiguredRouterCosts(
  existing: api.AutoRouterCandidateConfig[],
  configured: api.AutoRouterCandidateConfig[],
) {
  const configuredByModel = new Map(configured.map((candidate) => [normalizeModelKey(candidate.modelId), candidate]));
  return existing.map((candidate) => {
    const configuredCandidate = configuredByModel.get(normalizeModelKey(candidate.modelId));
    if (!configuredCandidate) return candidate;
    return {
      ...candidate,
      cost: configuredCandidate.cost,
      supportsImages: candidate.supportsImages || configuredCandidate.supportsImages,
      supportsThinking: configuredCandidate.supportsThinking ?? candidate.supportsThinking,
      card: configuredCandidate.card,
    };
  });
}

function buildConfiguredRouterCandidates(cfg: api.AppConfig | null): api.AutoRouterCandidateConfig[] {
  if (!cfg) return [];
  const candidates: api.AutoRouterCandidateConfig[] = [];

  for (const provider of cfg.providers || []) {
    for (const model of provider.models || []) {
      if (!model.enabled) continue;
      const modelId = `${provider.id}:${model.id}`;
      const known = findRouterModelCard(model.id, provider.id);
      const fallback = fallbackRouterCard(model.id);
      const baseCost = getEffectiveRouterCost(model.id, provider.id, known?.cost ?? fallback.cost, provider.accessMode);
      candidates.push({
        modelId,
        cost: Math.max(0.02, Number(baseCost.toFixed(2))),
        supportsImages: known?.supportsImages ?? fallback.supportsImages,
        supportsThinking: known?.supportsThinking ?? fallback.supportsThinking,
        card: routerCapabilityCard(known?.card || fallback.card, known?.supportsThinking ?? fallback.supportsThinking),
      });
    }
  }

  const seen = new Set<string>();
  return candidates
    .sort((a, b) => {
      const aKnown = findRouterModelCard(a.modelId) ? 0 : 1;
      const bKnown = findRouterModelCard(b.modelId) ? 0 : 1;
      if (aKnown !== bKnown) return aKnown - bKnown;
      return a.cost - b.cost;
    })
    .filter((candidate) => {
      const key = normalizeModelKey(candidate.modelId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mergeRouterCandidates(
  existing: api.AutoRouterCandidateConfig[],
  configured: api.AutoRouterCandidateConfig[],
) {
  const merged: api.AutoRouterCandidateConfig[] = [];
  const seen = new Set<string>();
  for (const candidate of [...existing, ...configured]) {
    const key = normalizeModelKey(candidate.modelId);
    if (seen.has(key)) continue;
    seen.add(key);
    const configuredCandidate = configured.find((item) => normalizeModelKey(item.modelId) === key);
    merged.push(configuredCandidate || enrichRouterCandidate(candidate));
  }
  return merged;
}

function routerCandidateSource(candidate: api.AutoRouterCandidateConfig, configured: api.AutoRouterCandidateConfig[]) {
  const configuredMatch = configured.some((item) => normalizeModelKey(item.modelId) === normalizeModelKey(candidate.modelId));
  if (configuredMatch) return { label: 'Configured', tone: 'ok', detail: 'Enabled provider model' };
  if (findRouterModelCard(candidate.modelId, getProviderIdFromModelId(candidate.modelId))) {
    return { label: 'Manual catalog', tone: 'catalog', detail: 'Manual entry matched to the model catalog' };
  }
  return { label: 'Manual custom', tone: 'custom', detail: 'Manual entry using custom metadata' };
}

function routerSourceBadgeStyle(tone: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 10,
    lineHeight: 1,
    padding: '3px 5px',
    borderRadius: 4,
    border: '1px solid var(--border-color, #d1d5db)',
    whiteSpace: 'nowrap',
  };
  if (tone === 'ok') return { ...base, color: 'var(--success, #22c55e)', background: 'color-mix(in srgb, var(--success, #22c55e) 10%, transparent)' };
  if (tone === 'catalog') return { ...base, color: 'var(--accent-color, #6366f1)', background: 'color-mix(in srgb, var(--accent-color, #6366f1) 10%, transparent)' };
  return { ...base, color: 'var(--text-secondary)', background: 'var(--bg-primary, #fff)' };
}

function resolveRouterSelection(
  currentModelId: string,
  candidates: api.AutoRouterCandidateConfig[],
  fallbackModelId = '',
) {
  const current = currentModelId.trim();
  if (current && candidates.some((candidate) => normalizeModelKey(candidate.modelId) === normalizeModelKey(current))) return current;
  const fallback = fallbackModelId.trim();
  if (fallback && candidates.some((candidate) => normalizeModelKey(candidate.modelId) === normalizeModelKey(fallback))) return fallback;
  return candidates[0]?.modelId || '';
}

function AutoRouterPane() {
  const [arEnabled, setArEnabled] = useState(false);
  const [arThreshold, setArThreshold] = useState(0.7);
  const [arClassifier, setArClassifier] = useState('');
  const [arDefaultModel, setArDefaultModel] = useState('');
  const [arCandidates, setArCandidates] = useState<api.AutoRouterCandidateConfig[]>([]);
  const [configuredCandidates, setConfiguredCandidates] = useState<api.AutoRouterCandidateConfig[]>([]);
  const [arSaving, setArSaving] = useState(false);
  const [newCandidate, setNewCandidate] = useState<api.AutoRouterCandidateConfig>({
    modelId: '', cost: 0.5, supportsImages: false, supportsThinking: false, card: ''
  });

  // Load router state and candidates on mount
  useEffect(() => {
    api.getRouterState().then((state) => {
      setArEnabled(state.enabled);
      setArThreshold(state.threshold);
    }).catch(() => {});
    api.getConfig().then(async (cfg) => {
      const scannedCandidates = buildConfiguredRouterCandidates(cfg);
      setConfiguredCandidates(scannedCandidates);
      if (cfg?.autoRouter) {
        setArClassifier(cfg.autoRouter.classifierModel || '');
        setArDefaultModel(cfg.autoRouter.defaultModel || '');
        setArThreshold(cfg.autoRouter.threshold ?? 0.7);
        const existing = (cfg.autoRouter.candidates || []).map((candidate) => enrichRouterCandidate(candidate));
        const mergedCandidates = existing.length > 0 ? refreshConfiguredRouterCosts(existing, scannedCandidates) : scannedCandidates;
        setArCandidates(mergedCandidates);
        if (JSON.stringify(mergedCandidates) !== JSON.stringify(existing) || existing.some((candidate) => !candidate.card?.trim())) {
          await api.configureRouter({ ...cfg.autoRouter, candidates: mergedCandidates });
        }
      } else if (scannedCandidates.length > 0) {
        setArClassifier(scannedCandidates[0].modelId);
        setArDefaultModel(scannedCandidates[0].modelId);
        setArCandidates(scannedCandidates);
      }
    }).catch(() => {});
  }, []);

  const persistRouterConfig = async (partial: Partial<api.AutoRouterConfig>) => {
    // Fetch fresh config, merge updates, write back
    const cfg = await api.getConfig();
    const current = cfg?.autoRouter || {
      enabled: true,
      classifierModel: 'minimax:MiniMax-M3',
      threshold: 0.7,
      defaultModel: 'minimax:MiniMax-M3',
      cacheTTLMs: 300000,
      candidates: [],
    };
    const merged = { ...current, ...partial };
    await api.configureRouter(merged);
    return merged;
  };

  const toggleAutoRouter = async () => {
    setArSaving(true);
    try {
      if (arEnabled) {
        // Disable: keep current config but set enabled=false
        const cfg = await api.getConfig();
        const currentAr = cfg?.autoRouter;
        await api.configureRouter({
          enabled: false,
          classifierModel: currentAr?.classifierModel || arClassifier || 'minimax:MiniMax-M3',
          threshold: currentAr?.threshold ?? arThreshold,
          defaultModel: currentAr?.defaultModel || arDefaultModel || 'minimax:MiniMax-M3',
          cacheTTLMs: currentAr?.cacheTTLMs ?? 300000,
          candidates: currentAr?.candidates || arCandidates,
        });
      } else {
        // Enable: use existing config or defaults
        const cfg = await api.getConfig();
        const currentAr = cfg?.autoRouter;
        const scannedCandidates = buildConfiguredRouterCandidates(cfg);
        const baseCandidates = currentAr?.candidates && currentAr.candidates.length > 0 ? currentAr.candidates : arCandidates;
        const candidates = baseCandidates.length > 0 ? mergeRouterCandidates(baseCandidates, []) : scannedCandidates;
        const firstCandidate = candidates[0]?.modelId || 'minimax:MiniMax-M3';
        const merged = await api.configureRouter({
          enabled: true,
          classifierModel: currentAr?.classifierModel || arClassifier || firstCandidate,
          threshold: currentAr?.threshold ?? arThreshold,
          defaultModel: currentAr?.defaultModel || arDefaultModel || firstCandidate,
          cacheTTLMs: currentAr?.cacheTTLMs ?? 300000,
          candidates,
        });
        setConfiguredCandidates(scannedCandidates);
        setArCandidates(mergeRouterCandidates(candidates, merged.state.candidates.map((c) => ({ ...c, card: '', supportsThinking: c.supportsThinking }))));
      }
      setArEnabled(!arEnabled);
    } catch (err) {
      console.error('Failed to toggle auto-router:', err);
    }
    setArSaving(false);
  };

  const addCandidate = async () => {
    if (!newCandidate.modelId.trim()) return;
    const updated = mergeRouterCandidates(arCandidates, [{ ...newCandidate, modelId: newCandidate.modelId.trim() }]);
    const nextClassifier = resolveRouterSelection(arClassifier, updated, newCandidate.modelId);
    const nextDefaultModel = resolveRouterSelection(arDefaultModel, updated, newCandidate.modelId);
    setArCandidates(updated);
    setArClassifier(nextClassifier);
    setArDefaultModel(nextDefaultModel);
    await persistRouterConfig({
      classifierModel: nextClassifier,
      defaultModel: nextDefaultModel,
      candidates: updated,
    });
    setNewCandidate({ modelId: '', cost: 0.5, supportsImages: false, supportsThinking: false, card: '' });
  };

  const updateCandidate = async (index: number, candidate: api.AutoRouterCandidateConfig) => {
    const updated = arCandidates.map((item, itemIndex) => itemIndex === index ? candidate : item);
    setArCandidates(updated);
    await persistRouterConfig({ candidates: updated });
  };

  const removeCandidate = async (index: number) => {
    const updated = arCandidates.filter((_, i) => i !== index);
    const nextClassifier = resolveRouterSelection(arClassifier, updated, arDefaultModel);
    const nextDefaultModel = resolveRouterSelection(arDefaultModel, updated, nextClassifier);
    setArCandidates(updated);
    setArClassifier(nextClassifier);
    setArDefaultModel(nextDefaultModel);
    await persistRouterConfig({
      classifierModel: nextClassifier,
      defaultModel: nextDefaultModel,
      candidates: updated,
    });
  };

  const syncConfiguredCandidates = async () => {
    setArSaving(true);
    try {
      const cfg = await api.getConfig();
      const scannedCandidates = buildConfiguredRouterCandidates(cfg);
      const updated = mergeRouterCandidates(refreshConfiguredRouterCosts(arCandidates, scannedCandidates), scannedCandidates);
      const nextClassifier = resolveRouterSelection(arClassifier, updated);
      const nextDefaultModel = resolveRouterSelection(arDefaultModel, updated, nextClassifier);
      setConfiguredCandidates(scannedCandidates);
      setArCandidates(updated);
      setArClassifier(nextClassifier);
      setArDefaultModel(nextDefaultModel);
      await persistRouterConfig({
        classifierModel: nextClassifier,
        defaultModel: nextDefaultModel,
        candidates: updated,
      });
    } finally {
      setArSaving(false);
    }
  };

  const addConfiguredCandidate = async (candidate: api.AutoRouterCandidateConfig) => {
    const updated = mergeRouterCandidates(arCandidates, [candidate]);
    const nextClassifier = resolveRouterSelection(arClassifier, updated, candidate.modelId);
    const nextDefaultModel = resolveRouterSelection(arDefaultModel, updated, candidate.modelId);
    setArCandidates(updated);
    setArClassifier(nextClassifier);
    setArDefaultModel(nextDefaultModel);
    await persistRouterConfig({
      classifierModel: nextClassifier,
      defaultModel: nextDefaultModel,
      candidates: updated,
    });
  };

  const configuredAvailable = configuredCandidates.filter((candidate) => (
    !arCandidates.some((existing) => normalizeModelKey(existing.modelId) === normalizeModelKey(candidate.modelId))
  ));
  const selectedClassifierMissing = arClassifier && !arCandidates.some((candidate) => normalizeModelKey(candidate.modelId) === normalizeModelKey(arClassifier));
  const selectedDefaultMissing = arDefaultModel && !arCandidates.some((candidate) => normalizeModelKey(candidate.modelId) === normalizeModelKey(arDefaultModel));

  return (
    <>
      <PaneTitle>Auto-Router</PaneTitle>
      <PaneDesc>Use a classifier model to pick the best candidate model per task.</PaneDesc>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div className="settings-item">
            <div>
              <div className="settings-item-label">Enable Auto-Router</div>
              <div className="settings-item-desc">Let a cheap classifier choose among active candidate models</div>
            </div>
            <div className={('toggle ' + (arEnabled ? 'active' : ''))} onClick={arSaving ? undefined : toggleAutoRouter} />
          </div>
          {arEnabled && (
            <div className="settings-card" style={{ marginTop: 8, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Auto-Router Config</div>
              <div className="settings-item" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                <div>
                  <div className="settings-item-label">Classifier Model</div>
                  <div className="settings-item-desc">Active candidate used to score task fit before cost and context gates are applied</div>
                </div>
                <select
                  value={arClassifier}
                  style={{ width: 260, height: 30, fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                  onChange={async (e) => {
                    const modelId = e.target.value;
                    setArClassifier(modelId);
                    const merged = await persistRouterConfig({ classifierModel: modelId });
                    setArClassifier(merged.classifierModel);
                  }}
                >
                  {selectedClassifierMissing && (
                    <option value={arClassifier}>{arClassifier}</option>
                  )}
                  {arCandidates.map((candidate) => (
                    <option key={candidate.modelId} value={candidate.modelId}>{candidate.modelId}</option>
                  ))}
                </select>
              </div>
              <div className="settings-item" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                <div>
                  <div className="settings-item-label">Default Model</div>
                  <div className="settings-item-desc">Fallback candidate used when classification fails or no score clears the threshold</div>
                </div>
                <select
                  value={arDefaultModel}
                  style={{ width: 260, height: 30, fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                  onChange={async (e) => {
                    const modelId = e.target.value;
                    setArDefaultModel(modelId);
                    const merged = await persistRouterConfig({ defaultModel: modelId });
                    setArDefaultModel(merged.defaultModel);
                  }}
                >
                  {selectedDefaultMissing && (
                    <option value={arDefaultModel}>{arDefaultModel}</option>
                  )}
                  {arCandidates.map((candidate) => (
                    <option key={candidate.modelId} value={candidate.modelId}>{candidate.modelId}</option>
                  ))}
                </select>
              </div>
              <div className="settings-item" style={{ marginBottom: 4 }}>
                <div>
                  <div className="settings-item-label">Threshold</div>
                  <div className="settings-item-desc">Quality bar (0–1). Higher = safer, lower = cheaper. ({arThreshold.toFixed(2)})</div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={arThreshold}
                  style={{ width: 120, accentColor: 'var(--accent-color, #6366f1)' }}
                  onChange={async (e) => {
                    const val = parseFloat(e.target.value);
                    setArThreshold(val);
                    const merged = await persistRouterConfig({ threshold: val });
                    setArThreshold(merged.threshold);
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, marginBottom: 8 }}>
                The auto-router uses a cheap classifier model to score each candidate on task fitness.
                The lowest effective-cost candidate above the threshold wins. Effective cost is a preference weight, not a quality score.
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 6,
                marginBottom: 10,
              }}>
                <div style={{ padding: 8, borderRadius: 6, background: 'var(--bg-secondary, #f3f4f6)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Catalog</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{TOP_ROUTER_MODEL_CARDS.length} cards</div>
                </div>
                <div style={{ padding: 8, borderRadius: 6, background: 'var(--bg-secondary, #f3f4f6)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Configured</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{configuredCandidates.length} models</div>
                </div>
                <div style={{ padding: 8, borderRadius: 6, background: 'var(--bg-secondary, #f3f4f6)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Routed</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{arCandidates.length} active</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  className="settings-btn"
                  style={{ padding: '5px 9px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={syncConfiguredCandidates}
                  disabled={arSaving || configuredCandidates.length === 0}
                  title="Scan configured providers and refresh subscription-aware effective costs"
                >
                  <RefreshCw size={12} /> Sync configured
                </button>
                {configuredAvailable.slice(0, 3).map((candidate) => (
                  <button
                    key={candidate.modelId}
                    className="settings-btn"
                    style={{ padding: '5px 9px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    onClick={() => addConfiguredCandidate(candidate)}
                    title={`Configured provider model. ${candidate.card}`}
                  >
                    + Configured: {candidate.modelId}
                  </button>
                ))}
              </div>

              {/* Candidate list */}
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                Candidates ({arCandidates.length})
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Effective cost includes subscription/prepaid bias. Lower numbers are preferred after the classifier decides which models are good enough.
              </div>
              {arCandidates.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 8 }}>
                  No candidates configured. Add at least one to enable routing.
                </div>
              )}
              {arCandidates.map((c, i) => {
                const source = routerCandidateSource(c, configuredCandidates);
                const isClassifier = normalizeModelKey(c.modelId) === normalizeModelKey(arClassifier);
                const isDefault = normalizeModelKey(c.modelId) === normalizeModelKey(arDefaultModel);
                return (
                <div key={c.modelId} title={source.detail} style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 6,
                  padding: '7px 8px', marginBottom: 4,
                  borderRadius: 4, fontSize: 12,
                  background: 'var(--bg-secondary, #f3f4f6)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {c.modelId}
                      </span>
                      <span style={routerSourceBadgeStyle(source.tone)}>{source.label}</span>
                      {isClassifier && <span style={routerSourceBadgeStyle('catalog')}>Classifier</span>}
                      {isDefault && <span style={routerSourceBadgeStyle('custom')}>Default</span>}
                      {c.supportsImages && <span style={{ fontSize: 10, color: 'var(--accent-color, #6366f1)' }}>Images</span>}
                      {c.supportsThinking && <span style={{ fontSize: 10, color: 'var(--accent-color, #6366f1)' }}>Thinking</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, max-content)) minmax(80px, 120px)', gap: 8, alignItems: 'center', marginTop: 6 }}>
                      <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={c.supportsImages}
                          style={{ accentColor: 'var(--accent-color, #6366f1)' }}
                          onChange={(e) => updateCandidate(i, { ...c, supportsImages: e.target.checked })}
                        />
                        Images
                      </label>
                      <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!c.supportsThinking}
                          style={{ accentColor: 'var(--accent-color, #6366f1)' }}
                          onChange={(e) => updateCandidate(i, {
                            ...c,
                            supportsThinking: e.target.checked,
                            card: routerCapabilityCard(c.card.replace(/\s*Native thinking:\s*(yes|no)\.\s*/i, ' ').trim(), e.target.checked),
                          })}
                        />
                        Thinking
                      </label>
                      <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        Cost
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="10"
                          value={c.cost}
                          title="Effective routing cost"
                          style={{ width: 58, height: 24, fontSize: 11, padding: '3px 5px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                          onChange={(e) => updateCandidate(i, { ...c, cost: parseFloat(e.target.value) || 0 })}
                        />
                      </label>
                    </div>
                    <textarea
                      aria-label={`${c.modelId} capability card`}
                      value={c.card}
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, resize: 'vertical', minHeight: 44, fontSize: 11, lineHeight: 1.35, padding: '5px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                      onChange={(e) => {
                        const next = [...arCandidates];
                        next[i] = { ...c, card: e.target.value };
                        setArCandidates(next);
                      }}
                      onBlur={(e) => updateCandidate(i, { ...c, card: e.target.value.trim() || fallbackRouterCard(c.modelId).card })}
                      placeholder="Capability card for classifier routing"
                    />
                  </div>
                  <button
                    className="settings-btn-icon"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, color: 'var(--text-danger, #ef4444)', lineHeight: 1, alignSelf: 'center' }}
                    onClick={() => removeCandidate(i)}
                    title="Remove candidate"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                );
              })}

              {/* Add candidate form */}
              <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border-color, #e5e7eb)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Add Candidate</div>
                <input
                  placeholder="Model ID (e.g. minimax:MiniMax-M3)"
                  value={newCandidate.modelId}
                  style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                  onChange={(e) => setNewCandidate(enrichRouterCandidate({ ...newCandidate, modelId: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="Effective cost"
                    value={newCandidate.cost}
                    style={{ width: 60, fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                    onChange={(e) => setNewCandidate({ ...newCandidate, cost: parseFloat(e.target.value) || 0 })}
                  />
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newCandidate.supportsImages}
                      style={{ accentColor: 'var(--accent-color, #6366f1)' }}
                      onChange={(e) => setNewCandidate({ ...newCandidate, supportsImages: e.target.checked })}
                    />
                    Images
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!newCandidate.supportsThinking}
                      style={{ accentColor: 'var(--accent-color, #6366f1)' }}
                      onChange={(e) => setNewCandidate({
                        ...newCandidate,
                        supportsThinking: e.target.checked,
                        card: routerCapabilityCard(newCandidate.card.replace(/\s*Native thinking:\s*(yes|no)\.\s*/i, ' ').trim() || fallbackRouterCard(newCandidate.modelId).card, e.target.checked),
                      })}
                    />
                    Thinking
                  </label>
                </div>
                <input
                  placeholder="Capability card (describe what this model is good/bad at)"
                  value={newCandidate.card}
                  style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                  onChange={(e) => setNewCandidate({ ...newCandidate, card: e.target.value })}
                />
                <button
                  className="settings-btn"
                  style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 4,
                    border: 'none', cursor: 'pointer',
                    background: 'var(--accent-color, #6366f1)', color: '#fff',
                    alignSelf: 'flex-start',
                  }}
                  onClick={addCandidate}
                  disabled={!newCandidate.modelId.trim()}
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
          )}
      </div>
    </>
  );
}

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
        <ContextBudgetControls />

function AboutPane({ configPath }: { configPath?: string }) {
  const displayConfigPath = configPath || '(not reported by server)';

  return (
    <>
      <PaneTitle>About OpenHarness</PaneTitle>
      <PaneDesc>A local-first AI workbench for routing, evaluating, and coordinating coding agents.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>OpenHarness</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>Version 1.0.0</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          An Electron + React + Express workbench for local-first agent workflows with MCP tool integration, model routing, and multi-panel operations.
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Active config file</div>
          <div style={{ padding: '6px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: 6, wordBreak: 'break-all' }}>
            {displayConfigPath}
          </div>
          <button
            className="settings-mini-button"
            onClick={() => {
              if (!configPath) return;
              navigator.clipboard?.writeText(configPath).catch(() => {});
            }}
            style={{ marginTop: 6 }}
            title="Copy active config path"
            disabled={!configPath}
          >
            Copy config path
          </button>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <div>• 8 built-in themes (4 dark + 4 light)</div>
          <div>• OpenAI-compatible provider support</div>
          <div>• Docker MCP integration with 34+ tools</div>
          <div>• 7 agent roles with model recommendations</div>
        </div>
      </div>
    </>
  );
}

// ── Item 4: provider health badge (M17) ──

function ProviderHealthBadge({
  summary, lastTest: _lastTest, onProbe, probing,
}: {
  summary?: api.ProviderHealthSummary;
  lastTest?: { ok: boolean; latencyMs?: number; error?: string };
  onProbe: () => void;
  probing: boolean;
}) {
  if (!summary) {
    return (
      <button className="settings-mini-button" onClick={onProbe} disabled={probing} title="Probe this provider for live health and capabilities">
        {probing ? <Loader size={11} className="spin" /> : <Wifi size={11} />}
        Probe health
      </button>
    );
  }
  const status = summary.failed ? 'fail' : summary.stale ? 'stale' : 'ok';
  const label = summary.failed
    ? `last probe failed${summary.latest?.error ? `: ${summary.latest.error.slice(0, 40)}` : ''}`
    : summary.stale
      ? 'health stale'
      : `health OK (${summary.latest?.latencyMs ?? 0}ms, ${summary.latest?.capabilities.filter((c) => c.ok).length ?? 0}/${summary.latest?.capabilities.length ?? 0} caps)`;
  return (
    <button
      className={`settings-mini-button prov-health-badge prov-health-${status}`}
      onClick={onProbe}
      disabled={probing}
      title={`Total probes: ${summary.total}. Click to re-probe.`}
    >
      {probing ? <Loader size={11} className="spin" /> : <Wifi size={11} />}
      {label}
    </button>
  );
}
