import { Bot, User, Cpu } from 'lucide-react';
import type { Message } from '../types';
import { ToolCallComponent } from './ToolCall';
import { CodeBlockComponent } from './CodeBlock';

interface Props {
  message: Message;
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
  const parts: any[] = [];
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
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:600;margin:12px 0 6px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;margin:14px 0 8px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:17px;font-weight:700;margin:16px 0 8px">$1</h2>')
    .replace(/^(\d+)\. (.+)$/gm, '<div style="padding-left:16px;margin:2px 0">$1. $2</div>')
    .replace(/^- (.+)$/gm, '<div style="padding-left:16px;margin:2px 0">• $1</div>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

const avatarIcons = {
  user: <User size={14} />,
  assistant: <Bot size={14} />,
  system: <Cpu size={14} />,
};

const senderNames = {
  user: 'You',
  assistant: 'Codex',
  system: 'System',
};

export function MessageBubble({ message }: Props) {
  const parts = parseContent(message.content);
  const isStreaming = message.status === 'streaming';

  return (
    <div className="message-wrapper">
      <div className="message">
        <div className={`message-avatar ${message.role}`}>
          {avatarIcons[message.role]}
        </div>
        <div className="message-body">
          <div className="message-sender">
            {senderNames[message.role]}
            <span className="timestamp">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
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
            <div className="tool-calls">
              {message.toolCalls.map((tc) => (
                <ToolCallComponent key={tc.id} toolCall={tc} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
