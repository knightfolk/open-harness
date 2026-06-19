import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { validateMcpEndpoint } from '../server/routes/mcpRoutes';

const serverIndex = readFileSync('server/index.ts', 'utf-8');
const mcpRoutes = readFileSync('server/routes/mcpRoutes.ts', 'utf-8');
const browserPanel = readFileSync('src/components/BrowserPanel.tsx', 'utf-8');
const settings = readFileSync('src/components/SettingsModal.tsx', 'utf-8');
const api = readFileSync('src/utils/api.ts', 'utf-8');

assert.ok(
  serverIndex.includes('registerMcpRoutes(app, {'),
  'server/index.ts should register MCP control-plane routes through the extracted route module',
);

for (const forbidden of [
  "app.get('/api/mcp-servers'",
  "app.post('/api/mcp-servers'",
  "app.get('/api/mcp/status'",
  "app.post('/api/mcp/:serverId/tools/:toolName'",
  "app.get('/api/mcp/curated'",
]) {
  assert.equal(serverIndex.includes(forbidden), false, `server/index.ts should not keep inline MCP route handler ${forbidden}`);
}

for (const expected of [
  'export function registerMcpRoutes',
  'export function validateMcpEndpoint',
  "authConfigured: server.authType === 'bearer' && Boolean(server.authToken)",
  "app.get('/api/mcp-servers'",
  "app.post('/api/mcp/:serverId/tools/:toolName'",
  'checkToolActionPolicy(toolName, args, trustMode, workingDir)',
  'redactToolResult(result)',
]) {
  assert.ok(mcpRoutes.includes(expected), `MCP route module should preserve route behavior and auth masking: ${expected}`);
}

assert.equal(validateMcpEndpoint('stdio://npx -y @modelcontextprotocol/server-memory').ok, true, 'valid stdio endpoint should pass');
assert.equal(validateMcpEndpoint('https://example.test/mcp').ok, true, 'valid https endpoint should pass');
assert.equal(validateMcpEndpoint('file:///tmp/server').ok, false, 'unsupported endpoint schemes should fail');
assert.equal(validateMcpEndpoint('stdio://').ok, false, 'empty stdio endpoint should fail');

for (const expected of [
  'feedbackNote',
  'buildBrowserFeedbackPrompt',
  'Reviewer note:',
  'Resource failures:',
  'Capture issues:',
  'Send browser preview evidence to chat',
  'Sends screenshot, DOM, errors, and resources',
  'onAskAboutScreenshot(preview?.screenshotBase64 || \'\', url, visualContext, buildBrowserFeedbackPrompt(visualContext))',
]) {
  assert.ok(browserPanel.includes(expected), `BrowserPanel should send preview evidence back into chat: ${expected}`);
}

for (const expected of [
  'authConfigured?: boolean',
]) {
  assert.ok(api.includes(expected), `API types should expose MCP auth state: ${expected}`);
}

for (const expected of [
  'Bearer tokens are stored locally and masked in Settings.',
  'Bearer token stored locally',
  'Bearer token missing',
  'No auth token',
  'Connection checklist',
  'Use bearer auth only for private HTTP gateways',
  'Remove MCP server ${server.name}',
]) {
  assert.ok(settings.includes(expected), `Settings should explain MCP auth and transport state: ${expected}`);
}

console.log('Post-alpha follow-up regression checks passed.');
