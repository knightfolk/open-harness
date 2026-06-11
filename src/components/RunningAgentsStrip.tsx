import { Bot, ChevronRight, Loader } from 'lucide-react';
import type { SubAgent } from '../types';

interface Props {
  agents: SubAgent[];
  onFocus: () => void;
}

export function RunningAgentsStrip({ agents, onFocus }: Props) {
  if (!agents || agents.length === 0) return null;
  const running = agents.filter((a) => a.status === 'running').length;
  const waiting = agents.filter((a) => a.status === 'idle').length;
  const total = agents.length;
  const label = running > 0
    ? `${running} working · ${waiting} waiting`
    : waiting > 0
      ? `${waiting} agent${waiting === 1 ? '' : 's'} waiting`
    : `${total} agent${total === 1 ? '' : 's'} tracked`;

  // Show up to three recent agent tasks as quick indicators.
  const recent = agents.slice(-3).reverse();

  return (
    <button type="button" className="running-agents-strip" onClick={onFocus}>
      <span className="running-agents-strip-icon">
        {running > 0 ? <Loader size={13} className="running-agents-spin" /> : <Bot size={13} />}
      </span>
      <span className="running-agents-strip-label">{label}</span>
      <span className="running-agents-strip-tasks">
        {recent.map((a) => (
          <span key={a.id} className="running-agents-strip-task" title={a.task || a.name}>
            <span className={`running-agents-strip-dot ${a.status}`} />
            <span className="running-agents-strip-task-label">{(a.runTrace ? `${a.runTrace.role}` : a.name) || a.task}</span>
          </span>
        ))}
      </span>
      <span className="running-agents-strip-action">
        <span>Focus</span>
        <ChevronRight size={12} />
      </span>
    </button>
  );
}
