import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  PanelLeftClose, PanelLeftOpen, RotateCcw,
  ChevronDown, Check, Wrench,
  Activity, MessageSquare, PanelBottom, PanelRight, ArrowLeftRight,
} from 'lucide-react';
import type { PanelId, PanelPlacement } from '../types/layout';
import { ALL_PANELS, defaultPanelPlacement, oppositePanelPlacement } from '../types/layout';
import { getPanelIcon, getPanelConfig } from './layout/panelRegistry';

const PANEL_PLACEMENT_OVERRIDES_KEY = 'openharness.panel-placement-overrides.v1';

function isPanelPlacement(value: unknown): value is PanelPlacement {
  return value === 'right' || value === 'bottom';
}

function loadPanelPlacementOverrides(): Partial<Record<PanelId, PanelPlacement>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(PANEL_PLACEMENT_OVERRIDES_KEY) || '{}') as Record<string, unknown>;
    const panelIds = new Set<string>(ALL_PANELS);
    const next: Partial<Record<PanelId, PanelPlacement>> = {};
    for (const [id, placement] of Object.entries(parsed)) {
      if (panelIds.has(id) && isPanelPlacement(placement)) {
        next[id as PanelId] = placement;
      }
    }
    return next;
  } catch {
    return {};
  }
}

function savePanelPlacementOverrides(overrides: Partial<Record<PanelId, PanelPlacement>>) {
  try {
    localStorage.setItem(PANEL_PLACEMENT_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Non-essential preference storage can fail in restricted browser contexts.
  }
}

function placementLabel(placement: PanelPlacement) {
  return placement === 'right' ? 'right pane' : 'bottom pane';
}

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  visiblePanels: Set<PanelId>;
  onTogglePanel: (id: PanelId, placement?: PanelPlacement) => void;
  onOpenPanel: (id: PanelId, placement?: PanelPlacement) => void;
  onResetLayout: () => void;
  activeModel: string;
  sessionTitle: string;
  workingDir: string | null;
  environmentOpen: boolean;
  onToggleEnvironment: () => void;
}

export function TopBar({
  sidebarOpen, onToggleSidebar, visiblePanels, onTogglePanel, onOpenPanel, onResetLayout,
  activeModel, sessionTitle, workingDir,
  environmentOpen, onToggleEnvironment,
}: Props) {
  const modelLabel = activeModel.toLowerCase() === 'auto' ? 'Router' : activeModel;
  const modelDetailPanel: PanelId = activeModel.toLowerCase() === 'auto' ? 'routing-learning' : 'model-lab';
  const [panelMenuOpen, setPanelMenuOpen] = useState(false);
  const [panelPlacementOverrides, setPanelPlacementOverrides] = useState(loadPanelPlacementOverrides);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelMenuIds = useMemo(() =>
    ALL_PANELS.filter((id) => id !== 'chat' && id !== 'sub-agents'),
    [],
  );
  const visibleCount = useMemo(() =>
    panelMenuIds.filter((id) => visiblePanels.has(id)).length,
    [panelMenuIds, visiblePanels],
  );
  const sideChatOpen = visiblePanels.has('side-chat');

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

  const resolvedPanelPlacement = useCallback((id: PanelId): PanelPlacement => (
    panelPlacementOverrides[id] ?? defaultPanelPlacement(id)
  ), [panelPlacementOverrides]);

  const flipPanelPlacement = useCallback((id: PanelId) => {
    setPanelPlacementOverrides((prev) => {
      const current = prev[id] ?? defaultPanelPlacement(id);
      const nextPlacement = oppositePanelPlacement(current);
      const next = { ...prev, [id]: nextPlacement };
      if (nextPlacement === defaultPanelPlacement(id)) {
        delete next[id];
      }
      savePanelPlacementOverrides(next);
      return next;
    });
  }, []);

  const panelMenuItems = useMemo(() => panelMenuIds.map((id) => {
    const Icon = getPanelIcon(id);
    const config = getPanelConfig(id);
    const active = visiblePanels.has(id);
    const placement = resolvedPanelPlacement(id);
    const opposite = oppositePanelPlacement(placement);
    const PlacementIcon = placement === 'bottom' ? PanelBottom : PanelRight;
    const isCustomPlacement = placement !== defaultPanelPlacement(id);
    const placementTitle = `${config.label} opens in the ${placementLabel(placement)} by default.`;
    const flipTitle = `Change ${config.label} default to the ${placementLabel(opposite)}.`;
    return (
      <div
        key={id}
        className={'panel-menu-row' + (active ? ' active' : '')}
        data-panel-menu-id={id}
      >
        <button
          type="button"
          className={'panel-menu-item panel-menu-main' + (active ? ' active' : '')}
          onClick={() => { onTogglePanel(id, placement); setPanelMenuOpen(false); }}
          title={placementTitle}
          aria-label={`${config.label}. ${placementTitle}`}
        >
          <Icon size={14} />
          <span className="panel-menu-item-label">{config.label}</span>
          <span className={`panel-menu-placement ${placement}${isCustomPlacement ? ' custom' : ''}`} title={placementTitle} aria-label={placementTitle}>
            <PlacementIcon size={13} aria-hidden="true" />
          </span>
          {active && <Check size={14} className="panel-menu-check" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="panel-menu-flip"
          onClick={() => flipPanelPlacement(id)}
          title={flipTitle}
          aria-label={flipTitle}
        >
          <ArrowLeftRight size={13} aria-hidden="true" />
        </button>
      </div>
    );
  }), [panelMenuIds, visiblePanels, resolvedPanelPlacement, onTogglePanel, flipPanelPlacement]);

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
        onClick={() => onOpenPanel(modelDetailPanel, resolvedPanelPlacement(modelDetailPanel))}
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

        <button
          className={'top-bar-action' + (sideChatOpen ? ' active' : '')}
          type="button"
          data-priority="high"
          onClick={() => onTogglePanel('side-chat', resolvedPanelPlacement('side-chat'))}
          title={sideChatOpen ? 'Hide Side Chat' : 'Open Side Chat'}
          aria-label={sideChatOpen ? 'Hide Side Chat' : 'Open Side Chat'}
        >
          <MessageSquare size={16} aria-hidden="true" />
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
