import {
  PanelLeftClose, PanelLeftOpen, Bot, ListChecks, Terminal,
  GitBranch, MoreHorizontal
} from 'lucide-react';
import type { PanelView } from '../types';

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  panelView: PanelView;
  onTogglePanel: (view: PanelView) => void;
  sessionTitle: string;
}

export function TopBar({ sidebarOpen, onToggleSidebar, panelView, onTogglePanel, sessionTitle }: Props) {
  return (
    <div className="top-bar">
      <button className="top-bar-toggle" onClick={onToggleSidebar} title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="top-bar-title">{sessionTitle || 'CMDui'}</div>

      <div className="top-bar-model">
        <span className="top-bar-model-dot" />
        o3
      </div>

      <div className="top-bar-actions">
        <button
          className={`top-bar-action ${panelView === 'sub-agents' ? 'active' : ''}`}
          onClick={() => onTogglePanel(panelView === 'sub-agents' ? 'none' : 'sub-agents')}
          title="Sub-agents"
        >
          <Bot size={16} />
        </button>
        <button
          className={`top-bar-action ${panelView === 'plan' ? 'active' : ''}`}
          onClick={() => onTogglePanel(panelView === 'plan' ? 'none' : 'plan')}
          title="Plan"
        >
          <ListChecks size={16} />
        </button>
        <button
          className={`top-bar-action ${panelView === 'terminal' ? 'active' : ''}`}
          onClick={() => onTogglePanel(panelView === 'terminal' ? 'none' : 'terminal')}
          title="Terminal & Files"
        >
          <Terminal size={16} />
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border-primary)', margin: '0 4px' }} />

        <button className="top-bar-action" title="Git status">
          <GitBranch size={16} />
        </button>
        <button className="top-bar-action" title="More options">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
