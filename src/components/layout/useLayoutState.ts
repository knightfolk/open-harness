import { useState, useCallback, useEffect } from 'react';
import type { LayoutNode, SplitNode, PanelId } from '../../types/layout';
import { DEFAULT_LAYOUT, ALL_PANELS } from '../../types/layout';

const STORAGE_KEY = 'openharness-layout.v7';
const FORCE_HIDDEN_PANELS: PanelId[] = ['sub-agents'];
const KNOWN_PANELS = new Set<string>([
  ...ALL_PANELS,
]);
const DEFAULT_HIDDEN_PANELS: PanelId[] = ALL_PANELS.filter((id): id is PanelId => id !== 'chat');

function loadLayout(): LayoutNode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LayoutNode;
      if (validateLayout(parsed)) {
        const panelsToHide = [...DEFAULT_HIDDEN_PANELS, ...FORCE_HIDDEN_PANELS];
        return [...new Set(panelsToHide)].reduce((next, panelId) => {
          const pruned = removePanelFromTree(next, panelId);
          return pruned ?? structuredClone(DEFAULT_LAYOUT);
        }, parsed as LayoutNode);
      }
    }
  } catch { /* ignore */ }
  return structuredClone(DEFAULT_LAYOUT);
}

function validateLayout(node: LayoutNode): boolean {
  if (typeof node === 'string') return KNOWN_PANELS.has(node);
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

/** Insert a new panel beside the root layout in a stable vertical split. */
function appendPanel(node: LayoutNode, id: PanelId): LayoutNode {
  if (typeof node === 'string') {
    return { direction: 'vertical', children: [node, id] };
  }

  const split = node as SplitNode;
  return { ...split, direction: 'vertical', children: [...split.children, id] };
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
      return appendPanel(prev, id);
    });
  }, [setLayout]);

  const removePanelById = useCallback((id: PanelId) => {
    setLayout((prev) => {
      if (!containsPanel(prev, id)) return prev;
      const result = removePanelFromTree(prev, id);
      return result ?? structuredClone(DEFAULT_LAYOUT);
    });
  }, [setLayout]);

  const togglePanel = useCallback((id: PanelId) => {
    setLayout((prev) => {
      if (containsPanel(prev, id)) {
        const result = removePanelFromTree(prev, id);
        return result ?? structuredClone(DEFAULT_LAYOUT);
      }
      return appendPanel(prev, id);
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
