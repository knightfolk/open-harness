# Modular Panel Layout — Implementation Plan

## Goal
Refactor the fixed 3-column layout into a **tiling panel system** where every section (chat, diffs, browser, terminal, sub-agents, plan, etc.) is a movable tile. Users can rearrange panels by dragging, split views vertically/horizontally, and toggle visibility from the top bar.

## Architecture

### 1. Panel Registry
A central registry of all available panel types:
- **Chat** — main conversation view
- **Diffs** — file change / diff viewer
- **Browser** — embedded browser preview (iframe placeholder)
- **Terminal** — command output / interactive terminal
- **Sub-Agents** — agent tracker (standalone panel, sidebar keeps its tree too)
- **Plan** — step progress tracker
- **Files** — file tree / file changes list

Each panel type defines:
- `id` — unique key (e.g., `chat`, `diffs`, `terminal`)
- `label` — display name
- `icon` — lucide icon
- `defaultSize` — suggested size in pixels
- `minSize` — minimum before collapsing
- `component` — the React component to render

### 2. Layout State (localStorage-persisted)
A layout tree persisted to localStorage:

```
LayoutNode = PanelId | [direction, ...LayoutNode[]]
direction = 'horizontal' | 'vertical'
PanelId = string  // references Panel Registry
```

**Example default layout:**
```
['horizontal',
  ['vertical',
    'chat',
    'terminal'
  ],
  ['vertical',
    'sub-agents',
    'plan'
  ]
]
```

Saved to `localStorage('cmdui-layout')` on every change, restored on boot.

### 3. Allotment for Splits
Uses [allotment](https://github.com/smeijer/allotment) for the split/resize engine:
- `<Allotment horizontal|vertical>` replaces custom SplitContainer
- Built-in resize handles, min/max sizes, proportional sizing
- Nestable for complex layouts
- Keyboard accessible, touch friendly

### 4. Panel Chrome
Every panel gets a consistent wrapper:
```
┌─────────────────────────────┐
│ ⋮⋮  Icon  Panel Title    × │  ← drag handle (deferred), title, close
├─────────────────────────────┤
│                             │
│     (panel content)         │
│                             │
└─────────────────────────────┘
```

### 5. Top Bar Panel Toggles
- Dynamic toggle buttons from the registry
- Click to add/remove panels from the layout
- Active toggles are highlighted

### 6. Drag & Swap (DEFERRED — final polish pass)
- Each panel gets a drag handle in its header
- On drop onto another panel: swap positions
- Ghost outline + drop-zone highlights
- Implemented last, after everything else works

## File Changes

### New Files
| File | Purpose |
|------|---------|
| `src/types/layout.ts` | LayoutNode, PanelConfig types |
| `src/components/layout/panelRegistry.ts` | Registry of all available panels |
| `src/components/layout/LayoutEngine.tsx` | Renders layout tree via Allotment |
| `src/components/layout/PanelWrapper.tsx` | Chrome around any panel (header, close) |
| `src/components/layout/useLayoutState.ts` | Hook: layout tree state + localStorage persistence |
| `src/components/DiffViewer.tsx` | New panel: file diff display |
| `src/components/BrowserPanel.tsx` | New panel: embedded browser placeholder |

### Modified Files
| File | Change |
|------|--------|
| `src/App.tsx` | Replace fixed layout with LayoutEngine |
| `src/components/TopBar.tsx` | Dynamic panel toggles from registry |
| `src/styles/components.css` | Add panel chrome, allotment overrides |

### Kept Unchanged
| File | Reason |
|------|--------|
| `src/components/Sidebar.tsx` | Sub-agent tree stays in sidebar |

### Removed Files
| File | Reason |
|------|--------|
| `src/components/RightPanel.tsx` | Replaced by generic panel system |

## Implementation Order

### Phase 1: Core Layout Engine + localStorage
1. Install allotment
2. Define layout types (`types/layout.ts`)
3. Build `panelRegistry` with all panel definitions
4. Build `useLayoutState` hook with add/remove + localStorage save/restore
5. Build `PanelWrapper` with header and close button
6. Build `LayoutEngine` — recursive Allotment renderer

### Phase 2: Panel Content
7. Wrap existing Chat view as a panel
8. Build `DiffViewer` panel
9. Build `BrowserPanel` placeholder
10. Wrap existing Terminal output as a panel
11. Wrap SubAgent tracker as a panel
12. Wrap Plan tracker as a panel

### Phase 3: Integration
13. Update `TopBar` with dynamic panel toggles
14. Wire everything into `App.tsx`
15. Clean up removed files (RightPanel)

### Phase 4: Polish (deferred)
16. Drag-swap between panels
17. DragOverlay visual feedback
18. Layout presets (default, code review, monitoring, etc.)
