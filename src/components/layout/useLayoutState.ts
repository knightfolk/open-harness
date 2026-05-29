import { useState, useCallback, useEffect } from 'react';
import type { LayoutNode, SplitNode, PanelId } from '../../types/layout';
import { DEFAULT_LAYOUT } from '../../types/layout';

const STORAGE_KEY = 'openharness-layout';

/** Panels that prefer to split vertically (top/bottom) when added */
const VERTICAL_PANELS: Set<PanelId> = new Set(['terminal', 'plan']);
/** Panels that prefer to split horizontally (left/right) when added */
const HORIZONTAL_PANELS: Set<PanelId> = new Set(['sub-agents', 'diffs', 'browser', 'files']);

function loadLayout(): LayoutNode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LayoutNode;
      if (validateLayout(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_LAYOUT);
}

function validateLayout(node: LayoutNode): boolean {
  if (typeof node === 'string') return true;
  if (typeof node === 'object' && node !== null && 'direction' in node && 'children' in node) {
    const split = node as SplitNode;
    if (!Array.isArray(split.children) || split.children.length === 0) return false;
    return split.children.every(validateLayout);
  }
  return false;
}

function saveLayout(layout: LayoutNode) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch { /* ignore */ }
}

function containsPanel(node: LayoutNode, id: PanelId): boolean {
  if (typeof node === 'string') return node === id;
  return (node as SplitNode).children.some((child) => containsPanel(child, id));
}

/** Remove a panel from the tree, collapsing empty splits */
function removePanelFromTree(node: LayoutNode, id: PanelId): LayoutNode | null {
  if (typeof node === 'string') {
    return node === id ? null : node;
  }
  const split = node as SplitNode;
  const newChildren = split.children
    .map((child) => removePanelFromTree(child, id))
    .filter((c): c is LayoutNode => c !== null);

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];
  return { ...split, children: newChildren };
}

/**
 * Find the deepest, largest leaf node and split it in the given direction,
 * inserting the new panel alongside it.
 */
function splitLargestLeaf(
  node: LayoutNode,
  id: PanelId,
  direction: 'horizontal' | 'vertical',
): LayoutNode {
  if (typeof node === 'string') {
    // This leaf becomes a split with the old panel + new panel
    return { direction, children: [node, id] };
  }

  const split = node as SplitNode;

  // If this split is the same direction, append to it
  if (split.direction === direction) {
    return { ...split, children: [...split.children, id] };
  }

  // Different direction — recurse into the largest child
  // "Largest" = fewest nesting levels (heuristic: pick last child, or the one that's a leaf)
  const lastChild = split.children[split.children.length - 1];
  const newLastChild = splitLargestLeaf(lastChild, id, direction);
  return {
    ...split,
    children: [...split.children.slice(0, -1), newLastChild],
  };
}

/** Determine the preferred split direction for a panel */
function preferredDirection(id: PanelId): 'horizontal' | 'vertical' {
  if (VERTICAL_PANELS.has(id)) return 'vertical';
  if (HORIZONTAL_PANELS.has(id)) return 'horizontal';
  // Default: chat-type panels split vertically (terminal below chat)
  return 'vertical';
}


/** Swap two panels in the tree */
function swapPanelsInTree(node: LayoutNode, from: PanelId, to: PanelId): LayoutNode {
  if (typeof node === 'string') {
    if (node === from) return to;
    if (node === to) return from;
    return node;
  }
  const split = node as SplitNode;
  return {
    ...split,
    children: split.children.map((child) => swapPanelsInTree(child, from, to)),
  };
}

export function useLayoutState() {
  const [layout, setLayoutState] = useState<LayoutNode>(loadLayout);

  const setLayout = useCallback((newLayout: LayoutNode | ((prev: LayoutNode) => LayoutNode)) => {
    setLayoutState((prev) => {
      const next = typeof newLayout === 'function' ? newLayout(prev) : newLayout;
      saveLayout(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = () => saveLayout(layout);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [layout]);

  const addPanel = useCallback((id: PanelId) => {
    setLayout((prev) => {
      if (containsPanel(prev, id)) return prev;
      const direction = preferredDirection(id);
      return splitLargestLeaf(prev, id, direction);
    });
  }, [setLayout]);

  const removePanelById = useCallback((id: PanelId) => {
    setLayout((prev) => {
      if (!containsPanel(prev, id)) return prev;
      const result = removePanelFromTree(prev, id);
      return result ?? { direction: 'horizontal', children: ['chat'] as LayoutNode[] };
    });
  }, [setLayout]);

  const togglePanel = useCallback((id: PanelId) => {
    setLayout((prev) => {
      if (containsPanel(prev, id)) {
        const result = removePanelFromTree(prev, id);
        return result ?? { direction: 'horizontal', children: ['chat'] as LayoutNode[] };
      }
      const direction = preferredDirection(id);
      return splitLargestLeaf(prev, id, direction);
    });
  }, [setLayout]);

  const swapPanels = useCallback((from: PanelId, to: PanelId) => {
    setLayout((prev) => {
      if (!containsPanel(prev, from) || !containsPanel(prev, to)) return prev;
      return swapPanelsInTree(prev, from, to);
    });
  }, [setLayout]);

  const resetLayout = useCallback(() => {
    setLayout(structuredClone(DEFAULT_LAYOUT));
  }, [setLayout]);

  const isPanelVisible = useCallback((id: PanelId) => {
    return containsPanel(layout, id);
  }, [layout]);

  return { layout, setLayout, addPanel, removePanel: removePanelById, togglePanel, swapPanels, resetLayout, isPanelVisible };
}
