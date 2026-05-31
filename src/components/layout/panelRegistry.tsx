import type { PanelId, PanelConfig } from '../../types/layout';
import {
  MessageSquare, GitCompare, Globe, Terminal,
  Bot, ListChecks, FolderOpen, FlaskConical,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface PanelDefinition extends PanelConfig {
  component: () => Promise<{ default: ComponentType<any> }>;
}

const iconMap: Record<PanelId, ComponentType<{ size?: number }>> = {
  chat: MessageSquare,
  diffs: GitCompare,
  browser: Globe,
  terminal: Terminal,
  'side-chat': MessageSquare,
  'sub-agents': Bot,
  plan: ListChecks,
  files: FolderOpen,
  'model-lab': FlaskConical,
};

export const panelConfigs: Record<PanelId, PanelConfig> = {
  chat:        { id: 'chat',        label: 'Chat',        icon: 'MessageSquare', defaultSize: 500, minSize: 280 },
  diffs:       { id: 'diffs',       label: 'Diffs',       icon: 'GitCompare',    defaultSize: 400, minSize: 200 },
  browser:     { id: 'browser',     label: 'Browser',     icon: 'Globe',         defaultSize: 400, minSize: 200 },
  terminal:    { id: 'terminal',    label: 'Terminal',     icon: 'Terminal',      defaultSize: 200, minSize: 120 },
  'side-chat':     { id: 'side-chat',     label: 'Side Chat',     icon: 'MessageSquare', defaultSize: 380, minSize: 260 },
  'sub-agents':{ id: 'sub-agents',  label: 'Sub-Agents',  icon: 'Bot',           defaultSize: 320, minSize: 200 },
  plan:        { id: 'plan',        label: 'Plan',         icon: 'ListChecks',    defaultSize: 280, minSize: 180 },
  files:       { id: 'files',       label: 'Files',        icon: 'FolderOpen',    defaultSize: 280, minSize: 180 },
  'model-lab': { id: 'model-lab',   label: 'Model Lab',   icon: 'FlaskConical',  defaultSize: 400, minSize: 260 },
};

export function getPanelIcon(id: PanelId) {
  return iconMap[id];
}

export function getPanelConfig(id: PanelId): PanelConfig {
  return panelConfigs[id];
}
