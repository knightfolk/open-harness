#!/usr/bin/env tsx

import { readFileSync } from 'node:fs';

type CheckResult = { name: string; pass: boolean; details?: string };

function assert(condition: boolean, name: string): void {
  if (!condition) {
    throw new Error(`WebBridge regression contract failed: ${name}`);
  }
}

function runChecks(): CheckResult[] {
  const bridgeSource = readFileSync('OpenHarnessApp/Sources/OpenHarnessApp/Bridge/WebBridge.swift', 'utf8');
  const contentSource = readFileSync('OpenHarnessApp/Sources/OpenHarnessApp/Views/ContentView.swift', 'utf8');

  const checks: CheckResult[] = [];

  const add = (name: string, condition: boolean, details?: string) => {
    checks.push({ name, pass: condition, details });
    if (!condition) {
      assert(false, name + (details ? ` (${details})` : ''));
    }
  };

  add(
    'trusted action list includes createSession/listDirectory/readFile',
    /"createSession"/.test(bridgeSource) &&
      /"listDirectory"/.test(bridgeSource) &&
      /"readFile"/.test(bridgeSource),
  );

  const sectionContains = (source: string, pattern: RegExp, name: string, details?: string) => {
    const pass = pattern.test(source);
    checks.push({ name, pass, details });
    if (!pass) {
      assert(false, name + (details ? ` (${details})` : ''));
    }
  };

  add(
    'bridge origin handler is main-frame only',
    /message\.frameInfo\.isMainFrame/.test(bridgeSource),
  );

  add(
    'runtime probe is opt-in by environment variable or launch argument',
    /enum WebBridgeRuntimeProbe[\s\S]*OPENHARNESS_WEBBRIDGE_RUNTIME_PROBE[\s\S]*--webbridge-runtime-probe/.test(bridgeSource) &&
      /guard WebBridgeRuntimeProbe\.isEnabled else \{ return \}/.test(bridgeSource) &&
      /guard WebBridgeRuntimeProbe\.isEnabled else \{ return \}/.test(contentSource),
  );

  sectionContains(
    bridgeSource,
    /guard[\s\S]*message\.name == "nativeBridge"[\s\S]*message\.frameInfo\.isMainFrame[\s\S]*WebBridge\.isTrustedBridgeOrigin\(messageURL\)/,
    'bridge handler gates on nativeBridge, main-frame, and trusted URL',
  );

  add(
    'trusted localhost origin allows localhost + optional 5173',
    /if scheme == "http" \|\| scheme == "https"[\s\S]*host == "localhost" \|\| host == "127\.0\.0\.1"/.test(bridgeSource) &&
      /\(url\.port == 5173 \|\| url\.port == nil\)/.test(bridgeSource),
  );

  add(
    'file:// origins are constrained to app bundle resources',
    /if scheme == "file"[\s\S]*normalizedPath\.hasPrefix\(bundlePath \+ "\/"\)[\s\S]*\/openharnessapp_openharnessapp\.bundle\/resources\/dist/.test(
      bridgeSource,
    ) &&
      /normalizedPath\.contains\("\/resources\/dist"\)/.test(bridgeSource),
  );

  sectionContains(
    bridgeSource,
    /case "createSession":[\s\S]*registerWorkspaceRoot\(normalizedDir\)/,
    'createSession normalizes/validates requested workingDir and registers trusted workspace',
  );

  sectionContains(
    bridgeSource,
    /case "listDirectory":[\s\S]*ensurePathUnderAllowedWorkspace/,
    'listDirectory is guarded by ensurePathUnderAllowedWorkspace',
  );

  sectionContains(
    bridgeSource,
    /case "readFile":[\s\S]*ensurePathUnderAllowedWorkspace/,
    'readFile is guarded by ensurePathUnderAllowedWorkspace',
  );

  sectionContains(
    bridgeSource,
    /resolveSessionWorkspacePath\(from: payload\)/,
    'listDirectory/readFile resolve workspace from payload/session',
  );

  sectionContains(
    bridgeSource,
    /ensurePathUnderAllowedWorkspace\(path\)/,
    'path gate check short-circuits disallowed locations',
  );

  sectionContains(
    contentSource,
    /navigationAction\.targetFrame == nil/,
    'navigation policy checks targetFrame before allowing trusted URL',
  );

  sectionContains(
    contentSource,
    /WebBridge\.isTrustedBridgeOrigin\(url\)[\s\S]*decisionHandler\(\.allow\)/,
    'new window policy allows only trusted navigation URLs',
  );

  sectionContains(
    contentSource,
    /NSWorkspace\.shared\.open\(url\)[\s\S]*decisionHandler\(\.cancel\)/,
    'untrusted target-frame navigation is redirected out-of-app and canceled',
  );

  sectionContains(
    contentSource,
    /!WebBridge\.isTrustedBridgeOrigin\(url\)[\s\S]*decisionHandler\(\.cancel\)/,
    'in-frame untrusted navigations are canceled',
  );

  return checks;
}

const results = runChecks();

for (const result of results) {
  const status = result.pass ? 'PASS' : 'FAIL';
  console.log(`${status}: ${result.name}`);
  if (result.details) console.log(`  - ${result.details}`);
}

console.log(`WebBridge runtime regression contract: PASS (${results.length} checks)`);
