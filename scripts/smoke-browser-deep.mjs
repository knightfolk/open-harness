#!/usr/bin/env node

const apiBase = process.env.OPENHARNESS_API_BASE || 'http://127.0.0.1:3001';
const targetUrl = process.env.OPENHARNESS_BROWSER_SMOKE_URL || 'http://127.0.0.1:5173';

async function main() {
  const res = await fetch(`${apiBase}/api/browser/deep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl }),
  });
  if (!res.ok) {
    throw new Error(`deep browser capture returned HTTP ${res.status}`);
  }
  const artifact = await res.json();
  if (artifact.status !== 200) {
    throw new Error(`captured page returned HTTP ${artifact.status}`);
  }
  if (!artifact.title && !artifact.bodyTextPreview) {
    throw new Error('deep browser capture did not return title or body text');
  }
  if (!artifact.domStructure) {
    throw new Error('deep browser capture did not include DOM structure');
  }
  if (!Array.isArray(artifact.resourceHealth)) {
    throw new Error('deep browser capture did not include resource health');
  }
  const failedResources = artifact.resourceHealth.filter((entry) => !entry.ok);
  console.log(JSON.stringify({
    ok: true,
    url: artifact.url,
    status: artifact.status,
    title: artifact.title,
    headings: artifact.domStructure.headings.length,
    interactiveElements: artifact.domStructure.interactiveElements.length,
    resources: artifact.resourceHealth.length,
    failedResources: failedResources.length,
    errors: artifact.errors.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
