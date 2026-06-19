import { Component, useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { RoutingLearningPane } from './RoutingLearningPane';
import { AssistantCapabilityPane, AssistantMemoryPane, ClickySettingsPane } from './settings/AssistantSettingsPanes';
import { AboutPane, ChatSettingsPane, CrashReportsPane, ReleaseNotesPane } from './settings/InfoSettingsPanes';
import { AddMCPServerPane, CuratedMCPPane, CustomMCPServersPane, DockerMCPPane } from './settings/McpSettingsPanes';
import { OnboardingPane } from './settings/OnboardingSettingsPanes';
import { PersonalizationPane, PersonalityPane, ThemePane } from './settings/PreferenceSettingsPanes';
import {
  X, KeyRound, Brain, FileCode,
  PlayCircle, ShieldCheck, Server, MessageCircle, Palette as ThemeIcon,
  Settings, SlidersHorizontal, Plus, Trash2, RefreshCw, Loader, Wifi,
  Check, ChevronDown, ChevronRight, CheckCircle2, Bot,
  ArrowRight, BookOpen, Search, Sparkles, FileText,
  Layers, Eye, Wrench, DollarSign, AlertCircle,
} from 'lucide-react';
import type { ProviderConfig, CodingRoleAssignment, MCPServerItem } from '../types';
import type { ThinkingEffort } from '../types';
import type { ThemeTextureRecipe } from '../theme/themeTokens';
import * as api from '../utils/api';
import { modelAbilityStates, modelSupportsThinking, THINKING_EFFORTS } from '../utils/modelCapabilities';
import { mockMemoryEntries } from '../utils/mockData';
import {
  findModelCatalogCard,
  formatContextWindow,
  formatModelCost,
  MODEL_CATALOG_MAINTENANCE_NOTE,
  MODEL_CATALOG_SOURCES,
  MODEL_CATALOG_UPDATED_AT,
  MODEL_CATEGORY_META,
  modelCatalogFreshness,
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

// ── Category definition ────────────────────────────────
interface SettingsCategory {
  id: string;
  label: string;
  icon: typeof Settings;
  subcategories?: { id: string; label: string }[];
}

class SettingsPaneErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[settings-pane] Pane failed to render', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          This settings pane did not load.
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          The rest of Settings is still available. Refresh the app or open another settings section while this pane is repaired.
        </div>
      </div>
    );
  }
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
    { id: 'personalization', label: 'Personalization' },
    { id: 'clicky', label: 'Clicky' },
    { id: 'skills', label: 'Skills' },
    { id: 'plugins', label: 'Plugins' },
    { id: 'memory', label: 'Memory' },
  ]},
  { id: 'mcp', label: 'MCP Servers', icon: Server, subcategories: [
    { id: 'docker', label: 'Docker MCP' },
    { id: 'curated', label: 'Curated Tools' },
    { id: 'custom', label: 'Custom Servers' },
    { id: 'add-mcp', label: 'Add Server' },
  ]},
  { id: 'personality', label: 'Personality', icon: MessageCircle },
  { id: 'onboarding', label: 'Setup Wizard', icon: ArrowRight },
  { id: 'theme', label: 'Theme', icon: ThemeIcon },
  { id: 'routing', label: 'Routing Learning', icon: Brain },
  { id: 'auto-router', label: 'Auto-Router', icon: SlidersHorizontal },
  { id: 'release-notes', label: 'Release Notes', icon: FileText },
  { id: 'crash-reports', label: 'Crash Reports', icon: AlertCircle },
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
  initialCategory?: string;
  configPath?: string;
  activeModel: string;
  thinkingEffort: ThinkingEffort;
  providers: ProviderConfig[];
  roleAssignments: CodingRoleAssignment[];
  roleThinking: Record<string, ThinkingEffort>;
  activeTheme: string;
  textureOpacityOverride: number | null;
  textureRecipeOverride: ThemeTextureRecipe | null;
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
  onTextureOpacityOverrideChange: (value: number | null) => void;
  onTextureRecipeOverrideChange: (value: ThemeTextureRecipe | null) => void;
  onThemePluginManifestsChange: (themeManifests: string[]) => void;
  onRemoveTheme: (themeId: string) => void;
  onPersonalityChange: (text: string) => void;
  onRestartOnboarding: () => void;
  onMcpStatusRefresh: () => Promise<void>;
  clickyEnabled: boolean;
  onClickyEnabledChange: (enabled: boolean) => void;
  workingDir?: string | null;
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

// ── Main component ─────────────────────────────────────
export function SettingsModal({
  isOpen, onClose, activeModel, thinkingEffort, providers, roleAssignments, roleThinking, activeTheme,
  textureOpacityOverride,
  textureRecipeOverride,
  configPath, personalityText, mcpServers, mcpStatus, onAddProvider, onTestProvider,
  onUpdateProvider,
  onFetchModels, onRemoveProvider, onAddMCPServer, onRemoveMCPServer,
  onSelectModel, onThinkingEffortChange, onToggleProviderModel, onAssignRoleModel, onAssignRoleThinking, onSelectTheme,
  onTextureOpacityOverrideChange,
  onTextureRecipeOverrideChange,
  onThemePluginManifestsChange, onRemoveTheme,
  onPersonalityChange,
  onRestartOnboarding,
  onMcpStatusRefresh,
  clickyEnabled,
  onClickyEnabledChange,
  initialCategory,
  workingDir,
}: Props) {
  const [selectedCat, setSelectedCat] = useState(initialCategory || 'model');
  const [selectedSub, setSelectedSub] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = modalRef.current;
    if (el) {
      const first = el.querySelector<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      first?.focus();
    }
    return () => {
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [isOpen]);

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return;
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );
    if (focusable.length < 2) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !initialCategory) return;
    const category = CATEGORIES.find((item) => item.id === initialCategory);
    if (!category) return;
    setSelectedCat(category.id);
    setSelectedSub(category.subcategories?.[0]?.id || null);
  }, [initialCategory, isOpen]);

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
      <div
        className="settings-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        onKeyDown={handleModalKeyDown}
      >
        <div className="settings-modal-header">
          <h2 className="settings-modal-title" id="settings-dialog-title">Settings</h2>
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
            <SettingsPaneErrorBoundary key={contentKey}>
              {contentKey === 'model' && <ActiveModelPane activeModel={activeModel} thinkingEffort={thinkingEffort} enabledModels={enabledModels} providers={providers} onSelectModel={onSelectModel} onThinkingEffortChange={onThinkingEffortChange} />}
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
              {contentKey === 'assistant/personalization' && <PersonalizationPane />}
              {contentKey === 'assistant/clicky' && <ClickySettingsPane enabled={clickyEnabled} onChange={onClickyEnabledChange} />}
              {contentKey === 'assistant/skills' && <AssistantCapabilityPane kind="skills" workingDir={workingDir} />}
              {contentKey === 'assistant/plugins' && <AssistantCapabilityPane kind="plugins" workingDir={workingDir} />}
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
                  textureOpacityOverride={textureOpacityOverride}
                  textureRecipeOverride={textureRecipeOverride}
                  onSelectTheme={onSelectTheme}
                  onTextureOpacityOverrideChange={onTextureOpacityOverrideChange}
                  onTextureRecipeOverrideChange={onTextureRecipeOverrideChange}
                  onThemePluginManifestsChange={onThemePluginManifestsChange}
                  onRemoveTheme={onRemoveTheme}
                />
              )}
              {contentKey === 'routing' && <RoutingLearningPane enabledModels={enabledModels} onApplyRoleRecommendation={onAssignRoleModel} />}
              {contentKey === 'auto-router' && <AutoRouterPane />}
              {contentKey === 'release-notes' && <ReleaseNotesPane />}
              {contentKey === 'crash-reports' && <CrashReportsPane />}
              {contentKey === 'chat' && <ChatSettingsPane />}
              {contentKey === 'about' && <AboutPane configPath={configPath} />}
            </SettingsPaneErrorBoundary>
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
          aria-label={`${title}: ${active ? 'available' : 'unavailable'}`}
        >
          <Icon size={13} aria-hidden="true" />
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

function scoreModelForRole(model: any, roleId: string): number {
  const card = findModelCatalogCard(model.id, model.providerId);
  const cost = COST_SCORE[card?.relativeCost || 'mid'] ?? 3;
  const context = card?.contextWindowTokens || model.contextWindowTokens || 0;
  const category = card ? modelBestCategory(card) : undefined;
  const text = [
    card?.compactDescription,
    card?.reviewSummary,
    ...(card?.strengths || []),
    ...(card?.bestFor || []),
    ...(card?.avoidFor || []).map((item) => `avoid:${item}`),
  ].join(' ').toLowerCase();
  const supportsThinking = card?.supportsThinking || modelSupportsThinking(model.id, model.providerId);
  const supportsTools = card?.supportsTools ? 12 : 0;
  const longContext = context >= 200_000 ? 6 : 0;
  const hugeContext = context >= 1_000_000 ? 8 : 0;
  const recommendation = isModelRecommended(roleId, model.id) ? 20 : 0;
  const avoidRole = text.includes(`avoid:${roleId}`) || (
    roleId === 'planner' && /avoid:[^,]*(planning|strategy)/.test(text)
  );
  const avoidPenalty = avoidRole ? -30 : 0;

  const roleFit: Record<string, number> = {
    planner:
      (category === 'reasoning' || category === 'long-context' ? 28 : 0) +
      (/(planning|strategy|architecture|decomposition|analysis|tradeoff)/.test(text) ? 28 : 0) +
      (supportsThinking ? 14 : 0) + longContext + hugeContext - cost,
    coder:
      (category === 'coding' ? 36 : 0) +
      (/(coding|code|implementation|bug fix|refactor|agentic|tool)/.test(text) ? 30 : 0) +
      supportsTools + (supportsThinking ? 4 : 0) - cost * 2,
    reviewer:
      (category === 'review' || category === 'reasoning' ? 32 : 0) +
      (/(review|audit|security|correctness|debugging|quality)/.test(text) ? 32 : 0) +
      (supportsThinking ? 12 : 0) + longContext - cost,
    reasoner:
      (category === 'reasoning' || category === 'long-context' ? 34 : 0) +
      (/(reasoning|analysis|math|debugging|tradeoff|architecture)/.test(text) ? 30 : 0) +
      (supportsThinking ? 18 : 0) + longContext + hugeContext - cost * 0.5,
    summarizer:
      (category === 'worker' || category === 'rag' || category === 'long-context' ? 26 : 0) +
      (/(summary|summaries|summarization|classification|long context|documents|rag)/.test(text) ? 28 : 0) +
      longContext + hugeContext - cost * 10 + (supportsThinking ? -6 : 4),
    worker:
      (category === 'worker' || category === 'coding' ? 24 : 0) +
      (/(worker|fast|low-cost|tool|classification|routine|small edits)/.test(text) ? 28 : 0) +
      supportsTools - cost * 12 + (supportsThinking ? -8 : 6),
  };

  return (roleFit[roleId] ?? scoreModelForEffort(model, ROLE_DEFAULT_EFFORT[roleId] || 'medium')) + recommendation + avoidPenalty;
}

function bestModelForRole(enabledModels: any[], roleId: string): any | null {
  return ([...enabledModels]
    .sort((a, b) => scoreModelForRole(b, roleId) - scoreModelForRole(a, roleId))[0]) || null;
}

/* ================================================================== */
/*  ACTIVE MODEL                                                       */
/* ================================================================== */

function ActiveModelPane({ activeModel, thinkingEffort, enabledModels, providers, onSelectModel, onThinkingEffortChange }: any) {
  const current = enabledModels.find((m: any) => m.id === activeModel);
  const effectiveCurrent = current || (activeModel === 'Auto'
    ? { id: 'Auto', name: 'Auto', providerName: 'Router' }
    : null);
  const activeCard = current ? findModelCatalogCard(current.id, current.providerId) : null;
  const premiumCostWarning = activeCard && ['premium', 'luxury'].includes(activeCard.relativeCost)
    ? activeCard.relativeCost
    : null;
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
        {premiumCostWarning && (
          <div className={`settings-budget-warning ${premiumCostWarning}`} role="status" aria-label={`${premiumCostWarning === 'luxury' ? 'Luxury-cost' : 'Premium-cost'} model warning for ${activeCard?.displayName || activeModel}`}>
            <div className="settings-budget-warning-title">
              <DollarSign size={12} aria-hidden="true" />
              {premiumCostWarning === 'luxury' ? 'Luxury-cost model selected' : 'Premium-cost model selected'}
            </div>
            <div>
              {activeCard?.displayName || activeModel} is best reserved for high-stakes planning, review, or difficult implementation.
              Use Auto or a lower-cost worker model for routine chat, long background runs, or bulk tool loops.
            </div>
          </div>
        )}
      </div>
      <ModelBudgetEditor activeModel={activeModel} enabledModels={enabledModels} />
      <ProviderRateLimitEditor providers={providers} />
    </>
  );
}

function ModelBudgetEditor({ activeModel, enabledModels }: { activeModel: string; enabledModels: any[] }) {
  return <ModelBudgetControls activeModel={activeModel} enabledModels={enabledModels} />;
}

function emptyModelBudget(modelId: string): api.ModelBudget {
  return {
    modelId,
    maxInputTokens: 0,
    maxOutputTokens: 0,
    maxCost: 0,
    period: 'monthly',
    onExceeded: 'warn',
  };
}

function describeModelBudget(budget: api.ModelBudget) {
  const limits = [
    budget.maxInputTokens > 0 ? `${budget.maxInputTokens.toLocaleString()} input` : null,
    budget.maxOutputTokens > 0 ? `${budget.maxOutputTokens.toLocaleString()} output` : null,
    budget.maxCost > 0 ? `$${budget.maxCost.toFixed(2)}` : null,
  ].filter(Boolean);
  return limits.length > 0 ? limits.join(' / ') : 'No active limit yet';
}

function ModelBudgetControls({ activeModel, enabledModels }: { activeModel: string; enabledModels: any[] }) {
  const [budgets, setBudgets] = useState<api.ModelBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const configuredModelIds = new Set(enabledModels.map((model) => model.id));
  const defaultNewModelId = activeModel && activeModel !== 'Auto' ? activeModel : '*';

  useEffect(() => {
    let cancelled = false;
    api.getConfig()
      .then((cfg) => {
        if (!cancelled) setBudgets(cfg?.modelBudgets || []);
      })
      .catch((err) => {
        if (!cancelled) setMessage(err?.message || 'Could not load model budgets.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const persist = async (nextBudgets: api.ModelBudget[]) => {
    setSaving(true);
    setMessage('');
    try {
      await api.updateConfig({ modelBudgets: nextBudgets });
      setBudgets(nextBudgets);
      setMessage('Budget rules saved.');
    } catch (err: any) {
      setMessage(err?.message || 'Could not save budget rules.');
    } finally {
      setSaving(false);
    }
  };

  const updateBudget = (index: number, patch: Partial<api.ModelBudget>) => {
    setBudgets((prev) => prev.map((budget, i) => i === index ? { ...budget, ...patch } : budget));
  };

  const saveBudgets = () => persist(budgets.filter((budget) => budget.modelId.trim()));
  const addBudget = () => {
    const modelId = budgets.some((budget) => budget.modelId === defaultNewModelId)
      ? '*'
      : defaultNewModelId;
    setBudgets((prev) => [...prev, emptyModelBudget(modelId)]);
  };
  const removeBudget = (index: number) => setBudgets((prev) => prev.filter((_, i) => i !== index));

  return (
    <div className="settings-card" style={{ marginTop: 16 }}>
      <div className="settings-section-header">
        <div>
          <div className="settings-section-title">Model Budgets</div>
          <div className="settings-item-desc">
            Preflight limits run before provider requests. Use <code>*</code> for a global default, then add model-specific overrides for expensive models.
          </div>
        </div>
        <button className="settings-mini-button" type="button" onClick={addBudget} disabled={loading || saving} aria-label={`Add model budget rule for ${defaultNewModelId === '*' ? 'global default' : defaultNewModelId}`}>
          <Plus size={11} aria-hidden="true" /> Add budget
        </button>
      </div>
      {loading ? (
        <div className="settings-item-desc" role="status">Loading budget rules...</div>
      ) : budgets.length === 0 ? (
        <div className="settings-budget-warning" role="status" aria-label="No model budget rules configured">
          <div className="settings-budget-warning-title"><DollarSign size={12} aria-hidden="true" /> No budget rules configured</div>
          <div>Add a warning or blocking limit before running large Model Lab matrices or premium-model sweeps.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }} role="list" aria-label={`${budgets.length} model budget rule${budgets.length === 1 ? '' : 's'}`}>
          {budgets.map((budget, index) => {
            const knownModel = budget.modelId === '*' || configuredModelIds.has(budget.modelId);
            return (
              <div key={`${budget.modelId}-${index}`} role="listitem" aria-label={`Model budget rule ${index + 1}: ${budget.onExceeded} when ${budget.modelId || 'missing model'} exceeds ${describeModelBudget(budget)} per ${budget.period}`} style={{ padding: 10, border: '1px solid var(--border-primary)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                <div role="group" aria-label={`Model budget rule ${index + 1} identity and action`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    className="settings-input"
                    value={budget.modelId}
                    onChange={(event) => updateBudget(index, { modelId: event.target.value })}
                    placeholder="model id or *"
                    style={{ minWidth: 160, flex: 1 }}
                    list="settings-budget-models"
                    aria-label={`Model id for budget rule ${index + 1}`}
                  />
                  <select className="settings-select" value={budget.period} onChange={(event) => updateBudget(index, { period: event.target.value as api.ModelBudget['period'] })} aria-label={`Reset period for model budget rule ${index + 1}`}>
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                  </select>
                  <select className="settings-select" value={budget.onExceeded} onChange={(event) => updateBudget(index, { onExceeded: event.target.value as api.ModelBudget['onExceeded'] })} aria-label={`Exceeded action for model budget rule ${index + 1}`}>
                    <option value="warn">warn</option>
                    <option value="block">block</option>
                    <option value="allow">allow</option>
                  </select>
                  <button className="settings-mini-button" type="button" onClick={() => removeBudget(index)} disabled={saving} title="Remove budget" aria-label={`Remove model budget rule ${index + 1} for ${budget.modelId || 'missing model'}`}>
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                </div>
                <div role="group" aria-label={`Model budget thresholds for rule ${index + 1}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  <label className="settings-item-desc">
                    Input tokens
                    <input className="settings-input" type="number" min={0} value={budget.maxInputTokens} onChange={(event) => updateBudget(index, { maxInputTokens: Number(event.target.value) || 0 })} aria-label={`Input token limit for model budget rule ${index + 1}`} />
                  </label>
                  <label className="settings-item-desc">
                    Output tokens
                    <input className="settings-input" type="number" min={0} value={budget.maxOutputTokens} onChange={(event) => updateBudget(index, { maxOutputTokens: Number(event.target.value) || 0 })} aria-label={`Output token limit for model budget rule ${index + 1}`} />
                  </label>
                  <label className="settings-item-desc">
                    Cost USD
                    <input className="settings-input" type="number" min={0} step="0.01" value={budget.maxCost} onChange={(event) => updateBudget(index, { maxCost: Number(event.target.value) || 0 })} aria-label={`Cost limit in US dollars for model budget rule ${index + 1}`} />
                  </label>
                </div>
                <div role={knownModel ? undefined : 'alert'} style={{ marginTop: 8, fontSize: 11, color: knownModel ? 'var(--text-tertiary)' : 'var(--accent-warning)' }}>
                  {budget.onExceeded.toUpperCase()} when {budget.modelId || '(missing model)'} exceeds {describeModelBudget(budget)} per {budget.period}.
                  {!knownModel && ' This model is not currently enabled; the rule will still apply if that id is used.'}
                </div>
              </div>
            );
          })}
          <datalist id="settings-budget-models">
            <option value="*" />
            {enabledModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
          </datalist>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <div className="settings-item-desc" role="status">{message || '0 means unlimited for that limit.'}</div>
        <button className="settings-mini-button" type="button" onClick={saveBudgets} disabled={loading || saving} aria-label={`Save ${budgets.length} model budget rule${budgets.length === 1 ? '' : 's'}`}>
          {saving ? <Loader size={11} className="spin" aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
          Save budgets
        </button>
      </div>
    </div>
  );
}

function ProviderRateLimitEditor({ providers }: { providers: ProviderConfig[] }) {
  return <ProviderRateLimitControls providers={providers} />;
}

function emptyProviderRateLimit(providerId: string): api.ProviderRateLimit {
  return {
    providerId,
    maxRequestsPerMinute: 0,
    maxTokensPerMinute: 0,
    onExceeded: 'warn',
  };
}

function ProviderRateLimitStatus({ status, onRefresh, saving }: {
  status: api.ProviderRateLimitStatus;
  onRefresh: () => void;
  saving: boolean;
}) {
  if (!status) return null;
  return (
    <div role="region" aria-label={`Provider rate-limit rolling status for current ${status.windowSeconds} second window`} style={{ marginTop: 12, padding: 10, border: '1px solid var(--border-primary)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div className="settings-item-label">Rolling status</div>
          <div className="settings-item-desc">Current {status.windowSeconds}s window plus recent warnings/blocks.</div>
        </div>
        <button className="settings-mini-button" type="button" onClick={onRefresh} disabled={saving} aria-label="Refresh provider rate-limit rolling status">
          <RefreshCw size={11} aria-hidden="true" /> Refresh
        </button>
      </div>
      {status.providers.length === 0 ? (
        <div className="settings-item-desc" role="status">No provider calls have been tracked in the current server process.</div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }} role="list" aria-label="Tracked provider usage in the current rolling window">
          {status.providers.slice(0, 6).map((providerStatus) => (
            <div key={providerStatus.providerId} role="listitem" aria-label={`${providerStatus.providerId}: ${providerStatus.requestsUsed}${providerStatus.maxRequestsPerMinute ? ` of ${providerStatus.maxRequestsPerMinute}` : ''} requests, ${providerStatus.tokensUsed.toLocaleString()}${providerStatus.maxTokensPerMinute ? ` of ${providerStatus.maxTokensPerMinute.toLocaleString()}` : ''} tokens, resets in ${providerStatus.resetSeconds} seconds`} style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{providerStatus.providerId}</span>
              <span>
                {providerStatus.requestsUsed}{providerStatus.maxRequestsPerMinute ? `/${providerStatus.maxRequestsPerMinute}` : ''} req
                {' · '}
                {providerStatus.tokensUsed.toLocaleString()}{providerStatus.maxTokensPerMinute ? `/${providerStatus.maxTokensPerMinute.toLocaleString()}` : ''} tokens
                {' · '}
                reset {providerStatus.resetSeconds}s
              </span>
            </div>
          ))}
        </div>
      )}
      {status.recentEvents.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="settings-item-label">Recent rate-limit events</div>
          <div role="list" aria-label="Recent provider rate-limit warning and block events">
            {status.recentEvents.slice(0, 4).map((event, index) => (
              <div key={`${event.providerId}-${event.timestamp}-${index}`} role="listitem" style={{ marginTop: 4, fontSize: 11, color: event.action === 'block' ? 'var(--accent-error)' : 'var(--accent-warning)' }}>
                {event.action.toUpperCase()} · {event.providerId} · {new Date(event.timestamp).toLocaleTimeString()} · {event.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function describeProviderRateLimit(limit: api.ProviderRateLimit) {
  const limits = [
    limit.maxRequestsPerMinute > 0 ? `${limit.maxRequestsPerMinute} req/min` : null,
    limit.maxTokensPerMinute > 0 ? `${limit.maxTokensPerMinute.toLocaleString()} tokens/min` : null,
  ].filter(Boolean);
  return limits.length > 0 ? limits.join(' / ') : 'No active limit yet';
}

function ProviderRateLimitControls({ providers }: { providers: ProviderConfig[] }) {
  const [limits, setLimits] = useState<api.ProviderRateLimit[]>([]);
  const [status, setStatus] = useState<api.ProviderRateLimitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const configuredProviderIds = new Set(providers.filter((provider) => provider.configured).map((provider) => provider.id));
  const defaultProviderId = providers.find((provider) => provider.configured)?.id || '*';

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getConfig(),
      api.getProviderRateLimitStatus().catch(() => null),
    ])
      .then(([cfg, nextStatus]) => {
        if (!cancelled) {
          setLimits(cfg?.providerRateLimits || []);
          setStatus(nextStatus);
        }
      })
      .catch((err) => {
        if (!cancelled) setMessage(err?.message || 'Could not load provider rate limits.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const refreshStatus = async () => {
    try {
      setStatus(await api.getProviderRateLimitStatus());
      setMessage('Rate-limit status refreshed.');
    } catch (err: any) {
      setMessage(err?.message || 'Could not refresh rate-limit status.');
    }
  };

  const persist = async (nextLimits: api.ProviderRateLimit[]) => {
    setSaving(true);
    setMessage('');
    try {
      await api.updateConfig({ providerRateLimits: nextLimits });
      setLimits(nextLimits);
      setStatus(await api.getProviderRateLimitStatus().catch(() => status));
      setMessage('Provider rate limits saved.');
    } catch (err: any) {
      setMessage(err?.message || 'Could not save provider rate limits.');
    } finally {
      setSaving(false);
    }
  };

  const updateLimit = (index: number, patch: Partial<api.ProviderRateLimit>) => {
    setLimits((prev) => prev.map((limit, i) => i === index ? { ...limit, ...patch } : limit));
  };

  const addLimit = () => {
    const providerId = limits.some((limit) => limit.providerId === defaultProviderId) ? '*' : defaultProviderId;
    setLimits((prev) => [...prev, emptyProviderRateLimit(providerId)]);
  };
  const removeLimit = (index: number) => setLimits((prev) => prev.filter((_, i) => i !== index));
  const saveLimits = () => persist(limits.filter((limit) => limit.providerId.trim()));

  return (
    <div className="settings-card" style={{ marginTop: 16 }}>
      <div className="settings-section-header">
        <div>
          <div className="settings-section-title">Provider Rate Limits</div>
          <div className="settings-item-desc">
            Rolling one-minute preflight limits for provider calls. Use <code>*</code> as a global fallback, then add provider-specific overrides where needed.
          </div>
        </div>
        <button className="settings-mini-button" type="button" onClick={addLimit} disabled={loading || saving} aria-label={`Add provider rate-limit rule for ${defaultProviderId === '*' ? 'global default' : defaultProviderId}`}>
          <Plus size={11} aria-hidden="true" /> Add limit
        </button>
      </div>
      {loading ? (
        <div className="settings-item-desc" role="status">Loading provider limits...</div>
      ) : limits.length === 0 ? (
        <div className="settings-budget-warning" role="status" aria-label="No provider rate limits configured">
          <div className="settings-budget-warning-title"><Wifi size={12} aria-hidden="true" /> No provider rate limits configured</div>
          <div>Add a warning or blocking threshold before running broad Model Lab sweeps against metered providers.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }} role="list" aria-label={`${limits.length} provider rate-limit rule${limits.length === 1 ? '' : 's'}`}>
          {limits.map((limit, index) => {
            const knownProvider = limit.providerId === '*' || configuredProviderIds.has(limit.providerId);
            return (
              <div key={`${limit.providerId}-${index}`} role="listitem" aria-label={`Provider rate-limit rule ${index + 1}: ${limit.onExceeded} when ${limit.providerId || 'missing provider'} exceeds ${describeProviderRateLimit(limit)}`} style={{ padding: 10, border: '1px solid var(--border-primary)', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                <div role="group" aria-label={`Provider rate-limit rule ${index + 1} identity and action`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    className="settings-input"
                    value={limit.providerId}
                    onChange={(event) => updateLimit(index, { providerId: event.target.value })}
                    placeholder="provider id or *"
                    style={{ minWidth: 160, flex: 1 }}
                    list="settings-rate-provider-ids"
                    aria-label={`Provider id for rate-limit rule ${index + 1}`}
                  />
                  <select className="settings-select" value={limit.onExceeded} onChange={(event) => updateLimit(index, { onExceeded: event.target.value as api.ProviderRateLimit['onExceeded'] })} aria-label={`Exceeded action for provider rate-limit rule ${index + 1}`}>
                    <option value="warn">warn</option>
                    <option value="block">block</option>
                    <option value="allow">allow</option>
                  </select>
                  <button className="settings-mini-button" type="button" onClick={() => removeLimit(index)} disabled={saving} title="Remove provider rate limit" aria-label={`Remove provider rate-limit rule ${index + 1} for ${limit.providerId || 'missing provider'}`}>
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                </div>
                <div role="group" aria-label={`Provider rate-limit thresholds for rule ${index + 1}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  <label className="settings-item-desc">
                    Requests per minute
                    <input className="settings-input" type="number" min={0} value={limit.maxRequestsPerMinute} onChange={(event) => updateLimit(index, { maxRequestsPerMinute: Number(event.target.value) || 0 })} aria-label={`Requests per minute for provider rate-limit rule ${index + 1}`} />
                  </label>
                  <label className="settings-item-desc">
                    Tokens per minute
                    <input className="settings-input" type="number" min={0} value={limit.maxTokensPerMinute} onChange={(event) => updateLimit(index, { maxTokensPerMinute: Number(event.target.value) || 0 })} aria-label={`Tokens per minute for provider rate-limit rule ${index + 1}`} />
                  </label>
                </div>
                <div role={knownProvider ? undefined : 'alert'} style={{ marginTop: 8, fontSize: 11, color: knownProvider ? 'var(--text-tertiary)' : 'var(--accent-warning)' }}>
                  {limit.onExceeded.toUpperCase()} when {limit.providerId || '(missing provider)'} exceeds {describeProviderRateLimit(limit)}.
                  {!knownProvider && ' This provider is not currently configured; the rule will still apply if that id is used.'}
                </div>
              </div>
            );
          })}
          <datalist id="settings-rate-provider-ids">
            <option value="*" />
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </datalist>
        </div>
      )}
      {status && <ProviderRateLimitStatus status={status} onRefresh={refreshStatus} saving={saving} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <div className="settings-item-desc" role="status">{message || '0 means unlimited for that limit. Limits reset every rolling minute.'}</div>
        <button className="settings-mini-button" type="button" onClick={saveLimits} disabled={loading || saving} aria-label={`Save ${limits.length} provider rate-limit rule${limits.length === 1 ? '' : 's'}`}>
          {saving ? <Loader size={11} className="spin" aria-hidden="true" /> : <Check size={11} aria-hidden="true" />}
          Save limits
        </button>
      </div>
    </div>
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

function modelHarnessFit(card: (typeof TOP_MODEL_CATALOG)[number]) {
  let score = 36;
  const reasons: string[] = [];
  if (card.supportsTools) { score += 16; reasons.push('tool-capable'); }
  if (card.supportsThinking) { score += 12; reasons.push('thinking'); }
  if (card.supportsImages) { score += 8; reasons.push('vision'); }
  if (card.contextWindowTokens >= 1_000_000) { score += 12; reasons.push('1M context'); }
  else if (card.contextWindowTokens >= 200_000) { score += 8; reasons.push('long context'); }
  if (card.routerCost <= 0.35) { score += 12; reasons.push('cheap router'); }
  else if (card.routerCost <= 0.8) { score += 8; reasons.push('balanced cost'); }
  else if (card.routerCost <= 1.15) { score += 4; reasons.push('premium fit'); }
  if (card.bestFor.length >= 3) score += 5;
  if (card.weaknesses.length >= 3) score -= 6;
  if (card.relativeCost === 'luxury') { score -= 8; reasons.push('watch spend'); }
  const bounded = Math.max(20, Math.min(96, score));
  return {
    score: bounded,
    label: bounded >= 82 ? 'Strong harness fit' : bounded >= 68 ? 'Good fit' : bounded >= 54 ? 'Specialist fit' : 'Use carefully',
    reasons: reasons.slice(0, 4),
  };
}

function modelSignal(card: (typeof TOP_MODEL_CATALOG)[number], patterns: RegExp[], fallback: string) {
  const text = [
    card.displayName,
    card.family,
    card.provider,
    card.compactDescription,
    card.reviewSummary,
    ...card.bestFor,
    ...card.strengths,
    ...card.weaknesses,
    ...card.benchmarkHighlights,
  ].join(' ').toLowerCase();
  return patterns.some((pattern) => pattern.test(text)) ? 'Strong' : fallback;
}

function modelScorecardSignals(card: (typeof TOP_MODEL_CATALOG)[number]) {
  const speed = card.routerCost <= 0.45 || modelSignal(card, [/\bspeed\b/, /\bfast\b/, /\blatency\b/, /\bworker\b/, /\bflash\b/], '') === 'Strong'
    ? 'Fast'
    : card.relativeCost === 'luxury' || card.contextWindowTokens >= 1_000_000
      ? 'Slower'
      : 'Mixed';
  const privacy = /local|open-weight|open deployment|open-source|oss|qwen|deepseek|mistral|llama|gemma|phi|kimi|minimax/i.test([
    card.provider,
    card.family,
    card.displayName,
    ...card.strengths,
  ].join(' '))
    ? 'Open/local path'
    : 'Hosted';
  return {
    coding: modelSignal(card, [/\bcod(e|ing)\b/, /\bswe\b/, /\bimplementation\b/, /\bbug\b/, /\brepo\b/, /\brefactor\b/], 'Mixed'),
    reasoning: card.supportsThinking ? 'Strong' : modelSignal(card, [/\breason/i, /\bplanning\b/, /\banalysis\b/, /\bmath\b/, /\bdebug/i], 'Mixed'),
    review: modelSignal(card, [/\breview\b/, /\bdebug/i, /\bquality\b/, /\barchitecture\b/], 'Mixed'),
    planning: modelSignal(card, [/\bplanning\b/, /\barchitecture\b/, /\borchestration\b/, /\bdecomposition\b/, /\bagent\b/], 'Mixed'),
    speed,
    privacy,
    localAvailability: privacy === 'Open/local path' ? 'Likely' : 'Provider',
  };
}

function ModelLibraryPane({ providers }: { providers: ProviderConfig[] }) {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | keyof typeof MODEL_CATEGORY_META>('all');
  const [accessOnly, setAccessOnly] = useState(false);
  const [audit, setAudit] = useState<api.ModelCatalogAuditReport | null>(null);
  const [auditStatus, setAuditStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const refreshAudit = useCallback(async () => {
    setAuditStatus('loading');
    try {
      await api.refreshModelMetadata();
      const report = await api.getModelCatalogAudit();
      setAudit(report);
      setAuditStatus('idle');
    } catch {
      setAuditStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getModelCatalogAudit({ openRouter: false })
      .then((report) => {
        if (!cancelled) setAudit(report);
      })
      .catch(() => {
        if (!cancelled) setAuditStatus('error');
      });
    return () => { cancelled = true; };
  }, [providers]);

  const categoryCounts = TOP_MODEL_CATALOG.reduce<Record<string, number>>((acc, card) => {
    const category = modelBestCategory(card);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const freshnessCounts = TOP_MODEL_CATALOG.reduce<Record<string, number>>((acc, card) => {
    const status = modelCatalogFreshness(card).status;
    acc[status] = (acc[status] || 0) + 1;
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
          <Search size={14} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search models, strengths, providers, comparisons"
            aria-label="Search model library by model, strength, provider, or comparison"
          />
        </label>
        <select
          className="settings-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as 'all' | keyof typeof MODEL_CATEGORY_META)}
          title="Filter by best-rated category"
          aria-label="Filter model library by best-rated category"
        >
          <option value="all">All categories</option>
          {Object.entries(MODEL_CATEGORY_META).map(([id, meta]) => (
            <option key={id} value={id}>{meta.label} ({categoryCounts[id] || 0})</option>
          ))}
        </select>
        <button
          className={`settings-mini-button model-library-access-button ${accessOnly ? 'active' : ''}`}
          type="button"
          onClick={() => setAccessOnly((prev) => !prev)}
          title="Show enabled models from configured providers"
          aria-pressed={accessOnly}
          aria-label={accessOnly ? 'Showing only enabled provider models; show all model library cards' : 'Show only enabled provider models in the model library'}
        >
          {accessOnly ? <Check size={11} aria-hidden="true" /> : <Bot size={11} aria-hidden="true" />}
          My Models
        </button>
        <button
          className="settings-mini-button"
          type="button"
          onClick={() => { void refreshAudit(); }}
          disabled={auditStatus === 'loading'}
          title="Refresh model metadata and audit catalog coverage"
          aria-label="Refresh model metadata and audit catalog coverage"
        >
          {auditStatus === 'loading' ? <Loader size={11} aria-hidden="true" className="spin" /> : <RefreshCw size={11} aria-hidden="true" />}
          Refresh
        </button>
      </div>

      <div className="model-library-summary" role="status" aria-label={`Model library summary: ${TOP_MODEL_CATALOG.length} catalog cards, ${providers.flatMap((p) => p.configured ? p.models.filter((m) => m.enabled) : []).length} enabled provider models, ${audit?.missingCatalogCards.length || 0} missing catalog cards, ${audit?.metadataDisagreements.length || 0} metadata differences, ${audit?.suggestedCatalogCards.length || 0} draft cards, ${freshnessCounts.fresh || 0} fresh official cards, ${freshnessCounts.stale || 0} stale official cards, ${freshnessCounts.advisory || 0} advisory cards, updated ${MODEL_CATALOG_UPDATED_AT}`}>
        <div><strong>{TOP_MODEL_CATALOG.length}</strong> catalog cards</div>
        <div><strong>{providers.flatMap((p) => p.configured ? p.models.filter((m) => m.enabled) : []).length}</strong> enabled provider models</div>
        <div><strong>{audit?.missingCatalogCards.length ?? '...'}</strong> missing cards</div>
        <div><strong>{audit?.metadataDisagreements.length ?? '...'}</strong> metadata diffs</div>
        <div><strong>{audit?.suggestedCatalogCards.length ?? '...'}</strong> draft cards</div>
        <div><strong>{freshnessCounts.fresh || 0}</strong> fresh official</div>
        <div><strong>{freshnessCounts.stale || 0}</strong> stale official</div>
        <div><strong>{freshnessCounts.advisory || 0}</strong> advisory</div>
        <div>Updated {MODEL_CATALOG_UPDATED_AT}</div>
      </div>
      {auditStatus === 'error' && (
        <div className="settings-inline-error" role="status">
          Model metadata audit is unavailable.
        </div>
      )}

      <div className="model-category-legend" role="group" aria-label="Model library category filters">
        {Object.entries(MODEL_CATEGORY_META).map(([id, meta]) => (
          <button
            key={id}
            className={`model-category-chip ${categoryFilter === id ? 'active' : ''}`}
            type="button"
            style={{ ['--category-color' as any]: meta.color, ['--category-bg' as any]: meta.background }}
            onClick={() => setCategoryFilter(categoryFilter === id ? 'all' : id as keyof typeof MODEL_CATEGORY_META)}
            title={`Best-rated category: ${meta.label}`}
            aria-pressed={categoryFilter === id}
            aria-label={`${categoryFilter === id ? 'Clear' : 'Apply'} ${meta.label} model category filter`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <div className="model-library-grid" role="list" aria-label={`${filtered.length} model capability scorecard${filtered.length === 1 ? '' : 's'} shown`}>
        {filtered.map((card) => {
          const access = getCatalogAccess(card.id, providers);
          const category = modelBestCategory(card);
          const categoryMeta = MODEL_CATEGORY_META[category];
          const accessClass = access.label.toLowerCase();
          const fit = modelHarnessFit(card);
          const signals = modelScorecardSignals(card);
          const freshness = modelCatalogFreshness(card);
          return (
            <article
              key={card.id}
              className="model-card"
              role="listitem"
              aria-label={`${card.displayName} capability scorecard. Provider ${card.provider}. ${categoryMeta.label}. Access ${access.label}${access.providerLabel ? ` via ${access.providerLabel}` : ''}. Source ${freshness.label}. Harness fit ${fit.score} percent, ${fit.label}. Coding ${signals.coding}. Reasoning ${signals.reasoning}. Review ${signals.review}. Planning ${signals.planning}. Tool use ${card.supportsTools ? 'supported' : 'basic'}. Vision ${card.supportsImages ? 'yes' : 'no'}. Long context ${formatContextWindow(card.contextWindowTokens)}. Speed ${signals.speed}. Cost ${formatModelCost(card)}. Privacy ${signals.privacy}. Local availability ${signals.localAvailability}.`}
              style={{ ['--model-category-color' as any]: categoryMeta.color, ['--model-category-bg' as any]: categoryMeta.background }}
              title={modelCatalogTooltip(card.id)}
            >
              <div className="model-card-top">
                <div className="model-card-title-block">
                  <div className="model-card-provider">{card.provider}</div>
                  <h3>{card.displayName}</h3>
                </div>
                <div className={`model-card-access ${accessClass}`} aria-label={`Provider access: ${access.label}${access.providerLabel ? ` through ${access.providerLabel}` : ''}`}>
                  {access.label}
                  {access.providerLabel && <span>{access.providerLabel}</span>}
                </div>
              </div>
              <div className="model-card-category">{categoryMeta.label}</div>
              <div className={`model-card-freshness ${freshness.status}`} aria-label={`${card.displayName} source freshness: ${freshness.label}; confidence ${freshness.confidence}; source ${freshness.label}`}>
                {freshness.status === 'fresh' ? 'Fresh source' : freshness.status === 'stale' ? 'Stale source' : freshness.status === 'advisory' ? 'Advisory source' : 'Unverified source'}
                <span>{freshness.label}</span>
              </div>
              <p className="model-card-compact">{card.compactDescription}</p>
              <div className="model-card-metrics" role="list" aria-label={`${card.displayName} core capability scorecard: coding, reasoning, review, planning, tool use, vision, long context, speed, cost, privacy, and local availability`}>
                <div role="listitem" aria-label={`Coding capability ${signals.coding}`}><span>Coding</span><strong>{signals.coding}</strong></div>
                <div role="listitem" aria-label={`Reasoning capability ${signals.reasoning}`}><span>Reasoning</span><strong>{signals.reasoning}</strong></div>
                <div role="listitem" aria-label={`Review capability ${signals.review}`}><span>Review</span><strong>{signals.review}</strong></div>
                <div role="listitem" aria-label={`Planning capability ${signals.planning}`}><span>Planning</span><strong>{signals.planning}</strong></div>
                <div role="listitem" aria-label={`Context window ${formatContextWindow(card.contextWindowTokens)}`}><span>Context</span><strong>{formatContextWindow(card.contextWindowTokens)}</strong></div>
                <div role="listitem" aria-label={`Cost tier ${formatModelCost(card)}`}><span>Cost</span><strong>{formatModelCost(card)}</strong></div>
                <div role="listitem" aria-label={`Tool capability ${card.supportsTools ? 'supported' : 'basic'}`}><span>Tools</span><strong>{card.supportsTools ? 'Yes' : 'Basic'}</strong></div>
                <div role="listitem" aria-label={`Vision capability ${card.supportsImages ? 'supported' : 'not supported'}`}><span>Vision</span><strong>{card.supportsImages ? 'Yes' : 'No'}</strong></div>
                <div role="listitem" aria-label={`Speed expectation ${signals.speed}`}><span>Speed</span><strong>{signals.speed}</strong></div>
                <div role="listitem" aria-label={`Privacy and deployment posture ${signals.privacy}`}><span>Privacy</span><strong>{signals.privacy}</strong></div>
                <div role="listitem" aria-label={`Local availability ${signals.localAvailability}`}><span>Local</span><strong>{signals.localAvailability}</strong></div>
              </div>
              <div className="model-card-scorecard" role="group" aria-label={`${card.displayName} harness fit score ${fit.score} percent: ${fit.label}`}>
                <div className="model-card-score-main">
                  <span>Harness fit</span>
                  <strong>{fit.score}%</strong>
                  <em>{fit.label}</em>
                </div>
                <div className="model-card-score-reasons" role="list" aria-label={`${card.displayName} harness fit reasons`}>
                  {fit.reasons.map((reason) => <span key={`${card.id}-${reason}`} role="listitem">{reason}</span>)}
                </div>
              </div>
              <div className="model-card-review">{card.reviewSummary}</div>
              <div className="model-card-columns">
                <div role="group" aria-label={`${card.displayName} strengths`}>
                  <span>Good at</span>
                  <p>{card.strengths.join(', ')}</p>
                </div>
                <div role="group" aria-label={`${card.displayName} weaknesses`}>
                  <span>Bad at</span>
                  <p>{card.weaknesses.join(', ')}</p>
                </div>
              </div>
              <div className="model-card-compare" aria-label={`${card.displayName} comparable models: ${card.comparableTo.join(', ')}`}>
                Comparable to: {card.comparableTo.join(', ')}
              </div>
              <div className="model-card-benchmark" aria-label={`${card.displayName} benchmark highlight: ${card.benchmarkHighlights[0]}`}>{card.benchmarkHighlights[0]}</div>
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

function selectedProviderPlan(providerId?: string, providerName?: string, accessMode?: ProviderAccessMode, planId?: string) {
  const catalog = providerPlanCatalogFor(providerId, providerName);
  const plans = catalog?.plans || [defaultProviderPlan(providerId, providerName)];
  return plans.find((plan) => plan.id === planId) || plans.find((plan) => plan.accessMode === accessMode) || plans[0];
}

function ProviderOAuthControls({ provider }: { provider: ProviderConfig }) {
  const [status, setStatus] = useState<api.ProviderOAuthState | null>(provider.oauth || null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const plan = selectedProviderPlan(provider.id, provider.name, provider.accessMode, provider.planId);
  const shouldShow = provider.accessMode === 'subscription' && plan?.authMethod === 'oauth';

  useEffect(() => {
    if (!shouldShow) return;
    let cancelled = false;
    api.getProviderOAuthStatus(provider.id)
      .then((next) => { if (!cancelled) setStatus(next); })
      .catch((err) => { if (!cancelled) setMessage(err?.message || 'OAuth status unavailable'); });
    return () => { cancelled = true; };
  }, [provider.id, shouldShow]);

  if (!shouldShow) return null;

  const connected = !!status?.connected || !!provider.oauth?.connected;
  const configured = status?.configured !== false;
  const providerLabel = status?.provider ? status.provider[0].toUpperCase() + status.provider.slice(1) : provider.name;

  const startOAuth = async () => {
    if (!configured) {
      const missingProvider = providerLabel || provider.name;
      setAuthUrl('');
      setMessage(`${missingProvider} OAuth needs server client credentials before sign-in can start.`);
      return;
    }
    setBusy(true);
    setMessage('');
    setAuthUrl('');
    const oauthWindow = window.open('about:blank', '_blank', 'popup=yes,width=520,height=720');
    try {
      const result = await api.startProviderOAuth(provider.id);
      setAuthUrl(result.authUrl);
      if (oauthWindow) {
        oauthWindow.opener = null;
        oauthWindow.location.href = result.authUrl;
        setMessage('OAuth sign-in opened in a browser tab. Refresh this provider after approving access.');
      } else {
        setMessage('OAuth popup was blocked. Open the sign-in link below to continue.');
      }
    } catch (err: any) {
      oauthWindow?.close();
      setMessage(err?.message || 'OAuth setup failed');
    } finally {
      setBusy(false);
    }
  };

  const disconnectOAuth = async () => {
    setBusy(true);
    setMessage('');
    try {
      await api.disconnectProviderOAuth(provider.id);
      const next = await api.getProviderOAuthStatus(provider.id);
      setStatus(next);
      setMessage('OAuth disconnected.');
    } catch (err: any) {
      setMessage(err?.message || 'Failed to disconnect OAuth');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="provider-plan-controls" style={{ marginTop: 8 }}>
      <div className="provider-plan-note">
        {connected
          ? `${providerLabel} OAuth connected${status?.connectedAt ? ` on ${new Date(status.connectedAt).toLocaleDateString()}` : ''}.`
          : configured
            ? `${providerLabel} OAuth is ready for this subscription plan.`
            : `${providerLabel} OAuth needs client credentials on the server before sign-in can start.`}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="settings-mini-button" onClick={startOAuth} disabled={busy}>
          {busy ? <Loader size={11} className="spin" /> : <KeyRound size={11} />}
          {connected ? 'Reconnect OAuth' : 'Connect OAuth'}
        </button>
        {connected && (
          <button className="settings-mini-button" onClick={disconnectOAuth} disabled={busy}>
            <Trash2 size={11} /> Disconnect
          </button>
        )}
        <button
          className="settings-mini-button"
          onClick={async () => {
            setBusy(true);
            setMessage('');
            try {
              setStatus(await api.getProviderOAuthStatus(provider.id));
            } catch (err: any) {
              setMessage(err?.message || 'OAuth status unavailable');
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>
      {message && <div className={`test-result ${message.includes('failed') || message.includes('needs') || message.includes('unavailable') ? 'error' : 'success'}`}>{message}</div>}
      {authUrl && (
        <a className="settings-inline-link" href={authUrl} target="_blank" rel="noreferrer">
          Open OAuth sign-in
        </a>
      )}
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
          const draftKey = (providerKeyDraft[provider.id] || '').trim();
          const canProbeProvider = provider.type === 'local' || provider.configured || draftKey.length > 0;
          const apiKeyStatus = provider.hasKey ? 'stored' : provider.oauth?.connected ? 'OAuth connected' : 'not configured';
          const missingCredentialMessage = provider.type === 'local'
            ? ''
            : 'Add an API key before testing or fetching models.';

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
                  <ProviderOAuthControls provider={provider} />
                  {/* Quick actions */}
                  <div className="prov-card-actions">
                    {provider.type !== 'local' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                            API key
                            <span style={{ color: provider.hasKey ? 'var(--text-secondary)' : provider.oauth?.connected ? 'var(--accent-success)' : 'var(--warning)' }}>
                              {' '}({apiKeyStatus})
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
                    {canProbeProvider && (healthByProvider[provider.id]?.summary || tr) && (
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
                        const tempKey = draftKey || undefined;
                        setTestingProvider(provider.id);
                        onTest(provider.id, tempKey)
                          .then((r: any) => setTestResults((p) => ({ ...p, [provider.id]: r })))
                          .catch((e: any) => setTestResults((p) => ({ ...p, [provider.id]: { ok: false, error: e.message } })))
                          .finally(() => setTestingProvider(null));
                      }}
                      disabled={testingProvider === provider.id || !canProbeProvider}
                      title={!canProbeProvider ? missingCredentialMessage : undefined}
                    >
                      {testingProvider === provider.id ? <Loader size={11} className="spin" /> : <Wifi size={11} />}
                      {testingProvider === provider.id ? 'Testing...' : 'Test'}
                    </button>
                    <button className="settings-mini-button" onClick={async () => {
                      const tempKey = draftKey || undefined;
                      setFetchingModels(provider.id);
                      try {
                        const result = await onFetch(provider.id, tempKey);
                        const count = Array.isArray(result) ? result.length : (result?.length || 0);
                        setFetchResults((prev) => ({ ...prev, [provider.id]: { ok: true, msg: 'Found ' + count + ' model' + (count === 1 ? '' : 's') } }));
                      } catch (err: any) {
                        setFetchResults((prev) => ({ ...prev, [provider.id]: { ok: false, msg: err?.message || 'Failed' } }));
                      }
                      setFetchingModels(null);
                    }} disabled={fetchingModels === provider.id || !canProbeProvider} title={!canProbeProvider ? missingCredentialMessage : undefined}>
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
        {models.map((model: any, index: number) => (
          <div key={`${providerId}:${model.id}:${index}`} className="prov-model-row" title={modelCatalogTooltip(model.id, providerId)}>
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
  const [evalRecommendations, setEvalRecommendations] = useState<api.EvalRecommendation[]>([]);
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

  const evalProofStatusCopy = (recommendation: api.EvalRecommendation) => {
    if (recommendation.proofReviewStatus === 'approved') return 'Proof approved';
    if (recommendation.proofReviewStatus === 'needs-attention') return 'Proof needs attention';
    return 'Proof unreviewed';
  };

  const evalProofStatusDetail = (recommendation: api.EvalRecommendation) => {
    const base = recommendation.proofReviewStatus === 'approved'
      ? 'Human-reviewed evidence supports this recommendation.'
      : recommendation.proofReviewStatus === 'needs-attention'
        ? 'Review found issues; do not treat this as a trusted recommendation yet.'
        : 'Review the Model Lab proof before applying this recommendation.';
    return recommendation.proofReviewedAt ? `${base} Reviewed ${new Date(recommendation.proofReviewedAt).toLocaleString()}.` : base;
  };

  useEffect(() => {
    let cancelled = false;
    api.getEvalRecommendations()
      .then((items) => { if (!cancelled) setEvalRecommendations(items); })
      .catch(() => { if (!cancelled) setEvalRecommendations([]); });
    return () => { cancelled = true; };
  }, []);

  const enabledModelKeys = useMemo(() => {
    const keys = new Set<string>();
    enabledModels.forEach((model: any) => {
      const normalizedId = String(model.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const normalizedName = String(model.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const normalizedProviderModel = `${model.providerId || ''}:${model.id || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (normalizedId) keys.add(normalizedId);
      if (normalizedName) keys.add(normalizedName);
      if (normalizedProviderModel) keys.add(normalizedProviderModel);
    });
    return keys;
  }, [enabledModels]);

  const evalRecommendationByRole = useMemo(() => {
    const entries = new Map<string, api.EvalRecommendation>();
    evalRecommendations.forEach((rec) => {
      const normalized = rec.modelId.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!enabledModelKeys.has(normalized)) return;
      if (!entries.has(rec.role)) entries.set(rec.role, rec);
    });
    return entries;
  }, [enabledModelKeys, evalRecommendations]);

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

  const recommendedRoleModels = Object.fromEntries(
    roleAssignments.map((role: CodingRoleAssignment) => [role.id, bestModelForRole(enabledModels, role.id)])
  ) as Record<string, any | null>;

  const applyRecommendedDefaults = useCallback(() => {
    roleAssignments.forEach((role: CodingRoleAssignment) => {
      const effort = ROLE_DEFAULT_EFFORT[role.id] || 'medium';
      onAssignRoleThinking(role.id, effort);
      const recommended = recommendedRoleModels[role.id];
      if (recommended) onAssignRoleModel(role.id, recommended.id);
    });
  }, [onAssignRoleModel, onAssignRoleThinking, recommendedRoleModels, roleAssignments]);

  return (
    <>
      <PaneTitle>Agent Roles</PaneTitle>
      <PaneDesc>Pick how much thinking each kind of work deserves. Use Auto for the model unless you want a specific role override.</PaneDesc>
      <div className="role-recommendation-bar">
        <div>
          <div className="role-recommendation-title">Auto configure from selected plan models</div>
          <div className="role-recommendation-copy">Uses only models enabled under your configured providers and plan choices, then picks the strongest available fit for each agent role.</div>
        </div>
        <button
          type="button"
          className="settings-mini-button"
          onClick={applyRecommendedDefaults}
          disabled={enabledModels.length === 0}
          aria-label="Auto configure agent roles from enabled model recommendations"
        >
          <Sparkles size={12} aria-hidden="true" /> Auto configure roles
        </button>
      </div>
      <div className="role-recommendation-bar">
        <div>
          <div className="role-recommendation-title">Eval proof trust</div>
          <div className="role-recommendation-copy">
            Approved proof can be applied directly. Unreviewed proof is manual-only and needs human review before changing defaults. Needs-attention proof stays blocked until resolved.
          </div>
        </div>
      </div>
      <div className="role-auto-grid" role="group" aria-label="Recommended role models">
        {roleAssignments.map((role: CodingRoleAssignment) => {
          const recommended = recommendedRoleModels[role.id];
          const Icon = roleIconMap[role.id] || Bot;
          return (
            <div
              key={role.id}
              className="role-auto-card"
              role="group"
              aria-label={`${role.name} recommended model: ${recommended ? `${recommended.providerName} ${recommended.name}` : 'no enabled model'}`}
            >
              <span className="role-auto-icon"><Icon size={13} aria-hidden="true" /></span>
              <span className="role-auto-text">
                <span className="role-auto-name">{role.name}</span>
                <span className="role-auto-model">
                  {recommended ? `${recommended.providerName} - ${recommended.name}` : 'No enabled model'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="role-effort-list">
        {THINKING_EFFORTS.map((effort) => {
          const rolesForEffort = roleAssignments.filter((role: CodingRoleAssignment) => (roleThinking?.[role.id] || 'medium') === effort.id);
          const sharedModel = rolesForEffort.length > 0 && rolesForEffort.every((role: CodingRoleAssignment) => role.modelId === rolesForEffort[0].modelId)
            ? rolesForEffort[0].modelId
            : '';
          const effortTitleId = `agent-role-effort-title-${effort.id}`;
          const effortIntentId = `agent-role-effort-intent-${effort.id}`;
          return (
            <section key={effort.id} className="role-effort-section" aria-labelledby={effortTitleId} aria-describedby={effortIntentId}>
              <div className="role-effort-header">
                <div className="role-effort-title-row">
                  <span className="role-effort-icon"><Brain size={14} aria-hidden="true" /></span>
                  <div>
                    <div className="role-effort-title" id={effortTitleId}>{effort.label}</div>
                    <div className="role-effort-summary">{effortCopy[effort.id].summary}</div>
                  </div>
                  <span
                    className="role-effort-count"
                    aria-label={`${rolesForEffort.length} role${rolesForEffort.length === 1 ? '' : 's'} using ${effort.label.toLowerCase()} thinking`}
                  >
                    {rolesForEffort.length}
                  </span>
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
              <div className="role-effort-intent" id={effortIntentId}>{effortCopy[effort.id].intent}</div>
              {recommendedModels[effort.id] && (
                <div className="role-effort-recommendation">
                  Best available: {recommendedModels[effort.id]?.providerName} — {recommendedModels[effort.id]?.name}
                </div>
              )}
              <div className="role-bucket-list">
                {rolesForEffort.length === 0 && (
                  <div className="role-effort-empty" role="status" aria-live="polite">No roles are using {effort.label.toLowerCase()} thinking.</div>
                )}
                {rolesForEffort.map((role: CodingRoleAssignment) => {
                  const Icon = roleIconMap[role.id] || Bot;
                  const selectedModel = enabledModels.find((model: any) => model.id === role.modelId);
                  const evalRecommendation = evalRecommendationByRole.get(role.id);
                  const supportsThinking = modelSupportsThinking(role.modelId, selectedModel?.providerId);
                  const thinkingTitle = role.modelId === 'Auto'
                    ? `${role.name} uses Thinking to bias Auto routing depth and cost.`
                    : `${role.name} thinking effort for this reasoning-capable model.`;
                  return (
                    <div
                      key={role.id}
                      className="role-bucket-card"
                      role="group"
                      aria-label={`${role.name}: ${role.description}. Current model ${selectedModel ? `${selectedModel.providerName} ${selectedModel.name}` : role.modelId}. Thinking effort ${roleThinking?.[role.id] || 'medium'}.`}
                    >
                      <div className="role-bucket-icon"><Icon size={15} aria-hidden="true" /></div>
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
                              <span><Brain size={12} aria-hidden="true" /> Move to</span>
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
                        {evalRecommendation && (
                          <div
                            className="role-eval-recommendation"
                            role="group"
                            aria-label={`${role.name} eval recommendation: ${evalRecommendation.modelId}. ${evalProofStatusCopy(evalRecommendation)}. ${evalRecommendation.reason}`}
                          >
                            <div>
                              <span>Eval recommendation · {evalProofStatusCopy(evalRecommendation)}</span>
                              <strong>{evalRecommendation.modelId}</strong>
                              <p>{evalRecommendation.reason}</p>
                              <p className={`eval-proof-status ${evalRecommendation.proofReviewStatus}`}>
                                {evalProofStatusDetail(evalRecommendation)}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="settings-mini-button"
                              onClick={() => onAssignRoleModel(role.id, evalRecommendation.modelId)}
                              disabled={evalRecommendation.proofReviewStatus === 'needs-attention'}
                              aria-label={`${evalRecommendation.proofTrusted ? 'Apply approved' : evalRecommendation.proofReviewStatus === 'needs-attention' ? 'Blocked' : 'Apply manually after review'} eval recommendation for ${role.name}: ${evalRecommendation.modelId}`}
                              title={evalRecommendation.proofReviewStatus === 'needs-attention'
                                ? 'Resolve the proof review before applying this recommendation.'
                                : evalRecommendation.proofTrusted
                                  ? 'Apply this approved-proof recommendation.'
                                  : 'Apply manually after reviewing the unapproved proof.'}
                            >
                              {evalRecommendation.proofTrusted ? 'Apply' : 'Apply manually'}
                            </button>
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
  card: `${card.compactDescription} Source freshness: ${modelCatalogFreshness(card).label}. Treat stale or advisory cards as routing hints, not strong recommendations.`,
}));

const normalizeModelKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

function formatRouterPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function routerToolReliabilityForModel(
  summary: api.RouterLearningSummary | null,
  modelId: string,
): api.ToolReliabilityBucket | null {
  const byModel = summary?.toolReliability?.byModel || {};
  const candidateKey = normalizeModelKey(modelId);
  for (const [key, bucket] of Object.entries(byModel)) {
    const normalized = normalizeModelKey(key);
    if (normalized === candidateKey || normalized.endsWith(candidateKey) || candidateKey.endsWith(normalized)) {
      return bucket;
    }
  }
  return null;
}

function routerToolRecoveryForModel(
  summary: api.RouterLearningSummary | null,
  modelId: string,
): api.ToolReliabilityRecoveryExample | null {
  const examples = summary?.toolReliability?.recoveryExamples || [];
  const candidateKey = normalizeModelKey(modelId);
  return examples.find((example) => {
    const normalized = normalizeModelKey(example.firstError.model);
    return normalized === candidateKey || normalized.endsWith(candidateKey) || candidateKey.endsWith(normalized);
  }) || null;
}

function routerToolRecoveryLabel(example: api.ToolReliabilityRecoveryExample): string {
  const recoveryPath = example.recoveredBy.length > 0
    ? example.recoveredBy.map((step) => `${step.tool} (${step.model})`).join(' -> ')
    : 'final answer without a later completed tool call';
  return `${example.firstError.tool} failed, then ${recoveryPath}; session ${example.sessionId}, run ${example.runId}`;
}

function routerRetryReductionForModel(
  summary: api.RouterLearningSummary | null,
  modelId: string,
): api.ToolReliabilityRetryReductionRecommendation | null {
  const recommendations = summary?.toolReliability?.retryReductionRecommendations || [];
  const candidateKey = normalizeModelKey(modelId);
  return recommendations.find((recommendation) => {
    const normalized = normalizeModelKey(recommendation.failedModel);
    return normalized === candidateKey || normalized.endsWith(candidateKey) || candidateKey.endsWith(normalized);
  }) || null;
}

function modelRecommendationMatches(candidateModelId: string, recommendationModelId: string): boolean {
  const candidateKey = normalizeModelKey(candidateModelId);
  const recKey = normalizeModelKey(recommendationModelId);
  return candidateKey === recKey || candidateKey.endsWith(recKey) || recKey.endsWith(candidateKey);
}

function routerToolPairRisksForModel(
  summary: api.RouterLearningSummary | null,
  modelId: string,
): Array<[string, api.ToolReliabilityBucket]> {
  const pairs = summary?.toolReliability?.byModelTool || {};
  const candidateKey = normalizeModelKey(modelId);
  return Object.entries(pairs)
    .filter(([pair, stats]) => {
      const modelPart = pair.split('/')[0]?.trim() || pair;
      const normalized = normalizeModelKey(modelPart);
      return stats.error > 0 && (normalized === candidateKey || normalized.endsWith(candidateKey) || candidateKey.endsWith(normalized));
    })
    .sort(([, a], [, b]) => b.errorRate - a.errorRate || b.error - a.error || b.total - a.total)
    .slice(0, 3);
}

function routerToolPairLabel(pair: string): string {
  const parts = pair.split('/').map((part) => part.trim());
  return parts.length > 1 ? parts.slice(1).join(' / ') : pair;
}

const PROMPT_STRATEGY_MODEL_HINTS: Array<{ hints: string[]; strategyId: string }> = [
  { hints: ['gpt', 'openai', 'codex', 'o-series'], strategyId: 'openai-outcome-first-v1' },
  { hints: ['claude', 'anthropic'], strategyId: 'anthropic-xml-evidence-v1' },
  { hints: ['gemini', 'google'], strategyId: 'gemini-specific-iterative-v1' },
  { hints: ['mistral', 'devstral', 'codestral'], strategyId: 'mistral-structured-purpose-v1' },
  { hints: ['deepseek'], strategyId: 'deepseek-structured-code-v1' },
  { hints: ['qwen'], strategyId: 'qwen-xml-code-v1' },
  { hints: ['minimax', 'm3'], strategyId: 'minimax-long-context-agent-v1' },
  { hints: ['llama'], strategyId: 'llama-repeat-rules-v1' },
  { hints: ['gemma'], strategyId: 'gemma-concise-first-user-v1' },
  { hints: ['phi'], strategyId: 'phi-minimal-router-v1' },
];

function routerPromptStrategyIdForModel(modelId: string): string {
  const normalized = modelId.toLowerCase();
  return PROMPT_STRATEGY_MODEL_HINTS.find((entry) => entry.hints.some((hint) => normalized.includes(hint)))?.strategyId
    || 'unknown-safe-structured-v1';
}

function routerPromptStrategyReliabilityForModel(
  summary: api.RouterLearningSummary | null,
  modelId: string,
): { strategyId: string; bucket: api.ToolReliabilityBucket | null; variants: Array<[string, api.ToolReliabilityBucket]> } {
  const strategyId = routerPromptStrategyIdForModel(modelId);
  const bucket = summary?.toolReliability?.byPromptStrategy?.[strategyId] || null;
  const variants = Object.entries(summary?.toolReliability?.byPromptStrategyVariant || {})
    .filter(([key, stats]) => key.startsWith(`${strategyId}:`) && stats.total > 0)
    .sort(([, a], [, b]) => b.errorRate - a.errorRate || b.error - a.error || b.total - a.total)
    .slice(0, 2);
  return { strategyId, bucket, variants };
}

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
  if (lower.includes('deepseek')) return { cost: 0.25, supportsImages: false, supportsThinking: /\b(v4|r1|r2|reasoner)\b/.test(lower), card: 'DeepSeek-family model. Strong low-cost long-context text coding; enable images only for explicit VL/provider vision variants.' };
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
  const [routerState, setRouterState] = useState<api.AutoRouterState | null>(null);
  const [arCandidates, setArCandidates] = useState<api.AutoRouterCandidateConfig[]>([]);
  const [configuredCandidates, setConfiguredCandidates] = useState<api.AutoRouterCandidateConfig[]>([]);
  const [evalRecommendations, setEvalRecommendations] = useState<api.EvalRecommendation[]>([]);
  const [routerLearningSummary, setRouterLearningSummary] = useState<api.RouterLearningSummary | null>(null);
  const [arSaving, setArSaving] = useState(false);
  const [newCandidate, setNewCandidate] = useState<api.AutoRouterCandidateConfig>({
    modelId: '', cost: 0.5, supportsImages: false, supportsThinking: false, card: ''
  });

  const evalProofStatusCopy = (recommendation: api.EvalRecommendation) => {
    if (recommendation.proofReviewStatus === 'approved') return 'Proof approved';
    if (recommendation.proofReviewStatus === 'needs-attention') return 'Proof needs attention';
    return 'Proof unreviewed';
  };

  const evalProofStatusDetail = (recommendation: api.EvalRecommendation) => {
    const base = recommendation.proofReviewStatus === 'approved'
      ? 'Human-reviewed evidence supports this router cue.'
      : recommendation.proofReviewStatus === 'needs-attention'
        ? 'Review found issues; do not treat this router cue as trusted yet.'
        : 'Review the Model Lab proof before trusting this router cue.';
    return recommendation.proofReviewedAt ? `${base} Reviewed ${new Date(recommendation.proofReviewedAt).toLocaleString()}.` : base;
  };

  // Load router state and candidates on mount
  useEffect(() => {
    api.getRouterState().then((state) => {
      setRouterState(state);
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
    api.getEvalRecommendations()
      .then(setEvalRecommendations)
      .catch(() => setEvalRecommendations([]));
    api.getRouterLearning()
      .then(setRouterLearningSummary)
      .catch(() => setRouterLearningSummary(null));
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
    const result = await api.configureRouter(merged);
    setRouterState(result.state);
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
        setRouterState(await api.getRouterState());
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
        setRouterState(merged.state);
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
  const evidenceRefreshLabel = routerState?.candidateEvidenceRefreshedAt
    ? new Date(routerState.candidateEvidenceRefreshedAt).toLocaleString()
    : 'Not refreshed yet';
  const evidenceRefreshCount = routerState?.candidateEvidenceRefreshCount ?? 0;
  const toolEvidenceSources = routerLearningSummary?.toolReliability?.byEvidenceSource || [];

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
                              aria-label="Auto-Router classifier model"
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
                              aria-label="Auto-Router default fallback model"
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
                              aria-label="Auto-Router routing threshold"
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
              <div className="router-eval-recommendation" style={{ marginBottom: 10 }}>
                <span>Eval proof trust</span>
                <p>
                  Eval-backed router cues show proof status when a recommendation matches an active candidate.
                  Treat approved proof as trusted, review unreviewed proof manually, and do not trust needs-attention proof until it is resolved.
                </p>
              </div>
              <div
                className="router-eval-recommendation"
                role="status"
                aria-label={`Auto-Router evidence freshness: candidate evidence refreshed ${evidenceRefreshCount} time${evidenceRefreshCount === 1 ? '' : 's'}, last refresh ${evidenceRefreshLabel}`}
                style={{ marginBottom: 10 }}
              >
                <span>Candidate evidence freshness</span>
                <p>
                  Eval and tool-reliability annotations were rebuilt {evidenceRefreshCount} time{evidenceRefreshCount === 1 ? '' : 's'}.
                  Last refresh: {evidenceRefreshLabel}.
                </p>
                <p className={`eval-proof-status ${routerState?.enabled ? 'approved' : 'unreviewed'}`}>
                  {routerState?.enabled
                    ? 'The classifier sees refreshed candidate cards when routing runs.'
                    : 'Auto-Router is disabled, so evidence refresh metadata is informational only.'}
                </p>
              </div>
              {toolEvidenceSources.length > 0 && (
                <div
                  className="router-eval-recommendation"
                  role="status"
                  aria-label={`Auto-Router tool-error evidence sources: ${toolEvidenceSources.map((source) => `${source.source} has ${source.outcomeRuns} outcome runs, ${source.retryReductionRecommendations} retry recommendations, average retry distance ${source.avgRetryDistance}, tuning action ${source.tuningAction}`).join('; ')}`}
                  style={{ marginBottom: 10 }}
                >
                  <span>Tool-error evidence sources</span>
                  <p>
                    Check the source mix before changing candidate cards or costs; saved-session evidence is strongest for local routing behavior,
                    while imported or log-derived evidence should be treated as context until manually reviewed.
                  </p>
                  <p>
                    {toolEvidenceSources.map((source) =>
                      `${source.source}: ${source.outcomeRuns} outcome run${source.outcomeRuns === 1 ? '' : 's'}, ${source.recoveredRuns} recovered, ${source.unrecoveredRuns} unrecovered, ${source.retryReductionRecommendations} retry recommendation${source.retryReductionRecommendations === 1 ? '' : 's'}, avg retry distance ${source.avgRetryDistance}, tuning action ${source.tuningAction}`
                    ).join(' · ')}
                  </p>
                </div>
              )}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 6,
                marginBottom: 10,
              }}>
                <div role="status" aria-label={`Auto-router catalog contains ${TOP_ROUTER_MODEL_CARDS.length} model capability cards`} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-secondary, #f3f4f6)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Catalog</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{TOP_ROUTER_MODEL_CARDS.length} cards</div>
                </div>
                <div role="status" aria-label={`Auto-router has ${configuredCandidates.length} configured provider models available to sync`} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-secondary, #f3f4f6)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Configured</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{configuredCandidates.length} models</div>
                </div>
                <div role="status" aria-label={`Auto-router has ${arCandidates.length} active routed candidates`} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-secondary, #f3f4f6)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Routed</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{arCandidates.length} active</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  type="button"
                  className="settings-btn"
                  style={{ padding: '5px 9px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={syncConfiguredCandidates}
                  disabled={arSaving || configuredCandidates.length === 0}
                  title="Scan configured providers and refresh subscription-aware effective costs"
                  aria-label="Sync configured provider models into Auto-Router candidates"
                >
                  <RefreshCw size={12} aria-hidden="true" /> Sync configured
                </button>
                {configuredAvailable.slice(0, 3).map((candidate) => (
                  <button
                    key={candidate.modelId}
                    type="button"
                    className="settings-btn"
                    style={{ padding: '5px 9px', fontSize: 11, borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    onClick={() => addConfiguredCandidate(candidate)}
                    title={`Configured provider model. ${candidate.card}`}
                    aria-label={`Add configured provider model ${candidate.modelId} as an Auto-Router candidate`}
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
                <div role="status" aria-live="polite" style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 8 }}>
                  No candidates configured. Add at least one to enable routing.
                </div>
              )}
              <div role="list" aria-label={`${arCandidates.length} Auto-Router candidate${arCandidates.length === 1 ? '' : 's'} configured`}>
              {arCandidates.map((c, i) => {
                const source = routerCandidateSource(c, configuredCandidates);
                const isClassifier = normalizeModelKey(c.modelId) === normalizeModelKey(arClassifier);
                const isDefault = normalizeModelKey(c.modelId) === normalizeModelKey(arDefaultModel);
                const evalRecommendation = evalRecommendations.find((rec) => {
                  return modelRecommendationMatches(c.modelId, rec.modelId);
                });
                const toolReliability = routerToolReliabilityForModel(routerLearningSummary, c.modelId);
                const toolRecovery = routerToolRecoveryForModel(routerLearningSummary, c.modelId);
                const retryReduction = routerRetryReductionForModel(routerLearningSummary, c.modelId);
                const toolPairRisks = routerToolPairRisksForModel(routerLearningSummary, c.modelId);
                const promptStrategyReliability = routerPromptStrategyReliabilityForModel(routerLearningSummary, c.modelId);
                const catalogCard = findModelCatalogCard(c.modelId);
                const freshness = catalogCard ? modelCatalogFreshness(catalogCard) : null;
                const toolReliabilityTone = toolReliability && toolReliability.total > 0
                  ? toolReliability.errorRate > 0.2
                    ? 'custom'
                    : toolReliability.error > 0
                      ? 'catalog'
                      : 'ok'
                  : null;
                return (
                <div
                  key={c.modelId}
                  title={source.detail}
                  role="listitem"
                  aria-label={`Auto-router candidate ${i + 1}: ${c.modelId}. Source ${source.label}. ${freshness ? `Catalog freshness ${freshness.label}. ` : ''}Effective cost ${c.cost}. Images ${c.supportsImages ? 'supported' : 'not supported'}. Thinking ${c.supportsThinking ? 'supported' : 'not supported'}.${isClassifier ? ' Used as classifier model.' : ''}${isDefault ? ' Used as default fallback model.' : ''}${evalRecommendation ? ` Eval recommendation ${evalProofStatusCopy(evalRecommendation)} for ${evalRecommendation.role}.` : ''}`}
                  style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 6,
                  padding: '7px 8px', marginBottom: 4,
                  borderRadius: 4, fontSize: 12,
                  background: 'var(--bg-secondary, #f3f4f6)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div role="list" aria-label={`${c.modelId} Auto-Router evidence badges`} style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {c.modelId}
                      </span>
                      <span role="listitem" aria-label={`${c.modelId} source ${source.label}`} style={routerSourceBadgeStyle(source.tone)}>{source.label}</span>
                      {freshness && <span role="listitem" aria-label={`${c.modelId} catalog freshness: ${freshness.label}. Stale or advisory cards are routing hints, not strong recommendations.`} style={routerSourceBadgeStyle(freshness.status === 'fresh' ? 'ok' : freshness.status === 'stale' ? 'custom' : 'catalog')}>
                        {freshness.status === 'fresh' ? 'Fresh card' : freshness.status === 'stale' ? 'Stale card' : freshness.status === 'advisory' ? 'Advisory card' : 'Unverified card'}
                      </span>}
                      {isClassifier && <span role="listitem" aria-label={`${c.modelId} is the classifier model`} style={routerSourceBadgeStyle('catalog')}>Classifier</span>}
                      {isDefault && <span role="listitem" aria-label={`${c.modelId} is the default fallback model`} style={routerSourceBadgeStyle('custom')}>Default</span>}
                      {evalRecommendation && <span role="listitem" aria-label={`${c.modelId} eval recommendation status: ${evalProofStatusCopy(evalRecommendation)}`} style={routerSourceBadgeStyle(evalRecommendation.proofReviewStatus === 'approved' ? 'ok' : 'custom')}>
                        {evalRecommendation.proofReviewStatus === 'approved' ? 'Eval-backed' : 'Eval evidence'}
                      </span>}
                      {toolReliability && toolReliability.total > 0 && (
                        <span
                          role="listitem"
                          aria-label={`${c.modelId} tool reliability: ${toolReliability.error} errors from ${toolReliability.total} traced tool calls, ${toolReliability.recoveredRuns} recovered runs`}
                          style={routerSourceBadgeStyle(toolReliabilityTone || 'catalog')}
                        >
                          Tool {toolReliability.error}/{toolReliability.total}
                        </span>
                      )}
                      {c.supportsImages && <span role="listitem" aria-label={`${c.modelId} supports image inputs`} style={{ fontSize: 10, color: 'var(--accent-color, #6366f1)' }}>Images</span>}
                      {c.supportsThinking && <span role="listitem" aria-label={`${c.modelId} supports native thinking`} style={{ fontSize: 10, color: 'var(--accent-color, #6366f1)' }}>Thinking</span>}
                    </div>
                    {evalRecommendation && (
                      <div
                        className="router-eval-recommendation"
                        role="group"
                        aria-label={`Auto-router eval recommendation for ${c.modelId}: suggested for ${evalRecommendation.role}. ${evalProofStatusCopy(evalRecommendation)}. ${evalRecommendation.reason}`}
                      >
                        <span>Eval suggests this for {evalRecommendation.role} · {evalProofStatusCopy(evalRecommendation)}</span>
                        <p>{evalRecommendation.reason}</p>
                        <p className={`eval-proof-status ${evalRecommendation.proofReviewStatus}`}>
                          {evalProofStatusDetail(evalRecommendation)}
                        </p>
                      </div>
                    )}
                    {toolReliability && toolReliability.total > 0 && (
                      <div
                        className="router-eval-recommendation"
                        role="group"
                        aria-label={`Auto-router tool reliability for ${c.modelId}: ${toolReliability.error} errors from ${toolReliability.total} traced tool calls, ${formatRouterPercent(toolReliability.errorRate)} error rate, ${toolReliability.firstCallErrors} first-call failures from ${toolReliability.runs} tool-using runs, ${toolReliability.recoveredRuns} recovered runs from ${toolReliability.affectedRuns} affected runs${toolRecovery ? `. Recent recovery path: ${routerToolRecoveryLabel(toolRecovery)}` : ''}${retryReduction ? `. Retry-reduction recommendation: first failed ${retryReduction.failedProviderId || 'unknown'}:${retryReduction.avoidPath}, recovered ${retryReduction.preferPath}, prefer after ${retryReduction.retryDistance} rounds, avg recovery distance ${retryReduction.avgRetryDistance}, source ${retryReduction.evidenceSource}, confidence ${retryReduction.evidenceConfidence} from ${retryReduction.supportRunCount} runs, supporting sessions ${(retryReduction.supportSessionIds || []).join(', ') || retryReduction.sessionId}, supporting runs ${(retryReduction.supportRunIds || []).join(', ') || retryReduction.runId}, tuning action ${retryReduction.tuningAction}, session ${retryReduction.sessionId}, run ${retryReduction.runId}` : ''}${toolPairRisks.length ? `. Risky tool pairs: ${toolPairRisks.map(([pair, stats]) => `${routerToolPairLabel(pair)} ${stats.error}/${stats.total} errors`).join(', ')}` : ''}${promptStrategyReliability.bucket ? `. Prompt strategy ${promptStrategyReliability.strategyId}: ${promptStrategyReliability.bucket.error}/${promptStrategyReliability.bucket.total} tool errors` : ''}`}
                      >
                        <span>
                          Tool reliability · {toolReliability.error}/{toolReliability.total} errors · {formatRouterPercent(toolReliability.errorRate)}
                        </span>
                        <p>
                          {toolReliability.error === 0
                            ? `No tool-call errors in ${toolReliability.total} persisted traced call${toolReliability.total === 1 ? '' : 's'}.`
                            : `${toolReliability.recoveredRuns}/${toolReliability.affectedRuns} tool-error run${toolReliability.affectedRuns === 1 ? '' : 's'} recovered to a final answer; ${toolReliability.firstCallErrors}/${toolReliability.runs} tool-using run${toolReliability.runs === 1 ? '' : 's'} failed on the first call.`}
                        </p>
                        {toolRecovery && (
                          <p>
                            Recent recovery path: {routerToolRecoveryLabel(toolRecovery)} in {toolRecovery.recoveryRounds} round{toolRecovery.recoveryRounds === 1 ? '' : 's'}.
                          </p>
                        )}
                        {toolRecovery && (
                          <p aria-label={`Auto-Router recovery proof for ${c.modelId}: session ${toolRecovery.sessionId}, run ${toolRecovery.runId}`}>
                            Recovery proof: session {toolRecovery.sessionId}, run {toolRecovery.runId}.
                          </p>
                        )}
                        {retryReduction && (
                          <p aria-label={`Auto-Router retry-reduction recommendation for ${c.modelId}: first failed ${retryReduction.failedProviderId || 'unknown'}:${retryReduction.avoidPath}, recovered ${retryReduction.preferPath}, prefer after ${retryReduction.retryDistance} rounds, avg recovery distance ${retryReduction.avgRetryDistance}, source ${retryReduction.evidenceSource}, confidence ${retryReduction.evidenceConfidence} from ${retryReduction.supportRunCount} runs, average retry distance ${retryReduction.avgRetryDistance}, supporting sessions ${(retryReduction.supportSessionIds || []).join(', ') || retryReduction.sessionId}, supporting runs ${(retryReduction.supportRunIds || []).join(', ') || retryReduction.runId}, tuning action ${retryReduction.tuningAction}, provider path avoid ${retryReduction.avoidProviderPath}, provider path prefer ${retryReduction.preferProviderPath}`}>
                            Retry reduction: first failed {retryReduction.failedProviderId || 'unknown'}:{retryReduction.avoidPath}; recovered {retryReduction.preferPath}; prefer after {retryReduction.retryDistance} rounds; avg recovery distance {retryReduction.avgRetryDistance}; source {retryReduction.evidenceSource}; confidence {retryReduction.evidenceConfidence} from {retryReduction.supportRunCount} run{retryReduction.supportRunCount === 1 ? '' : 's'}; supporting sessions {(retryReduction.supportSessionIds || []).join(', ') || retryReduction.sessionId}; supporting runs {(retryReduction.supportRunIds || []).join(', ') || retryReduction.runId}; tuning action {retryReduction.tuningAction}; {retryReduction.tuningGuidance}; provider path avoid {retryReduction.avoidProviderPath}; provider path prefer {retryReduction.preferProviderPath}.
                          </p>
                        )}
                        {toolPairRisks.length > 0 && (
                          <p>
                            Risky tools for this model: {toolPairRisks.map(([pair, stats]) =>
                              `${routerToolPairLabel(pair)} ${stats.error}/${stats.total} errors, first-call ${stats.firstCallErrors}/${stats.runs}`
                            ).join('; ')}.
                          </p>
                        )}
                        {promptStrategyReliability.bucket && (
                          <p>
                            {'Prompt strategy best practice for ${selection.profile.id}: '}
                            {'Use as advisory prompt-contract evidence, not an automatic routing override.'}
                            <br />
                            Prompt strategy {promptStrategyReliability.strategyId}: {promptStrategyReliability.bucket.error}/{promptStrategyReliability.bucket.total} tool errors, first-call {promptStrategyReliability.bucket.firstCallErrors}/{promptStrategyReliability.bucket.runs}
                            {promptStrategyReliability.variants.length > 0
                              ? `; risky variants ${promptStrategyReliability.variants.map(([variant, stats]) => `${variant} ${stats.error}/${stats.total}`).join(', ')}.`
                              : '.'}
                          </p>
                        )}
                        <p className={`eval-proof-status ${toolReliability.error > 0 ? 'needs-attention' : 'approved'}`}>
                          This same evidence is also added to classifier candidate cards for tool-heavy execute scoring.
                        </p>
                      </div>
                    )}
                    <div role="group" aria-label={`Capability and effective-cost controls for Auto-Router candidate ${c.modelId}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, max-content)) minmax(80px, 120px)', gap: 8, alignItems: 'center', marginTop: 6 }}>
                      <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={c.supportsImages}
                          aria-label={`${c.modelId} supports images`}
                          style={{ accentColor: 'var(--accent-color, #6366f1)' }}
                          onChange={(e) => updateCandidate(i, { ...c, supportsImages: e.target.checked })}
                        />
                        Images
                      </label>
                      <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={!!c.supportsThinking}
                          aria-label={`${c.modelId} supports thinking`}
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
                          aria-label={`${c.modelId} effective routing cost`}
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
                      aria-label={`${c.modelId} capability card for classifier routing; describe strengths, weaknesses, and safest task fit`}
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
                    type="button"
                    className="settings-btn-icon"
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, color: 'var(--text-danger, #ef4444)', lineHeight: 1, alignSelf: 'center' }}
                    onClick={() => removeCandidate(i)}
                    title="Remove candidate"
                    aria-label={`Remove auto-router candidate ${c.modelId}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
                );
              })}
              </div>

              {/* Add candidate form */}
              <div role="group" aria-label="Add a new Auto-Router candidate" style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border-color, #e5e7eb)', paddingTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Add Candidate</div>
                <input
                  placeholder="Model ID (e.g. minimax:MiniMax-M3)"
                  value={newCandidate.modelId}
                  aria-label="New Auto-Router candidate model id"
                  style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                  onChange={(e) => setNewCandidate(enrichRouterCandidate({ ...newCandidate, modelId: e.target.value }))}
                />
                <div role="group" aria-label="New Auto-Router candidate capability flags and effective cost" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="Effective cost"
                    value={newCandidate.cost}
                    aria-label="New Auto-Router candidate effective cost"
                    style={{ width: 60, fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                    onChange={(e) => setNewCandidate({ ...newCandidate, cost: parseFloat(e.target.value) || 0 })}
                  />
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={newCandidate.supportsImages}
                      aria-label="New Auto-Router candidate supports images"
                      style={{ accentColor: 'var(--accent-color, #6366f1)' }}
                      onChange={(e) => setNewCandidate({ ...newCandidate, supportsImages: e.target.checked })}
                    />
                    Images
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!newCandidate.supportsThinking}
                      aria-label="New Auto-Router candidate supports thinking"
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
                  aria-label="New Auto-Router candidate capability card; describe strengths, weaknesses, and safest task fit"
                  style={{ fontSize: 12, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary)' }}
                  onChange={(e) => setNewCandidate({ ...newCandidate, card: e.target.value })}
                />
                <button
                  type="button"
                  className="settings-btn"
                  style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 4,
                    border: 'none', cursor: 'pointer',
                    background: 'var(--accent-color, #6366f1)', color: '#fff',
                    alignSelf: 'flex-start',
                  }}
                  onClick={addCandidate}
                  disabled={!newCandidate.modelId.trim()}
                  aria-label={`Add Auto-Router candidate ${newCandidate.modelId.trim() || 'model'}`}
                >
                  <Plus size={12} aria-hidden="true" /> Add
                </button>
              </div>
            </div>
          )}
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
      <button
        className="settings-mini-button"
        type="button"
        onClick={onProbe}
        disabled={probing}
        title="Probe this provider for live health and capabilities"
        aria-label={probing ? 'Provider health probe running' : 'Probe provider health and capabilities; no previous probe summary is available'}
      >
        {probing ? <Loader size={11} className="spin" aria-hidden="true" /> : <Wifi size={11} aria-hidden="true" />}
        Probe health
      </button>
    );
  }
  const status = summary.failed ? 'fail' : summary.stale ? 'stale' : 'ok';
  const healthyCapabilities = summary.latest?.capabilities.filter((c) => c.ok).length ?? 0;
  const totalCapabilities = summary.latest?.capabilities.length ?? 0;
  const label = summary.failed
    ? `last probe failed${summary.latest?.error ? `: ${summary.latest.error.slice(0, 40)}` : ''}`
    : summary.stale
      ? 'health stale'
      : `health OK (${summary.latest?.latencyMs ?? 0}ms, ${healthyCapabilities}/${totalCapabilities} caps)`;
  const actionLabel = summary.failed
    ? `Provider health failed after ${summary.total} probe${summary.total === 1 ? '' : 's'}${summary.latest?.error ? `; latest error ${summary.latest.error.slice(0, 80)}` : ''}. Re-probe provider health and capabilities.`
    : summary.stale
      ? `Provider health is stale after ${summary.total} probe${summary.total === 1 ? '' : 's'}. Re-probe provider health and capabilities.`
      : `Provider health OK after ${summary.total} probe${summary.total === 1 ? '' : 's'}; latest latency ${summary.latest?.latencyMs ?? 0} milliseconds; ${healthyCapabilities} of ${totalCapabilities} capabilities passed. Re-probe provider health and capabilities.`;
  return (
    <button
      className={`settings-mini-button prov-health-badge prov-health-${status}`}
      type="button"
      onClick={onProbe}
      disabled={probing}
      title={`Total probes: ${summary.total}. Click to re-probe.`}
      aria-label={probing ? `Provider health re-probe running; previous status was ${label}` : actionLabel}
    >
      {probing ? <Loader size={11} className="spin" aria-hidden="true" /> : <Wifi size={11} aria-hidden="true" />}
      {label}
    </button>
  );
}
