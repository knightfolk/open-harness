import { useState, useCallback, useEffect, useRef } from 'react';
import type { Message, SubAgent, ProviderConfig, CodingRoleAssignment, Plan } from './types';
import type { PanelId } from './types/layout';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LayoutEngine } from './components/layout/LayoutEngine';
import { SettingsModal } from './components/SettingsModal';
import { useLayoutState } from './components/layout/useLayoutState';
import { randomAgentName } from './utils/names';
import * as api from './utils/api';
import './styles/global.css';
import './styles/components.css';

const uid = () => Math.random().toString(36).slice(2, 10);

function basename(p: string) {
  return p.split('/').filter(Boolean).pop() || p;
}

function App() {
  const [sessions, setSessions] = useState<api.SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [workingDir, setWorkingDir] = useState<string | null>(null);
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
  const [roleAssignments, setRoleAssignments] = useState<CodingRoleAssignment[]>([
    { id: 'planning', name: 'Planner', description: 'Research, architecture decisions, breaking down tasks', modelId: 'MiniMax-M2.7' },
    { id: 'implementation', name: 'Code Implementer', description: 'Writing new code, scaffolding, refactoring', modelId: 'MiniMax-M2.7' },
    { id: 'bugfix', name: 'Bug Fixer', description: 'Debugging, tracing errors, regression testing', modelId: 'MiniMax-M2.7' },
    { id: 'design', name: 'Design Specialist', description: 'UI/UX patterns, styling, component layout', modelId: 'MiniMax-M2.7' },
    { id: 'image', name: 'Image Generator', description: 'Generating images, diagrams, visual assets', modelId: 'MiniMax-M2.7' },
    { id: 'toolrunning', name: 'Tool Runner', description: 'Executing tools, shell commands, file operations', modelId: 'MiniMax-M2.7' },
    { id: 'review', name: 'Code Reviewer', description: 'Reviewing PRs, suggesting improvements, security audits', modelId: 'MiniMax-M2.7' },
  ]);
  const [activeTheme, setActiveTheme] = useState('midnight');
  const [personalityText, setPersonalityText] = useState('');
  const [mcpServers, setMcpServers] = useState<import('./types').MCPServerItem[]>([]);
  const [mcpStatus, setMcpStatus] = useState<api.MCPServerStatus[]>([]);
  const [modelContextWindows, setModelContextWindows] = useState<Map<string, number>>(new Map());
  const [contextWarning, setContextWarning] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapOverlayVisible, setSnapOverlayVisible] = useState(false);
  const { layout, togglePanel, removePanel, swapPanels, resetLayout } = useLayoutState();

  const streamingTextRef = useRef<Map<string, string>>(new Map());

  // Listen for Electron IPC events (snap zones, menu actions)
  useEffect(() => {
    const native = (window as any).CMDuiNative;
    if (!native?.onMenuAction) return;
    native.onMenuAction((action: string) => {
      if (action === 'show-snap-zones') {
        setSnapOverlayVisible(true);
        setTimeout(() => setSnapOverlayVisible(false), 3000);
      }
      if (action === 'open-preferences') setSettingsOpen(true);
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
                modelId: config.roleAssignments?.[r.id] || r.modelId,
              }))
            );
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

    // Spawn sub-agents
    const agentTasks = ['Analyzing request...', 'Searching for context...', 'Generating response...'];
    const models = [activeModel, 'o4-mini', 'gpt-4.1'];
    const spawned: SubAgent[] = [];
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      spawned.push({
        id: uid(),
        name: randomAgentName(),
        model: models[Math.floor(Math.random() * models.length)],
        status: 'running',
        task: agentTasks[i % agentTasks.length],
        progress: 0,
        startTime: new Date(),
        tokensUsed: 0,
      });
    }
    spawned.forEach((agent, i) => {
      setTimeout(() => setSubAgents((prev) => [...prev, agent]), 200 + i * 600);
    });

    const progressInterval = setInterval(() => {
      setSubAgents((prev) =>
        prev.map((a) =>
          a.status === 'running'
            ? { ...a, progress: Math.min((a.progress || 0) + Math.random() * 25, 90) }
            : a
        )
      );
    }, 500);

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
        },
        onError: (error) => {
          console.error('Stream error:', error);
        },
        onDone: () => {
          clearInterval(progressInterval);
          setSubAgents((prev) =>
            prev.map((a) =>
              a.status === 'running'
                ? { ...a, status: 'complete', progress: 100, endTime: new Date() }
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
      clearInterval(progressInterval);
    }
  }, [isTyping, ensureSession, activeModel]);

  // Build visible panel set
  const visiblePanels = new Set<PanelId>();
  const collectPanels = (node: any) => {
    if (typeof node === 'string') visiblePanels.add(node as PanelId);
    else if (node?.children) node.children.forEach(collectPanels);
  };
  collectPanels(layout);

  const msgCount = messages.length;
  const agentCount = subAgents.filter((a) => a.status === 'running').length;
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
            />
          )}
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-bar-item">
            <div className="status-bar-dot" />
            Connected
          </div>
          <div className="status-bar-item">{activeModel}</div>
          {workingDir && (
            <div className="status-bar-item" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
              {workingDir}
            </div>
          )}
          <div className="status-bar-item">{msgCount} messages</div>
          <div className="status-bar-item">{agentCount} agent{agentCount !== 1 ? 's' : ''} active</div>
          <div style={{ flex: 1 }} />
          <div className="status-bar-item">Open-Harness v1.0.0</div>
        </div>
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
