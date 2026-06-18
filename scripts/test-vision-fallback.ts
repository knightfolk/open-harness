import assert from 'node:assert/strict';
import {
  appendVisualContextToContent,
  formatVisualContextForPrompt,
  normalizeVisualContext,
} from '../server/visionFallback';

const context = normalizeVisualContext({
  kind: 'browser-screenshot',
  url: 'http://localhost:5173',
  title: 'OpenHarness',
  capturedAt: '2026-06-18T00:00:00.000Z',
  screenshot: {
    present: true,
    path: '/tmp/preview.png',
  },
  screenshotBase64: 'this-should-not-be-used',
  bodyTextPreview: 'OpenHarness chat workspace. Run controls and model routing are visible.',
  a11yNodes: [
    { tag: 'button', label: 'Send message', role: 'button' },
    { tag: 'button', label: 'Review Changes' },
  ],
  domStructure: {
    headings: [{ level: 1, text: 'OpenHarness' }],
    interactiveElements: [
      { tag: 'button', text: 'Send', selector: '.send-button' },
      { tag: 'a', text: 'Docs', selector: 'a' },
    ],
    images: [{ src: '/openharness-icon.png', alt: 'OpenHarness icon' }],
    links: [{ href: '/docs', text: 'Docs' }],
    metaDescription: 'Developer agent workspace',
  },
  resourceHealth: [
    { url: 'http://localhost:5173/missing.png', status: 404, ok: false },
    { url: 'http://localhost:5173/main.js', status: 200, ok: true },
  ],
  errors: [{ type: 'warning', message: 'Screenshot capture used cached preview' }],
});

assert.ok(context, 'valid browser screenshot context should normalize');

const textOnlyPrompt = formatVisualContextForPrompt(context!, false);
assert.match(textOnlyPrompt, /does not support native vision input/i, 'non-vision models should get explicit fallback framing');
assert.match(textOnlyPrompt, /Visible text preview: OpenHarness chat workspace/i, 'body text preview should be included');
assert.match(textOnlyPrompt, /Interactive elements:/, 'interactive elements should be included');
assert.match(textOnlyPrompt, /Resource issues:/, 'broken resources should be included');
assert.doesNotMatch(textOnlyPrompt, /this-should-not-be-used/, 'raw base64 should never be included in the text fallback');

const nativeVisionPrompt = formatVisualContextForPrompt(context!, true);
assert.match(nativeVisionPrompt, /compact companion/i, 'native vision models should get companion evidence framing');

const appended = appendVisualContextToContent('Review this screenshot.', context, false);
assert.match(appended, /^Review this screenshot\./, 'original request should remain first');
assert.match(appended, /## Visual Evidence/, 'visual evidence should be appended after the request');

assert.equal(normalizeVisualContext({ kind: 'browser-screenshot', url: '' }), undefined, 'blank URLs should be ignored');
assert.equal(normalizeVisualContext({ kind: 'other', url: 'http://localhost:5173' }), undefined, 'unknown visual context kinds should be ignored');

console.log('vision fallback tests passed');
