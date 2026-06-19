import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf-8');
const css = readFileSync('src/styles/components.css', 'utf-8');
const panelRegistry = readFileSync('src/components/layout/panelRegistry.tsx', 'utf-8');
const panelPressureDeepDive = readFileSync('docs/PANEL_PRESSURE_DEEP_DIVE.md', 'utf-8');

function mediaSections(query: string): string {
  const marker = `@media ${query}`;
  const sections: string[] = [];
  let searchFrom = 0;
  while (true) {
    const start = css.indexOf(marker, searchFrom);
    if (start === -1) break;
    const next = css.indexOf('@media ', start + marker.length);
    sections.push(next === -1 ? css.slice(start) : css.slice(start, next));
    searchFrom = start + marker.length;
  }
  assert.ok(sections.length > 0, `components.css should define ${query} responsive rules`);
  return sections.join('\n');
}

assert.ok(
  app.includes('const NARROW_SIDEBAR_AUTO_CLOSE_WIDTH = 640;'),
  'App should define a 640px narrow breakpoint for chat-first sidebar behavior',
);

assert.ok(
  app.includes('if (window.innerWidth <= NARROW_SIDEBAR_AUTO_CLOSE_WIDTH)') && app.includes('setSidebarOpen(false);'),
  'App should auto-close the sidebar on narrow screens so chat remains the default surface',
);

assert.ok(
  app.includes("window.addEventListener('resize', closeSidebarForNarrowScreens)") && app.includes("window.removeEventListener('resize', closeSidebarForNarrowScreens)"),
  'App should keep narrow sidebar behavior current on resize and clean up the listener',
);

assert.ok(
  app.includes("window.visualViewport?.addEventListener('resize', closeSidebarForNarrowScreens)") &&
    app.includes("window.visualViewport?.removeEventListener('resize', closeSidebarForNarrowScreens)"),
  'App should keep narrow sidebar behavior current when browser viewport emulation changes visualViewport',
);

assert.ok(
  app.includes('new ResizeObserver(closeSidebarForNarrowScreens)') &&
    app.includes('resizeObserver?.observe(document.documentElement)') &&
    app.includes('resizeObserver?.disconnect()'),
  'App should keep narrow sidebar behavior current when document layout width changes without a window resize event',
);

const narrow640 = mediaSections('(max-width: 640px)');
const routing680 = mediaSections('(max-width: 680px)');
const panel760 = mediaSections('(max-width: 760px)');
const split1080 = mediaSections('(max-width: 1080px)');

for (const expected of [
  'width: calc(100% - 20px)',
  'margin-left: 10px',
  'margin-right: 10px',
  '.input-top',
  'min-width: 0',
  '.input-textarea',
  'flex: 1 1 auto',
  'width: 100%',
]) {
  assert.ok(
    narrow640.includes(expected),
    `narrow composer rules should include ${expected}`,
  );
}

for (const expected of [
  '.settings-modal',
  'width: 94vw',
  'min-width: 0',
  'height: 92vh',
  '.settings-modal-body',
  'flex-direction: column',
  '.settings-nav',
  'width: 100%',
  'max-height: 164px',
  'border-right: none',
  'border-bottom: 1px solid var(--border-primary)',
  '.settings-content',
  'overflow-x: hidden',
]) {
  assert.ok(
    narrow640.includes(expected),
    `narrow Settings rules should include ${expected}`,
  );
}

for (const expected of [
  '.routing-explain',
  '.routing-metrics',
  '.routing-debug-grid',
  '.routing-breakdown-grid',
  '.routing-mini-grid',
  'grid-template-columns: 1fr',
  '.routing-learning-header',
  '.routing-section-header',
  'flex-direction: column',
  'align-items: stretch',
  '.routing-header-actions',
  'justify-content: flex-start',
]) {
  assert.ok(
    routing680.includes(expected),
    `narrow Routing Learning rules should include ${expected}`,
  );
}

for (const expected of [
  '.model-library-toolbar',
  '.model-library-summary',
  '.model-card-columns',
  'grid-template-columns: 1fr',
]) {
  assert.ok(
    panel760.includes(expected),
    `narrow Model Library/Model Lab-adjacent rules should include ${expected}`,
  );
}

for (const expected of [
  '.layout-split--horizontal',
  'flex-direction: column !important',
  '.layout-split--horizontal .layout-split-resizer--horizontal',
  'cursor: row-resize',
]) {
  assert.ok(
    split1080.includes(expected),
    `tight split rules should stack side-by-side panels before chat becomes too narrow: ${expected}`,
  );
}

for (const expected of [
  "'model-lab': { id: 'model-lab'",
  "minSize: 260",
  "'routing-learning': { id: 'routing-learning'",
  "minSize: 280",
  "chat:        { id: 'chat'",
  "minSize: 520",
  "browser:     { id: 'browser'",
  "minSize: 300",
  "terminal:    { id: 'terminal'",
  "minSize: 160",
]) {
  assert.ok(
    panelRegistry.includes(expected),
    `panel registry should keep narrow-safe proof panel sizing for ${expected}`,
  );
}

for (const expected of [
  'const COMPACT_SIDEBAR_WIDTH = 220;',
  'const PANEL_PRESSURE_CHAT_MIN_WIDTH = 560;',
  'const PANEL_PRESSURE_AUX_PANEL_WIDTH = 300;',
  'const PANEL_PRESSURE_ENVIRONMENT_WIDTH = 426;',
  'sidebarWidthBeforePressureRef',
  'environmentAutoCollapsedRef',
  'const auxiliaryPanelCount = Math.max(0, visiblePanels.size - 1);',
  'const isUnderPressure = auxiliaryPanelCount > 0 && window.innerWidth < requiredWidth;',
  'setEnvironmentOpen(false);',
  'setSidebarWidth(COMPACT_SIDEBAR_WIDTH);',
  "window.addEventListener('resize', rebalancePanelPressure)",
  "window.removeEventListener('resize', rebalancePanelPressure)",
  "window.visualViewport?.addEventListener('resize', rebalancePanelPressure)",
  "window.visualViewport?.removeEventListener('resize', rebalancePanelPressure)",
  'new ResizeObserver(rebalancePanelPressure)',
  'resizeObserver?.observe(document.documentElement)',
  'resizeObserver?.disconnect()',
]) {
  assert.ok(
    app.includes(expected),
    `panel pressure relief should preserve chat-readable minimum sizing before dense panels crowd the shell: ${expected}`,
  );
}

for (const expected of [
  'import { getPanelConfig } from',
  'function preferredSizes',
  'function nodeDefaultSize',
  'normalizeSizes(split.children.map((child) => nodeDefaultSize(child, split.direction)))',
  'const [sizes, setSizes] = useState(() => preferredSizes(split));',
  'function nodeMinSize',
  'const firstMinPx = nodeMinSize(split.children[index], split.direction);',
  'const secondMinPx = nodeMinSize(split.children[index + 1], split.direction);',
  'Math.max(firstMin, startSizes[index] + delta)',
]) {
  assert.ok(
    readFileSync('src/components/layout/LayoutEngine.tsx', 'utf-8').includes(expected),
    `layout split resizing should use panel registry minimums: ${expected}`,
  );
}

for (const expected of [
  '# Panel Pressure Deep Dive',
  'Chat | 920px | 520px',
  'Hide the Environment rail',
  'Compact the left sidebar to its 220px minimum',
  'Stack horizontal splits at tighter widths',
  'Open `Tools` and add `Browser` in the right pane',
  'Horizontal split direction changes from row to column before chat is reduced to one-word lines',
]) {
  assert.ok(
    panelPressureDeepDive.includes(expected),
    `panel pressure deep dive should preserve minimum-size and resize-demo guidance: ${expected}`,
  );
}

console.log('Premier narrow layout checks passed.');
