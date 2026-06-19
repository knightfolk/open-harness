import assert from 'node:assert/strict';
import { parseChangelog } from '../server/releaseNotes';

const parsed = parseChangelog(`# Changelog

## Unreleased
- Added first-launch patch notes.
- Added crash report exports.

## [1.0.0-alpha.1] - 2026-06-01
- Earlier release.
`, '1.0.0-alpha.update.1');

assert.equal(parsed.length, 2);
assert.equal(parsed[0].version, '1.0.0-alpha.update.1');
assert.equal(parsed[0].current, true);
assert.deepEqual(parsed[0].notes, ['Added first-launch patch notes.', 'Added crash report exports.']);
assert.equal(parsed[1].version, '1.0.0-alpha.1');
assert.equal(parsed[1].date, '2026-06-01');

console.log('release notes parser ok');
