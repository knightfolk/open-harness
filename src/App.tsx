import { useState, useCallback } from 'react';
import type { Message, Session, SubAgent } from './types';
import type { PanelId } from './types/layout';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LayoutEngine } from './components/layout/LayoutEngine';
import { useLayoutState } from './components/layout/useLayoutState';
import { mockSessions, mockSubAgents, mockPlan, mockFileChanges, mockTerminalCommands } from './utils/mockData';
import { randomAgentName } from './utils/names';
import './styles/global.css';
import './styles/components.css';

const uid = () => Math.random().toString(36).slice(2, 10);

const mockResponses = [
  "I've analyzed the codebase and found several optimization opportunities. Let me implement the changes step by step.\n\n```tsx\nconst optimizedComponent = useMemo(() => {\n  return data.filter(item => item.active)\n    .map(item => transform(item));\n}, [data]);\n```\n\nThis reduces unnecessary re-renders by memoizing the computed values.",
  "Here's what I found during the review:\n\n**Architecture**\n- The current state management uses prop drilling — consider Context or Zustand\n- API calls lack error boundaries\n- Missing loading states for async operations\n\nLet me fix these issues systematically.",
  "Building the feature now. I'll scaffold the components and wire up the state management.\n\n```typescript\ninterface FeatureConfig {\n  enabled: boolean;\n  theme: 'light' | 'dark';\n  agents: AgentConfig[];\n}\n```\n\nAll tests passing. Ready for review.",
  "Sure! Here's the implementation plan:\n\n1. **Data Layer** — Set up the store with typed actions\n2. **UI Layer** — Build the component tree with proper composition\n3. **Integration** — Wire up events and side effects\n4. **Testing** — Add unit and integration tests\n\nShall I proceed?",
];

const namedAgents: SubAgent[] = mockSubAgents.map(a => ({ ...a, name: randomAgentName() }));

function App() {
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(mockSessions[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>(namedAgents);
  const { layout, togglePanel, removePanel, resetLayout } = useLayoutState();

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const handleNewSession = () => {
    const newSession: Session = {
      id: uid(),
      title: 'New Session',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
      subAgents: [],
      plan: undefined,
      fileChanges: [],
      terminalCommands: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setSubAgents([]);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

  const handleSendMessage = useCallback((content: string) => {
    const sessionId = activeSessionId;

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'complete',
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, userMsg], updatedAt: new Date(), title: s.messages.length === 0 ? content.slice(0, 50) : s.title }
          : s
      )
    );

    setIsTyping(true);

    const models = ['o3', 'gpt-4.1', 'o4-mini', 'gpt-4.1-mini'];
    const tasks = [
      'Searching codebase for patterns...',
      'Analyzing dependencies and imports...',
      'Running test suite...',
      'Generating code changes...',
      'Reviewing for best practices...',
    ];

    const newAgents: SubAgent[] = [];
    const agentCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < agentCount; i++) {
      newAgents.push({
        id: uid(),
        name: randomAgentName(),
        model: models[Math.floor(Math.random() * models.length)],
        status: 'running',
        task: tasks[Math.floor(Math.random() * tasks.length)],
        progress: 0,
        startTime: new Date(),
        tokensUsed: 0,
      });
    }

    newAgents.forEach((agent, i) => {
      setTimeout(() => {
        setSubAgents((prev) => [...prev, agent]);
      }, 300 + i * 800);
    });

    const progressInterval = setInterval(() => {
      setSubAgents((prev) =>
        prev.map((a) =>
          a.status === 'running'
            ? { ...a, progress: Math.min((a.progress || 0) + Math.random() * 20, 95), tokensUsed: (a.tokensUsed || 0) + Math.floor(Math.random() * 500) }
            : a
        )
      );
    }, 600);

    const delay = 2000 + Math.random() * 2000;
    setTimeout(() => {
      clearInterval(progressInterval);
      setSubAgents((prev) =>
        prev.map((a) =>
          a.status === 'running'
            ? { ...a, status: 'complete', progress: 100, endTime: new Date() }
            : a
        )
      );

      const responseText = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        status: 'complete',
        toolCalls: [
          {
            id: uid(),
            name: 'exec_command',
            status: 'complete',
            input: 'npm test -- --watch=false',
            output: 'PASS  src/App.test.tsx\n  ✓ renders correctly (23ms)\n\nTests: 2 passed, 2 total',
            duration: 3200,
          },
        ],
      };

      setIsTyping(false);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: [...s.messages, assistantMsg], updatedAt: new Date() }
            : s
        )
      );
    }, delay);
  }, [activeSessionId]);

  // Build visible panel set for top bar highlights
  const visiblePanels = new Set<PanelId>();
  const collectPanels = (node: any) => {
    if (typeof node === 'string') visiblePanels.add(node as PanelId);
    else if (node?.children) node.children.forEach(collectPanels);
  };
  collectPanels(layout);

  const msgCount = activeSession?.messages.length || 0;
  const agentCount = subAgents.filter((a) => a.status === 'running').length;

  const messages = activeSession?.messages || [];
  const showWelcome = activeSession && messages.length === 0;

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={sidebarOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
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
          sessionTitle={activeSession?.title || 'CMDui'}
        />

        <div className="content-area">
          {showWelcome ? (
            <WelcomeScreen onSuggestionClick={handleSendMessage} />
          ) : (
            <LayoutEngine
              layout={layout}
              onRemovePanel={removePanel}
              subAgents={subAgents}
              plan={mockPlan}
              fileChanges={mockFileChanges}
              terminalCommands={mockTerminalCommands}
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
          <div className="status-bar-item">o3</div>
          <div className="status-bar-item">{msgCount} messages</div>
          <div className="status-bar-item">{agentCount} agent{agentCount !== 1 ? 's' : ''} active</div>
          <div style={{ flex: 1 }} />
          <div className="status-bar-item">CMDui v1.0.0</div>
        </div>
      </main>
    </div>
  );
}

export default App;
