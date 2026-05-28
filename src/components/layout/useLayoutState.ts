import { useState, useCallback, useEffect } from 'react';
import type { LayoutNode, SplitNode, PanelId } from '../../types/layout';
import { DEFAULT_LAYOUT } from '../../types/layout';

const STORAGE_KEY = 'cmdui-layout';

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

/** Check if a panelId exists anywhere in the tree */
function containsPanel(node: LayoutNode, id: PanelId): boolean {
  if (typeof node === 'string') return node === id;
  return (node as SplitNode).children.some((child) => containsPanel(child, id));
}

/** Remove a panel from the tree, collapsing empty splits */
function removePanel(node: LayoutNode, id: PanelId): LayoutNode | null {
  if (typeof node === 'string') {
    return node === id ? null : node;
  }
  const split = node as SplitNode;
  const newChildren = split.children
    .map((child) => removePanel(child, id))
    .filter((c): c is LayoutNode => c !== null);

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];
  return { ...split, children: newChildren };
}

/** Find the deepest split in a given direction and append the panel */
function appendPanel(node: LayoutNode, id: PanelId, direction: 'horizontal' | 'vertical'): LayoutNode {
  if (typeof node === 'string') {
    // Turn a leaf into a split
    return { direction, children: [node, id] };
  }
  const split = node as SplitNode;
  if (split.direction === direction) {
    // Same direction — just append
    return { ...split, children: [...split.children, id] };
  }
  // Different direction — nest
  const last = split.children[split.children.length - 1];
  const newLast = appendPanel(last, id, direction);
  return { ...split, children: [...split.children.slice(0, -1), newLast] };
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

  // Save on unmount just in case
  useEffect(() => {
    const handler = () => saveLayout(layout);
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [layout]);

  const addPanel = useCallback((id: PanelId) => {
    setLayout((prev) => {
      if (containsPanel(prev, id)) return prev;
      return appendPanel(prev, id, 'horizontal');
    });
  }, [setLayout]);

  const removePanelById = useCallback((id: PanelId) => {
    setLayout((prev) => {
      if (!containsPanel(prev, id)) return prev;
      const result = removePanel(prev, id);
      return result ?? { direction: 'horizontal', children: ['chat'] as LayoutNode[] };
    });
  }, [setLayout]);

  const togglePanel = useCallback((id: PanelId) => {
    setLayout((prev) => {
      if (containsPanel(prev, id)) {
        const result = removePanel(prev, id);
        return result ?? { direction: 'horizontal', children: ['chat'] as LayoutNode[] };
      }
      return appendPanel(prev, id, 'horizontal');
    });
  }, [setLayout]);

  const resetLayout = useCallback(() => {
    setLayout(structuredClone(DEFAULT_LAYOUT));
  }, [setLayout]);

  const isPanelVisible = useCallback((id: PanelId) => {
    return containsPanel(layout, id);
  }, [layout]);

  return { layout, setLayout, addPanel, removePanel: removePanelById, togglePanel, resetLayout, isPanelVisible };
}
