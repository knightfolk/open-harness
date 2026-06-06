import type { PanelId, PanelConfig } from '../../types/layout';
import {
  MessageSquare, GitCompare, Globe, Terminal,
  Bot, FolderOpen, FlaskConical, Shield, GitPullRequestArrow,
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
  'sub-agents': Bot,
  files: FolderOpen,
  'model-lab': FlaskConical,
  'safety': Shield,
  patches: GitPullRequestArrow,
};

export const panelConfigs: Record<PanelId, PanelConfig> = {
  chat:        { id: 'chat',        label: 'Chat',        icon: 'MessageSquare', defaultSize: 920, minSize: 280 },
  diffs:       { id: 'diffs',       label: 'Diffs',       icon: 'GitCompare',    defaultSize: 400, minSize: 200 },
  browser:     { id: 'browser',     label: 'Browser',     icon: 'Globe',         defaultSize: 360, minSize: 240 },
  terminal:    { id: 'terminal',    label: 'Terminal',     icon: 'Terminal',      defaultSize: 200, minSize: 120 },
  'sub-agents':{ id: 'sub-agents',  label: 'Sub-Agents',  icon: 'Bot',           defaultSize: 320, minSize: 200 },
  files:       { id: 'files',       label: 'Files',        icon: 'FolderOpen',    defaultSize: 280, minSize: 180 },
  'model-lab': { id: 'model-lab',   label: 'Model Lab',   icon: 'FlaskConical',  defaultSize: 400, minSize: 260 },
  'safety':     { id: 'safety',       label: 'Safety',      icon: 'Shield',        defaultSize: 420, minSize: 280 },
  patches:     { id: 'patches',     label: 'Patches',     icon: 'GitPullRequestArrow', defaultSize: 420, minSize: 280 },
};

export function getPanelIcon(id: PanelId) {
  return iconMap[id];
}

export function getPanelConfig(id: PanelId): PanelConfig {
  return panelConfigs[id];
}
