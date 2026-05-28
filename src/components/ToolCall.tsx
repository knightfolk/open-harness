import { useState } from 'react';
import { ChevronRight, ChevronDown, Terminal, FileEdit, Search, Loader } from 'lucide-react';
import type { ToolCall as ToolCallType } from '../types';

const toolIcons: Record<string, typeof Terminal> = {
  exec_command: Terminal,
  apply_patch: FileEdit,
  search: Search,
};

interface ToolCallProps {
  toolCall: ToolCallType;
}

export function ToolCallComponent({ toolCall }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = toolIcons[toolCall.name] || Terminal;
  const isRunning = toolCall.status === 'running';

  return (
    <div className="tool-call">
      <div className="tool-call-header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-call-icon">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <Icon size={13} style={{ color: 'var(--text-tertiary)' }} />
        <span className="tool-call-name">{toolCall.name}</span>
        {toolCall.duration != null && (
          <span className="tool-call-duration">{(toolCall.duration / 1000).toFixed(1)}s</span>
        )}
        <div className={`tool-call-status ${toolCall.status}`} />
      </div>
      {expanded && (
        <div className="tool-call-body">
          {toolCall.input && (
            <div style={{ marginBottom: 6, color: 'var(--accent-primary-hover)' }}>
              → {toolCall.input}
            </div>
          )}
          {toolCall.output && (
            <div style={{ color: 'var(--text-secondary)' }}>{toolCall.output}</div>
          )}
          {isRunning && !toolCall.output && (
            <div style={{ color: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader size={12} className="spin" /> Running...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
