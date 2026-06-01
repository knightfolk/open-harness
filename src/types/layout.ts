export type PanelId = 'chat' | 'side-chat' | 'diffs' | 'browser' | 'terminal' | 'sub-agents' | 'plan' | 'files' | 'model-lab' | 'safety' | 'patches';

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

export const DEFAULT_LAYOUT: LayoutNode = {
  direction: 'horizontal',
  children: [
    {
      direction: 'vertical',
      children: ['chat', 'terminal'],
    },
    {
      direction: 'vertical',
      children: ['sub-agents', 'plan'],
    },
  ],
};

export const ALL_PANELS: PanelId[] = ['chat', 'side-chat', 'diffs', 'browser', 'terminal', 'sub-agents', 'plan', 'files', 'model-lab', 'safety', 'patches'];
