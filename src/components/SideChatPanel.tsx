import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, MessageSquare, Trash2, X } from 'lucide-react';
import * as api from '../utils/api';

interface SideMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: 'streaming' | 'complete' | 'error';
  toolCalls?: any[];
}

export function SideChatPanel() {
  const [messages, setMessages] = useState<SideMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    try {
      const s = await api.createSession('Side Chat');
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
              ? { ...m, toolCalls: [...(m.toolCalls || []), { id: tc.id, name: tc.name, status: tc.status, input: tc.input, output: tc.output, duration: tc.duration }] }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mini header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 8px', borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
          <MessageSquare size={12} style={{ color: 'var(--accent-primary)' }} />
          Side Chat
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

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: 12, gap: 8 }}>
            <MessageSquare size={24} style={{ opacity: 0.3 }} />
            <span>Quick side conversation</span>
            <span style={{ fontSize: 10 }}>Ask questions without losing main chat context</span>
          </div>
        )}
        {messages.map((msg) => (
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
              {/* Tool calls */}
              {msg.toolCalls?.map((tc: any) => (
                <div key={tc.id} style={{
                  fontSize: 10, padding: '3px 6px', marginBottom: 4,
                  borderRadius: 4, background: 'var(--bg-secondary)',
                  color: 'var(--text-tertiary)', borderLeft: '2px solid var(--accent-primary)',
                }}>
                  {tc.name} {tc.status === 'running' ? '⋯' : tc.status === 'complete' ? '✓' : '✗'}
                </div>
              ))}
              {/* Content */}
              {msg.content && (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content}
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
        ))}
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
              flex: 1, resize: 'none', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '6px 8px',
              fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', lineHeight: 1.4,
              minHeight: 32, maxHeight: 80,
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
