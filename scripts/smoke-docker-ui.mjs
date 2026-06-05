#!/usr/bin/env node

const API_BASE = process.env.OPENHARNESS_BASE || 'http://localhost:3001';
const UI_URL = process.env.OPENHARNESS_UI_URL || `http://host.docker.internal:5173/?smoke=docker-ui-${Date.now()}`;
const MCP_SERVER_ID = process.env.OPENHARNESS_DOCKER_MCP_ID || 'docker-mcp';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const detail = typeof body === 'object' && body?.error ? body.error : text;
    throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status} ${detail}`);
  }
  return body;
}

async function callDockerTool(toolName, args) {
  return request(`/api/mcp/${MCP_SERVER_ID}/tools/${encodeURIComponent(toolName)}`, {
    method: 'POST',
    body: JSON.stringify(args || {}),
  });
}

function toolText(result) {
  const content = result?.result?.content || result?.content;
  if (!Array.isArray(content)) return '';
  return content.map((item) => item?.text || '').join('\n');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertNoUnresolvedNetworkFailures(networkText) {
  const lines = networkText.split('\n').map((line) => line.trim()).filter(Boolean);
  const successfulUrls = new Set();
  for (const line of lines) {
    const match = line.match(/\[(GET|POST|PUT|DELETE|PATCH)\]\s+(\S+)\s+=>\s+\[200\]\s+OK/i);
    if (match) successfulUrls.add(`${match[1].toUpperCase()} ${match[2]}`);
  }
  const unresolved = lines.filter((line) => {
    const failed = line.match(/\[(GET|POST|PUT|DELETE|PATCH)\]\s+(\S+)\s+=>\s+\[FAILED\]/i);
    if (!failed) return false;
    if (failed[1].toUpperCase() === 'GET' && /\/api\/mcp\/docker\/readiness(?:\?|$)/.test(failed[2])) {
      return false;
    }
    return !successfulUrls.has(`${failed[1].toUpperCase()} ${failed[2]}`);
  });
  assert(unresolved.length === 0, `Failed browser network request found:\n${unresolved.join('\n')}`);
}

async function main() {
  console.log(`Docker UI smoke`);
  console.log(`API: ${API_BASE}`);
  console.log(`UI:  ${UI_URL}`);

  const readiness = await request('/api/mcp/docker/readiness');
  assert(readiness.dockerInstalled, 'Docker is not installed.');
  assert(readiness.daemonRunning, `Docker daemon is not running. ${readiness.hints?.join(' ') || ''}`.trim());
  assert(readiness.dockerMcpAvailable, `Docker MCP is unavailable. ${readiness.hints?.join(' ') || ''}`.trim());
  assert(readiness.profileReady, `Docker MCP profile is not ready. ${readiness.hints?.join(' ') || ''}`.trim());

  const status = await request('/api/mcp/status');
  const dockerMcp = Array.isArray(status) ? status.find((server) => server.id === MCP_SERVER_ID) : null;
  assert(dockerMcp?.running, `${MCP_SERVER_ID} is not running.`);
  assert((dockerMcp.toolCount || 0) > 0, `${MCP_SERVER_ID} has no tools.`);
  assert(
    typeof dockerMcp.usableToolCount === 'number' && dockerMcp.usableToolCount < dockerMcp.toolCount,
    `${MCP_SERVER_ID} should report trust-filtered usable tools below the raw tool count.`,
  );
  const unsafeTool = Array.isArray(dockerMcp.tools)
    ? dockerMcp.tools.find((tool) => tool.name === 'browser_run_code_unsafe')
    : null;
  assert(unsafeTool?.allowed === false, 'browser_run_code_unsafe should be marked blocked in normal trust mode.');

  const navigate = await callDockerTool('browser_navigate', { url: UI_URL });
  const navigateText = toolText(navigate);
  assert(/Page Title:\s*OpenHarness/i.test(navigateText), 'OpenHarness page did not load with the expected title.');
  await callDockerTool('browser_wait_for', { time: 1 });

  const consoleResult = await callDockerTool('browser_console_messages', { level: 'error', all: false });
  const consoleText = toolText(consoleResult);
  assert(/Errors:\s*0\b/i.test(consoleText), `Browser console errors found:\n${consoleText}`);

  const networkResult = await callDockerTool('browser_network_requests', { static: false });
  const networkText = toolText(networkResult);
  assertNoUnresolvedNetworkFailures(networkText);
  assert(/\/api\/config.*=>\s*\[200\]\s*OK/i.test(networkText), 'Expected /api/config 200 request was not observed.');
  assert(/\/api\/mcp\/status.*=>\s*\[200\]\s*OK/i.test(networkText), 'Expected /api/mcp/status 200 request was not observed.');

  const snapshotResult = await callDockerTool('browser_snapshot', {});
  const snapshotText = toolText(snapshotResult);
  assert(/OpenHarness/i.test(snapshotText), 'Snapshot does not contain OpenHarness UI text.');

  console.log('Docker UI smoke passed.');
}

main().catch((err) => {
  console.error(`Docker UI smoke failed: ${err.message}`);
  process.exit(1);
});
