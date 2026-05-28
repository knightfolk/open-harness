import {
  PanelLeftClose, PanelLeftOpen, MoreHorizontal, RotateCcw,
  FolderOpen,
} from 'lucide-react';
import type { PanelId } from '../types/layout';
import { ALL_PANELS } from '../types/layout';
import { getPanelIcon, getPanelConfig } from './layout/panelRegistry';

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  visiblePanels: Set<PanelId>;
  onTogglePanel: (id: PanelId) => void;
  onResetLayout: () => void;
  sessionTitle: string;
  workingDir: string | null;
  onOpenFolder: () => void;
}

export function TopBar({ sidebarOpen, onToggleSidebar, visiblePanels, onTogglePanel, onResetLayout, sessionTitle, workingDir, onOpenFolder }: Props) {
  return (
    <div className="top-bar">
      <button className="top-bar-toggle" onClick={onToggleSidebar} title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      <div className="top-bar-title">
        {sessionTitle || 'CMDui'}
        {workingDir && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 8 }}>
            {workingDir}
          </span>
        )}
      </div>

      <div className="top-bar-model">
        <span className="top-bar-model-dot" />
        MiniMax-M2.7
      </div>

      <div className="top-bar-actions">
        <button
          className="top-bar-action"
          onClick={onOpenFolder}
          title="Open folder"
        >
          <FolderOpen size={16} />
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border-primary)', margin: '0 4px' }} />

        {ALL_PANELS.map((id) => {
          const Icon = getPanelIcon(id);
          const config = getPanelConfig(id);
          const active = visiblePanels.has(id);
          return (
            <button
              key={id}
              className={`top-bar-action ${active ? 'active' : ''}`}
              onClick={() => onTogglePanel(id)}
              title={config.label}
            >
              <Icon size={16} />
            </button>
          );
        })}

        <div style={{ width: 1, height: 20, background: 'var(--border-primary)', margin: '0 4px' }} />

        <button className="top-bar-action" onClick={onResetLayout} title="Reset layout">
          <RotateCcw size={16} />
        </button>
        <button className="top-bar-action" title="More options">
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
}
