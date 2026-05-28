import type { LayoutNode, SplitNode, PanelId } from '../types/layout';

export function containsPanelInTree(node: LayoutNode, id: PanelId): boolean {
  if (typeof node === 'string') return node === id;
  return (node as SplitNode).children.some((child) => containsPanelInTree(child, id));
}
