import { useState } from 'react';
import { ChevronRight, ChevronDown, Terminal, FileEdit, Search, Loader } from 'lucide-react';
import type { ToolCall as ToolCallType } from '../types';

const toolIcons: Record<string, typeof Terminal> = {
  exec_command: Terminal,
  apply_patch: FileEdit,
  search: Search,
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() || path;
}

function formatBytes(chars: number): string {
  if (chars < 1000) return `${chars} chars`;
  return `${(chars / 1000).toFixed(1)}k chars`;
}

function summarizeToolValue(value?: string): string {
  if (!value) return '';
  const parsed = parseMaybeJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.path === 'string' && typeof obj.content === 'string') {
      return `${basename(obj.path)} (${formatBytes(obj.content.length)})`;
    }
    if (typeof obj.path === 'string') return basename(obj.path);
    if (typeof obj.command === 'string') return obj.command.slice(0, 120);
    if (Array.isArray(obj.entries)) return `${obj.entries.length} entries`;
    if (typeof obj.output === 'string') return formatBytes(obj.output.length);
    if (typeof obj.error === 'string') return obj.error.slice(0, 140);
    return Object.keys(obj).slice(0, 5).join(', ');
  }
  return value.replace(/\s+/g, ' ').trim().slice(0, 160);
}

interface ToolCallProps {
  toolCall: ToolCallType;
}

export function ToolCallComponent({ toolCall }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = toolIcons[toolCall.name] || Terminal;
  const isRunning = toolCall.status === 'running';
  const inputSummary = summarizeToolValue(toolCall.input);
  const outputSummary = summarizeToolValue(toolCall.output);

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
          {inputSummary && (
            <div className="tool-call-row">
              <span className="tool-call-label">Input</span>
              <span>{inputSummary}</span>
            </div>
          )}
          {outputSummary && (
            <div className="tool-call-row">
              <span className="tool-call-label">Output</span>
              <span>{outputSummary}</span>
            </div>
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
