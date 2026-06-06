import { useRef, useEffect, useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { Send, Paperclip, Image, AtSign, Command } from 'lucide-react';
import type { Message, SubAgent } from '../types';
import { MessageBubble } from './MessageBubble';
import { shortModelName } from '../utils/modelDisplay';
import { SmartWelcome } from './SmartWelcome';
import type { ProjectProfile } from '../types';
import { EnvironmentRail } from './EnvironmentRail';

interface Props {
  messages: Message[];
  isTyping: boolean;
  onSendMessage: (msg: string) => void;
  activeModel: string;
  workingDir?: string | null;
  projectProfile?: ProjectProfile | null;
  onCompareModel?: () => void;
  onProposePatch?: (diffText: string, explanation?: string) => void;
  trustMode: string;
  subAgents: SubAgent[];
  onReviewChanges: () => void;
  onFocusAgents: () => void;
  environmentOpen: boolean;
  onEnvironmentOpenChange: (open: boolean) => void;
}

const SUPER_WIDTH_KEY = 'openharness.chat-super.width.v1';

function loadSuperWidth() {
  try {
    const raw = localStorage.getItem(SUPER_WIDTH_KEY);
    const width = raw ? Number(raw) : 330;
    return Number.isFinite(width) ? Math.min(520, Math.max(260, width)) : 330;
  } catch {
    return 330;
  }
}

export function ChatPanel({ messages, isTyping, onSendMessage, activeModel, workingDir, projectProfile, onCompareModel, onProposePatch, trustMode, subAgents, onReviewChanges, onFocusAgents, environmentOpen, onEnvironmentOpenChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [superWidth, setSuperWidth] = useState(loadSuperWidth);
  const [inputHeight, setInputHeight] = useState(112);
  const superHidden = !environmentOpen;
  const userScrolledUpRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const previousLastContentLengthRef = useRef(0);
  const assistantName = shortModelName(activeModel);
  const showTypingPlaceholder = isTyping && messages[messages.length - 1]?.status !== 'streaming';

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Keep the latest response pinned to the bottom unless the user has intentionally scrolled up.
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    const contentLength = lastMsg?.content?.length || 0;
    const messageAdded = messages.length > previousMessageCountRef.current;
    const streamingGrew = lastMsg?.status === 'streaming' && contentLength > previousLastContentLengthRef.current;
    const shouldFollow = messageAdded || (!userScrolledUpRef.current && (streamingGrew || isTyping));

    previousMessageCountRef.current = messages.length;
    previousLastContentLengthRef.current = contentLength;

    if (shouldFollow) requestAnimationFrame(scrollToBottom);
  }, [messages, isTyping, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const atBottom = isNearBottom();
    userScrolledUpRef.current = !atBottom;
    setUserScrolledUp(!atBottom);
  }, [isNearBottom]);

  // Handle run-command actions from NextBestActions
  const handleRunCommand = useCallback((command: string) => {
    onSendMessage(`Run this command: \`${command}\``);
  }, [onSendMessage]);

  // Handle compare-model actions
  const handleCompareModel = useCallback(() => {
    onCompareModel?.();
  }, [onCompareModel]);

  const hideSuperPanel = useCallback(() => {
    onEnvironmentOpenChange(false);
  }, [onEnvironmentOpenChange]);

  const startResizeSuper = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = superWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const next = Math.min(520, Math.max(260, startWidth - (moveEvent.clientX - startX)));
      setSuperWidth(next);
      try { localStorage.setItem(SUPER_WIDTH_KEY, String(next)); } catch { /* ignore */ }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.classList.remove('is-resizing-panel');
    };
    document.body.classList.add('is-resizing-panel');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [superWidth]);

  useEffect(() => {
    if (!isTyping) return;
    const width = rootRef.current?.clientWidth || window.innerWidth;
    if (width < 940) return;
    onEnvironmentOpenChange(true);
  }, [isTyping, onEnvironmentOpenChange]);

  return (
    <div ref={rootRef} className={`chat-panel-root ${superHidden ? 'has-hidden-super' : 'has-floating-super'}`} style={{ '--floating-super-width': `${superWidth}px`, '--chat-input-height': `${inputHeight}px` } as CSSProperties}>
      <div className="messages" ref={scrollRef} onScroll={handleScroll}>
        {messages.length === 0 && !isTyping && (
          <SmartWelcome workingDir={workingDir || null} projectProfile={projectProfile || null} onSuggestionClick={onSendMessage} />
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            assistantName={assistantName}
            projectProfile={projectProfile}
            onSendMessage={onSendMessage}
            onRunCommand={handleRunCommand}
            onCompareModel={handleCompareModel}
            onProposePatch={onProposePatch}
          />
        ))}
        {showTypingPlaceholder && (
          <div className="message-wrapper">
            <div className="message">
              <div className="message-avatar assistant" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: 'white' }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
              </div>
              <div className="message-body">
                <div className="message-sender">{assistantName}</div>
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {userScrolledUp && (
        <button className="scroll-to-bottom-pill" onClick={() => { setUserScrolledUp(false); scrollToBottom(); }}>
          ↓ New messages below
        </button>
      )}
      <div className={`floating-super-panel ${superHidden ? 'hidden' : ''}`} style={{ width: superWidth }} aria-hidden={superHidden}>
        <div className="floating-super-resizer" onMouseDown={startResizeSuper} role="separator" aria-orientation="vertical" aria-label="Resize Environment panel" />
        <EnvironmentRail
          workingDir={workingDir || null}
          trustMode={trustMode}
          subAgents={subAgents}
          onReviewChanges={onReviewChanges}
          onFocusAgents={onFocusAgents}
          onHide={hideSuperPanel}
          variant="floating"
        />
      </div>
      <ChatInputInline onSend={onSendMessage} disabled={isTyping} onHeightChange={setInputHeight} />
    </div>
  );
}

function ChatInputInline({ onSend, disabled, onHeightChange }: { onSend: (msg: string) => void; disabled?: boolean; onHeightChange?: (height: number) => void }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = inputAreaRef.current;
    if (!element || !onHeightChange) return;
    const report = () => onHeightChange(Math.ceil(element.getBoundingClientRect().height));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, []);

  const handleChange = (nextValue: string) => {
    setValue(nextValue);
    requestAnimationFrame(resizeTextarea);
  };

  const handleSend = () => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="input-area" ref={inputAreaRef}>
      <div className="input-container">
        <div className="input-top">
          <textarea
            ref={textareaRef}
            className="input-textarea"
            placeholder="Ask anything... (Enter to send)"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
          />
          <button className="input-send" onClick={handleSend} disabled={!value.trim() || disabled}>
            <Send size={16} />
          </button>
        </div>
        <div className="input-bottom">
          <div className="input-attachments">
            <button className="input-attachment-btn" title="Attach file"><Paperclip size={14} /></button>
            <button className="input-attachment-btn" title="Attach image"><Image size={14} /></button>
            <button className="input-attachment-btn" title="Mention skill"><AtSign size={14} /></button>
            <button className="input-attachment-btn" title="Run command"><Command size={14} /></button>
          </div>
          <div className="input-hint">{value.length > 0 ? `${value.length} chars` : 'Shift+Enter for new line'}</div>
        </div>
      </div>
    </div>
  );
}
