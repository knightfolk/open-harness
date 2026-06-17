import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const messageBubble = readFileSync('src/components/MessageBubble.tsx', 'utf-8');
const nextBestActions = readFileSync('src/components/NextBestActions.tsx', 'utf-8');
const confidenceMeter = readFileSync('src/components/ConfidenceMeter.tsx', 'utf-8');
const styles = readFileSync('src/styles/components.css', 'utf-8');

for (const expected of [
  'const [showDetails, setShowDetails] = useState(false)',
  'const detailsRegionId = `message-details-${safeDomId(message.id)}`',
  "(message.toolCalls?.length || 0) > 0 ? 'tool details' : null",
  "confidenceSignals ? 'confidence' : null",
  "teamPlanArtifact ? 'team plan' : null",
  "message.runTrace ? 'prompt microscope' : null",
  "nextActions.length > 0 ? 'next actions' : null",
  "return items.length > 0 ? items.join(', ') : 'message details'",
]) {
  assert.ok(
    messageBubble.includes(expected),
    `MessageBubble should summarize hidden diagnostic surfaces for a quiet Details affordance: ${expected}`,
  );
}

for (const expected of [
  'title="Export this run\'s replay, prompts, routing, artifacts, and proof bundle"',
  'aria-label="Export this run\'s replay bundle from message details"',
  "{replayExportStatus || 'Export replay'}",
  "const validationProofs = steps.filter((step) => step.type === 'artifact' && step.artifact.type === 'validation_proof').length",
  "validationProofs > 0 ? `${validationProofs} validation proof${validationProofs === 1 ? '' : 's'}` : null",
  'className="message-replay-summary"',
  '<span>Run replay</span>',
  'isAssistant && !isStreaming && hasHiddenDetails',
  'className="message-details-toggle"',
  'title={showDetails ? \'Hide message details\' : \'Show message details\'}',
  'aria-expanded={showDetails}',
  'aria-controls={detailsRegionId}',
  'aria-label={`${showDetails ? \'Hide\' : \'Show\'} ${hiddenDetailSummary}`}',
  '<span>{showDetails ? \'Hide details\' : \'Details\'}</span>',
]) {
  assert.ok(
    messageBubble.includes(expected),
    `MessageBubble should keep diagnostics behind an accessible Details toggle: ${expected}`,
  );
}

for (const expected of [
  'isAssistant && !isStreaming && showDetails',
  'className="message-details-region" role="region" aria-label="Message details"',
  'title="Export this run\'s replay, prompts, routing, artifacts, and proof bundle"',
  'aria-label="Export this run\'s replay bundle from message details"',
  "{replayExportStatus || 'Export replay'}",
  '<ToolCallSummary toolCalls={message.toolCalls} />',
  '<ConfidenceMeter signals={confidenceSignals} />',
  '<TeamPlanArtifactCard',
  '<PromptMicroscope runTrace={message.runTrace} />',
  '<NextBestActions',
  'collapseAt={1}',
]) {
  assert.ok(
    messageBubble.includes(expected),
    `MessageBubble should render diagnostic/tool/action surfaces only inside the opened details region: ${expected}`,
  );
}

const exportReplayIndex = messageBubble.indexOf('Export replay');
const detailsRegionIndex = messageBubble.indexOf('className="message-details-region" role="region" aria-label="Message details"');
assert.ok(
  exportReplayIndex > detailsRegionIndex,
  'Replay export should remain behind Message details instead of adding default chat chrome',
);

for (const expected of [
  'const [collapsed, setCollapsed] = useState(actions.length >= collapseAt && collapseAt > 0)',
  'if (collapsed)',
  'className="next-best-actions collapsed"',
  'className="nba-expand-btn"',
  'aria-expanded={false}',
  'aria-label={`Show ${actions.length} suggested action${actions.length === 1 ? \'\' : \'s\'}`}',
  '<span className="nba-expand-label">Actions</span>',
  '<span className="nba-expand-count" aria-hidden="true">{actions.length}</span>',
  'aria-label="Collapse suggested actions"',
  'role="group" aria-label="Suggested actions"',
]) {
  assert.ok(
    nextBestActions.includes(expected),
    `NextBestActions should default to one compact Actions affordance before showing chips: ${expected}`,
  );
}

for (const expected of [
  'aria-label={`${expanded ? \'Hide\' : \'Show\'} confidence details`}',
  'aria-controls={panelId}',
  'aria-expanded={expanded}',
  'aria-label="Confidence details"',
  'Reliability risk',
]) {
  assert.ok(
    confidenceMeter.includes(expected),
    `ConfidenceMeter should stay self-contained and opt-in inside Details: ${expected}`,
  );
}

for (const expected of [
  '.message-replay-summary',
  '.message-details-toggle',
  'background: none',
  'font-size: 11px',
  '.message-patch-action .btn',
  '.confidence-badge',
  'background: transparent',
  'opacity: 0.75',
]) {
  assert.ok(
    styles.includes(expected),
    `Calm chat styling should keep details/confidence affordances visually quiet: ${expected}`,
  );
}

console.log('Premier calm-chat checks passed.');
