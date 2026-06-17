import { lazy, Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Message, SubAgent, ProviderConfig, CodingRoleAssignment, HarnessRun, HarnessRunStep, ProjectProfile, SidebarTab, ThinkingEffort, RunSteeringAction } from './types';
import type { PanelId } from './types/layout';
import { ALL_PANELS } from './types/layout';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LayoutEngine } from './components/layout/LayoutEngine';
import { StatusBar } from './components/StatusBar';
import { AgentFocusPanel } from './components/AgentFocusPanel';
import { useLayoutState } from './components/layout/useLayoutState';
import * as api from './utils/api';
import { normalizeThinkingEffort } from './utils/modelCapabilities';
import { pickActiveRunAndPhases } from './utils/agentWorkState';
import {
  applyTheme,
  getInstalledThemePluginManifests,
  hydrateInstalledThemePluginManifests,
  removeImportedTheme,
  resolveThemeId,
} from './theme/builtins';
import { describeAutoRouterRunStep, latestAutoRouterStep } from './utils/autoRouterTrace';
import './styles/global.css';
import './styles/components.css';

// Heavy overlays and the on-demand focus/strip components are loaded
// lazily. They contribute a large share of the initial bundle but are
// only shown after explicit user action or while a run is in flight.
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard').then((m) => ({ default: m.OnboardingWizard })));
const ReviewChangesFlyout = lazy(() => import('./components/ReviewChangesFlyout').then((m) => ({ default: m.ReviewChangesFlyout })));

const uid = () => Math.random().toString(36).slice(2, 10);
const FIXED_SIDEBAR_WIDTH = 260;
const PINNED_TOOLS_KEY = 'openharness.pinned-tools.v1';
const ENVIRONMENT_HIDDEN_KEY = 'openharness.chat-super.hidden.v1';
const CLICKY_ENABLED_KEY = 'openharness.clicky.enabled.v1';
const THEME_TEXTURE_OPACITY_OVERRIDE_KEY = 'openharness.theme.texture-opacity-override.v1';
const NARROW_SIDEBAR_AUTO_CLOSE_WIDTH = 640;
const FORCE_HIDDEN_TOOL_PANELS: PanelId[] = ['sub-agents'];

function sanitizePinnedTools(value: unknown): PanelId[] {
  const knownPanels = new Set<string>(ALL_PANELS);
  const forcedHidden = new Set<string>(FORCE_HIDDEN_TOOL_PANELS);
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is PanelId => (
    typeof id === 'string'
    && knownPanels.has(id)
    && !forcedHidden.has(id)
  ));
}

function loadPinnedTools(): PanelId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(PINNED_TOOLS_KEY) || '[]');
    const sanitized = sanitizePinnedTools(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      localStorage.setItem(PINNED_TOOLS_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return [];
  }
}

function loadEnvironmentOpen() {
  try {
    const raw = localStorage.getItem(ENVIRONMENT_HIDDEN_KEY);
    if (raw === null) return true;
    return raw !== 'true';
  } catch {
    return true;
  }
}

function loadClickyEnabled() {
  try {
    return localStorage.getItem(CLICKY_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function clampThemeTextureOpacity(value: number) {
  return Math.min(0.18, Math.max(0, value));
}

function loadThemeTextureOpacityOverride(): number | null {
  try {
    const raw = localStorage.getItem(THEME_TEXTURE_OPACITY_OVERRIDE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampThemeTextureOpacity(parsed) : null;
  } catch {
    return null;
  }
}

function applyThemeTextureOpacityOverride(value: number) {
  document.documentElement.style.setProperty('--theme-texture-opacity', String(clampThemeTextureOpacity(value)));
}

function describeRunStep(step: HarnessRunStep): string {
  switch (step.type) {
    case 'orchestration': return `${step.label}: ${step.detail || step.mode}`;
    case 'route': return `Routed to ${step.role} using ${step.model}${step.reason ? ` (${step.reason})` : ''}`;
    case 'artifact': return `Created artifact: ${step.artifact.title}`;
    case 'prompt_built': return `Built prompt with ${step.toolCount} available tool${step.toolCount === 1 ? '' : 's'}`;
    case 'auto_router': return describeAutoRouterRunStep(step);
    case 'steering': return `Steering applied: ${step.action}${step.target ? ` (${step.target})` : ''}${step.note ? ` · ${step.note}` : ''}`;
    case 'worktree_isolation': return step.status === 'ready'
      ? `Worktree isolation ready for ${step.agent}: ${step.worktreeId || step.branch || step.path || 'isolated checkout'}`
      : step.status === 'preserved'
        ? `Worktree preserved for Safety review for ${step.agent}: ${step.worktreeId || step.branch || step.path || 'isolated checkout'}`
      : step.status === 'auto_discarded'
        ? `Clean worktree auto-discarded for ${step.agent}: ${step.worktreeId || step.branch || step.path || 'isolated checkout'}`
      : `Worktree isolation ${step.status} for ${step.agent}: ${step.error || step.reason}`;
    case 'model_request': return `Sent model request round ${step.round} to ${step.model}`;
    case 'tool_call': return step.durationMs == null ? `Started tool: ${step.name}` : `Finished tool: ${step.name} in ${step.durationMs}ms`;
    case 'model_text': return `Received ${step.chars} characters from model`;
    case 'model_thinking': return step.source === 'router'
      ? `Captured router rationale (${step.chars} characters)`
      : `Captured ${step.chars} characters of model thinking`;
    case 'final_answer': return `Final answer ready (${step.chars} characters)`;
    case 'error': return `Error: ${step.message}`;
    case 'repo_map': return `Repo map: ${step.totalFiles} files, ${step.tokenBudget} token budget${step.truncated ? ' (truncated)' : ''}`;
    case 'context_pack': return `Context pack "${step.pack}": ${step.files.length} files (${step.tokens} tokens) — ${step.suggestion}`;
  }
}

function basename(p: string) {
  return p.split('/').filter(Boolean).pop() || p;
}

function providerIsConfigured(provider: any): boolean {
  return !!provider.hasKey || provider.type === 'local' || provider.accessMode === 'subscription';
}

function formatStreamError(error: string): string {
  const raw = error || 'Unknown stream error';
  const jsonStart = raw.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart));
      const message = parsed?.error?.message || parsed?.message;
      if (message) {
        const prefix = raw.slice(0, jsonStart).trim().replace(/\s+$/, '');
        return prefix ? `${prefix}: ${message}` : message;
      }
    } catch {
      // Fall back to the raw error string below.
    }
  }
  return raw;
}

function orchestrationAgentId(runId: string, label: string): string {
  return `${runId}:phase:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phase'}`;
}

function isVisibleOrchestrationPhase(label: string): boolean {
  return !/^(plan|investigate|execute|compare) mode$/i.test(label);
}

function parsePhaseDetail(detail?: string): { model?: string; status?: SubAgent['status']; durationMs?: number } {
  if (!detail) return {};
  const model = detail.match(/\bmodel=([^\s]+)/)?.[1];
  const rawStatus = detail.match(/\bstatus=(complete|error|running|idle|blocked)\b/)?.[1] as SubAgent['status'] | undefined;
  const durationMs = Number(detail.match(/\bduration=(\d+)ms\b/)?.[1]);
  return {
    model,
    status: rawStatus,
    durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
  };
}

function buildSubAgentsFromLoadedMessages(rawMessages: api.MessageInfo[]): SubAgent[] {
  type LoadedRun = { run: api.HarnessRun; sourceTime: number };
  const latestRunsById = new Map<string, LoadedRun>();

  rawMessages.forEach((message) => {
    const run = message.runTrace;
    if (!run) return;
    const sourceTime = new Date(message.timestamp).getTime();
    const normalizedSourceTime = Number.isFinite(sourceTime) ? sourceTime : 0;
    const existing = latestRunsById.get(run.id);
    if (!existing || normalizedSourceTime >= existing.sourceTime) {
      latestRunsById.set(run.id, { run, sourceTime: normalizedSourceTime });
    }
  });

  if (latestRunsById.size === 0) return [];

  const agents: SubAgent[] = [];

  Array.from(latestRunsById.values())
    .sort((a, b) => b.sourceTime - a.sourceTime)
    .forEach(({ run }) => {
      const startedAt = new Date(run.startedAt);
      const completedAt = run.completedAt ? new Date(run.completedAt) : undefined;
      const runStatus: SubAgent['status'] = run.status === 'error' ? 'error' : run.status === 'running' ? 'running' : 'complete';
      const runSteps = run.steps || [];
      const runModel = run.effectiveModel || run.requestedModel || 'Auto';
      const runTask = runSteps.length ? describeRunStep(runSteps[runSteps.length - 1]) : `Run ${run.role}`;
      const normalizedStartTime = Number.isFinite(startedAt.getTime()) ? startedAt : new Date();
      const normalizedCompletedAt = completedAt && Number.isFinite(completedAt.getTime()) ? completedAt : undefined;
      const runStartMs = normalizedStartTime.getTime();
      const runMessages = runSteps.map((step, index) => ({
        id: `${run.id}:trace-step:${index}`,
        role: 'system' as const,
        content: describeRunStep(step),
        timestamp: new Date(runStartMs + index),
        status: 'complete' as const,
      }));

      const runAgent: SubAgent = {
        id: run.id,
        name: `${run.role} run`,
        model: runModel,
        status: runStatus,
        task: runTask,
        progress: runStatus === 'running' ? 90 : 100,
        startTime: normalizedStartTime,
        endTime: normalizedCompletedAt,
        tokensUsed: run.context.tokensUsed,
        messages: runMessages,
        runTrace: run,
      };
      agents.push(runAgent);

      const phaseTrace = runSteps
        .filter((step): step is Extract<HarnessRunStep, { type: 'orchestration' }> => step.type === 'orchestration' && isVisibleOrchestrationPhase(step.label));

      const phasesById = new Map<string, SubAgent>();
      phaseTrace.forEach((step, index) => {
        const phaseId = orchestrationAgentId(run.id, step.label);
        const detail = parsePhaseDetail(step.detail);
        const phaseIsLast = index === phaseTrace.length - 1;
        const inferredStatus: SubAgent['status'] = detail.status
          || (run.status === 'error'
            ? (phaseIsLast ? 'error' : 'complete')
            : run.status === 'running'
              ? (phaseIsLast ? 'running' : 'complete')
              : 'complete');
        const phaseRunModel = detail.model || runModel;
        const phaseStart = new Date(runStartMs + index + 1);
        const phaseMessage = {
          id: `${run.id}:phase-step:${phaseId}`,
          role: 'system' as const,
          content: describeRunStep(step),
          timestamp: phaseStart,
          status: 'complete' as const,
        };
        const previous = phasesById.get(phaseId);
        const durationMs = detail.durationMs;
        const baseAgent: SubAgent = {
          id: phaseId,
          name: step.label,
          model: phaseRunModel,
          status: inferredStatus,
          task: step.detail || describeRunStep(step),
          progress: inferredStatus === 'running' ? 80 : inferredStatus === 'error' || inferredStatus === 'blocked' || inferredStatus === 'complete' ? 100 : 0,
          startTime: phaseStart,
          endTime: durationMs != null ? new Date(phaseStart.getTime() + durationMs) : normalizedCompletedAt,
          messages: [phaseMessage],
          runTrace: run,
        };
        phasesById.set(phaseId, previous ? {
          ...baseAgent,
          status: inferredStatus,
          task: step.detail || describeRunStep(step),
          progress: inferredStatus === 'running' ? 80 : inferredStatus === 'error' || inferredStatus === 'blocked' || inferredStatus === 'complete' ? 100 : 0,
          model: phaseRunModel,
          messages: [...(previous.messages || []), phaseMessage],
          endTime: durationMs != null ? new Date(phaseStart.getTime() + durationMs)
            : previous.endTime,
        } : baseAgent);
      });

      phasesById.forEach((phase) => agents.push(phase));
    });

  return agents;
}

function runStepMeansWork(step: HarnessRunStep): boolean {
  if (step.type === 'model_request' || step.type === 'model_text' || step.type === 'model_thinking' || step.type === 'prompt_built' || step.type === 'repo_map' || step.type === 'context_pack') return true;
  if (step.type === 'worktree_isolation') return step.status !== 'ready';
  if (step.type === 'tool_call') return step.durationMs == null;
  return false;
}

const DEFAULT_ROLE_ASSIGNMENTS: CodingRoleAssignment[] = [
  { id: 'planner', name: 'Planner', description: 'Research, architecture decisions, breaking down tasks', modelId: 'Auto' },
  { id: 'coder', name: 'Code Implementer', description: 'Writing code, fixes, debugging, and refactoring', modelId: 'Auto' },
  { id: 'reviewer', name: 'Code Reviewer', description: 'Reviewing PRs, finding correctness and security issues', modelId: 'Auto' },
  { id: 'reasoner', name: 'Reasoner', description: 'Complex analysis, comparisons, and tradeoffs', modelId: 'Auto' },
  { id: 'summarizer', name: 'Summarizer', description: 'Condensing files, threads, and long outputs', modelId: 'Auto' },
  { id: 'worker', name: 'Tool Runner', description: 'Fast shell, file, and utility tasks', modelId: 'Auto' },
];

function legacyRoleModel(assignments: Record<string, string>, roleId: string): string | undefined {
  const currentToLegacy: Record<string, string[]> = {
    planner: ['planning'],
    coder: ['implementation', 'bugfix', 'design'],
    reviewer: ['review'],
    worker: ['toolrunning', 'image'],
  };
  return currentToLegacy[roleId]?.map((legacy) => assignments[legacy]).find(Boolean);
}

function roleMapToAssignments(assignments: Record<string, string>): CodingRoleAssignment[] {
  return DEFAULT_ROLE_ASSIGNMENTS.map((role) => ({
    ...role,
    modelId: assignments[role.id] || legacyRoleModel(assignments, role.id) || role.modelId,
  }));
}

function defaultRoleThinking(): Record<string, ThinkingEffort> {
  return {
    planner: 'medium',
    coder: 'medium',
    reviewer: 'high',
    reasoner: 'xhigh',
    summarizer: 'low',
    worker: 'low',
  };
}

function App() {
  const [sessions, setSessions] = useState<api.SessionInfo[]>([]);
  const sidebarWidth = FIXED_SIDEBAR_WIDTH;
  const [pinnedTools, setPinnedTools] = useState<PanelId[]>(loadPinnedTools);
  const [environmentOpen, setEnvironmentOpen] = useState(loadEnvironmentOpen);
  const [clickyEnabled, setClickyEnabled] = useState(loadClickyEnabled);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const savedProofMessageIdsRef = useRef(new Set<string>());
  const [workingDir, setWorkingDir] = useState<string | null>(null);
  const [projectProfile, setProjectProfile] = useState<ProjectProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('projects');
  const [isTyping, setIsTyping] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState('Auto');
  const [thinkingEffort, setThinkingEffort] = useState<ThinkingEffort>('medium');
  const [roleThinking, setRoleThinking] = useState<Record<string, ThinkingEffort>>(defaultRoleThinking);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<CodingRoleAssignment[]>(DEFAULT_ROLE_ASSIGNMENTS);
  const [activeTheme, setActiveTheme] = useState('midnight');
  const [textureOpacityOverride, setTextureOpacityOverride] = useState<number | null>(loadThemeTextureOpacityOverride);
  const [, setInstalledThemeManifests] = useState<string[]>([]);
  const [personalityText, setPersonalityText] = useState('');
  const [mcpServers, setMcpServers] = useState<import('./types').MCPServerItem[]>([]);
  const [mcpStatus, setMcpStatus] = useState<api.MCPServerStatus[]>([]);

  useEffect(() => {
    const closeSidebarForNarrowScreens = () => {
      if (window.innerWidth <= NARROW_SIDEBAR_AUTO_CLOSE_WIDTH) {
        setSidebarOpen(false);
      }
    };
    closeSidebarForNarrowScreens();
    window.addEventListener('resize', closeSidebarForNarrowScreens);
    return () => window.removeEventListener('resize', closeSidebarForNarrowScreens);
  }, []);
  const [providerRateLimitStatus, setProviderRateLimitStatus] = useState<api.ProviderRateLimitStatus | null>(null);
  const [modelContextWindows, setModelContextWindows] = useState<Map<string, number>>(new Map());
  const [contextWarning, setContextWarning] = useState<string | null>(null);
  const [trustMode, setTrustMode] = useState('workspace-write');
  const [favoriteModelIds, setFavoriteModelIds] = useState<string[]>([]);
  const [configPath, setConfigPath] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingPatchProposalId, setPendingPatchProposalId] = useState<string | null>(null);
  const [snapOverlayVisible, setSnapOverlayVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [reviewFlyoutOpen, setReviewFlyoutOpen] = useState(false);
  const [reviewFlyoutTab, setReviewFlyoutTab] = useState<'summary' | 'files' | 'patches' | 'validate' | 'commit'>('summary');
  const [focusedSubAgentId, setFocusedSubAgentId] = useState<string | null>(null);
  const [agentFocusOpen, setAgentFocusOpen] = useState(false);
  const [lastAutoRouterStep, setLastAutoRouterStep] = useState<Extract<HarnessRunStep, { type: 'auto_router' }> | null>(null);
  const { layout, togglePanel, removePanel, resetLayout, addPanel } = useLayoutState();

  const streamingTextRef = useRef<Map<string, string>>(new Map());
  const enabledModelsForPanels = useMemo(() => providers.flatMap((provider) =>
    provider.configured
      ? provider.models.filter((model) => model.enabled).map((model) => ({
          ...model,
          providerId: provider.id,
          providerName: provider.name,
        }))
      : []
  ), [providers]);

  // Listen for Electron IPC events (snap zones, menu actions)
  useEffect(() => {
    const native = (window as any).OpenHarnessNative;
    if (!native?.onMenuAction) return;
    native.onMenuAction(async (action: string, path?: string) => {
      if (action === 'show-snap-zones') {
        setSnapOverlayVisible(true);
        setTimeout(() => setSnapOverlayVisible(false), 3000);
      }
      if (action === 'open-preferences') setSettingsOpen(true);
      if (action === 'new-session') {
        const session = await api.createSession();
        setSessions((prev) => [{
          id: session.id,
          title: session.title,
          workingDir: session.workingDir || null,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          preview: '',
          messageCount: 0,
        }, ...prev]);
        setActiveSessionId(session.id);
        setWorkingDir(session.workingDir || null);
        setMessages([]);
        setLastAutoRouterStep(null);
        setSubAgents([]);
        setFocusedSubAgentId(null);
      }
      if (action === 'open-folder' && path) {
        const session = await api.createSession(basename(path), path);
        setSessions((prev) => [{
          id: session.id,
          title: basename(path),
          workingDir: path,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          preview: '',
          messageCount: 0,
        }, ...prev]);
        setActiveSessionId(session.id);
        setWorkingDir(path);
        setMessages([]);
        setLastAutoRouterStep(null);
        setSubAgents([]);
        setFocusedSubAgentId(null);
      }
    });
  }, []);

  // Poll MCP status
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const status = await api.getMCPStatus();
        if (mounted) setMcpStatus(status);
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const refreshMcpStatus = useCallback(async () => {
    try {
      const status = await api.getMCPStatus();
      setMcpStatus(status);
    } catch { /* ignore */ }
  }, []);

  // Keyboard shortcut: ⇧⌘S or ⌘\ opens the left side chat.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      // ⇧⌘S — explicit toggle
      if (e.shiftKey && key === 's') {
        e.preventDefault();
        setSidebarOpen(true);
        setSidebarTab('chat');
        return;
      }
      // ⌘\ — also toggles
      if (!e.shiftKey && e.key === '\\') {
        e.preventDefault();
        setSidebarOpen(true);
        setSidebarTab('chat');
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Load project profile whenever the active folder changes.
  useEffect(() => {
    let cancelled = false;
    if (!workingDir) { setProjectProfile(null); return; }
    api.getProjectProfile(workingDir)
      .then((profile) => { if (!cancelled) setProjectProfile(profile as ProjectProfile); })
      .catch((err) => { console.error('Failed to load project profile:', err); if (!cancelled) setProjectProfile(null); });
    return () => { cancelled = true; };
  }, [workingDir]);

  // Load config from server on mount
  useEffect(() => {
    applyTheme('midnight');
    (async () => {
      try {
        const config = await api.getConfig();
        if (config) {
          setConfigPath(config.configPath || '');
          setActiveModel(config.activeModel || 'Auto');
          setThinkingEffort(normalizeThinkingEffort(config.thinkingEffort));
          setRoleThinking({ ...defaultRoleThinking(), ...(config.roleThinking || {}) });
          const hydrateResult = hydrateInstalledThemePluginManifests(Array.isArray(config.installedThemePluginManifests)
            ? config.installedThemePluginManifests
            : []);
          const restoredThemeManifests = hydrateResult.persistedManifests;
          setInstalledThemeManifests(restoredThemeManifests);
          if (restoredThemeManifests.length > 0) {
            const normalized = [...new Set(restoredThemeManifests.filter((entry) => typeof entry === 'string' && entry.length > 0))];
            if (JSON.stringify(normalized) !== JSON.stringify(restoredThemeManifests) || !Array.isArray(config.installedThemePluginManifests)) {
              api.updateConfig({ installedThemePluginManifests: normalized }).catch(() => {});
            }
          } else if ((config.installedThemePluginManifests || []).length > 0) {
            api.updateConfig({ installedThemePluginManifests: [] }).catch(() => {});
          }
          const resolvedTheme = resolveThemeId(config.activeTheme);
          setActiveTheme(resolvedTheme);
          applyTheme(resolvedTheme);
          if (config.activeTheme && config.activeTheme !== resolvedTheme) {
            api.updateConfig({ activeTheme: resolvedTheme }).catch(() => {});
          }
          setPersonalityText(config.personality || '');
          setFavoriteModelIds(Array.isArray(config.favoriteModels) ? config.favoriteModels : []);
          if (config.providers?.length > 0) {
            setProviders(config.providers.map((p: any) => ({
              id: p.id,
              name: p.name,
              type: p.type || 'openai-compatible',
              endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
              configured: providerIsConfigured(p),
              accessMode: p.accessMode,
              planId: p.planId,
              oauth: p.oauth,
              models: p.models || [],
            })));
          }
          if (config.roleAssignments) {
            setRoleAssignments((prev) =>
              prev.map((r) => ({
                ...r,
                modelId: config.roleAssignments?.[r.id] || legacyRoleModel(config.roleAssignments, r.id) || r.modelId,
              }))
            );
          if (config.trustMode) setTrustMode(config.trustMode);
          }
        }
        const servers = await api.getMCPServers();
        if (servers.length > 0) setMcpServers(servers);
        const models = await api.getModels();
        if (models.length > 0) {
          const ctxMap = new Map<string, number>();
          for (const m of models) ctxMap.set(m.id, m.contextWindowTokens);
          setModelContextWindows(ctxMap);
        }

        // Show onboarding if no providers have keys
        const hasKey = (config?.providers || []).some((p: any) =>
          providerIsConfigured(p) || (p.apiKey && p.apiKey.startsWith('••••'))
        );
        if (!hasKey) setShowOnboarding(true);
      } catch { /* use defaults */ }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await api.getProviderRateLimitStatus();
        if (!cancelled) setProviderRateLimitStatus(status);
      } catch {
        if (!cancelled) setProviderRateLimitStatus(null);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (textureOpacityOverride !== null) {
      applyThemeTextureOpacityOverride(textureOpacityOverride);
    }
  }, [activeTheme, textureOpacityOverride]);

  // ── Provider / model handlers ──────────────────────
  const handleSelectModel = useCallback((modelId: string) => {
    const oldCtx = modelContextWindows.get(activeModel) || 0;
    const newCtx = modelContextWindows.get(modelId) || 0;
    if (oldCtx > 0 && newCtx > 0 && newCtx < oldCtx * 0.5) {
      const oldLabel = oldCtx >= 1_000_000 ? `${(oldCtx / 1_000_000).toFixed(0)}M` : `${Math.round(oldCtx / 1024)}K`;
      const newLabel = newCtx >= 1_000_000 ? `${(newCtx / 1_000_000).toFixed(0)}M` : `${Math.round(newCtx / 1024)}K`;
      setContextWarning(`Switching from ${oldLabel} to ${newLabel} context — older messages may be dropped.`);
      setTimeout(() => setContextWarning(null), 5000);
    }
    setActiveModel(modelId);
    api.updateConfig({ activeModel: modelId }).catch(() => {});
  }, [activeModel, modelContextWindows]);

  const handleToggleProviderModel = useCallback((providerId: string, modelId: string) => {
    setProviders((prev) => {
      const next = prev.map((prov) =>
        prov.id === providerId
          ? {
              ...prov,
              models: prov.models.map((m) =>
                m.id === modelId ? { ...m, enabled: !m.enabled } : m
              ),
            }
          : prov
      );
      // Persist the updated models list
      const serverProvider = next.find((p) => p.id === providerId);
      if (serverProvider) {
        api.updateProvider(providerId, { models: serverProvider.models } as any).catch(() => {});
      }
      return next;
    });
  }, []);

  const handleUpdateProvider = useCallback(async (providerId: string, updates: { apiKey?: string; baseURL?: string; type?: string; accessMode?: 'api-key' | 'subscription'; planId?: string; models?: any[] }) => {
    await api.updateProvider(providerId, updates as any);
    const fresh = await api.getProviders();
    setProviders(fresh.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type || 'openai-compatible',
      endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
      configured: providerIsConfigured(p),
      accessMode: p.accessMode,
      planId: p.planId,
      oauth: p.oauth,
      models: p.models || [],
    })));
  }, []);

  const handleAssignRoleModel = useCallback((roleId: string, modelId: string) => {
    setRoleAssignments((prev) => {
      const next = prev.map((r) => (r.id === roleId ? { ...r, modelId } : r));
      const map: Record<string, string> = {};
      next.forEach((r) => { map[r.id] = r.modelId; });
      api.updateConfig({ roleAssignments: map }).catch(() => {});
      return next;
    });
  }, []);

  const handleThinkingEffortChange = useCallback((effort: ThinkingEffort) => {
    setThinkingEffort(effort);
    api.updateConfig({ thinkingEffort: effort }).catch(() => {});
  }, []);

  const handleAssignRoleThinking = useCallback((roleId: string, effort: ThinkingEffort) => {
    setRoleThinking((prev) => {
      const next = { ...prev, [roleId]: effort };
      api.updateConfig({ roleThinking: next }).catch(() => {});
      return next;
    });
  }, []);

  const handleToggleFavoriteModel = useCallback((modelId: string) => {
    setFavoriteModelIds((prev) => {
      const next = prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId];
      api.updateConfig({ favoriteModels: next }).catch(() => {});
      return next;
    });
  }, []);

  const handleSelectTheme = useCallback((themeId: string) => {
    const resolvedThemeId = applyTheme(themeId);
    if (textureOpacityOverride !== null) {
      applyThemeTextureOpacityOverride(textureOpacityOverride);
    }
    setActiveTheme(resolvedThemeId);
    api.updateConfig({ activeTheme: resolvedThemeId }).catch(() => {});
  }, [textureOpacityOverride]);

  const handleTextureOpacityOverrideChange = useCallback((value: number | null) => {
    if (value === null) {
      try { localStorage.removeItem(THEME_TEXTURE_OPACITY_OVERRIDE_KEY); } catch { /* ignore */ }
      setTextureOpacityOverride(null);
      applyTheme(activeTheme);
      return;
    }
    const next = clampThemeTextureOpacity(value);
    try { localStorage.setItem(THEME_TEXTURE_OPACITY_OVERRIDE_KEY, String(next)); } catch { /* ignore */ }
    setTextureOpacityOverride(next);
    applyThemeTextureOpacityOverride(next);
  }, [activeTheme]);

  const handleThemePluginManifestsChange = useCallback((themeManifests: string[]) => {
    const normalized = [...new Set(themeManifests
      .filter((entry) => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0))];
    setInstalledThemeManifests(normalized);
    api.updateConfig({ installedThemePluginManifests: normalized }).catch(() => {});
  }, []);

  const handleRemoveTheme = useCallback((themeId: string) => {
    const removed = removeImportedTheme(themeId);
    if (!removed) return;
    handleThemePluginManifestsChange(getInstalledThemePluginManifests());
    if (activeTheme === themeId) {
      const resolvedFallback = applyTheme(resolveThemeId('midnight'));
      setActiveTheme(resolvedFallback);
      api.updateConfig({ activeTheme: resolvedFallback }).catch(() => {});
    }
  }, [activeTheme, handleThemePluginManifestsChange]);

  const handlePersonalityChange = useCallback((text: string) => {
    setPersonalityText(text);
    api.updateConfig({ personality: text }).catch(() => {});
  }, []);

  // ── Provider management handlers ─────────────────────
  const handleAddProvider = useCallback(async (provider: { name: string; type: string; apiKey: string; baseURL: string; accessMode?: 'api-key' | 'subscription'; planId?: string }) => {
    const result = await api.addProvider(provider);
    // Re-fetch providers from server
    const fresh = await api.getProviders();
    setProviders(fresh.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type || 'openai-compatible',
      endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
      configured: providerIsConfigured(p),
      accessMode: p.accessMode,
      planId: p.planId,
      oauth: p.oauth,
      models: p.models || [],
    })));
    return result;
  }, []);

  const handleTestProvider = useCallback(async (providerId: string, tempKey?: string) => {
    return await api.testProviderConnection(providerId, tempKey);
  }, []);

  const handleFetchModels = useCallback(async (providerId: string, tempKey?: string) => {
    const models = await api.fetchProviderModels(providerId, tempKey);
    // Update the provider's model list by saving to server then refreshing
    const fresh = await api.getProviders();
    setProviders(fresh.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type || 'openai-compatible',
      endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
      configured: providerIsConfigured(p),
      accessMode: p.accessMode,
      planId: p.planId,
      oauth: p.oauth,
      models: p.models || [],
    })));
    return models;
  }, []);

  const handleRemoveProvider = useCallback((providerId: string) => {
    api.deleteProvider(providerId).then(async () => {
      const fresh = await api.getProviders();
      setProviders(fresh.map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type || 'openai-compatible',
        endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
        configured: providerIsConfigured(p),
        accessMode: p.accessMode,
        planId: p.planId,
        oauth: p.oauth,
        models: p.models || [],
      })));
    }).catch(() => {});
  }, []);

  // ── MCP server management handlers ───────────────────
  const handleAddMCPServer = useCallback(async (server: { name: string; endpoint: string; authType: string; authToken: string }) => {
    const result = await api.addMCPServer(server);
    const servers = await api.getMCPServers();
    setMcpServers(servers);
    return result;
  }, []);

  const handleRemoveMCPServer = useCallback((serverId: string) => {
    api.deleteMCPServer(serverId).then(async () => {
      const servers = await api.getMCPServers();
      setMcpServers(servers);
    }).catch(() => {});
  }, []);

  // Load sessions on mount
  useEffect(() => {
    (async () => {
      try {
        let list = await api.listSessions();
        if (list.length === 0) {
          const session = await api.createSession();
          list = [{
            id: session.id,
            title: session.title,
            workingDir: session.workingDir || null,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            preview: '',
            messageCount: 0,
          }];
        }
        setSessions(list);
        setActiveSessionId(list[0].id);
        setWorkingDir(list[0].workingDir);
        const detail = await api.getSession(list[0].id);
        applyLoadedMessages(detail.messages, setMessages, setLastAutoRouterStep, setSubAgents, setFocusedSubAgentId);
      } catch (err) {
        console.error('Failed to load sessions:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectSession = useCallback(async (id: string) => {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    try {
      const detail = await api.getSession(id);
      setWorkingDir(detail.workingDir || null);
      applyLoadedMessages(detail.messages, setMessages, setLastAutoRouterStep, setSubAgents, setFocusedSubAgentId);
    } catch (err) {
      console.error('Failed to load session:', err);
      setMessages([]);
      setLastAutoRouterStep(null);
      setSubAgents([]);
      setFocusedSubAgentId(null);
    }
  }, [activeSessionId]);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await api.deleteSession(id);
      let fresh = await api.listSessions();
      if (fresh.length === 0) {
        const session = await api.createSession();
        fresh = [{
          id: session.id,
          title: session.title,
          workingDir: session.workingDir || null,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          preview: '',
          messageCount: 0,
        }];
      }
      setSessions(fresh);
      if (id === activeSessionId) {
        const next = fresh[0];
        setActiveSessionId(next.id);
        setWorkingDir(next.workingDir || null);
        const detail = await api.getSession(next.id);
        applyLoadedMessages(detail.messages, setMessages, setLastAutoRouterStep, setSubAgents, setFocusedSubAgentId);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }, [activeSessionId]);

  const handleDeleteProject = useCallback(async (workingDir: string | null) => {
    try {
      const targets = sessions.filter((session) => (session.workingDir || null) === workingDir);
      await Promise.all(targets.map((session) => api.deleteSession(session.id)));
      let fresh = await api.listSessions();
      if (fresh.length === 0) {
        const session = await api.createSession();
        fresh = [{
          id: session.id,
          title: session.title,
          workingDir: session.workingDir || null,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          preview: '',
          messageCount: 0,
        }];
      }
      setSessions(fresh);
      if (targets.some((session) => session.id === activeSessionId)) {
        const next = fresh[0];
        setActiveSessionId(next.id);
        setWorkingDir(next.workingDir || null);
        const detail = await api.getSession(next.id);
        applyLoadedMessages(detail.messages, setMessages, setLastAutoRouterStep, setSubAgents, setFocusedSubAgentId);
      }
    } catch (err) {
      console.error('Failed to delete project sessions:', err);
    }
  }, [activeSessionId, sessions]);

  const handleNewSession = useCallback(async (targetWorkingDir?: string | null) => {
    try {
      const sessionWorkingDir = targetWorkingDir === undefined ? workingDir : targetWorkingDir;
      const session = await api.createSession(undefined, sessionWorkingDir || undefined);
      setSessions((prev) => [{
        id: session.id,
        title: session.title,
        workingDir: session.workingDir || null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        preview: '',
        messageCount: 0,
      }, ...prev]);
      setActiveSessionId(session.id);
      setWorkingDir(session.workingDir || null);
      setMessages([]);
      setLastAutoRouterStep(null);
      setSubAgents([]);
      setFocusedSubAgentId(null);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }, [workingDir]);

  const handleOpenFolder = useCallback(async () => {
    try {
      const folderPath = await api.openFolderDialog();
      if (!folderPath) return; // user cancelled

      // Create a new session with this working dir
      const session = await api.createSession(basename(folderPath), folderPath);
      const sessionInfo: api.SessionInfo = {
        id: session.id,
        title: basename(folderPath),
        workingDir: folderPath,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        preview: '',
        messageCount: 0,
      };
      setSessions((prev) => [sessionInfo, ...prev]);
      setActiveSessionId(session.id);
      setWorkingDir(folderPath);
      setMessages([]);
      setLastAutoRouterStep(null);
      setSubAgents([]);
      setFocusedSubAgentId(null);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  }, []);


  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId;
    try {
      const session = await api.createSession(undefined, workingDir || undefined);
      setSessions((prev) => [{
        id: session.id,
        title: session.title,
        workingDir: session.workingDir || null,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        preview: '',
        messageCount: 0,
      }, ...prev]);
      setActiveSessionId(session.id);
      setWorkingDir(session.workingDir || null);
      return session.id;
    } catch (err) {
      console.error('Failed to create session:', err);
      return null;
    }
  }, [activeSessionId, workingDir]);

  const handleSendMessage = useCallback(async (content: string) => {
    if (isTyping) return;
    const sessionId = await ensureSession();
    if (!sessionId) return;

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'complete',
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setLastAutoRouterStep(null);

    // Real activity subagent — tracks what the model is actually doing
    const activityAgent: SubAgent = {
      id: uid(),
      name: activeModel,
      model: activeModel,
      status: 'running',
      task: 'Processing your request...',
      progress: 10,
      startTime: new Date(),
      tokensUsed: 0,
    };
    // Keep any prior agents and seed the activity placeholder without clobbering
    // existing entries, so multi-run messages accumulate visible sub-agent cards.
    setSubAgents((prev) => {
      if (prev.some((a) => a.id === activityAgent.id)) return prev;
      return [...prev, activityAgent];
    });

    const assistantId = uid();
    streamingTextRef.current.set(assistantId, '');
    let streamFailed = false;

    try {
      await api.sendMessage(sessionId, content, {
        onUserMessage: () => {},
        onSessionTitle: (updatedSessionId, title) => {
          setSessions((prev) => prev.map((session) =>
            session.id === updatedSessionId
              ? { ...session, title, updatedAt: new Date().toISOString() }
              : session
          ));
        },
        onAssistantStart: () => {
          setMessages((prev) => [...prev, {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            status: 'streaming',
          }]);
        },
        onText: (_id, text) => {
          streamingTextRef.current.set(
            assistantId,
            (streamingTextRef.current.get(assistantId) || '') + text
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: streamingTextRef.current.get(assistantId) || '' }
                : m
            )
          );
        },
        onThinking: (_id, chars, message, preview) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, thinkingChars: chars, thinkingStatus: message, thinkingPreview: preview }
                : m
            )
          );
        },
        onAssistantMessage: (msg) => {
          const finalContent = msg.content || streamingTextRef.current.get(assistantId) || '';
          streamingTextRef.current.set(assistantId, finalContent);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: finalContent, status: 'complete' as const, thinkingChars: undefined, thinkingStatus: undefined, thinkingPreview: undefined }
                : m
            )
          );
        },
        onToolCall: (tc) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;
              const existing = m.toolCalls || [];
              const index = existing.findIndex((tool) => tool.id === tc.id);
              const nextTool = { id: tc.id, name: tc.name, status: tc.status, input: tc.input, output: tc.output, duration: tc.duration };
              const toolCalls = index >= 0
                ? existing.map((tool, i) => (i === index ? { ...tool, ...nextTool } : tool))
                : [...existing, nextTool];
              return { ...m, toolCalls };
            })
          );
          // Update activity agent with real tool status
          if (tc.status === 'running') {
            setSubAgents((prev) =>
              prev.map((a) =>
                a.status === 'running'
                  ? { ...a, task: `Using tool: ${tc.name}`, progress: Math.min(90, (a.progress || 10) + 15) }
                  : a
              )
            );
          }
        },
        onRunStart: (run) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, runTrace: run } : m)));
          // Promote the optimistic activity placeholder into the real run card
          // so a single active task does not render as two agents.
          setSubAgents((prev) => {
            const next: SubAgent = {
              id: run.id,
              name: `${run.role} run`,
              model: run.effectiveModel,
              status: 'running',
              task: 'Starting run...',
              progress: 5,
              startTime: new Date(run.startedAt),
              messages: [],
              runTrace: run,
            };
            const idx = prev.findIndex((a) => a.id === run.id || a.id === activityAgent.id);
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = { ...prev[idx], ...next };
              return copy.filter((agent, agentIdx) => agentIdx === idx || agent.id !== activityAgent.id);
            }
            return [...prev, next];
          });
        },
        onRunStep: (runId, step) => {
          const stepText = describeRunStep(step);
          if (step.type === 'auto_router') setLastAutoRouterStep(step);
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantId || !m.runTrace) return m;
            const nextMessage = { ...m, runTrace: { ...m.runTrace, steps: [...m.runTrace.steps, step] } };
            if (step.type !== 'tool_call') return nextMessage;
            const existing = nextMessage.toolCalls || [];
            const index = existing.findIndex((tool) => tool.id === step.id);
            const nextTool = {
              id: step.id,
              name: step.name,
              status: step.durationMs == null ? 'running' as const : 'complete' as const,
              input: typeof step.input === 'string' ? step.input : JSON.stringify(step.input),
              output: step.outputPreview,
              duration: step.durationMs,
            };
            const toolCalls = index >= 0
              ? existing.map((tool, i) => (i === index ? { ...tool, ...nextTool } : tool))
              : [...existing, nextTool];
            return { ...nextMessage, toolCalls };
          }));
        if (step.type === 'orchestration' && isVisibleOrchestrationPhase(step.label)) {
            const phase = parsePhaseDetail(step.detail);
            const phaseId = orchestrationAgentId(runId, step.label);
            setSubAgents((prev) => {
              const existing = prev.find((a) => a.id === phaseId);
            const nextStatus = phase.status || existing?.status || 'idle';
            const isTerminalPhase = nextStatus === 'complete' || nextStatus === 'error' || nextStatus === 'blocked';
            const nextAgent: SubAgent = {
                ...(existing || {
                  id: phaseId,
                  name: step.label,
                  model: phase.model || 'Auto',
                  startTime: new Date(),
                  messages: [],
                }),
                model: phase.model || existing?.model || 'Auto',
                status: nextStatus,
                task: step.detail || stepText,
                progress: nextStatus === 'running'
                  ? Math.min(90, (existing?.progress || 10) + 20)
                  : isTerminalPhase
                    ? 100
                    : existing?.progress || 0,
                endTime: isTerminalPhase ? new Date() : existing?.endTime,
                messages: [
                  ...(existing?.messages || []),
                  { id: uid(), role: 'system', content: stepText, timestamp: new Date(), status: 'complete' as const },
                ],
                runTrace: existing?.runTrace,
              };
              return existing
                ? prev.map((a) => (a.id === phaseId ? nextAgent : a))
                : [...prev, nextAgent];
            });
          }
          if (runStepMeansWork(step)) {
            let promotedPhase = false;
            setSubAgents((prev) => prev.map((a) => {
              if (!a.id.startsWith(`${runId}:phase:`)) return a;
              if (a.status !== 'idle') return a;
              if (promotedPhase) return a;
              promotedPhase = true;
              return {
                ...a,
                status: 'running',
                task: stepText,
                progress: Math.max(15, a.progress || 0),
              };
            }));
          }
          setSubAgents((prev) => prev.map((a) => a.id === runId ? {
            ...a,
            task: stepText,
                status: step.type === 'error' ? 'error' : a.status,
                progress: step.type === 'final_answer' ? 95 : Math.min(90, (a.progress || 5) + 10),
                messages: [...(a.messages || []), { id: uid(), role: 'system', content: stepText, timestamp: new Date(), status: 'complete' }],
                runTrace: a.runTrace ? { ...a.runTrace, steps: [...a.runTrace.steps, step] } : undefined,
          } : a));
        },
        onRunComplete: (run) => {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, runTrace: run } : m)));
          setSubAgents((prev) => prev.map((a) => {
            if (a.id === run.id) {
              return {
                ...a,
                model: run.effectiveModel,
                status: run.status === 'error' ? 'error' : 'complete',
                progress: 100,
                endTime: run.completedAt ? new Date(run.completedAt) : new Date(),
                tokensUsed: run.context.tokensUsed,
                task: run.status === 'error' ? 'Run ended with an error' : 'Run complete',
                runTrace: run,
              };
            }
            if (a.id.startsWith(`${run.id}:phase:`) && (a.status === 'running' || a.status === 'idle')) {
              return {
                ...a,
                status: run.status === 'error' ? 'error' : 'complete',
                progress: 100,
                endTime: run.completedAt ? new Date(run.completedAt) : new Date(),
              };
            }
            return a;
          }));
        },
        onError: (error) => {
          console.error('Stream error:', error);
          streamFailed = true;
          const errorText = `I couldn't get a response from ${activeModel}.\n\n${formatStreamError(error)}\n\nCheck the provider API key or switch to another configured model, then try again.`;
          streamingTextRef.current.set(assistantId, errorText);
          setMessages((prev) => {
            const existing = prev.some((m) => m.id === assistantId);
            if (!existing) {
              return [...prev, {
                id: assistantId,
                role: 'assistant',
                content: errorText,
                timestamp: new Date(),
                status: 'error' as const,
              }];
            }
            return prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: errorText, status: 'error' as const }
                : m
            );
          });
          setSubAgents((prev) =>
            prev.map((a) =>
              a.status === 'running'
                ? { ...a, status: 'error', progress: 100, endTime: new Date(), task: 'Provider request failed' }
                : a
            )
          );
        },
        onDone: () => {
          setSubAgents((prev) =>
            prev.map((a) =>
              a.status === 'running' && !streamFailed
                ? { ...a, status: 'complete', progress: 100, endTime: new Date(), task: 'Response complete' }
                : a
            )
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, status: streamFailed ? 'error' as const : 'complete' as const }
                : m
            )
          );
          setIsTyping(false);
          api.listSessions().then(setSessions).catch(() => {});
        },
      });
    } catch (err) {
      console.error('Send failed:', err);
      setIsTyping(false);
    }
  }, [isTyping, ensureSession, activeModel]);

  // ── Terminal/Diff/Browser action handlers ─────────────
  const handleSendToChat = useCallback(async (text: string) => {
    await handleSendMessage(text);
  }, [handleSendMessage]);

  const openReviewChanges = useCallback((tab: 'summary' | 'files' | 'patches' | 'validate' | 'commit' = 'summary') => {
    setReviewFlyoutTab(tab);
    setReviewFlyoutOpen(true);
  }, []);

  const closeReviewChanges = useCallback(() => {
    setReviewFlyoutOpen(false);
    setReviewFlyoutTab('summary');
  }, []);

  const handleReviewDiff = useCallback(async (diffText: string) => {
    await handleSendMessage(`Review this diff and provide feedback:\n\`\`\`diff\n${diffText.slice(0, 5000)}\n\`\`\``);
  }, [handleSendMessage]);

  const handleProposePatch = useCallback(async (diffText: string, explanation?: string) => {
    if (!workingDir) {
      console.warn("[proposePatch] no workingDir open");
      return;
    }
    let sid = activeSessionId;
    if (!sid) {
      sid = await ensureSession();
      if (!sid) {
        console.warn("[proposePatch] no active session");
        return;
      }
    }
    try {
      const res = await api.createPatchProposal({
        patch: diffText,
        workingDir,
        sessionId: sid,
        source: "diff-viewer",
        explanation: explanation?.trim() || undefined,
      });
      setPendingPatchProposalId(res.id);
      openReviewChanges('patches');
    } catch (err: any) {
      console.error("[proposePatch] failed:", err?.message || err);
    }
  }, [workingDir, activeSessionId, ensureSession, openReviewChanges]);

  // Race-safe clear: if a different id is now pending (e.g. the user
  // clicked Propose patch on file B while file A's effect was still
  // running), leave it alone.
  const clearPendingPatchProposalId = useCallback((idToClear?: string) => {
    setPendingPatchProposalId((prev) => {
      if (idToClear && prev !== idToClear) return prev;
      return null;
    });
  }, []);

  const handleExplainChange = useCallback(async (filePath: string) => {
    await handleSendMessage(`Explain what changed in \`${filePath}\` and why.`);
  }, [handleSendMessage]);

  const handleAskAboutScreenshot = useCallback(async (_screenshotBase64: string, url: string) => {
    await handleSendMessage(`I have a screenshot of ${url}. The screenshot shows the current state of the page. What issues or improvements do you see?`);
  }, [handleSendMessage]);

  const handleCompareModel = useCallback(async () => {
    if (isTyping) return;
    const sessionId = await ensureSession();
    if (!sessionId) return;
    const candidateModels = Array.from(modelContextWindows.keys());
    const targetModel = candidateModels.find((id) => id !== activeModel) || activeModel;
    if (!targetModel) return;

    const pendingId = uid();
    setMessages((prev) => [...prev, {
      id: pendingId,
      role: 'assistant',
      content: `Comparing the last answer with ${targetModel}…`,
      timestamp: new Date(),
      status: 'streaming',
    }]);

    try {
      const result = await api.compareModel(sessionId, targetModel);
      setMessages((prev) => prev.map((message) => message.id === pendingId ? {
        ...message,
        status: 'complete',
        content: [
          `## Model comparison artifact`,
          ``,
          `Compared with: **${result.model}** (${result.providerId})`,
          `Runtime: ${(result.wallMs / 1000).toFixed(1)}s`,
          `Tool calls: ${result.toolCalls.length}`,
          ``,
          `### Response`,
          result.response || '_No response returned._',
        ].join('\n'),
      } : message));
    } catch (err: any) {
      setMessages((prev) => prev.map((message) => message.id === pendingId ? {
        ...message,
        status: 'error',
        content: `Model comparison failed: ${err?.message || String(err)}`,
      } : message));
    }
  }, [activeModel, ensureSession, isTyping, modelContextWindows]);

  const handleRunSteer = useCallback(async (
    runId: string,
    action: RunSteeringAction,
    target: 'orchestrator' | 'agent' = 'orchestrator',
    note?: string,
  ): Promise<HarnessRun | null> => {
    if (!activeSessionId) return null;
    const trimmedNote = note?.trim();
    if (action === 'add-note' && !trimmedNote) return null;
    try {
      const savedRun = await api.sendRunSteering(activeSessionId, runId, action, {
        target,
        note: trimmedNote,
      });
      if (savedRun) {
        const savedSteeringStep = savedRun.steps
          .slice()
          .reverse()
          .find((step): step is Extract<HarnessRunStep, { type: 'steering' }> => step.type === 'steering');
        const stepText = savedSteeringStep ? describeRunStep(savedSteeringStep) : 'Steering saved';
        setSubAgents((prev) => prev.map((agent) => {
          if (!agent.runTrace || agent.runTrace.id !== runId) return agent;
          return {
            ...agent,
            task: stepText,
            messages: [...(agent.messages || []), { id: uid(), role: 'system', content: stepText, timestamp: new Date(), status: 'complete' }],
            runTrace: savedRun,
          };
        }));
        setMessages((prev) => prev.map((message) =>
          message.runTrace?.id === runId ? { ...message, runTrace: savedRun } : message
        ));
      }
      return savedRun;
    } catch (err) {
      console.error('Failed to send run steering:', err);
      return null;
    }
  }, [activeSessionId]);

  const handleProofArtifactSaved = useCallback((message: api.MessageInfo) => {
    if (messages.some((item) => item.id === message.id)) return;
    if (savedProofMessageIdsRef.current.has(message.id)) return;
    savedProofMessageIdsRef.current.add(message.id);
    const mapped = mapApiMessage(message);
    const savedSessionId = mapped.runTrace?.sessionId || activeSessionId;
    const proofArtifact = mapped.runTrace?.steps
      .filter((step): step is Extract<HarnessRunStep, { type: 'artifact' }> => step.type === 'artifact')
      .map((step) => step.artifact)
      .find((artifact) => artifact.type === 'validation_proof');
    const proofPreview = proofArtifact
      ? `${proofArtifact.title}: ${proofArtifact.summary}`
      : mapped.content.slice(0, 120);
    setMessages((prev) => {
      if (prev.some((item) => item.id === mapped.id)) return prev;
      return [...prev, mapped];
    });
    if (savedSessionId) {
      setSessions((prev) => prev.map((session) => (
        session.id === savedSessionId
          ? {
            ...session,
            preview: proofPreview,
            updatedAt: message.timestamp,
            messageCount: session.messageCount + 1,
          }
          : session
      )));
    }
    const savedMessageRouterStep = latestAutoRouterStep([mapped]);
    if (savedMessageRouterStep) setLastAutoRouterStep(savedMessageRouterStep);
    if (mapped.runTrace) {
      setSubAgents((prev) => {
        if (prev.some((agent) => agent.id === mapped.runTrace!.id)) return prev;
        return [...prev, ...buildSubAgentsFromLoadedMessages([message])];
      });
    }
  }, [activeSessionId, messages]);


  const handleTrustModeChange = useCallback((mode: string) => {
    setTrustMode(mode);
    api.updateConfig({ trustMode: mode }).catch(() => {});
  }, []);
  const visiblePanels = useMemo(() => {
    const set = new Set<PanelId>();
    const collect = (node: any) => {
      if (typeof node === 'string') set.add(node as PanelId);
      else if (node?.children) node.children.forEach(collect);
    };
    collect(layout);
    return set;
  }, [layout]);

  // Compute enabled tool count: 3 built-in + MCP tools from running servers
  const builtinToolCount = trustMode === "chat-only" ? 0 : trustMode === "read-only" ? 2 : 3;
  const mcpToolCount = mcpStatus
    .filter(s => s.running)
    .reduce((sum, s) => sum + (s.usableToolCount ?? s.toolCount ?? 0), 0);
  const enabledToolCount = builtinToolCount + mcpToolCount;

  const msgCount = messages.length;
  const sessionTitle = sessions.find((s) => s.id === activeSessionId)?.title || 'OpenHarness';
  const runningModel = subAgents.find((a) => a.status === 'running' || a.status === 'blocked')?.model || null;
  const terminalPanelOpen = visiblePanels.has('terminal');
  const recentRateLimitEvent = providerRateLimitStatus?.recentEvents.find((event) => {
    const timestamp = Date.parse(event.timestamp);
    return Number.isFinite(timestamp) && Date.now() - timestamp < 10 * 60 * 1000;
  }) || null;
  const exhaustedRateLimitProvider = providerRateLimitStatus?.providers.find((provider) =>
    provider.configured &&
    provider.action !== 'allow' &&
    (provider.remainingRequests === 0 || provider.remainingTokens === 0)
  ) || null;
  const providerRateLimitWarning = recentRateLimitEvent
    ? {
        severity: recentRateLimitEvent.action,
        providerId: recentRateLimitEvent.providerId,
        label: `${recentRateLimitEvent.action.toUpperCase()} ${recentRateLimitEvent.providerId}`,
        detail: recentRateLimitEvent.reason,
        resetSeconds: recentRateLimitEvent.resetSeconds,
      }
    : exhaustedRateLimitProvider
      ? {
          severity: exhaustedRateLimitProvider.action === 'block' ? 'block' as const : 'warn' as const,
          providerId: exhaustedRateLimitProvider.providerId,
          label: `Limit reached ${exhaustedRateLimitProvider.providerId}`,
          detail: 'Configured provider rate limit is exhausted in the current rolling window.',
          resetSeconds: exhaustedRateLimitProvider.resetSeconds,
        }
      : null;
  const shouldShowStatusBar = Boolean(
    contextWarning ||
    terminalPanelOpen ||
    runningModel ||
    lastAutoRouterStep ||
    providerRateLimitWarning ||
    subAgents.some((agent) => agent.status === 'running' || agent.status === 'blocked' || agent.status === 'error'),
  );
  const focusSubAgentInPanel = (agentId: string | null) => {
    openAgentFocusPanel(agentId);
  };
  const togglePinnedTool = useCallback((id: PanelId) => {
    if (FORCE_HIDDEN_TOOL_PANELS.includes(id)) return;
    setPinnedTools((prev) => {
      const current = sanitizePinnedTools(prev);
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try { localStorage.setItem(PINNED_TOOLS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const setChatEnvironmentOpen = useCallback((open: boolean) => {
    setEnvironmentOpen(open);
    try { localStorage.setItem(ENVIRONMENT_HIDDEN_KEY, open ? 'false' : 'true'); } catch { /* ignore */ }
  }, []);
  const openAgentFocusPanel = useCallback((agentId: string | null) => {
    if (agentId) setFocusedSubAgentId(agentId);
    setAgentFocusOpen(true);
    if (environmentOpen) setChatEnvironmentOpen(false);
  }, [environmentOpen, setChatEnvironmentOpen]);
  const closeAgentFocusPanel = useCallback(() => {
    setAgentFocusOpen(false);
    setFocusedSubAgentId(null);
  }, []);

  useEffect(() => {
    if (agentFocusOpen && subAgents.length === 0) {
      closeAgentFocusPanel();
    }
  }, [agentFocusOpen, subAgents, closeAgentFocusPanel]);

  const handleClickyEnabledChange = useCallback((enabled: boolean) => {
    setClickyEnabled(enabled);
    try { localStorage.setItem(CLICKY_ENABLED_KEY, enabled ? 'true' : 'false'); } catch { /* ignore */ }
  }, []);

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId || undefined}
        workingDir={workingDir}
        mainMessages={messages}
        activeTab={sidebarTab}
        activeSubAgents={subAgents}
        onActiveTabChange={setSidebarTab}
        activeModel={activeModel}
        providers={providers}
        roleAssignments={roleAssignments}
        activeTheme={activeTheme}
        personalityText={personalityText}
        mcpServers={mcpServers}
        mcpStatus={mcpStatus}
        onOpenSettings={() => setSettingsOpen(true)}
        onAddProvider={handleAddProvider}
        onTestProvider={handleTestProvider}
        onFetchModels={handleFetchModels}
        onRemoveProvider={handleRemoveProvider}
        onAddMCPServer={handleAddMCPServer}
        onRemoveMCPServer={handleRemoveMCPServer}
        onSelectModel={handleSelectModel}
        onToggleProviderModel={handleToggleProviderModel}
        onAssignRoleModel={handleAssignRoleModel}
        onSelectTheme={handleSelectTheme}
        onPersonalityChange={handlePersonalityChange}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onOpenFolder={handleOpenFolder}
        onFocusAgent={(id) => focusSubAgentInPanel(id)}
        width={sidebarWidth}
        onDeleteSession={handleDeleteSession}
        onDeleteProject={handleDeleteProject}
        clickyEnabled={clickyEnabled}
      />

      <main className="main-area">
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          visiblePanels={visiblePanels}
          onTogglePanel={togglePanel}
          onOpenPanel={addPanel}
          onResetLayout={resetLayout}
          activeModel={activeModel}
          sessionTitle={sessionTitle}
          workingDir={workingDir}
          environmentOpen={environmentOpen}
          onToggleEnvironment={() => setChatEnvironmentOpen(!environmentOpen)}
          pinnedTools={pinnedTools}
          onTogglePinnedTool={togglePinnedTool}
        />

        <div className="content-area">
          {loading ? (
            <div className="welcome-screen">
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          ) : (
            <>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, position: 'relative' }}>
              <>
                <LayoutEngine
                  layout={layout}
                  onRemovePanel={removePanel}
                  subAgents={subAgents}
                  plan={null}
                  fileChanges={[]}
                  terminalCommands={[]}
                  focusedSubAgentId={focusedSubAgentId}
                  messages={messages}
                  isTyping={isTyping}
                  onSendMessage={handleSendMessage}
                  activeModel={activeModel}
                  workingDir={workingDir}
                  projectProfile={projectProfile}
                  sessionId={activeSessionId}
                  pendingPatchProposalId={pendingPatchProposalId}
                  clearPendingPatchProposalId={clearPendingPatchProposalId}
                  onSendToChat={handleSendToChat}
                  onReviewDiff={handleReviewDiff}
                  onProposePatch={handleProposePatch}
                  onExplainChange={handleExplainChange}
                  onAskAboutScreenshot={handleAskAboutScreenshot}
                  onCompareModel={handleCompareModel}
                  onReviewChanges={() => openReviewChanges('summary')}
                  onFocusAgents={() => {
                    const activeRun = pickActiveRunAndPhases(subAgents)?.run.id;
                    const next = activeRun || subAgents.find((a) => a.status === 'running')?.id || subAgents[0]?.id || null;
                    if (!next) return;
                    focusSubAgentInPanel(next);
                  }}
                  onFocusSubAgent={(agentId: string) => focusSubAgentInPanel(agentId)}
                  trustMode={trustMode}
                  models={Array.from(modelContextWindows.entries()).map(([id]) => ({ id, name: id }))}
                  enabledModels={enabledModelsForPanels}
                  onApplyRoleRecommendation={handleAssignRoleModel}
                  pinnedTools={pinnedTools}
                  onOpenPinnedTool={addPanel}
                  environmentOpen={environmentOpen}
                  onEnvironmentOpenChange={setChatEnvironmentOpen}
                  onRunSteer={handleRunSteer}
                />

                {agentFocusOpen && (
                  <div className="agent-focus-overlay" role="region" aria-label="Right-hand Agent detail pane">
                    <AgentFocusPanel
                      agents={subAgents}
                      focusedId={focusedSubAgentId}
                      onFocus={openAgentFocusPanel}
                      onExit={closeAgentFocusPanel}
                      onRunSteer={handleRunSteer}
                    />
                  </div>
                )}
              </>
            </div>
          </>
          )}
        </div>

        {/* Enhanced Status Bar */}
        {shouldShowStatusBar && (
          <StatusBar
            activeModel={activeModel}
            providerName={activeModel.toLowerCase() === 'auto'
              ? 'Router'
              : providers.find(p => p.models?.some(m => m.id === activeModel))?.name || ''}
            activeProviderId={providers.find(p => p.models?.some(m => m.id === activeModel))?.id}
            activeProviderAccessMode={providers.find(p => p.models?.some(m => m.id === activeModel))?.accessMode}
            activeProviderPlanId={providers.find(p => p.models?.some(m => m.id === activeModel))?.planId}
            thinkingEffort={thinkingEffort}
            connected={providers.some(p => p.configured)}
            messageCount={msgCount}
            workingDir={workingDir}
            models={Array.from(modelContextWindows.entries()).map(([id, ctx]) => {
              const prov = providers.find(p => p.models?.some(m => m.id === id));
              return {
                id,
                name: id,
                providerName: prov?.name || 'Unknown',
                providerId: prov?.id,
                accessMode: prov?.accessMode,
                planId: prov?.planId,
                contextWindow: ctx,
              };
            })}
            onModelChange={handleSelectModel}
            onThinkingEffortChange={handleThinkingEffortChange}
            favoriteModelIds={favoriteModelIds}
            onToggleFavoriteModel={handleToggleFavoriteModel}
            enabledToolCount={enabledToolCount}
            configuredProviderCount={providers.filter(p => p.configured).length}
            trustMode={trustMode}
            onTrustModeChange={handleTrustModeChange}
            runningModel={runningModel}
            autoRouterStep={lastAutoRouterStep}
            providerRateLimitWarning={providerRateLimitWarning}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}
      </main>

      {/* Context Window Warning Toast */}
      {contextWarning && (
        <div style={{
          position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          border: '1px solid var(--warning, #f59e0b)', borderRadius: 8,
          padding: '10px 20px', fontSize: 13, zIndex: 10000,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)', maxWidth: 500, textAlign: 'center',
          animation: 'fadeSlideUp 0.3s ease',
        }}>
          <span style={{ marginRight: 8 }}>⚠️</span>{contextWarning}
        </div>
      )}

      {/* Snap Zone Overlay */}
      {snapOverlayVisible && <SnapZoneOverlay onSnap={(zone) => { (window as any).OpenHarnessNative?.snapToZone(zone); setSnapOverlayVisible(false); }} onClose={() => setSnapOverlayVisible(false)} />}

      {/* Onboarding Wizard */}
      {showOnboarding && (
        <Suspense fallback={null}>
        <OnboardingWizard
          onComplete={async (result) => {
            // Refresh providers/models after onboarding completes.
            try {
              const fresh = await api.getProviders();
              setProviders(fresh.map((p: any) => ({
                id: p.id,
                name: p.name,
                type: p.type || 'openai-compatible',
                endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
                configured: providerIsConfigured(p),
                accessMode: p.accessMode,
                planId: p.planId,
                oauth: p.oauth,
                models: p.models || [],
              })));
              const models = await api.getModels();
              if (models.length > 0) {
                const ctxMap = new Map<string, number>();
                for (const m of models) ctxMap.set(m.id, m.contextWindowTokens);
                setModelContextWindows(ctxMap);
                if (result?.activeModel) setActiveModel(result.activeModel);
                else setActiveModel(models[0].id);
              }
              // Adopt personality, trust mode, and agent roles from onboarding.
                if (result?.personality) setPersonalityText(result.personality);
              if (result?.trustMode) setTrustMode(result.trustMode as any);
              if (result?.roleAssignments) setRoleAssignments(roleMapToAssignments(result.roleAssignments));
              if (result?.activeTheme) {
                const resolvedTheme = applyTheme(result.activeTheme);
                setActiveTheme(resolvedTheme);
              }
              // If the user picked a folder, open it as a session.
              if (result?.folderPath) {
                try { await api.createSession('Onboarding project', result.folderPath); } catch { /* ignore */ }
              }
            } catch { /* use what we have */ }
            setShowOnboarding(false);
          }}
          onSkip={() => setShowOnboarding(false)}
        />
        </Suspense>
      )}

      {/* Review Changes Flyout */}
      {reviewFlyoutOpen && (
        <Suspense fallback={null}>
        <ReviewChangesFlyout
          workingDir={workingDir}
          _sessionId={activeSessionId}
          onClose={closeReviewChanges}
          initialTab={reviewFlyoutTab}
          onReviewDiff={handleReviewDiff}
          onProposePatch={handleProposePatch}
          onExplainChange={handleExplainChange}
          onProofArtifactSaved={handleProofArtifactSaved}
        />
        </Suspense>
      )}

      <Suspense fallback={null}>
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        configPath={configPath}
        activeModel={activeModel}
        thinkingEffort={thinkingEffort}
        providers={providers}
        roleAssignments={roleAssignments}
        roleThinking={roleThinking}
        activeTheme={activeTheme}
        textureOpacityOverride={textureOpacityOverride}
        personalityText={personalityText}
        mcpServers={mcpServers}
        mcpStatus={mcpStatus}
        onAddProvider={handleAddProvider}
        onTestProvider={handleTestProvider}
        onFetchModels={handleFetchModels}
        onUpdateProvider={handleUpdateProvider}
        onRemoveProvider={handleRemoveProvider}
        onAddMCPServer={handleAddMCPServer}
        onRemoveMCPServer={handleRemoveMCPServer}
        onSelectModel={handleSelectModel}
        onThinkingEffortChange={handleThinkingEffortChange}
        onToggleProviderModel={handleToggleProviderModel}
        onAssignRoleModel={handleAssignRoleModel}
        onAssignRoleThinking={handleAssignRoleThinking}
        onSelectTheme={handleSelectTheme}
        onTextureOpacityOverrideChange={handleTextureOpacityOverrideChange}
        onThemePluginManifestsChange={handleThemePluginManifestsChange}
        onRemoveTheme={handleRemoveTheme}
        onPersonalityChange={handlePersonalityChange}
        onRestartOnboarding={() => { setSettingsOpen(false); setShowOnboarding(true); }}
        onMcpStatusRefresh={refreshMcpStatus}
        clickyEnabled={clickyEnabled}
        onClickyEnabledChange={handleClickyEnabledChange}
      />
      </Suspense>
    </div>
  );
}

function mapApiMessage(m: api.MessageInfo): Message {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp),
    status: 'complete',
    toolCalls: m.toolCalls?.map((tc) => ({
      id: tc.id,
      name: tc.name,
      status: tc.status,
      input: tc.input,
      output: tc.output,
      duration: tc.duration,
    })),
    runTrace: m.runTrace,
  };
}

function applyLoadedMessages(
  rawMessages: api.MessageInfo[],
  setMessages: (messages: Message[]) => void,
  setLastAutoRouterStep: (step: Extract<HarnessRunStep, { type: 'auto_router' }> | null) => void,
  setSubAgents: (agents: SubAgent[]) => void,
  setFocusedSubAgentId?: (agentId: string | null) => void,
) {
  const mapped = rawMessages.map(mapApiMessage);
  setMessages(mapped);
  setLastAutoRouterStep(latestAutoRouterStep(mapped));
  const restoredAgents = buildSubAgentsFromLoadedMessages(rawMessages);
  setSubAgents(restoredAgents);
  if (setFocusedSubAgentId) {
    const runningAgent = restoredAgents.find((agent) => agent.status === 'running' || agent.status === 'blocked')?.id;
    setFocusedSubAgentId(runningAgent || restoredAgents[0]?.id || null);
  }
}

// ── Snap Zone Overlay (FancyZones-style) ──
function SnapZoneOverlay({ onSnap, onClose }: { onSnap: (zone: string) => void; onClose: () => void }) {
  const zones = [
    { id: 'top-left', label: '1', gridArea: '1 / 1' },
    { id: 'top-half', label: '2', gridArea: '1 / 2' },
    { id: 'top-right', label: '3', gridArea: '1 / 3' },
    { id: 'left-half', label: '4', gridArea: '2 / 1' },
    { id: 'maximize', label: '5', gridArea: '2 / 2' },
    { id: 'right-half', label: '6', gridArea: '2 / 3' },
    { id: 'bottom-left', label: '7', gridArea: '3 / 1' },
    { id: 'bottom-half', label: '8', gridArea: '3 / 2' },
    { id: 'bottom-right', label: '9', gridArea: '3 / 3' },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr',
        gap: 8, width: '80vw', maxWidth: 700, height: '70vh', maxHeight: 500, padding: 8,
      }} onClick={(e) => e.stopPropagation()}>
        {zones.map((zone) => (
          <button key={zone.id}
            onClick={() => onSnap(zone.id)}
            style={{
              gridArea: zone.gridArea,
              background: 'rgba(99, 102, 241, 0.15)', border: '2px dashed rgba(99, 102, 241, 0.5)',
              borderRadius: 12, cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
              fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.35)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.8)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
          >
            {zone.label}
          </button>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 24, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
        Click a zone to snap — or press Escape to cancel — ⌘⇧1-9 for direct snap
      </div>
    </div>
  );
}

export default App;
