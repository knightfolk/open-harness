import { strict as assert } from 'node:assert';
import {
  buildModelRequestDurationEvidence,
  modelRequestDurationEvidenceLines,
  sortModelRequestDurationRows,
} from '../src/utils/modelRequestDurationEvidence';

const rows = {
  byModel: [
    ['provider:slow', { samples: 2, avgMs: 30001, slow: true, thresholdMs: 30000 }],
    ['provider:steady', { samples: 1, avgMs: 30000, slow: false, thresholdMs: 30000 }],
  ],
  byTaskType: [
    ['execute', { samples: 3, avgMs: 45000, slow: true, thresholdMs: 30000 }],
  ],
} as const;

const evidence = buildModelRequestDurationEvidence(rows);

assert.deepEqual(
  evidence.summary,
  {
    modelRows: 2,
    taskRows: 1,
    slowRowCount: 2,
    thresholdMs: 30000,
  },
  'Model request duration evidence should summarize slow rows using the shared threshold carried by aggregate rows',
);

assert.deepEqual(
  evidence.byModel,
  [
    {
      label: 'provider:slow',
      scope: 'model',
      samples: 2,
      avgMs: 30001,
      slow: true,
      thresholdMs: 30000,
      markdown: '- Model provider:slow: 30.0s average from 2 samples · slow (>30.0s threshold)',
    },
    {
      label: 'provider:steady',
      scope: 'model',
      samples: 1,
      avgMs: 30000,
      slow: false,
      thresholdMs: 30000,
      markdown: '- Model provider:steady: 30.0s average from 1 sample · threshold 30.0s',
    },
  ],
  'Per-model evidence rows should preserve slow, threshold, and deterministic Markdown text',
);

assert.deepEqual(
  modelRequestDurationEvidenceLines(rows),
  [
    '- Slow request duration rows: 2 at 30.0s threshold',
    '- Model provider:slow: 30.0s average from 2 samples · slow (>30.0s threshold)',
    '- Model provider:steady: 30.0s average from 1 sample · threshold 30.0s',
    '- Task execute: 45.0s average from 3 samples · slow (>30.0s threshold)',
  ],
  'Markdown evidence lines should surface the same slow flags and threshold as JSON evidence rows',
);

assert.deepEqual(
  sortModelRequestDurationRows([
    ['provider:fast-many', { samples: 12, avgMs: 30000, slow: false, thresholdMs: 30000 }],
    ['provider:slow-few', { samples: 2, avgMs: 30001, slow: true, thresholdMs: 30000 }],
    ['provider:slow-many', { samples: 5, avgMs: 31000, slow: true, thresholdMs: 30000 }],
    ['provider:slow-many-higher-avg', { samples: 5, avgMs: 45000, slow: true, thresholdMs: 30000 }],
  ]).map(([label]) => label),
  ['provider:slow-many-higher-avg', 'provider:slow-many', 'provider:slow-few', 'provider:fast-many'],
  'Model request duration rows should sort slow rows first, then sample count, then average duration for live UI discoverability',
);

console.log('Model request duration evidence checks passed.');
