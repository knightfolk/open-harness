import type { PanelId, PanelConfig } from '../../types/layout';
import {
  MessageSquare, GitCompare, Globe, Terminal,
  Bot, ListChecks, FolderOpen,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface PanelDefinition extends PanelConfig {
  component: () => Promise<{ default: ComponentType<any> }>;
}

/**
 * We store component references here so panels can be lazily loaded.
 * The LayoutEngine will resolve these at render time.
 */
const iconMap: Record<PanelId, ComponentType<{ size?: number }>> = {
  chat: MessageSquare,
  diffs: GitCompare,
  browser: Globe,
  terminal: Terminal,
  'sub-agents': Bot,
  plan: ListChecks,
  files: FolderOpen,
};

export const panelConfigs: Record<PanelId, PanelConfig> = {
  chat:        { id: 'chat',        label: 'Chat',        icon: 'MessageSquare', defaultSize: 500, minSize: 280 },
  diffs:       { id: 'diffs',       label: 'Diffs',       icon: 'GitCompare',    defaultSize: 400, minSize: 200 },
  browser:     { id: 'browser',     label: 'Browser',     icon: 'Globe',         defaultSize: 400, minSize: 200 },
  terminal:    { id: 'terminal',    label: 'Terminal',     icon: 'Terminal',      defaultSize: 200, minSize: 120 },
  'sub-agents':{ id: 'sub-agents',  label: 'Sub-Agents',  icon: 'Bot',           defaultSize: 320, minSize: 200 },
  plan:        { id: 'plan',        label: 'Plan',         icon: 'ListChecks',    defaultSize: 280, minSize: 180 },
  files:       { id: 'files',       label: 'Files',        icon: 'FolderOpen',    defaultSize: 280, minSize: 180 },
};

export function getPanelIcon(id: PanelId) {
  return iconMap[id];
}

export function getPanelConfig(id: PanelId): PanelConfig {
  return panelConfigs[id];
}
