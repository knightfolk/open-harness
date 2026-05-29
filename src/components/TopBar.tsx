import { useState, useRef, useEffect } from 'react';
import {
  PanelLeftClose, PanelLeftOpen, RotateCcw, FolderOpen,
  ChevronDown, Check, LayoutGrid,
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
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const visibleCount = visiblePanels.size;

  useEffect(() => {
    if (!panelMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPanelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelMenuOpen]);

  const panelToggles = ALL_PANELS.map((id) => {
    const Icon = getPanelIcon(id);
    const config = getPanelConfig(id);
    const active = visiblePanels.has(id);
    const label = (active ? 'Hide ' : 'Show ') + config.label;
    const cls = 'top-bar-action' + (active ? ' active' : '');
    return (
      <button key={id} className={cls} onClick={() => onTogglePanel(id)} title={label}>
        <Icon size={16} />
      </button>
    );
  });

  const panelMenuItems = ALL_PANELS.map((id) => {
    const Icon = getPanelIcon(id);
    const config = getPanelConfig(id);
    const active = visiblePanels.has(id);
    return (
      <button
        key={id}
        className={'panel-menu-item' + (active ? ' active' : '')}
        onClick={() => { onTogglePanel(id); setPanelMenuOpen(false); }}
      >
        <Icon size={14} />
        <span className="panel-menu-item-label">{config.label}</span>
        {active && <Check size={14} className="panel-menu-check" />}
      </button>
    );
  });

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
        <button className="top-bar-action" onClick={onOpenFolder} title="Open folder">
          <FolderOpen size={16} />
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border-primary)', margin: '0 4px' }} />

        {panelToggles}

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            className={'top-bar-action top-bar-panels-btn' + (panelMenuOpen ? ' active' : '')}
            onClick={() => setPanelMenuOpen(!panelMenuOpen)}
            title="Manage panels"
          >
            <LayoutGrid size={16} />
            <span className="top-bar-panels-label">Panels</span>
            <ChevronDown size={12} />
          </button>

          {panelMenuOpen && (
            <div className="panel-menu">
              <div className="panel-menu-header">
                <span>Panels</span>
                <span className="panel-menu-count">{visibleCount} active</span>
              </div>
              {panelMenuItems}
              <div className="panel-menu-separator" />
              <button className="panel-menu-item" onClick={() => { onResetLayout(); setPanelMenuOpen(false); }}>
                <RotateCcw size={14} />
                <span className="panel-menu-item-label">Reset to default layout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
