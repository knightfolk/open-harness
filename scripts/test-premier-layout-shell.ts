import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { ALL_PANELS, DEFAULT_LAYOUT } from '../src/types/layout';

assert.equal(DEFAULT_LAYOUT, 'chat', 'Premier shell should default to chat-only layout');
assert.deepEqual(
  ALL_PANELS,
  ['chat', 'browser', 'terminal', 'files', 'model-lab', 'routing-learning', 'safety'],
  'Default Tools panels should not include the permanent sub-agents split',
);

const useLayoutState = readFileSync('src/components/layout/useLayoutState.ts', 'utf-8');
const layoutEngine = readFileSync('src/components/layout/LayoutEngine.tsx', 'utf-8');
const panelWrapper = readFileSync('src/components/layout/PanelWrapper.tsx', 'utf-8');
const topBar = readFileSync('src/components/TopBar.tsx', 'utf-8');
const panelRegistry = readFileSync('src/components/layout/panelRegistry.tsx', 'utf-8');
const environmentRail = readFileSync('src/components/EnvironmentRail.tsx', 'utf-8');
const statusBar = readFileSync('src/components/StatusBar.tsx', 'utf-8');
const app = readFileSync('src/App.tsx', 'utf-8');
const checklist = readFileSync('docs/PREMIER_HARNESS_PROOF_CHECKLIST.md', 'utf-8');
const mockData = readFileSync('src/utils/mockData.ts', 'utf-8');

for (const expected of [
  "const DEFAULT_HIDDEN_PANELS: PanelId[] = ALL_PANELS.filter((id): id is PanelId => id !== 'chat')",
  "const FORCE_HIDDEN_PANELS: PanelId[] = ['sub-agents']",
  'removePanelFromTree(next, panelId)',
  'return appendPanel(prev, id, placement)',
  'setLayout(structuredClone(DEFAULT_LAYOUT))',
]) {
  assert.ok(
    useLayoutState.includes(expected),
    `Layout state should preserve chat-first defaults and prune forced-hidden panels: ${expected}`,
  );
}

for (const forbidden of [
  'onDragStart',
  'onDragOver',
  'onDrop',
  'draggable=',
  'data-drag',
  'reorder',
]) {
  assert.equal(
    layoutEngine.includes(forbidden) || panelWrapper.includes(forbidden),
    false,
    `Layout shell should not expose default drag/drop or reorder behavior: ${forbidden}`,
  );
}

for (const expected of [
  'className={`panel-frame panel-frame--${panelId}`}',
  'data-panel-id={panelId}',
  'className="panel-header"',
  'className="panel-close"',
  'type="button"',
  'aria-label={`Close ${config.label} panel`}',
  '<X size={14} aria-hidden="true" />',
]) {
  assert.ok(
    panelWrapper.includes(expected),
    `Panel wrapper should keep flat closeable panel chrome without drag handles: ${expected}`,
  );
}

for (const expected of [
  "ALL_PANELS.filter((id) => id !== 'chat' && id !== 'sub-agents')",
  "const modelDetailPanel: PanelId = activeModel.toLowerCase() === 'auto' ? 'routing-learning' : 'model-lab'",
  'className="top-bar-model"',
  'type="button"',
  'data-model-evidence-entry="true"',
  'data-model-evidence-panel={modelDetailPanel}',
  "aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}",
  'onOpenPanel: (id: PanelId, placement?: PanelPlacement) => void',
  'onClick={() => onOpenPanel(modelDetailPanel, resolvedPanelPlacement(modelDetailPanel))}',
  "title={activeModel.toLowerCase() === 'auto' ? 'Open Routing Learning for router evidence' : `Open Model Lab for ${activeModel}`}",
  "aria-label={activeModel.toLowerCase() === 'auto' ? 'Open Routing Learning for router evidence' : `Open Model Lab for model ${activeModel}`}",
  'aria-label="Open Tools and panels menu"',
  '<Wrench size={16} aria-hidden="true" />',
  '<ChevronDown size={12} aria-hidden="true" />',
  'className={\'top-bar-action top-bar-panels-btn\' + (panelMenuOpen ? \' active\' : \'\')}',
  'title="Tools and panels"',
  '<span className="top-bar-panels-label">Tools</span>',
  '<div className="panel-menu">',
  '<span>Tools</span>',
  '<span className="panel-menu-count">{visibleCount} panels open</span>',
  'Reset to default layout',
]) {
  assert.ok(
    topBar.includes(expected),
    `TopBar should keep advanced panels behind a Tools menu and reset path: ${expected}`,
  );
}

const styles = readFileSync('src/styles/components.css', 'utf-8');
const globalStyles = readFileSync('src/styles/global.css', 'utf-8');
for (const expected of [
  '.top-bar-model:hover',
  '.top-bar-model:focus-visible',
  'outline: 2px solid var(--accent-primary)',
]) {
  assert.ok(
    styles.includes(expected),
    `Top-bar model/router evidence button should preserve hover and keyboard focus affordances: ${expected}`,
  );
}

for (const expected of [
  'function isEmptyUntitledSession',
  "session.title === 'New Session'",
  'function compactVisibleSessions',
  'compactVisibleSessions(list)',
  'compactVisibleSessions(fresh)',
  'compactVisibleSessions([sessionInfo, ...prev], session.id)',
  'api.listSessions().then((list) => setSessions(compactVisibleSessions(list, sessionId)))',
]) {
  assert.ok(
    app.includes(expected),
    `App should hide stale empty New Session placeholders once real sessions exist: ${expected}`,
  );
}

for (const expected of [
  '--topbar-height: 52px',
]) {
  assert.ok(
    globalStyles.includes(expected),
    `Top bar should sit lower with enough vertical room: ${expected}`,
  );
}

for (const expected of [
  'padding: 8px 16px 0 12px',
  'padding: 8px 12px 0 12px',
  'padding: 8px 8px 0 8px',
  'padding: 8px 4px 0 4px',
]) {
  assert.ok(
    styles.includes(expected),
    `Top bar controls/title should stay left aligned with the panel instead of using a traffic-light inset: ${expected}`,
  );
}

assert.equal(
  styles.includes('padding: 0 16px 0 78px') ||
    styles.includes('padding: 0 12px 0 78px') ||
    styles.includes('padding: 0 8px 0 78px') ||
    styles.includes('padding: 0 4px 0 68px'),
  false,
  'Top bar should not keep the old far-right traffic-light left padding',
);

for (const expected of [
  "'sub-agents':{ id: 'sub-agents',  label: 'Agent Work'",
  "chat:        { id: 'chat',        label: 'Chat'",
  "'routing-learning': { id: 'routing-learning', label: 'Routing Learning'",
]) {
  assert.ok(
    panelRegistry.includes(expected),
    `Panel registry should preserve labels for legacy panels while default layout hides them: ${expected}`,
  );
}

for (const expected of [
  'access: {',
  'progress: {',
  'sources: {',
  'No active run progress.',
  'No source context attached.',
]) {
  assert.ok(
    environmentRail.includes(expected),
    `Environment rail should preserve fixed context order without reorder handles: ${expected}`,
  );
}

for (const expected of [
  'const shouldShowStatusBar = Boolean(',
  'contextWarning ||',
  'terminalPanelOpen ||',
  'runningModel ||',
  'lastAutoRouterStep ||',
  'providerRateLimitWarning ||',
  "subAgents.some((agent) => agent.status === 'running' || agent.status === 'blocked' || agent.status === 'error')",
  'onOpenPanel={addPanel}',
  '{shouldShowStatusBar && (',
  '<StatusBar',
]) {
  assert.ok(
    app.includes(expected),
    `App shell should only mount bottom status chrome for warnings/background work/user-opened terminal: ${expected}`,
  );
}

for (const expected of [
  "ALL_PANELS.filter((id) => id !== 'chat' && id !== 'sub-agents')",
]) {
  assert.ok(
    topBar.includes(expected),
    `TopBar should keep forced-hidden tool panels out of the Tools menu: ${expected}`,
  );
}

for (const expected of [
  'className={`status-bar-item status-bar-rate-limit status-bar-rate-limit-${providerRateLimitWarning.severity}`}',
  'className="status-terminal-popover"',
]) {
  assert.ok(
    statusBar.includes(expected),
    `Status bar should stay hidden in quiet chat and appear for warnings/background/user-opened terminal: ${expected}`,
  );
}

for (const expected of [
  'top-bar model/router badge opens Routing Learning for',
  'Model Lab for concrete models',
  'quiet evidence entry',
]) {
  assert.ok(
    checklist.includes(expected),
    `Proof checklist should preserve top-bar router/model evidence entry requirement: ${expected}`,
  );
}

for (const expected of [
  'activeModel="Auto"',
  "onOpenPanel={(panel) => console.log('Open evidence panel', panel)}",
]) {
  assert.ok(
    mockData.includes(expected),
    `Mock layout snippet should not teach the obsolete passive TopBar contract: ${expected}`,
  );
}

console.log('Premier layout-shell checks passed.');
