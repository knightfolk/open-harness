import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildPromptSectionEstimateLookup } from '../src/utils/promptMicroscopeSections';
import type { SectionEstimate } from '../src/utils/api';

function makeEstimate(id: string, tokens: number, text = id): SectionEstimate {
  return {
    id,
    label: id,
    tokens,
    truncated: false,
    text,
    redactedHits: 0,
  };
}

assert.equal(
  buildPromptSectionEstimateLookup(null).size,
  0,
  'Estimate lookup should be empty for null estimates',
);
assert.equal(
  buildPromptSectionEstimateLookup(undefined).size,
  0,
  'Estimate lookup should be empty for undefined estimates',
);

const first = makeEstimate('assembly:intro', 4, 'first estimate');
const duplicate = makeEstimate('assembly:intro', 99, 'duplicate estimate');
const second = makeEstimate('toolcall:read-file', 7, 'tool estimate');
const lookup = buildPromptSectionEstimateLookup([first, duplicate, second]);

assert.equal(lookup.size, 2, 'Estimate lookup should collapse duplicate IDs');
assert.equal(
  lookup.get('assembly:intro'),
  first,
  'Estimate lookup should preserve previous estimates.find first-match behavior for duplicate IDs',
);
assert.equal(
  lookup.get('toolcall:read-file')?.tokens,
  7,
  'Estimate lookup should make section estimates addressable by ID',
);

const promptMicroscopeSource = readFileSync('src/components/PromptMicroscope.tsx', 'utf8');
const componentStyles = readFileSync('src/styles/components.css', 'utf8');
const promptMicroscopeRenderSource = promptMicroscopeSource.slice(promptMicroscopeSource.indexOf('const promptBuiltPreview'));
assert.ok(
  promptMicroscopeSource.includes('buildPromptSectionEstimateLookup(estimates)'),
  'Prompt Microscope should build one keyed section-estimate lookup',
);
assert.ok(
  promptMicroscopeSource.includes('estimateById.get(s.id)'),
  'Prompt Microscope section rows should use keyed estimate lookup',
);
assert.ok(
  !promptMicroscopeSource.includes('estimates?.find'),
  'Prompt Microscope should avoid per-row estimates.find lookups',
);
assert.ok(
  promptMicroscopeSource.includes('function buildPromptEstimateSummary'),
  'Prompt Microscope should centralize section estimate totals in one helper',
);
assert.ok(
  promptMicroscopeSource.includes('const promptEstimateSummary = useMemo(() => (expanded ? buildPromptEstimateSummary({')
    && promptMicroscopeSource.includes('}) : EMPTY_PROMPT_ESTIMATE_SUMMARY)'),
  'Prompt Microscope should memoize section estimate totals behind the expanded-state guard instead of recalculating them in render',
);
assert.ok(
  promptMicroscopeSource.includes('const totalEstimatedInputTokens = estimates?.reduce'),
  'Prompt Microscope estimate summary should keep token totals on the full estimates array',
);
assert.ok(
  promptMicroscopeSource.includes('const totalRedactions = estimates?.reduce'),
  'Prompt Microscope should keep redaction totals on the full estimates array',
);
assert.ok(
  promptMicroscopeSource.includes('sum + Math.max(0, s.redactedHits)'),
  'Prompt Microscope should not subtract unknown-redaction fallback sentinels from redaction totals',
);
assert.ok(
  promptMicroscopeSource.includes('const totalRedactionUnknown = estimates?.filter((s) => s.redactedHits < 0).length ?? 0'),
  'Prompt Microscope should count prompt sections whose redaction estimate is unknown',
);
assert.ok(
  !promptMicroscopeRenderSource.includes('const totalEstimatedInputTokens = estimates?.reduce'),
  'Prompt Microscope render body should use the memoized estimate summary instead of inline token reductions',
);
assert.ok(
  promptMicroscopeSource.includes('totalRedactionUnknown > 0'),
  'Prompt Microscope should show a top-level warning when any prompt section redaction estimate is unknown',
);
assert.ok(
  promptMicroscopeSource.includes('pm-redact-pill-warning'),
  'Prompt Microscope should render unknown redaction counts as a visually distinct warning pill',
);
assert.ok(
  promptMicroscopeSource.includes('prompt section redaction estimate(s) unavailable'),
  'Prompt Microscope should explain unknown redaction estimates in the warning pill title',
);
assert.ok(
  componentStyles.includes('.pm-redact-pill-warning'),
  'Prompt Microscope warning pill should have a dedicated warning style',
);
assert.ok(
  promptMicroscopeSource.includes('duplicate IDs still count toward server accounting'),
  'Prompt Microscope should document why totals do not use the deduped estimate lookup',
);
