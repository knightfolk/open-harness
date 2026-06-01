import { useMemo, useState } from 'react';
import { Bot, User, Cpu, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import type { Message, ToolCall, ProjectProfile } from '../types';
import { ToolCallComponent } from './ToolCall';
import { CodeBlockComponent } from './CodeBlock';
import { NextBestActions } from './NextBestActions';
import { ConfidenceMeter } from './ConfidenceMeter';
import { PromptMicroscope } from './PromptMicroscope';
import { ArtifactDrawer } from './ArtifactDrawer';
import { analyzeConfidence, deriveNextActions } from '../utils/runSignals';

interface Props {
  message: Message;
  assistantName: string;
  projectProfile?: ProjectProfile | null;
  onSendMessage?: (text: string) => void;
  onRunCommand?: (command: string) => void;
  onCompareModel?: () => void;
}

function parseContent(content: string) {
  const parts: { type: 'text' | 'code'; content: string; lang?: string }[] = [];
  const codeRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2], lang: match[1] || 'text' });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return parts;
}

function renderText(text: string) {
  // Parse inline code-comment directives
  const commentRegex = /::code-comment\{title="([^"]*)" body="([^"]*)" file="([^"]*)" start=(\d+)(?: end=(\d+))? priority=(\d+)\}/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = commentRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex} dangerouslySetInnerHTML={{ __html: simpleMarkdown(text.slice(lastIndex, match.index)) }} />);
    }
    parts.push(
      <div key={match.index} className={`inline-comment priority-${match[6]}`}>
        <div className="inline-comment-title">{match[1]}</div>
        <div className="inline-comment-body">{match[2]}</div>
        <div className="inline-comment-file">{match[3]}:{match[4]}{match[5] ? `-${match[5]}` : ''}</div>
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={lastIndex} dangerouslySetInnerHTML={{ __html: simpleMarkdown(text.slice(lastIndex)) }} />);
  }

  return parts;
}

function simpleMarkdown(text: string): string {
  // Escape HTML first
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Block-level: headers (must come before list items)
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Block-level: blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Block-level: unordered list items
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');

  // Block-level: ordered list items
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');

  // Paragraphs: double newlines become paragraph breaks
  html = html.replace(/\n\n/g, '</p><p>');
  // Single newlines become line breaks (but not inside block elements)
  html = html.replace(/\n/g, '<br/>');

  // Inline: bold, italic, code, links (after escaping)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  return '<p>' + html + '</p>';
}

const avatarIcons = {
  user: <User size={14} />,
  assistant: <Bot size={14} />,
  system: <Cpu size={14} />,
};

const senderNames = {
  user: 'You',
  system: 'System',
};


function stripThinking(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trimStart();
}

function toolVerb(status: ToolCall['status']) {
  if (status === 'running') return 'using';
  if (status === 'error') return 'had trouble with';
  return 'used';
}

function ToolCallSummary({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const uniqueTools = useMemo(() => {
    const map = new Map<string, ToolCall>();
    for (const tool of toolCalls) map.set(tool.id, tool);
    return Array.from(map.values());
  }, [toolCalls]);
  const running = uniqueTools.filter((tool) => tool.status === 'running').length;
  const errors = uniqueTools.filter((tool) => tool.status === 'error').length;
  const primaryStatus = running > 0 ? 'running' : errors > 0 ? 'error' : 'complete';
  const label = running > 0
    ? `Using ${running} tool${running === 1 ? '' : 's'}…`
    : `Used ${uniqueTools.length} tool${uniqueTools.length === 1 ? '' : 's'}`;

  return (
    <div className={`tool-summary ${primaryStatus}`}>
      <button className="tool-summary-button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <Wrench size={13} />
        <span>{label}</span>
        {errors > 0 && <span className="tool-summary-error">{errors} failed</span>}
      </button>
      {expanded && (
        <div className="tool-summary-details">
          {uniqueTools.map((tool) => (
            <div key={tool.id} className="tool-summary-item">
              <span>{toolVerb(tool.status)} {tool.name}</span>
              {tool.duration != null && <span>{(tool.duration / 1000).toFixed(1)}s</span>}
            </div>
          ))}
          <div className="tool-summary-advanced">
            {uniqueTools.map((tool) => <ToolCallComponent key={tool.id} toolCall={tool} />)}
          </div>
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message, assistantName, projectProfile, onSendMessage, onRunCommand, onCompareModel }: Props) {
  const visibleContent = stripThinking(message.content);
  const parts = parseContent(visibleContent);
  const isStreaming = message.status === 'streaming';
  const isAssistant = message.role === 'assistant';

  // Compute delight signals for assistant messages
  const confidenceSignals = useMemo(
    () => isAssistant && !isStreaming ? analyzeConfidence(message) : null,
    [isAssistant, isStreaming, message]
  );
  const nextActions = useMemo(
    () => isAssistant && !isStreaming ? deriveNextActions(message, projectProfile) : [],
    [isAssistant, isStreaming, message, projectProfile]
  );

  return (
    <div className="message-wrapper">
      <div className="message">
        <div className={`message-avatar ${message.role}`}>
          {avatarIcons[message.role]}
        </div>
        <div className="message-body">
          <div className="message-sender">
            {message.role === 'assistant' ? assistantName : senderNames[message.role]}
            <span className="timestamp">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {/* Confidence badge inline with sender */}
            {confidenceSignals && (
              <ConfidenceMeter signals={confidenceSignals} />
            )}
          </div>
          <div className="message-content">
            {parts.map((part, i) =>
              part.type === 'code' ? (
                <CodeBlockComponent key={i} language={part.lang || 'text'} code={part.content} />
              ) : (
                <div key={i}>{renderText(part.content)}</div>
              )
            )}
            {isStreaming && (
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            )}
          </div>
          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallSummary toolCalls={message.toolCalls} />
          )}

          {/* ── Delight features for completed assistant messages ── */}
          {isAssistant && !isStreaming && (
            <>
              {/* Artifact drawer */}
              <ArtifactDrawer message={message} />

              {/* Prompt microscope */}
              <PromptMicroscope runTrace={message.runTrace} />

              {/* Next best actions */}
              {onSendMessage && nextActions.length > 0 && (
                <NextBestActions
                  actions={nextActions}
                  onSendMessage={onSendMessage}
                  onRunCommand={onRunCommand}
                  onCompareModel={onCompareModel}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
