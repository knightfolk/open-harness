import { useState, useCallback, useEffect, useRef } from 'react';
import type { Message, SubAgent } from './types';
import type { PanelId } from './types/layout';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LayoutEngine } from './components/layout/LayoutEngine';
import { useLayoutState } from './components/layout/useLayoutState';
import { randomAgentName } from './utils/names';
import * as api from './utils/api';
import './styles/global.css';
import './styles/components.css';

const uid = () => Math.random().toString(36).slice(2, 10);

function App() {
  const [sessions, setSessions] = useState<api.SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const { layout, togglePanel, removePanel, resetLayout } = useLayoutState();

  const streamingTextRef = useRef<Map<string, string>>(new Map());

  // Load sessions on mount, create one if none exist
  useEffect(() => {
    (async () => {
      try {
        let list = await api.listSessions();
        if (list.length === 0) {
          // No sessions — create the first one
          const session = await api.createSession();
          list = [{
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            preview: '',
            messageCount: 0,
          }];
        }
        setSessions(list);
        setActiveSessionId(list[0].id);
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
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        preview: '',
        messageCount: 0,
      }, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
      setSubAgents([]);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }, []);

  /** Ensure we have an active session before sending */
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId;
    try {
      const session = await api.createSession();
      setSessions((prev) => [{
        id: session.id,
        title: session.title,
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

    // Add user message immediately
    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'complete',
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Spawn sub-agents for visual feedback
    const agentTasks = ['Analyzing request...', 'Searching for context...', 'Generating response...'];
    const models = ['MiniMax-M2.7', 'o4-mini', 'gpt-4.1'];
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

    // Streaming assistant message
    const assistantId = uid();
    streamingTextRef.current.set(assistantId, '');

    try {
      await api.sendMessage(sessionId, content, {
        onUserMessage: () => {},
        onAssistantStart: () => {
          const placeholder: Message = {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            status: 'streaming',
          };
          setMessages((prev) => [...prev, placeholder]);
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
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolCalls: [...(m.toolCalls || []), { id: tc.id, name: tc.name, status: tc.status, input: tc.input, output: tc.output, duration: tc.duration }] }
                : m
            )
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
  }, [isTyping, ensureSession]);

  // Build visible panel set for top bar
  const visiblePanels = new Set<PanelId>();
  const collectPanels = (node: any) => {
    if (typeof node === 'string') visiblePanels.add(node as PanelId);
    else if (node?.children) node.children.forEach(collectPanels);
  };
  collectPanels(layout);

  const msgCount = messages.length;
  const agentCount = subAgents.filter((a) => a.status === 'running').length;
  const sessionTitle = sessions.find((s) => s.id === activeSessionId)?.title || 'CMDui';
  const showWelcome = activeSessionId && messages.length === 0 && !loading;

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
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />

      <main className="main-area">
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          visiblePanels={visiblePanels}
          onTogglePanel={togglePanel}
          onResetLayout={resetLayout}
          sessionTitle={sessionTitle}
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
          ) : showWelcome ? (
            <WelcomeScreen onSuggestionClick={handleSendMessage} />
          ) : (
            <LayoutEngine
              layout={layout}
              onRemovePanel={removePanel}
              subAgents={subAgents}
              plan={{
                steps: [
                  { id: '1', step: 'Explore codebase', status: 'completed' },
                  { id: '2', step: 'Design solution', status: 'completed' },
                  { id: '3', step: 'Implement changes', status: 'in_progress' },
                  { id: '4', step: 'Test and verify', status: 'pending' },
                ],
              }}
              fileChanges={[
                { id: uid(), filePath: 'src/App.tsx', type: 'modify' as const, additions: 42, deletions: 18 },
                { id: uid(), filePath: 'src/utils/api.ts', type: 'add' as const, additions: 89, deletions: 0 },
              ]}
              terminalCommands={[
                { id: uid(), command: 'npm run build', output: '✓ built in 80ms', exitCode: 0, duration: 800 },
              ]}
              messages={messages}
              isTyping={isTyping}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-bar-item">
            <div className="status-bar-dot" />
            Connected
          </div>
          <div className="status-bar-item">MiniMax-M2.7</div>
          <div className="status-bar-item">{msgCount} messages</div>
          <div className="status-bar-item">{agentCount} agent{agentCount !== 1 ? 's' : ''} active</div>
          <div style={{ flex: 1 }} />
          <div className="status-bar-item">CMDui v1.0.0</div>
        </div>
      </main>
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

export default App;
