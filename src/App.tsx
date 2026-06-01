import { useState, useCallback, useEffect, useRef } from 'react';
import type { Message, SubAgent, ProviderConfig, CodingRoleAssignment, Plan, HarnessRunStep, ProjectProfile } from './types';
import type { PanelId } from './types/layout';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LayoutEngine } from './components/layout/LayoutEngine';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { StatusBar } from './components/StatusBar';
import { useLayoutState } from './components/layout/useLayoutState';
import * as api from './utils/api';
import './styles/global.css';
import './styles/components.css';

const uid = () => Math.random().toString(36).slice(2, 10);


function describeRunStep(step: HarnessRunStep): string {
  switch (step.type) {
    case 'orchestration': return `${step.label}: ${step.detail || step.mode}`;
    case 'route': return `Routed to ${step.role} using ${step.model}${step.reason ? ` (${step.reason})` : ''}`;
    case 'prompt_built': return `Built prompt with ${step.toolCount} available tool${step.toolCount === 1 ? '' : 's'}`;
    case 'model_request': return `Sent model request round ${step.round} to ${step.model}`;
    case 'tool_call': return step.durationMs == null ? `Started tool: ${step.name}` : `Finished tool: ${step.name} in ${step.durationMs}ms`;
    case 'model_text': return `Received ${step.chars} characters from model`;
    case 'final_answer': return `Final answer ready (${step.chars} characters)`;
    case 'error': return `Error: ${step.message}`;
  }
}

function basename(p: string) {
  return p.split('/').filter(Boolean).pop() || p;
}

const DEFAULT_ROLE_ASSIGNMENTS: CodingRoleAssignment[] = [
  { id: 'planner', name: 'Planner', description: 'Research, architecture decisions, breaking down tasks', modelId: 'MiniMax-M2.7' },
  { id: 'coder', name: 'Code Implementer', description: 'Writing code, fixes, debugging, and refactoring', modelId: 'MiniMax-M2.7' },
  { id: 'reviewer', name: 'Code Reviewer', description: 'Reviewing PRs, finding correctness and security issues', modelId: 'MiniMax-M2.7' },
  { id: 'reasoner', name: 'Reasoner', description: 'Complex analysis, comparisons, and tradeoffs', modelId: 'MiniMax-M2.7' },
  { id: 'summarizer', name: 'Summarizer', description: 'Condensing files, threads, and long outputs', modelId: 'MiniMax-M2.7' },
  { id: 'worker', name: 'Tool Runner', description: 'Fast shell, file, and utility tasks', modelId: 'MiniMax-M2.7' },
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

function App() {
  const [sessions, setSessions] = useState<api.SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [workingDir, setWorkingDir] = useState<string | null>(null);
  const [projectProfile, setProjectProfile] = useState<ProjectProfile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState('MiniMax-M2.7');
  const [providers, setProviders] = useState<ProviderConfig[]>([
    {
      id: 'minimax',
      name: 'MiniMax',
      type: 'openai-compatible' as const,
      endpointLabel: 'api.minimax.io/v1',
      configured: true,
      models: [
        { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', enabled: true },
      ],
    },
  ]);
  const [roleAssignments, setRoleAssignments] = useState<CodingRoleAssignment[]>(DEFAULT_ROLE_ASSIGNMENTS);
  const [activeTheme, setActiveTheme] = useState('midnight');
  const [personalityText, setPersonalityText] = useState('');
  const [mcpServers, setMcpServers] = useState<import('./types').MCPServerItem[]>([]);
  const [mcpStatus, setMcpStatus] = useState<api.MCPServerStatus[]>([]);
  const [modelContextWindows, setModelContextWindows] = useState<Map<string, number>>(new Map());
  const [contextWarning, setContextWarning] = useState<string | null>(null);
  const [trustMode, setTrustMode] = useState('workspace-write');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapOverlayVisible, setSnapOverlayVisible] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { layout, togglePanel, removePanel, swapPanels, resetLayout } = useLayoutState();

  const streamingTextRef = useRef<Map<string, string>>(new Map());

  // Listen for Electron IPC events (snap zones, menu actions)
  useEffect(() => {
    const native = (window as any).CMDuiNative;
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
        setSubAgents([]);
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
        setSubAgents([]);
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
    document.documentElement.setAttribute('data-theme', 'midnight');
    (async () => {
      try {
        const config = await api.getConfig();
        if (config) {
          setActiveModel(config.activeModel || 'MiniMax-M2.7');
          setActiveTheme(config.activeTheme || 'midnight');
          setPersonalityText(config.personality || '');
          document.documentElement.setAttribute('data-theme', config.activeTheme || 'midnight');
          if (config.providers?.length > 0) {
            setProviders(config.providers.map((p: any) => ({
              id: p.id,
              name: p.name,
              type: p.type || 'openai-compatible',
              endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
              configured: !!p.hasKey || p.type === 'local',
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
          p.hasKey || p.type === 'local' || (p.apiKey && p.apiKey.startsWith('••••'))
        );
        if (!hasKey) setShowOnboarding(true);
      } catch { /* use defaults */ }
    })();
  }, []);

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

  const handleAssignRoleModel = useCallback((roleId: string, modelId: string) => {
    setRoleAssignments((prev) => {
      const next = prev.map((r) => (r.id === roleId ? { ...r, modelId } : r));
      const map: Record<string, string> = {};
      next.forEach((r) => { map[r.id] = r.modelId; });
      api.updateConfig({ roleAssignments: map }).catch(() => {});
      return next;
    });
  }, []);

  const handleSelectTheme = useCallback((themeId: string) => {
    setActiveTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    api.updateConfig({ activeTheme: themeId }).catch(() => {});
  }, []);

  const handlePersonalityChange = useCallback((text: string) => {
    setPersonalityText(text);
    api.updateConfig({ personality: text }).catch(() => {});
  }, []);

  // ── Provider management handlers ─────────────────────
  const handleAddProvider = useCallback(async (provider: { name: string; type: string; apiKey: string; baseURL: string }) => {
    const result = await api.addProvider(provider);
    // Re-fetch providers from server
    const fresh = await api.getProviders();
    setProviders(fresh.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type || 'openai-compatible',
      endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
      configured: !!p.hasKey || p.type === 'local',
      models: p.models || [],
    })));
    return result;
  }, []);

  const handleTestProvider = useCallback(async (providerId: string) => {
    return await api.testProviderConnection(providerId);
  }, []);

  const handleFetchModels = useCallback(async (providerId: string) => {
    const models = await api.fetchProviderModels(providerId);
    // Update the provider's model list by saving to server then refreshing
    const fresh = await api.getProviders();
    setProviders(fresh.map((p: any) => ({
      id: p.id,
      name: p.name,
      type: p.type || 'openai-compatible',
      endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
      configured: !!p.hasKey || p.type === 'local',
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
        configured: !!p.hasKey || p.type === 'local',
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
        setMessages(detail.messages.map(mapApiMessage));
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
    setSubAgents([]);
    try {
      const detail = await api.getSession(id);
      setWorkingDir(detail.workingDir || null);
      setMessages(detail.messages.map(mapApiMessage));
    } catch (err) {
      console.error('Failed to load session:', err);
      setMessages([]);
    }
  }, [activeSessionId]);

  const handleNewSession = useCallback(async () => {
    try {
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
      setSubAgents([]);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }, []);

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
      setSubAgents([]);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  }, []);


  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId;
    try {
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
      return session.id;
    } catch (err) {
      console.error('Failed to create session:', err);
      return null;
    }
  }, [activeSessionId]);

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
    setSubAgents([activityAgent]);

    const assistantId = uid();
    streamingTextRef.current.set(assistantId, '');

    try {
      await api.sendMessage(sessionId, content, {
        onUserMessage: () => {},
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
          setSubAgents([{
            id: run.id,
            name: `${run.role} run`,
            model: run.effectiveModel,
            status: 'running',
            task: 'Starting run...',
            progress: 5,
            startTime: new Date(run.startedAt),
            messages: [],
            runTrace: run,
          }]);
        },
        onRunStep: (runId, step) => {
          const stepText = describeRunStep(step);
          setMessages((prev) => prev.map((m) => {
            if (m.id !== assistantId || !m.runTrace) return m;
            return { ...m, runTrace: { ...m.runTrace, steps: [...m.runTrace.steps, step] } };
          }));
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
          setSubAgents((prev) => prev.map((a) => a.id === run.id ? {
            ...a,
            model: run.effectiveModel,
            status: run.status === 'error' ? 'error' : 'complete',
            progress: 100,
            endTime: run.completedAt ? new Date(run.completedAt) : new Date(),
            tokensUsed: run.context.tokensUsed,
            task: run.status === 'error' ? 'Run ended with an error' : 'Run complete',
            runTrace: run,
          } : a));
        },
        onError: (error) => {
          console.error('Stream error:', error);
        },
        onDone: () => {
          setSubAgents((prev) =>
            prev.map((a) =>
              a.status === 'running'
                ? { ...a, status: 'complete', progress: 100, endTime: new Date(), task: 'Response complete' }
                : a
            )
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, status: 'complete' as const }
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

  const handleReviewDiff = useCallback(async (diffText: string) => {
    await handleSendMessage(`Review this diff and provide feedback:\n\`\`\`diff\n${diffText.slice(0, 5000)}\n\`\`\``);
  }, [handleSendMessage]);

  const handleExplainChange = useCallback(async (filePath: string) => {
    await handleSendMessage(`Explain what changed in \`${filePath}\` and why.`);
  }, [handleSendMessage]);

  const handleAskAboutScreenshot = useCallback(async (_screenshotBase64: string, url: string) => {
    await handleSendMessage(`I have a screenshot of ${url}. The screenshot shows the current state of the page. What issues or improvements do you see?`);
  }, [handleSendMessage]);


  const handleTrustModeChange = useCallback((mode: string) => {
    setTrustMode(mode);
    api.updateConfig({ trustMode: mode }).catch(() => {});
  }, []);
  // Build visible panel set
  const visiblePanels = new Set<PanelId>();
  const collectPanels = (node: any) => {
    if (typeof node === 'string') visiblePanels.add(node as PanelId);
    else if (node?.children) node.children.forEach(collectPanels);
  };
  collectPanels(layout);

  // Compute enabled tool count: 3 built-in + MCP tools from running servers
  const builtinToolCount = trustMode === "chat-only" ? 0 : trustMode === "read-only" ? 2 : 3;
  const mcpToolCount = mcpStatus.filter(s => s.running).reduce((sum, s) => sum + (s.toolCount || 0), 0);
  const enabledToolCount = builtinToolCount + mcpToolCount;

  const msgCount = messages.length;
  const sessionTitle = sessions.find((s) => s.id === activeSessionId)?.title || 'Open-Harness';
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const latestToolCalls = latestAssistantMessage?.toolCalls || [];
  const hasRunningTools = latestToolCalls.some((tool) => tool.status === 'running');
  const hasToolCalls = latestToolCalls.length > 0;
  const chatPlan: Plan | null = messages.length === 0 ? null : {
    explanation: isTyping ? 'Current response progress' : 'Last response completed',
    steps: [
      { id: 'request', step: 'Receive user request', status: 'completed' },
      {
        id: 'response',
        step: 'Generate model response',
        status: isTyping && !hasToolCalls ? 'in_progress' : 'completed',
      },
      {
        id: 'tools',
        step: hasToolCalls ? `Use ${latestToolCalls.length} tool${latestToolCalls.length === 1 ? '' : 's'} as needed` : 'Use tools only if needed',
        status: hasRunningTools ? 'in_progress' : hasToolCalls ? 'completed' : isTyping ? 'pending' : 'completed',
      },
      {
        id: 'final',
        step: 'Deliver final answer',
        status: isTyping ? 'pending' : 'completed',
      },
    ],
  };

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        sessions={sessions.map(s => ({
          id: s.id,
          title: s.title,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          messages: [],
          subAgents: [],
          fileChanges: [],
          terminalCommands: [],
        }))}
        activeSessionId={activeSessionId || undefined}
        activeSubAgents={subAgents}
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
      />

      <main className="main-area">
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          visiblePanels={visiblePanels}
          onTogglePanel={togglePanel}
          onResetLayout={resetLayout}
          sessionTitle={sessionTitle}
          activeModel={activeModel}
          workingDir={workingDir}
          onOpenFolder={handleOpenFolder}
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
            <LayoutEngine
              layout={layout}
              onRemovePanel={removePanel}
              onSwapPanels={swapPanels}
              subAgents={subAgents}
              plan={chatPlan}
              fileChanges={[]}
              terminalCommands={[]}
              messages={messages}
              isTyping={isTyping}
              onSendMessage={handleSendMessage}
              activeModel={activeModel}
              workingDir={workingDir}
              projectProfile={projectProfile}
              onSendToChat={handleSendToChat}
              onReviewDiff={handleReviewDiff}
              onExplainChange={handleExplainChange}
              onAskAboutScreenshot={handleAskAboutScreenshot}
              models={Array.from(modelContextWindows.entries()).map(([id]) => ({ id, name: id }))}
            />
          )}
        </div>

        {/* Enhanced Status Bar */}
        <StatusBar
          activeModel={activeModel}
          providerName={providers.find(p => p.models?.some(m => m.id === activeModel))?.name || ''}
          connected={providers.some(p => p.configured)}
          messageCount={msgCount}
          workingDir={workingDir}
          models={Array.from(modelContextWindows.entries()).map(([id, ctx]) => {
            const prov = providers.find(p => p.models?.some(m => m.id === id));
            return { id, name: id, providerName: prov?.name || 'Unknown', contextWindow: ctx };
          })}
          onModelChange={handleSelectModel}
          enabledToolCount={enabledToolCount}
          trustMode={trustMode}
          onTrustModeChange={handleTrustModeChange}
        />
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
      {snapOverlayVisible && <SnapZoneOverlay onSnap={(zone) => { (window as any).CMDuiNative?.snapToZone(zone); setSnapOverlayVisible(false); }} onClose={() => setSnapOverlayVisible(false)} />}

      {/* Onboarding Wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={async (provider) => {
            // Refresh providers after onboarding
            if (provider) {
              try {
                const fresh = await api.getProviders();
                setProviders(fresh.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  type: p.type || 'openai-compatible',
                  endpointLabel: p.baseURL?.replace(/^https?:\/\//, '') || '',
                  configured: !!p.hasKey || p.type === 'local',
                  models: p.models || [],
                })));
                const models = await api.getModels();
                if (models.length > 0) {
                  const ctxMap = new Map<string, number>();
                  for (const m of models) ctxMap.set(m.id, m.contextWindowTokens);
                  setModelContextWindows(ctxMap);
                  setActiveModel(models[0].id);
                  await api.updateConfig({ activeModel: models[0].id });
                }
              } catch { /* use what we have */ }
            }
            setShowOnboarding(false);
          }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeModel={activeModel}
        providers={providers}
        roleAssignments={roleAssignments}
        activeTheme={activeTheme}
        personalityText={personalityText}
        mcpServers={mcpServers}
        mcpStatus={mcpStatus}
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
      />
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
