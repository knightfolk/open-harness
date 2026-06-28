export type PanelId = 'chat' | 'side-chat' | 'browser' | 'terminal' | 'files' | 'model-lab' | 'routing-learning' | 'safety' | 'attention-inbox' | 'workflows' | 'sub-agents';
export type PanelPlacement = 'right' | 'bottom';

/** A layout tree: either a single panel, or a split with direction + children */
export type LayoutNode = PanelId | SplitNode;

export interface SplitNode {
  direction: 'horizontal' | 'vertical';
  children: LayoutNode[];
}

export interface PanelConfig {
  id: PanelId;
  label: string;
  icon: string; // lucide icon name
  defaultSize: number; // suggested px
  minSize: number; // min px
}

export const DEFAULT_LAYOUT: LayoutNode = 'chat';

export const ALL_PANELS: PanelId[] = ['chat', 'side-chat', 'browser', 'terminal', 'files', 'model-lab', 'routing-learning', 'safety', 'attention-inbox', 'workflows'];

export function defaultPanelPlacement(id: PanelId): PanelPlacement {
  return id === 'terminal' ? 'bottom' : 'right';
}

export function oppositePanelPlacement(placement: PanelPlacement): PanelPlacement {
  return placement === 'right' ? 'bottom' : 'right';
}
