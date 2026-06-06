import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, MessageSquare, Trash2 } from 'lucide-react';
import * as api from '../utils/api';
import { MarkdownContent } from './MarkdownContent';

interface SideChatModel {
  id: string;
  name: string;
}

interface Props {
  activeModel: string;
  models: SideChatModel[];
  activeSessionId?: string;
  workingDir?: string | null;
}

interface SideMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'streaming' | 'complete' | 'error';
  toolCalls?: SideToolCall[];
}

interface SideToolCall {
  id: string;
  name: string;
  status: 'running' | 'complete' | 'error';
  input?: string;
  output?: string;
  duration?: number;
}

const SIDE_CHAT_MODEL_KEY = 'openharness.side-chat.model.v1';
const SIDE_CHAT_INCLUDE_MAIN_KEY = 'openharness.side-chat.include-main.v1';

const TOOL_ACTIVITY_COPY: Record<string, { running: string; complete: string; error: string }> = {
  web_fetch: {
    running: 'Opening a tiny window to the web...',
    complete: 'Brought back fresh web context.',
    error: 'The web trail went cold.',
  },
  browser_navigate: {
    running: 'Walking the browser to the right page...',
    complete: 'Browser landed on the page.',
    error: 'The browser missed the turn.',
  },
  browser_snapshot: {
    running: 'Taking a quick look around the page...',
    complete: 'Page scan is in hand.',
    error: 'Could not get a clean page scan.',
  },
  browser_click: {
    running: 'Pressing the right button...',
    complete: 'Click landed.',
    error: 'That click did not take.',
  },
  browser_type: {
    running: 'Typing carefully...',
    complete: 'Text is in place.',
    error: 'Typing stumbled.',
  },
  read_file: {
    running: 'Reading the relevant file...',
    complete: 'File context loaded.',
    error: 'Could not read that file.',
  },
  list_directory: {
    running: 'Peeking inside the folder...',
    complete: 'Folder map loaded.',
    error: 'Could not list that folder.',
  },
  exec_command: {
    running: 'Running a quick command...',
    complete: 'Command came back.',
    error: 'Command hit a snag.',
  },
};

function toolActivityText(toolCalls?: SideToolCall[]) {
  if (!toolCalls?.length) return null;
  const latestRunning = [...toolCalls].reverse().find((tool) => tool.status === 'running');
  const latest = latestRunning || toolCalls[toolCalls.length - 1];
  const copy = TOOL_ACTIVITY_COPY[latest.name];
  if (copy) return copy[latest.status];

  const readableName = latest.name.replace(/^browser_/, '').replace(/_/g, ' ');
  if (latest.status === 'running') return `Working with ${readableName}...`;
  if (latest.status === 'complete') return `Finished ${readableName}.`;
  return `${readableName} hit a snag.`;
}

function loadSideChatModel(activeModel: string) {
  try {
    return localStorage.getItem(SIDE_CHAT_MODEL_KEY) || activeModel;
  } catch {
    return activeModel;
  }
}

function loadIncludeMainChat() {
  try {
    return localStorage.getItem(SIDE_CHAT_INCLUDE_MAIN_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function SideChatPanel({ activeModel, models, activeSessionId, workingDir }: Props) {
  const [messages, setMessages] = useState<SideMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(() => loadSideChatModel(activeModel));
  const [includeMainChat, setIncludeMainChat] = useState(loadIncludeMainChat);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<Map<string, string>>(new Map());
  const modelOptions = useMemo(
    () => models.length > 0 ? models : [{ id: activeModel, name: activeModel }],
    [activeModel, models],
  );
  const fallbackModel = modelOptions.length > 0 ? modelOptions[0].id : activeModel;
  const effectiveModel = modelOptions.some((m) => m.id === selectedModel) ? selectedModel : fallbackModel;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!modelOptions.some((m) => m.id === selectedModel)) setSelectedModel(fallbackModel);
  }, [modelOptions, selectedModel, fallbackModel]);

  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    streamingRef.current.clear();
  }, [activeSessionId, workingDir]);

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    try {
      const s = await api.createSession('Side Chat', workingDir || undefined);
      setSessionId(s.id);
      return s.id;
    } catch { return null; }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const content = input.trim();
    setInput('');

    const userMsg: SideMessage = {
      id: Math.random().toString(36).slice(2, 10),
      role: 'user',
      content,
      timestamp: new Date(),
      status: 'complete',
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const sId = await ensureSession();
    if (!sId) { setIsTyping(false); return; }

    const assistantId = Math.random().toString(36).slice(2, 10);
    streamingRef.current.set(assistantId, '');

    try {
      await api.sendMessage(sId, content, {
        onUserMessage: () => {},
        onAssistantStart: () => {
          setMessages((prev) => [...prev, {
            id: assistantId, role: 'assistant', content: '', timestamp: new Date(), status: 'streaming',
          }]);
        },
        onText: (_id, text) => {
          streamingRef.current.set(assistantId, (streamingRef.current.get(assistantId) || '') + text);
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, content: streamingRef.current.get(assistantId) || '' } : m
          ));
        },
        onToolCall: (tc) => {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  toolCalls: (() => {
                    const nextTool = { id: tc.id, name: tc.name, status: tc.status, input: tc.input, output: tc.output, duration: tc.duration };
                    const existing = m.toolCalls || [];
                    const index = existing.findIndex((tool) => tool.id === tc.id);
                    return index >= 0
                      ? existing.map((tool, i) => (i === index ? { ...tool, ...nextTool } : tool))
                      : [...existing, nextTool];
                  })(),
                }
              : m
          ));
        },
        onError: (error) => {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Error: ${error}`, status: 'error' } : m
          ));
        },
        onDone: () => {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, status: 'complete' } : m
          ));
          setIsTyping(false);
        },
      }, {
        modelId: effectiveModel,
        sideChat: {
          includeMainChat,
          mainSessionId: activeSessionId,
        },
      });
    } catch {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    streamingRef.current.clear();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    try { localStorage.setItem(SIDE_CHAT_MODEL_KEY, modelId); } catch { /* ignore */ }
  };

  const handleIncludeMainChatChange = (checked: boolean) => {
    setIncludeMainChat(checked);
    try { localStorage.setItem(SIDE_CHAT_INCLUDE_MAIN_KEY, checked ? 'true' : 'false'); } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mini header */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 5,
        padding: '6px 8px', borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <MessageSquare size={12} style={{ color: 'var(--accent-primary)' }} />
            <select
              value={effectiveModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isTyping || modelOptions.length <= 1}
              title="Side chat model"
              aria-label="Side chat model"
              style={{
                minWidth: 0,
                width: '100%',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
                borderRadius: 5,
                padding: '3px 22px 3px 7px',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>{model.name || model.id}</option>
              ))}
            </select>
          </div>
          {messages.length > 0 && (
            <button onClick={clearChat} title="Clear chat" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
              padding: 2, display: 'flex', alignItems: 'center',
            }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
        <label
          title="Share the active main chat transcript with side chat"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            color: 'var(--text-tertiary)',
            fontSize: 10,
            fontWeight: 600,
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={includeMainChat}
            disabled={isTyping}
            onChange={(e) => handleIncludeMainChatChange(e.target.checked)}
            aria-label="Use main chat context"
            style={{ width: 12, height: 12, margin: 0, accentColor: 'var(--accent-primary)' }}
          />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Main chat</span>
        </label>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 12, gap: 8 }}>
            <MessageSquare size={24} style={{ opacity: 0.3 }} />
            <span>Quick side conversation</span>
            <span style={{ fontSize: 10 }}>{includeMainChat ? 'Ask with main chat context' : 'Ask without main chat context'}</span>
          </div>
        )}
        {messages.map((msg) => {
          const activityText = toolActivityText(msg.toolCalls);
          return (
            <div key={msg.id} style={{
              marginBottom: 8,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '6px 10px',
                borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                fontSize: 12,
                lineHeight: 1.5,
                border: msg.role === 'assistant' ? '1px solid var(--border-primary)' : 'none',
              }}>
                {/* Tool activity */}
                {activityText && (
                  <div className={`side-chat-tool-activity ${msg.toolCalls?.some((tc) => tc.status === 'running') ? 'running' : ''}`}>
                    <span className="side-chat-tool-activity-dot" />
                    <span>{activityText}</span>
                  </div>
                )}
              {/* Content */}
              {msg.content && (
                <div className="side-chat-message-content">
                  <MarkdownContent content={msg.content} />
                </div>
              )}
              {msg.status === 'streaming' && !msg.content && (
                <div style={{ display: 'flex', gap: 3 }}>
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-tertiary)', animation: 'pulse 1s ease-in-out infinite' }} />
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-tertiary)', animation: 'pulse 1s ease-in-out 0.2s infinite' }} />
                  <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-tertiary)', animation: 'pulse 1s ease-in-out 0.4s infinite' }} />
                </div>
              )}
            </div>
          </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '6px 8px 8px', borderTop: '1px solid var(--border-primary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Quick question..."
            rows={1}
            disabled={isTyping}
            style={{
              flex: 1, minWidth: 0, resize: 'none', overflow: 'hidden', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '6px 8px',
              fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', lineHeight: 1.4,
              height: 32, minHeight: 32,
            }}
          />
          <button onClick={handleSend} disabled={!input.trim() || isTyping} style={{
            background: input.trim() && !isTyping ? 'var(--accent-primary)' : 'var(--bg-active)',
            color: input.trim() && !isTyping ? 'white' : 'var(--text-tertiary)',
            border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 8px',
            cursor: input.trim() && !isTyping ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 32, minWidth: 32, transition: 'all var(--transition-fast)',
          }}>
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
