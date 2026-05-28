import { X, Bot, ListChecks, Terminal } from 'lucide-react';
import type { PanelView, SubAgent, Plan, FileChange, TerminalCommand } from '../types';
import { SubAgentTracker } from './SubAgentTracker';
import { PlanTracker } from './PlanTracker';

interface Props {
  view: PanelView;
  onClose: () => void;
  subAgents: SubAgent[];
  plan?: Plan;
  fileChanges: FileChange[];
  terminalCommands: TerminalCommand[];
}

const panelTitles: Record<Exclude<PanelView, 'none'>, string> = {
  'sub-agents': 'Sub-Agents',
  'plan': 'Plan',
  'terminal': 'Terminal',
};

const panelIcons: Record<Exclude<PanelView, 'none'>, typeof Bot> = {
  'sub-agents': Bot,
  'plan': ListChecks,
  'terminal': Terminal,
};

export function RightPanel({ view, onClose, subAgents, plan, fileChanges, terminalCommands }: Props) {
  if (view === 'none') return null;

  const Icon = panelIcons[view];
  const title = panelTitles[view];

  return (
    <div className="right-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Icon size={15} />
          {title}
          {view === 'sub-agents' && subAgents.length > 0 && (
            <span className="badge">{subAgents.filter((a) => a.status === 'running').length}</span>
          )}
        </div>
        <button className="panel-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="panel-body">
        {view === 'sub-agents' && <SubAgentTracker agents={subAgents} />}
        {view === 'plan' && plan && <PlanTracker plan={plan} />}
        {view === 'terminal' && (
          <TerminalView commands={terminalCommands} fileChanges={fileChanges} />
        )}
      </div>
    </div>
  );
}

function TerminalView({ commands, fileChanges }: { commands: TerminalCommand[]; fileChanges: FileChange[] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
        Commands
      </div>
      {commands.map((cmd) => (
        <div key={cmd.id} className="terminal-output">
          <div className="terminal-cmd">{cmd.command}</div>
          <div className="terminal-body">{cmd.output}</div>
          <div className={`terminal-exit ${cmd.exitCode !== 0 ? 'error' : ''}`}>
            exit {cmd.exitCode} · {(cmd.duration / 1000).toFixed(1)}s
            {cmd.workingDir && <span style={{ marginLeft: 8 }}>{cmd.workingDir}</span>}
          </div>
        </div>
      ))}

      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 8px' }}>
        File Changes ({fileChanges.length})
      </div>
      {fileChanges.map((fc) => (
        <div key={fc.id} className="file-change-item">
          <span className={`file-change-type ${fc.type}`}>{fc.type}</span>
          <span className="file-change-path">{fc.filePath}</span>
          <span className="file-change-stats">
            {fc.additions > 0 && <span className="file-change-additions">+{fc.additions}</span>}
            {fc.deletions > 0 && <span className="file-change-deletions">-{fc.deletions}</span>}
          </span>
        </div>
      ))}

      {fileChanges.length === 0 && commands.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⌨️</div>
          <div className="empty-state-text">No terminal activity yet</div>
        </div>
      )}
    </div>
  );
}
