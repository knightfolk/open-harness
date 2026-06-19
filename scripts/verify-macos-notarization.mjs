import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const appPaths = ['release/mac/OpenHarness.app', 'release/mac-arm64/OpenHarness.app'].filter((path) => existsSync(path));

function run(label, command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status !== 0) {
    throw new Error(`${label} failed\n${output}`);
  }
  console.log(`ok: ${label}`);
  if (output) {
    console.log(output.split('\n').slice(-3).join('\n'));
  }
}

if (appPaths.length === 0) {
  console.error('No macOS OpenHarness.app bundles found in release/mac or release/mac-arm64.');
  process.exit(1);
}

for (const appPath of appPaths) {
  console.log(`\nVerifying ${appPath}`);
  run('codesign deep verification', 'codesign', ['--verify', '--deep', '--strict', '--verbose=4', appPath]);
  run('stapled notarization ticket', 'xcrun', ['stapler', 'validate', appPath]);
  run('Gatekeeper assessment', 'spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]);
}
