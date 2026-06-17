import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf-8');
const css = readFileSync('src/styles/components.css', 'utf-8');
const panelRegistry = readFileSync('src/components/layout/panelRegistry.tsx', 'utf-8');

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

const narrow640 = mediaSections('(max-width: 640px)');
const routing680 = mediaSections('(max-width: 680px)');
const panel760 = mediaSections('(max-width: 760px)');

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
  "'model-lab': { id: 'model-lab'",
  "minSize: 260",
  "'routing-learning': { id: 'routing-learning'",
  "minSize: 280",
]) {
  assert.ok(
    panelRegistry.includes(expected),
    `panel registry should keep narrow-safe proof panel sizing for ${expected}`,
  );
}

console.log('Premier narrow layout checks passed.');
