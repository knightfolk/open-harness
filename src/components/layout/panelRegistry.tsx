import type { PanelId, PanelConfig } from '../../types/layout';
import {
  MessageSquare, Globe, Terminal,
  FolderOpen, FlaskConical, Shield, Brain,
  UsersRound,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface PanelDefinition extends PanelConfig {
  component: () => Promise<{ default: ComponentType<any> }>;
}

const iconMap: Record<PanelId, ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  chat: MessageSquare,
  browser: Globe,
  terminal: Terminal,
  files: FolderOpen,
  'model-lab': FlaskConical,
  'routing-learning': Brain,
  'safety': Shield,
  'sub-agents': UsersRound,
};

export const panelConfigs: Record<PanelId, PanelConfig> = {
  chat:        { id: 'chat',        label: 'Chat',        icon: 'MessageSquare', defaultSize: 920, minSize: 520 },
  browser:     { id: 'browser',     label: 'Browser',     icon: 'Globe',         defaultSize: 360, minSize: 300 },
  terminal:    { id: 'terminal',    label: 'Terminal',     icon: 'Terminal',      defaultSize: 220, minSize: 160 },
  files:       { id: 'files',       label: 'Files',        icon: 'FolderOpen',    defaultSize: 280, minSize: 220 },
  'model-lab': { id: 'model-lab',   label: 'Model Lab',   icon: 'FlaskConical',  defaultSize: 400, minSize: 260 },
  'routing-learning': { id: 'routing-learning', label: 'Routing Learning', icon: 'Brain', defaultSize: 420, minSize: 280 },
  'safety':     { id: 'safety',       label: 'Safety',      icon: 'Shield',        defaultSize: 420, minSize: 280 },
  'sub-agents':{ id: 'sub-agents',  label: 'Agent Work', icon: 'UsersRound', defaultSize: 420, minSize: 280 },
};

export function getPanelIcon(id: PanelId) {
  return iconMap[id];
}

export function getPanelConfig(id: PanelId): PanelConfig {
  return panelConfigs[id];
}
