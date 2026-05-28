import { useState, useRef, useEffect, useCallback } from 'react';
import type { PanelView, Message, Session, SubAgent } from './types';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { MessageBubble } from './components/MessageBubble';
import { ChatInput } from './components/ChatInput';
import { WelcomeScreen } from './components/WelcomeScreen';
import { RightPanel } from './components/RightPanel';
import { mockSessions, mockSubAgents, mockPlan, mockFileChanges, mockTerminalCommands } from './utils/mockData';
import { randomAgentName } from './utils/names';
import './styles/global.css';
import './styles/components.css';

const uid = () => Math.random().toString(36).slice(2, 10);

const mockResponses = [
  "I've analyzed the codebase and found several optimization opportunities. Let me implement the changes step by step.\n\nFirst, let me look at the component structure:\n\n```tsx\nconst optimizedComponent = useMemo(() => {\n  return data.filter(item => item.active)\n    .map(item => transform(item));\n}, [data]);\n```\n\nThis reduces unnecessary re-renders by memoizing the computed values. I'll apply this pattern across all heavy components.",
  "Here's what I found during the review:\n\n**Architecture**\n- The current state management uses prop drilling — consider Context or Zustand\n- API calls lack error boundaries\n- Missing loading states for async operations\n\n**Performance**\n- Three components re-render on every keystroke\n- Bundle size can be reduced by 40% with tree shaking\n\nLet me fix these issues systematically.\n\n::code-comment{title=\"[P1] Missing error boundary\" body=\"The API wrapper swallows errors silently. Add proper error handling with user-facing feedback.\" file=\"/src/utils/api.ts\" start=24 priority=1}",
  "Building the feature now. I'll scaffold the components and wire up the state management.\n\n```typescript\ninterface FeatureConfig {\n  enabled: boolean;\n  theme: 'light' | 'dark';\n  agents: AgentConfig[];\n}\n```\n\nI've also added unit tests:\n\n```bash\n$ npm test\n\nPASS  src/__tests__/feature.test.ts\n  ✓ should initialize with default config (3ms)\n  ✓ should toggle theme correctly (1ms)\n  ✓ should handle empty agent list (1ms)\n```\n\nAll tests passing. Ready for review.",
  "Sure! Here's the implementation plan:\n\n1. **Data Layer** — Set up the store with typed actions\n2. **UI Layer** — Build the component tree with proper composition\n3. **Integration** — Wire up events and side effects\n4. **Testing** — Add unit and integration tests\n5. **Documentation** — Write inline docs and usage examples\n\nShall I proceed with implementation?",
];

// Give initial agents random names
const namedAgents: SubAgent[] = mockSubAgents.map(a => ({ ...a, name: randomAgentName() }));

function App() {
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(mockSessions[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelView, setPanelView] = useState<PanelView>('none');
  const [isTyping, setIsTyping] = useState(false);
  const [subAgents, setSubAgents] = useState<SubAgent[]>(namedAgents);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, scrollToBottom]);

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

  const handleSendMessage = (content: string) => {
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

    // Spawn sub-agents during the response
    const newAgents: SubAgent[] = [];
    const models = ['o3', 'gpt-4.1', 'o4-mini', 'gpt-4.1-mini'];
    const tasks = [
      'Searching codebase for patterns...',
      'Analyzing dependencies and imports...',
      'Running test suite...',
      'Generating code changes...',
      'Reviewing for best practices...',
    ];

    // Spawn 1-3 agents with staggered timing
    const agentCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < agentCount; i++) {
      const agent: SubAgent = {
        id: uid(),
        name: randomAgentName(),
        model: models[Math.floor(Math.random() * models.length)],
        status: 'running',
        task: tasks[Math.floor(Math.random() * tasks.length)],
        progress: 0,
        startTime: new Date(),
        tokensUsed: 0,
      };
      newAgents.push(agent);
    }

    // Add agents with staggered appearance
    newAgents.forEach((agent, i) => {
      setTimeout(() => {
        setSubAgents((prev) => [...prev, agent]);
      }, 300 + i * 800);
    });

    // Progress simulation
    const progressInterval = setInterval(() => {
      setSubAgents((prev) =>
        prev.map((a) =>
          a.status === 'running'
            ? { ...a, progress: Math.min((a.progress || 0) + Math.random() * 20, 95), tokensUsed: (a.tokensUsed || 0) + Math.floor(Math.random() * 500) }
            : a
        )
      );
    }, 600);

    // Complete agents and send response
    const delay = 2000 + Math.random() * 2000;
    setTimeout(() => {
      clearInterval(progressInterval);

      // Mark all running agents as complete
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
            output: 'PASS  src/App.test.tsx\n  ✓ renders correctly (23ms)\n  ✓ handles user input (15ms)\n\nTests: 2 passed, 2 total',
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
  };

  const handleTogglePanel = (view: PanelView) => {
    setPanelView(view);
  };

  const handleSuggestionClick = (text: string) => {
    handleSendMessage(text);
  };

  const msgCount = activeSession?.messages.length || 0;
  const agentCount = subAgents.filter((a) => a.status === 'running').length;

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
          panelView={panelView}
          onTogglePanel={handleTogglePanel}
          sessionTitle={activeSession?.title || 'CMDui'}
        />

        <div className="content-area">
          <div className="chat-container">
            {activeSession && activeSession.messages.length === 0 ? (
              <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
            ) : (
              <div className="messages">
                {activeSession?.messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isTyping && (
                  <div className="message-wrapper">
                    <div className="message">
                      <div className="message-avatar assistant" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white' }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                      </div>
                      <div className="message-body">
                        <div className="message-sender">Codex</div>
                        <div className="typing-indicator">
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                          <div className="typing-dot" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
            <ChatInput onSend={handleSendMessage} disabled={isTyping} />
          </div>

          <RightPanel
            view={panelView}
            onClose={() => setPanelView('none')}
            subAgents={subAgents}
            plan={activeSession?.plan || mockPlan}
            fileChanges={activeSession?.fileChanges || mockFileChanges}
            terminalCommands={activeSession?.terminalCommands || mockTerminalCommands}
          />
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-bar-item">
            <div className="status-bar-dot" />
            Connected
          </div>
          <div className="status-bar-item">
            o3
          </div>
          <div className="status-bar-item">
            {msgCount} messages
          </div>
          <div className="status-bar-item">
            {agentCount} agent{agentCount !== 1 ? 's' : ''} active
          </div>
          <div style={{ flex: 1 }} />
          <div className="status-bar-item">
            CMDui v1.0.0
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
