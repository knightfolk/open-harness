# Panel Pressure Deep Dive

OpenHarness should keep the main chat readable when extra work surfaces open. The layout can show several tools at once, but it should not preserve a side-by-side arrangement after the chat column has become too narrow to scan.

## Minimum Sizes

The panel registry is the source of truth for preferred and minimum panel sizes:

| Panel | Preferred | Minimum | Reason |
| --- | ---: | ---: | --- |
| Chat | 920px | 520px | Primary reading and writing surface; avoid skinny one-word lines. |
| Browser | 360px | 300px | Preview needs enough width for page state and controls. |
| Terminal | 220px | 160px | Usable as a compact log strip, often bottom-placed. |
| Files | 280px | 220px | File names and tree rows need room before truncation. |
| Model Lab | 400px | 260px | Dense model metadata collapses to one-column rules below its own breakpoints. |
| Routing Learning | 420px | 280px | Evidence grids collapse before becoming unreadable. |
| Safety | 420px | 280px | Review and approval controls need stable labels. |

## Pressure Sequence

When a non-chat panel opens, the shell estimates whether the viewport can hold:

- the chat readable width,
- one compact width for each open auxiliary panel,
- the left sidebar at its preferred width,
- the floating Environment rail,
- the Agent detail pane if it is open,
- a small shell-padding buffer.

If that budget does not fit, the app reclaims space in this order:

1. Hide the Environment rail without changing the user's saved Environment preference.
2. Compact the left sidebar to its 220px minimum.
3. Keep side-by-side panels only while the viewport is wide enough for readable columns.
4. Stack horizontal splits at tighter widths so chat receives full available width above the tool panel.
5. At the narrow breakpoint, close the sidebar entirely and keep the top-bar controls available.

## Resize Demo

Use this scenario for manual or browser-assisted proof:

1. Start from the default chat-only layout.
2. Open `Tools` and add `Browser` in the right pane.
3. At a wide desktop width, confirm Chat and Browser are side by side, with Chat wider than Browser.
4. Reduce the viewport until the layout is tight. Confirm the Environment rail is hidden and the sidebar is compacted before chat becomes a skinny column.
5. Reduce below the tight split breakpoint. Confirm Chat and Browser stack vertically.
6. Reduce to phone width. Confirm the sidebar closes and Chat remains full-width above the tool panel.
7. Reset to the default layout after the proof so the running app is not left in a demo state.

Expected proof signals:

- Chat width remains readable in side-by-side layouts.
- No horizontal document or chat-root overflow appears.
- Environment shows as hidden under panel pressure.
- Sidebar uses 220px under pressure and disappears at the narrow breakpoint.
- Horizontal split direction changes from row to column before chat is reduced to one-word lines.
