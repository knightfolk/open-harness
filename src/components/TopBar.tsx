import { useState, useRef, useEffect, useMemo } from 'react';
import {
  PanelLeftClose, PanelLeftOpen, RotateCcw,
  ChevronDown, Check, Wrench,
  Heart, Activity,
} from 'lucide-react';
import type { PanelId } from '../types/layout';
import { ALL_PANELS } from '../types/layout';
import { getPanelIcon, getPanelConfig } from './layout/panelRegistry';

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  visiblePanels: Set<PanelId>;
  onTogglePanel: (id: PanelId) => void;
  onOpenPanel: (id: PanelId) => void;
  onResetLayout: () => void;
  activeModel: string;
  sessionTitle: string;
  workingDir: string | null;
  environmentOpen: boolean;
  onToggleEnvironment: () => void;
  pinnedTools: PanelId[];
  onTogglePinnedTool: (id: PanelId) => void;
}

export function TopBar({
  sidebarOpen, onToggleSidebar, visiblePanels, onTogglePanel, onOpenPanel, onResetLayout,
  activeModel, sessionTitle, workingDir,
  environmentOpen, onToggleEnvironment,
  pinnedTools, onTogglePinnedTool,
}: Props) {
  const modelLabel = activeModel.toLowerCase() === 'auto' ? 'Router' : activeModel;
  const modelDetailPanel: PanelId = activeModel.toLowerCase() === 'auto' ? 'routing-learning' : 'model-lab';
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelMenuIds = useMemo(() =>
    ALL_PANELS.filter((id) => id !== 'chat' && id !== 'sub-agents'),
    [],
  );
  const visibleCount = useMemo(() =>
    panelMenuIds.filter((id) => visiblePanels.has(id)).length,
    [panelMenuIds, visiblePanels],
  );

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

  const panelMenuItems = useMemo(() => panelMenuIds.map((id) => {
    const Icon = getPanelIcon(id);
    const config = getPanelConfig(id);
    const active = visiblePanels.has(id);
    return (
      <button
        key={id}
        className={'panel-menu-item' + (active ? ' active' : '')}
        data-panel-menu-id={id}
        onClick={() => { onTogglePanel(id); setPanelMenuOpen(false); }}
      >
        <Icon size={14} />
        <span className="panel-menu-item-label">{config.label}</span>
        <span
          className={'panel-menu-heart' + (pinnedTools.includes(id) ? ' pinned' : '')}
          role="button"
          tabIndex={0}
          title={pinnedTools.includes(id) ? 'Remove from sidebar' : 'Add to sidebar'}
          aria-label={pinnedTools.includes(id) ? `Remove ${config.label} from sidebar` : `Add ${config.label} to sidebar`}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePinnedTool(id);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            onTogglePinnedTool(id);
          }}
        >
          <Heart size={13} />
        </span>
        {active && <Check size={14} className="panel-menu-check" aria-hidden="true" />}
      </button>
    );
  }), [panelMenuIds, visiblePanels, pinnedTools, onTogglePanel, onTogglePinnedTool]);

  return (
    <div className="top-bar">
      <button className="top-bar-toggle" type="button" onClick={onToggleSidebar} title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'} aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
        {sidebarOpen ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}
      </button>

      <div className="top-bar-title">
        {sessionTitle || 'OpenHarness'}
        {workingDir && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 8 }}>
            {workingDir}
          </span>
        )}
      </div>
      <button
        className="top-bar-model"
        type="button"
        data-model-evidence-entry="true"
        data-model-evidence-panel={modelDetailPanel}
        onClick={() => onOpenPanel(modelDetailPanel)}
        title={activeModel.toLowerCase() === 'auto' ? 'Open Routing Learning for router evidence' : `Open Model Lab for ${activeModel}`}
        aria-label={activeModel.toLowerCase() === 'auto' ? 'Open Routing Learning for router evidence' : `Open Model Lab for model ${activeModel}`}
      >
        <span className="top-bar-model-dot" aria-hidden="true" />
        <span>{modelLabel}</span>
      </button>

      <div className="top-bar-actions">
        <button
          className={'top-bar-action' + (environmentOpen ? ' active' : '')}
          onClick={onToggleEnvironment}
          title={environmentOpen ? 'Hide Environment' : 'Show Environment'}
          aria-label={environmentOpen ? 'Hide Environment' : 'Show Environment'}
        >
          <Activity size={16} aria-hidden="true" />
        </button>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            className={'top-bar-action top-bar-panels-btn' + (panelMenuOpen ? ' active' : '')}
            type="button"
            onClick={() => setPanelMenuOpen(!panelMenuOpen)}
            title="Tools and panels"
            aria-label="Open Tools and panels menu"
          >
            <Wrench size={16} aria-hidden="true" />
            <span className="top-bar-panels-label">Tools</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>

          {panelMenuOpen && (
            <div className="panel-menu">
              <div className="panel-menu-header">
                <span>Tools</span>
                <span className="panel-menu-count">{visibleCount} panels open</span>
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
