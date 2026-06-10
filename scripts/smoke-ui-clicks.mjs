#!/usr/bin/env node

const API_BASE = process.env.OPENHARNESS_BASE || 'http://localhost:3001';
const UI_URL = process.env.OPENHARNESS_UI_URL || `http://host.docker.internal:5173/?smoke=ui-clicks-${Date.now()}`;
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

async function evaluate(fn, arg) {
  const result = await callDockerTool('browser_evaluate', {
    function: `(${fn.toString()})`,
    element: arg === undefined ? undefined : JSON.stringify(arg),
  });
  const text = toolText(result);
  if (/^### Error/m.test(text) || result?.result?.isError) {
    throw new Error(text);
  }
  return text;
}

async function main() {
  console.log('UI click smoke');
  console.log(`API: ${API_BASE}`);
  console.log(`UI:  ${UI_URL}`);

  const status = await request('/api/mcp/status');
  const dockerMcp = Array.isArray(status) ? status.find((server) => server.id === MCP_SERVER_ID) : null;
  assert(dockerMcp?.running, `${MCP_SERVER_ID} is not running.`);

  await callDockerTool('browser_resize', { width: 1366, height: 900 });
  const navigate = await callDockerTool('browser_navigate', { url: UI_URL });
  assert(/Page Title:\s*OpenHarness/i.test(toolText(navigate)), 'OpenHarness page did not load.');
  await callDockerTool('browser_wait_for', { time: 1 });
  await evaluate(() => {
    localStorage.setItem('openharness-layout.v3', JSON.stringify('chat'));
    localStorage.removeItem('openharness.sidebar.width.v1');
    window.location.reload();
    return true;
  });
  await callDockerTool('browser_wait_for', { time: 1 });

  await evaluate(async () => {
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const labelOf = (el) => [el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const allButtons = () => Array.from(document.querySelectorAll('button'));
    const findButton = (label, { exact = false } = {}) => {
      const wanted = label.toLowerCase();
      return allButtons().find((candidate) => {
        const actual = labelOf(candidate).toLowerCase();
        return exact ? actual === wanted : actual.includes(wanted);
      });
    };
    const clickButton = async (label, { exact = false } = {}) => {
      const button = findButton(label, { exact });
      if (!button) throw new Error(`Button not found: ${label}`);
      button.click();
      await sleep(250);
      return labelOf(button);
    };
    const waitFor = async (predicate, message, attempts = 30) => {
      for (let i = 0; i < attempts; i += 1) {
        const value = predicate();
        if (value) return value;
        await sleep(100);
      }
      throw new Error(message);
    };
    const showPanel = async (showLabel, hideLabel, expectedText) => {
      if (findButton(showLabel)) await clickButton(showLabel);
      else if (!findButton(hideLabel)) throw new Error(`Panel toggle not found: ${showLabel}`);
      assertText(expectedText);
    };
    const assertText = (text) => {
      if (!document.body.innerText.toLowerCase().includes(text.toLowerCase())) {
        throw new Error(`Expected visible text not found: ${text}`);
      }
    };
    const assertCleanLayout = (scope = document.body, label = 'page') => {
      const rect = scope.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) throw new Error(`${label} has empty layout bounds.`);
      const overflowX = Math.ceil(document.documentElement.scrollWidth - window.innerWidth);
      if (overflowX > 4) throw new Error(`${label} has ${overflowX}px horizontal overflow.`);
      const badTextControls = Array.from(scope.querySelectorAll('button, input, select, textarea'))
        .filter((el) => {
          const box = el.getBoundingClientRect();
          if (box.width <= 0 || box.height <= 0) return false;
          return Math.ceil(el.scrollWidth - el.clientWidth) > 8 || Math.ceil(el.scrollHeight - el.clientHeight) > 8;
        })
        .map(labelOf)
        .filter(Boolean)
        .slice(0, 5);
      if (badTextControls.length) {
        throw new Error(`${label} has clipped controls: ${badTextControls.join(', ')}`);
      }
    };
    const openWorkspacePanel = async (id, label) => {
      const toolsButton = document.querySelector('.top-bar-panels-btn') || findButton('Tools');
      if (!toolsButton) throw new Error('Panel tools button not found.');
      toolsButton.click();
      const menuItem = await waitFor(
        () => document.querySelector(`[data-panel-menu-id="${id}"]`)
          || Array.from(document.querySelectorAll('.panel-menu .panel-menu-item'))
            .find((item) => labelOf(item).toLowerCase().includes(label.toLowerCase())),
        `Panel menu item not found: ${label}`,
      );
      menuItem.click();
      const frame = await waitFor(
        () => document.querySelector(`[data-panel-id="${id}"], .panel-frame--${id}`),
        `Panel did not open: ${label}`,
      );
      await waitFor(
        () => !frame.innerText.includes('Loading panel...') && frame.innerText.trim().length > label.length,
        `Panel content did not load: ${label}`,
      );
      assertCleanLayout(frame, `panel ${label}`);
      const close = frame.querySelector('.panel-close');
      if (!close) throw new Error(`Panel close button missing: ${label}`);
      close.click();
      await waitFor(
        () => !document.querySelector(`[data-panel-id="${id}"], .panel-frame--${id}`),
        `Panel did not close: ${label}`,
      );
      assertCleanLayout(document.body, `after closing ${label}`);
    };

    assertText('OpenHarness');
    assertCleanLayout(document.body, 'initial shell');

    const workspacePanels = [
      ['diffs', 'Diffs'],
      ['browser', 'Browser'],
      ['files', 'Files'],
      ['model-lab', 'Model Lab'],
      ['safety', 'Safety'],
      ['patches', 'Patches'],
    ];
    for (const [id, label] of workspacePanels) {
      await openWorkspacePanel(id, label);
    }

    await showPanel('Show bottom bar', 'Hide bottom bar', 'Terminal');
    await clickButton('Tools');
    assertCleanLayout(document.body, 'tool panels');

    await clickButton('Open settings', { exact: false });
    for (let i = 0; i < 20 && !document.querySelector('.settings-modal'); i += 1) await sleep(100);
    const modal = document.querySelector('.settings-modal');
    if (!modal) throw new Error('Settings modal did not open.');
    assertCleanLayout(modal, 'settings modal');

    const sections = [
      'Active Model',
      'Model Library',
      'Providers',
      'Agent Roles',
      'Assistant',
      'MCP Servers',
      'Personality',
      'Onboarding',
      'Theme',
      'Routing Learning',
      'Auto-Router',
      'Chat Settings',
      'About',
    ];

    for (const section of sections) {
      await clickButton(section, { exact: true });
      const content = document.querySelector('.settings-content');
      if (!content || content.innerText.trim().length < 10) {
        throw new Error(`Settings section rendered empty: ${section}`);
      }
      assertCleanLayout(modal, `settings section ${section}`);
    }

    const closeButton = document.querySelector('.settings-modal-close');
    if (!closeButton) throw new Error('Settings close button not found.');
    closeButton.click();
    for (let i = 0; i < 20 && document.querySelector('.settings-modal'); i += 1) await sleep(100);
    if (document.querySelector('.settings-modal')) throw new Error('Settings modal did not close.');
    assertCleanLayout(document.body, 'final shell');
    return true;
  });

  const consoleResult = await callDockerTool('browser_console_messages', { level: 'error', all: false });
  const consoleText = toolText(consoleResult);
  assert(/Errors:\s*0\b/i.test(consoleText), `Browser console errors found:\n${consoleText}`);

  const networkResult = await callDockerTool('browser_network_requests', { static: false });
  const networkText = toolText(networkResult);
  assertNoUnresolvedNetworkFailures(networkText);

  console.log('UI click smoke passed.');
}

main().catch((err) => {
  console.error(`UI click smoke failed: ${err.message}`);
  process.exit(1);
});
