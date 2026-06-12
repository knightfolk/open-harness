#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname, posix, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const args = process.argv.slice(2);
const targetArg = args.find((arg) => !arg.startsWith('--'));
const evalDir = targetArg ? resolve(targetArg) : join(root, 'test-fixtures', 'standalone-artifact-eval');
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full, rel) : [rel];
  });
}

const files = walk(evalDir);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const jsFiles = files.filter((file) => /\.m?js$/i.test(file));
const cssFiles = files.filter((file) => file.endsWith('.css'));
const readmeFiles = files.filter((file) => /readme\.md$/i.test(file));
const fileSet = new Set(files);

if (htmlFiles.length === 0) fail('Missing an HTML entry file.');
if (jsFiles.length === 0) fail('Missing a JavaScript game/app file.');
if (cssFiles.length === 0) fail('Missing a CSS styling file.');
if (readmeFiles.length === 0) fail('Missing README.md tester handoff.');

const allText = files
  .filter((file) => /\.(html|css|mjs|js|md|txt)$/i.test(file))
  .map((file) => readFileSync(join(evalDir, file), 'utf8'))
  .join('\n')
  .toLowerCase();
const htmlText = htmlFiles.map((file) => readFileSync(join(evalDir, file), 'utf8')).join('\n').toLowerCase();
const jsText = jsFiles.map((file) => readFileSync(join(evalDir, file), 'utf8')).join('\n').toLowerCase();
const cssText = cssFiles.map((file) => readFileSync(join(evalDir, file), 'utf8')).join('\n').toLowerCase();
const readmeText = readmeFiles.map((file) => readFileSync(join(evalDir, file), 'utf8')).join('\n').toLowerCase();

const checks = [
  [/1980|80s|eighties|arcade|mixtape|cassette|vhs|floppy|neon/, 'Uses an obvious 1980s theme.'],
  [/roguelike|dungeon|floor|level|room|grid|tile/, 'Includes roguelike structure.'],
  [/player|hero|avatar|@/, 'Represents the player.'],
  [/enemy|hazard|obstacle|ghost|sentry/, 'Includes enemies or hazards.'],
  [/item|collect|inventory|pickup|power/, 'Includes collectible items or powerups.'],
  [/score|hp|health|turn|depth|floor/, 'Tracks visible gameplay state.'],
  [/keydown|arrow|wasd|click|pointer|touch/, 'Implements player input.'],
  [/restart|reset|new run|play again/, 'Includes restart or replay behavior.'],
];

for (const [pattern, message] of checks) {
  if (!pattern.test(allText)) fail(message);
}

function localRefsFromHtml(html, attr) {
  const refs = [];
  const pattern = new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'gi');
  for (const match of html.matchAll(pattern)) {
    const ref = match[1];
    if (!ref || /^(?:(?:https?:)?\/\/|data:|blob:|#)/i.test(ref)) continue;
    refs.push(ref.replace(/^\.\//, ''));
  }
  return refs;
}

function blockedStandaloneRefsFromHtml(html) {
  const refs = [];
  const pattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const ref = match[1].trim();
    if (!ref || /^data:,$/i.test(ref)) continue;
    if (/^(?:(?:https?:)?\/\/|data:|blob:)/i.test(ref)) refs.push(ref);
  }
  return refs;
}

function htmlReferencesExistingAsset(ref) {
  return fileSet.has(ref) || files.some((file) => file.endsWith(`/${ref}`) || posix.basename(file) === posix.basename(ref));
}

const linkedJs = htmlFiles.flatMap((file) => {
  const html = readFileSync(join(evalDir, file), 'utf8');
  return localRefsFromHtml(html, 'src').filter((ref) => /\.m?js$/i.test(ref));
});
const linkedCss = htmlFiles.flatMap((file) => {
  const html = readFileSync(join(evalDir, file), 'utf8');
  return localRefsFromHtml(html, 'href').filter((ref) => /\.css$/i.test(ref));
});
const blockedStandaloneRefs = htmlFiles.flatMap((file) => {
  const html = readFileSync(join(evalDir, file), 'utf8');
  return blockedStandaloneRefsFromHtml(html);
});

if (blockedStandaloneRefs.length > 0) {
  fail(`HTML uses remote or embedded asset references: ${blockedStandaloneRefs.join(', ')}`);
}
if (linkedJs.length === 0) fail('HTML entry does not link a local JavaScript file.');
if (linkedCss.length === 0) fail('HTML entry does not link a local CSS file.');
for (const ref of [...linkedJs, ...linkedCss]) {
  if (!htmlReferencesExistingAsset(ref)) fail(`HTML references missing local asset: ${ref}`);
}

const jsStructuralChecks = [
  [/\b(addeventlistener|onkeydown|onkeyup|pointer|touch|click)\b/, 'JavaScript must wire real player input.'],
  [/\b(player|hero|avatar)\b[\s\S]{0,240}\b(x|y|row|col|position|hp|health)\b/, 'JavaScript must own player state.'],
  [/\b(enemies|enemy|hazards|hazard|obstacles|obstacle)\b/, 'JavaScript must own enemies or hazards.'],
  [/\b(items|item|collectibles|pickup|inventory|powerups|power)\b/, 'JavaScript must own collectible items or powerups.'],
  [/\b(render|draw|updateui|paint|canvas|getelementbyid|queryselector)\b/, 'JavaScript must render or update visible gameplay state.'],
  [/\b(restart|reset|newrun|initgame|startgame)\b/, 'JavaScript must implement restart/replay behavior.'],
];
for (const [pattern, message] of jsStructuralChecks) {
  if (!pattern.test(jsText)) fail(message);
}

if (!/\b(score|hp|health|turn|depth|floor)\b/.test(htmlText + jsText)) fail('HTML/JavaScript must expose visible gameplay state.');
if (!/\b(background|color|display|grid|canvas|font)\b/.test(cssText)) fail('CSS is too thin to prove a styled tester-ready UI.');
if (readmeText.length < 350) fail('README.md is too thin for tester handoff.');
if (!/\b(control|move|keyboard|arrow|wasd|restart)\b/.test(readmeText)) fail('README.md must include controls.');
if (!/\b(test|tester|verify|expected|goal|objective)\b/.test(readmeText)) fail('README.md must include tester instructions or goals.');

for (const file of jsFiles) {
  const check = spawnSync(process.execPath, ['--check', join(evalDir, file)], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (check.status !== 0) {
    fail(`JavaScript syntax failed for ${file}:\n${check.stderr || check.stdout}`);
  }
}

if (/todo|lorem ipsum|placeholder/.test(allText)) fail('Artifact contains TODO, placeholder, or lorem ipsum text.');
if (files.length < 4) fail(`Artifact is too thin: expected at least 4 files, found ${files.length}.`);

if (failures.length > 0) {
  console.error('Standalone artifact verification failed:');
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log('Standalone artifact verification passed.');
