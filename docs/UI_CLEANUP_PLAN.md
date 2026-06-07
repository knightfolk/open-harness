# OpenHarness UI Cleanup Plan

## Goal

Make OpenHarness feel calmer, simpler, and easier to read before adding more features. The app should keep its power, but the default screen should feel like a clean assistant workspace instead of a cockpit.

Use Codex as the product reference for restraint:

- Chat is the primary surface.
- Supporting context is present but quiet.
- Panels are flat, sparse, and easy to scan.
- Advanced tools appear when they are relevant, not all the time.
- Text labels are plain and specific.
- Diff and review workflows live in a focused flyout instead of occupying permanent screen space.

## Design Principles

### 1. Chat First

The center chat should be the user's home base. Side panels should never visually compete with the answer stream.

Rules:
- Default layout starts with chat only plus a slim environment rail.
- No permanent terminal, plan, sub-agent, diff, browser, or patch panels in the default layout.
- Show active work as compact status rows in chat, with a clear "Open details" action.

### 2. Flat Cards

Cards should frame repeated items or temporary overlays, not every section.

Rules:
- Use flat surfaces with one border and no nested cards.
- Prefer `border-radius: 8px` or less.
- Reduce heavy shadows and stacked rounded panels.
- Avoid floating panel islands unless they are a popover, modal, or flyout.

### 3. Clear Text

Labels should name what the number means.

Rules:
- Avoid bare labels like "Low", "High", "Risk", "Changes", or "Progress" when the object is unclear.
- Use labels like "Low confidence", "Reliability risk", "Working changes", "Task progress", and "Sources used".
- Keep supporting text short. If a line needs explaining, the UI probably needs a better label.

### 4. Progressive Disclosure

Hide complexity until the user asks for it or the task produces it.

Rules:
- Environment panel shows only the top three things by default: branch, working changes, and current permission mode.
- Sources, progress, tools, model routing, and cost details should collapse by default.
- "Changed files", "review patch", "run validation", and "commit" belong in a contextual flyout.

### 5. One Path For Diffs

Diff review should become a smart task panel, not multiple overlapping surfaces.

Rules:
- Merge "Diffs" and "Patches" into one "Review changes" flow.
- The default right rail shows a simple changes summary.
- Clicking changes opens a flyout with file list, smart diff, patch proposal actions, validation, and commit prep.

## Proposed Default Layout

### Current Problem

The current default layout and screenshots show too many competing surfaces:

- Sidebar with project/session navigation.
- Top bar with panel buttons.
- Chat stream.
- Transient orchestration/team-room bubbles during multi-agent work.
- Right-side environment card.
- Status bar.
- Optional panels for terminal, plan, sub-agents, diffs, browser, safety, model lab, patches.
- Message-level confidence and next action chips.

The result is useful, but visually busy. New users have to decide what to look at.

### Target Layout

Default screen:

- Left sidebar: project/session navigation only.
- Center: chat stream and composer.
- Multi-agent progress: show compact transient bubbles inside the chat stream; reserve the side panel for deeper trace inspection.
- Top bar: title, model selector, and one "Tools" button.
- Right rail: slim environment summary, collapsed by default on smaller widths.
- Bottom status: remove unless there is an active warning or background job.

Right rail default content:

```text
Environment
Project: OpenHarness
Branch: main
Working changes: 12 files
Access: Full

[Review changes]
```

No expanded progress, sources, terminal, patch review, or model lab by default.

## Smart Diff Flyout

Replace permanent diff/patch panels with a focused flyout opened from:

- Right rail "Review changes"
- Chat message "Review patch"
- Top bar "Changes"
- Keyboard shortcut later, if useful

Flyout structure:

```text
Review changes
12 files changed    +1,787 -84

[Summary] [Files] [Patch proposals] [Validate] [Commit]

Files
src/components/ConfidenceMeter.tsx       M   +2 -2
src/utils/runSignals.ts                  M   +4 -4
docs/UI_CLEANUP_PLAN.md                  A   +...

Diff
<selected file diff>

Actions
[Explain] [Propose patch] [Stage] [Open file]
```

Behavior:

- Summary tab groups changes by purpose when possible: UI, server, docs, config.
- Files tab shows the current `DiffViewer` content in a flatter two-column layout.
- Patch proposals tab hosts the current `PatchReviewPanel`.
- Validate tab shows suggested commands and last results.
- Commit tab shows generated commit message, staged files, and push/PR actions.

Implementation note:
- Keep existing `DiffViewer` and `PatchReviewPanel` logic, but mount them inside a new `ReviewChangesFlyout`.
- Do not rebuild diff parsing or patch proposal APIs.

## Component-Level Cleanup

### Layout

Files:
- `src/types/layout.ts`
- `src/components/layout/useLayoutState.ts`
- `src/components/layout/LayoutEngine.tsx`
- `src/components/layout/PanelWrapper.tsx`
- `src/components/layout/PanelContent.tsx`

Plan:
- Change `DEFAULT_LAYOUT` to `chat` only.
- Keep advanced panels available from the tools menu, but not visible by default.
- Add a flyout layer that does not split the main chat layout.
- Reduce panel header height and remove drag handles from normal view unless layout edit mode is active.

### Right Rail / Environment

Files to identify or create:
- Existing right rail component if present.
- Otherwise create `src/components/EnvironmentRail.tsx`.

Plan:
- Make the rail a flat, narrow summary.
- Show only branch, working changes, and access/trust mode by default.
- Move progress and sources into collapsible detail rows or the flyout.
- Use neutral text first, color only for status that requires attention.

### Chat Message Chrome

Files:
- `src/components/MessageBubble.tsx`
- `src/components/ConfidenceMeter.tsx`
- `src/components/NextBestActions.tsx`
- `src/styles/components.css`

Plan:
- Keep confidence labels clear, but make the badge visually quieter.
- Hide next-best-action chips behind a single "Actions" menu when there is more than one.
- Show "Review patch" only when a real diff exists, as it does today.
- Reduce inline code-chip styling in normal prose so answers read more like text.

### Top Bar

Files:
- `src/components/TopBar.tsx`
- `src/components/StatusBar.tsx`

Plan:
- Move panel toggles under one "Tools" button.
- Keep model selector visible but compact.
- Remove permanent bottom status bar once its useful signals move into the top bar, right rail, or flyout.
- Show warning/status toasts only when action is needed.

### Styles

Files:
- `src/styles/components.css`
- `src/styles/global.css`

Plan:
- Create shared tokens for flat surfaces:
  - `--surface-flat`
  - `--surface-subtle`
  - `--border-subtle`
  - `--text-muted`
- Standardize radius at 6px or 8px.
- Reduce shadow usage to modals and flyouts only.
- Reduce saturated accent colors in passive UI.

## Implementation Phases

### Phase 1: Visual Declutter Without Behavior Changes

Scope:
- Change default layout to chat-first.
- Reduce panel chrome.
- Simplify right rail labels.
- Quiet confidence and action chips.

Validation:
- `npm run lint`
- `npx tsc --noEmit --project tsconfig.json`
- Frontend reachable at `http://localhost:5173/`
- Manual screenshot check against the current busy screen.

Done when:
- A new user can identify chat, current project, branch, changes, and access mode in under five seconds.

### Phase 2: Smart Diff Flyout

Scope:
- Add `ReviewChangesFlyout`.
- Move `DiffViewer` and `PatchReviewPanel` into tabs inside the flyout.
- Add a single "Review changes" entry point in the right rail.
- Keep old panel IDs temporarily for backward compatibility.

Validation:
- Dirty repo shows accurate file count and additions/deletions.
- Clicking "Review changes" opens the flyout.
- Selecting a file shows its diff.
- Existing patch proposal flow still works.

Done when:
- Diff review no longer requires a permanent split panel.

### Phase 3: Tool Consolidation

Scope:
- Move terminal, browser, safety, model lab, and files panels under a single Tools menu.
- Add a recent-tools list for fast access.
- Preserve power-user panel layout as an optional "Workspace mode."

Validation:
- Existing panels can still be opened.
- Closing tools returns to a clean chat layout.
- Saved layouts do not trap the user in a cluttered state.

Done when:
- Default mode is simple, and advanced mode is still one click away.

### Phase 4: Polish And Accessibility

Scope:
- Keyboard focus states for flyouts and menus.
- Escape closes flyouts.
- Color is never the only signal.
- Labels remain readable at narrow widths.

Validation:
- Keyboard-only pass through chat, tools menu, and review flyout.
- Light/dark theme pass.
- No text clipping in the right rail or flyout header.

Done when:
- The interface feels calm in screenshots and remains usable under real project load.

## Non-Goals

- Do not remove advanced tools.
- Do not redesign the whole brand.
- Do not rewrite diff or patch proposal logic.
- Do not add new AI features during cleanup.
- Do not introduce a new component library.

## Suggested First PR

Title:
`Simplify default workspace and prepare review flyout`

Files:
- `src/types/layout.ts`
- `src/components/layout/PanelWrapper.tsx`
- `src/components/TopBar.tsx`
- `src/components/StatusBar.tsx`
- `src/components/MessageBubble.tsx`
- `src/components/ConfidenceMeter.tsx`
- `src/styles/components.css`

Deliverables:
- Chat-first default layout.
- Flatter panel chrome.
- Quieter message badges/actions.
- Right rail labels clarified.
- No behavior changes to diff or patch review yet.

## Suggested Second PR

Title:
`Move diff and patch review into smart changes flyout`

Files:
- `src/components/ReviewChangesFlyout.tsx`
- `src/components/DiffViewer.tsx`
- `src/components/PatchReviewPanel.tsx`
- `src/components/EnvironmentRail.tsx`
- `src/App.tsx`
- `src/styles/components.css`

Deliverables:
- "Review changes" opens a flyout.
- Diff and patch proposal workflows live together.
- Old panel entry points remain available during transition.
