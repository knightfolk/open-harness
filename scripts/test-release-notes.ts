import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

const packagedRoot = mkdtempSync(join(tmpdir(), 'openharness-release-notes-'));
writeFileSync(join(packagedRoot, 'package.json'), JSON.stringify({ version: '1.2.3-packaged.4' }));
writeFileSync(join(packagedRoot, 'CHANGELOG.md'), `# Changelog

## [1.2.3-packaged.4] - 2026-06-19

- Packaged release note.
`);

process.env.OPENHARNESS_APP_ROOT = packagedRoot;
const packaged = await import(`../server/releaseNotes.ts?packaged=${Date.now()}`);
const payload = packaged.getReleaseNotes();
assert.equal(payload.currentVersion, '1.2.3-packaged.4');
assert.equal(payload.releases[0].version, '1.2.3-packaged.4');
assert.equal(payload.releases[0].notes[0], 'Packaged release note.');

console.log('release notes parser ok');
