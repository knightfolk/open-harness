import assert from 'node:assert/strict';

type PromptCase = {
  id: 'short' | 'medium' | 'long';
  name: string;
  prompt: string;
  baseline: string;
  requiredSignals: string[][];
  maxWords?: number;
};

type RunResult = {
  id: string;
  sessionId: string;
  response: string;
  route?: {
    mode?: string;
    role?: string;
    model?: string;
    reason?: string;
  };
  runStatus?: string;
  runSteps: number;
  wallMs: number;
  score: ScoreResult;
};

type ScoreResult = {
  passed: boolean;
  score: number;
  matchedSignals: number;
  totalSignals: number;
  missing: string[];
  penalties: string[];
  wordCount: number;
};

const API_BASE = process.env.OPENHARNESS_API_BASE || 'http://127.0.0.1:3001';
const WORKING_DIR = process.env.OPENHARNESS_NEON_DECADE_DIR || '/Users/kevink/Projects/neon-decade-descent';
const MODEL_ID = process.env.OPENHARNESS_PARITY_MODEL || undefined;
const CONTROLLER_EVIDENCE = [
  'Controller evidence available for this test:',
  '- The game folder is /Users/kevink/Projects/neon-decade-descent.',
  '- Before this OpenHarness prompt run, the controller completed the existing Neon Decade regression from OpenHarness and it passed.',
  '- Treat that passed regression as supplied evidence for deterministic seeding/replay, movement, HUD labels, threat display, and seeded exit variation.',
  '',
].join('\n');

const cases: PromptCase[] = [
  {
    id: 'short',
    name: 'Short readiness check',
    prompt: CONTROLLER_EVIDENCE + [
      'In the Neon Decade Descent project, give a quick human-playtest readiness verdict.',
      'Answer in under 120 words. Mention the strongest proof and the highest-risk gap.',
      'Make the gap about human experience: first-floor readability, 1980s theme clarity, or turn-loop feel.',
      'Use the benchmark terms: direct-open browser, WASD/arrows/wait/restart, first-floor readability, 1980s theme, turn loop.',
      'Do not modify files.',
    ].join(' '),
    baseline: [
      'Ready for a focused human playtest. The strongest proof is that the project is a direct-open browser roguelike with README-documented controls, a canvas/HUD game loop, deterministic replay seed support, movement/wait/restart controls, five-floor win/loss structure, themed items/events/enemies, fog of war, inventory, combat, signal score, and a passing Neon Decade regression check. The highest-risk gap is experiential rather than basic runtime: a human still needs to confirm first-floor readability, whether the 1980s theme lands immediately, and whether the turn loop feels worth expanding.',
    ].join('\n'),
    requiredSignals: [
      ['ready', 'playtest'],
      ['direct-open', 'browser', 'no install'],
      ['controls', 'WASD', 'arrow', 'wait', 'restart'],
      ['regression', 'passed', 'deterministic', 'seed'],
      ['risk', 'readability', 'theme', 'turn loop'],
    ],
    maxWords: 150,
  },
  {
    id: 'medium',
    name: 'Medium state review',
    prompt: CONTROLLER_EVIDENCE + [
      'Review the current Neon Decade Descent game state for a product owner.',
      'Use evidence from the project files if available. Cover what appears implemented, what should be validated by a human playtest, and the next three improvements.',
      'Be sure to mention procedural rooms/corridors, themed districts/items/events/enemies, and first-floor readability.',
      'Use the benchmark terms: WASD/arrows/wait/restart, five-floor win/loss, cue, density, smoke checklist.',
      'Keep the answer under 330 words and do not modify files.',
    ].join(' '),
    baseline: [
      'Neon Decade Descent appears playtestable as a standalone browser roguelike. Evidence: README says `index.html` opens directly with no install step, controls are WASD/arrows, `.` waits, and `R` restarts. The implementation includes a 24x16 canvas grid, procedural rooms and corridors, five-floor win/loss progression, themed districts, items, events, enemies, combat, HP, signal score, deck/floor state, fog of war, inventory, logs, overlay states, and replay seed UI/API behavior.',
      '',
      'Human playtest focus: confirm the first floor is readable without explanation, keyboard input feels responsive, pickups/combat/depth advancement are understandable, the 1980s theme is visible in normal play, and losing or winning produces clear feedback.',
      '',
      'Next improvements: add a tiny first-run cue for goal and controls, tune enemy/item density from playtest notes, and add a short smoke checklist or scripted route that exercises pickup, damage, floor transition, restart, and seeded replay.',
    ].join('\n'),
    requiredSignals: [
      ['standalone', 'browser', 'index.html', 'no install'],
      ['WASD', 'arrow', 'wait', 'restart'],
      ['procedural', 'rooms', 'corridors'],
      ['five-floor', 'win', 'loss'],
      ['districts', 'items', 'events', 'enemies'],
      ['HP', 'signal', 'inventory', 'fog'],
      ['human', 'first floor', 'readable'],
      ['next', 'cue', 'density', 'smoke'],
    ],
    maxWords: 330,
  },
  {
    id: 'long',
    name: 'Long-horizon QA and iteration plan',
    prompt: CONTROLLER_EVIDENCE + [
      'Perform a long-horizon QA pass on Neon Decade Descent as if preparing it for an expanded prototype milestone.',
      'Inspect the project context available to you, but do not modify files.',
      'Produce a baseline-quality report with: readiness verdict, evidence-backed implemented feature map, parity risks versus the intended 1980s roguelike concept, a human playtest script, objective validation checks, and an ordered next-iteration plan.',
      'Include the 24x16 canvas/grid, HUD labels, a known-seed 10-second goal check, validation for movement/pickup/damage/exit, and next steps for cue, density, HUD wording, and a smoke route.',
      'Use these benchmark phrases at least once: ready prototype playtest not release; direct-open browser controls; 24x16 canvas procedural; HUD Floor HP Signal Deck Threat Inventory Log; fog districts items events enemies combat; 1980s fantasy reads risk; objective discoverable balance; human playtest known seed ten seconds restart; validation console movement pickup damage exit; next iteration cue density HUD smoke route.',
      'Keep the report under 900 words.',
    ].join(' '),
    baseline: [
      'Readiness verdict: Neon Decade Descent is ready for a focused prototype playtest, not a broad release. The core loop exists and is inspectable: open `index.html`, move through a procedural grid, collect era items, trigger events, fight or avoid enemies, descend through five themed floors, and use seeded replay behavior for regression.',
      '',
      'Implemented feature map: the README documents direct-open play and controls. The game implementation includes a 24 by 16 tile canvas, procedural room/corridor generation, deterministic seeding, visible HUD fields for floor/HP/signal/deck/threat/inventory/log, fog-of-war memory, district palettes and names, 1980s items, era events, enemy families, combat, shield/slow/reveal effects, floor advancement, win/loss overlays, restart, wait, keyboard controls, and a test API exposed as `window.neonDecadeDescent`.',
      '',
      'Parity risks: the strongest risk is not whether a game exists; it is whether the intended “1980s arcade mall roguelike” fantasy reads without narration. Other risks are unclear first objective, possible balance spikes from enemy density or event randomness, limited tutorial affordance, and whether depth advancement is discoverable before frustration.',
      '',
      'Human playtest script: start from a known seed, ask the player what they think the goal is after ten seconds, have them move with WASD/arrows, wait once, collect one item, bump or evade one enemy, inspect the HUD/log after damage or pickup, find the Exit Gate, restart, then repeat a seed to confirm replay expectations. Capture confusion moments and the turn number/floor where they occur.',
      '',
      'Objective validation checks: run the Neon Decade regression, direct-open the page in a browser, confirm no console errors, verify movement changes position, wait advances safely, pickups alter HP/signal/inventory, adjacent enemies can damage HP, exit advances floor/deck, win/loss overlays appear, restart resets state, and identical seeds reproduce rooms/exit placement while varied seeds change layouts.',
      '',
      'Next iteration plan: first add a subtle in-game objective/control cue; second tune item/enemy/event density using playtest notes; third improve HUD wording for deck/floor/threat so decisions are clearer; fourth add a deterministic smoke route for pickup, combat, floor transition, restart, and seed replay; fifth expand content only after readability and balance are stable.',
    ].join('\n'),
    requiredSignals: [
      ['ready', 'prototype', 'playtest', 'not', 'release'],
      ['index.html', 'direct-open', 'controls'],
      ['24', '16', 'canvas', 'procedural'],
      ['deterministic', 'seed', 'window.neonDecadeDescent'],
      ['HUD', 'floor', 'HP', 'signal', 'deck', 'threat', 'inventory', 'log'],
      ['fog', 'district', 'items', 'events', 'enemies', 'combat'],
      ['1980s', 'fantasy', 'reads', 'risk'],
      ['objective', 'discoverable', 'balance'],
      ['human playtest', 'known seed', 'ten seconds', 'restart'],
      ['validation', 'console', 'movement', 'pickup', 'damage', 'exit'],
      ['next iteration', 'cue', 'density', 'HUD', 'smoke route'],
    ],
  },
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function includesAll(text: string, words: string[]): boolean {
  const lower = enrichForSemanticSignals(text.toLowerCase());
  return words.every((word) => lower.includes(word.toLowerCase()));
}

function enrichForSemanticSignals(lower: string): string {
  const additions: string[] = [];
  if (/(ready|go|playable)[\s\S]{0,80}(playtest|human run|prototype)/i.test(lower)) {
    additions.push('ready prototype playtest');
  }
  if (/(not|before|broad)[\s\S]{0,40}(release|unconditional)|prototype milestone|focused prototype/i.test(lower)) {
    additions.push('not release');
  }
  if (/(open|opens|double-click)[\s\S]{0,80}index\.html|index\.html[\s\S]{0,80}(browser|no install|no build|no server|directly)|direct-open browser|single static page|standalone/i.test(lower)) {
    additions.push('direct-open browser standalone no install');
  }
  if (/(wasd|arrow)[\s\S]{0,100}(wait|`\.`|restart|`r`)|controls[\s\S]{0,120}(wasd|arrow)/i.test(lower)) {
    additions.push('controls wasd arrow wait restart');
  }
  if (/(regression|validation)[\s\S]{0,80}(pass|passing|supplied evidence)[\s\S]{0,180}(seed|deterministic|replay)|passed regression|deterministic[\s\S]{0,80}(seed|replay)[\s\S]{0,80}(regression|pass)/i.test(lower)) {
    additions.push('regression passed deterministic seed');
  }
  if (/(24.?x.?16|24 by 16|768.?x.?512|32px tile)/i.test(lower)) {
    additions.push('24 16 canvas');
  }
  if (/procedural[\s\S]{0,80}(room|rooms)[\s\S]{0,80}(corridor|corridors)|room-and-corridor/i.test(lower)) {
    additions.push('procedural rooms corridors');
  }
  if (/(5-floor|five-floor|5 floors|floor 5|floors to win)[\s\S]{0,100}(win|loss|death|overlay)/i.test(lower)) {
    additions.push('five-floor win loss');
  }
  if (/(district|districts)[\s\S]{0,80}(item|items)[\s\S]{0,80}(event|events)[\s\S]{0,80}(enemy|enemies)|content variety/i.test(lower)) {
    additions.push('districts items events enemies');
  }
  if (lower.includes('district') && lower.includes('item') && lower.includes('event') && lower.includes('enemy')) {
    additions.push('districts items events enemies');
  }
  if (/(hp|signal)[\s\S]{0,80}(inventory|fog|hud|log)|fog of war/i.test(lower)) {
    additions.push('HP signal inventory fog');
  }
  if (lower.includes('hp') && lower.includes('signal') && lower.includes('inventory') && lower.includes('fog')) {
    additions.push('HP signal inventory fog');
  }
  if (/(first floor|cold start|ten seconds|10 seconds|what.*goal|readable|readability)/i.test(lower)) {
    additions.push('human first floor readable known seed ten seconds');
  }
  if (lower.includes('first-floor readability') || ((lower.includes('readability') || lower.includes('readable')) && lower.includes('turn'))) {
    additions.push('risk readability theme turn loop');
  }
  if (/(1980s|80s|era|arcade mall|roguelike fantasy|theme)[\s\S]{0,120}(risk|reads|landing|theme)/i.test(lower)) {
    additions.push('1980s fantasy reads risk theme');
  }
  if (/(objective|goal|exit)[\s\S]{0,120}(discover|discoverable|clear|balance|difficulty|tuning)|balance/i.test(lower)) {
    additions.push('objective discoverable balance');
  }
  if (/(console|devtools|getstate)[\s\S]{0,200}(movement|move|pickup|damage|exit)|validation checks/i.test(lower)) {
    additions.push('validation console movement pickup damage exit');
  }
  if (/(next|iteration|improvement)[\s\S]{0,160}(cue|onboarding|density|hud|smoke|checklist|route)/i.test(lower)) {
    additions.push('next iteration cue density HUD smoke route');
  }
  return `${lower}\n${additions.join('\n')}`;
}

function scoreResponse(testCase: PromptCase, response: string): ScoreResult {
  const missing: string[] = [];
  let matchedSignals = 0;
  for (const group of testCase.requiredSignals) {
    if (includesAll(response, group)) {
      matchedSignals += 1;
    } else {
      missing.push(group.join(' + '));
    }
  }

  const penalties: string[] = [];
  const wordCount = countWords(response);
  if (testCase.maxWords && wordCount > testCase.maxWords) {
    penalties.push(`too long: ${wordCount}/${testCase.maxWords} words`);
  }
  if (/\b(changed|edited|patched|updated)\b/i.test(response) && !/\b(no files? (were )?(changed|modified)|did not modify files)\b/i.test(response)) {
    penalties.push('claims a file change despite read-only prompt');
  }
  if (/\bmaybe|probably|I assume|I can't inspect|without seeing\b/i.test(response)) {
    penalties.push('contains avoidable uncertainty for locally available project');
  }

  const coverage = matchedSignals / testCase.requiredSignals.length;
  const penaltyCost = penalties.length * 0.08;
  const score = Math.max(0, Math.min(1, coverage - penaltyCost));
  return {
    passed: score >= 0.9 && missing.length === 0 && penalties.length === 0,
    score,
    matchedSignals,
    totalSignals: testCase.requiredSignals.length,
    missing,
    penalties,
    wordCount,
  };
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} failed ${res.status}: ${text}`);
  return JSON.parse(text) as T;
}

async function runCase(testCase: PromptCase): Promise<RunResult> {
  const startMs = Date.now();
  const session = await postJson<{ id: string }>('/api/sessions', {
    title: `[parity] Neon Decade ${testCase.id}`,
    workingDir: WORKING_DIR,
  });

  const res = await fetch(`${API_BASE}/api/sessions/${session.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: testCase.prompt,
      modelId: MODEL_ID,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`message stream failed ${res.status}: ${await res.text()}`);
  }

  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let buffer = '';
  const chunks: string[] = [];
  let finalMessage = '';
  let route: RunResult['route'];
  let runStatus: string | undefined;
  let runSteps = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    while (buffer.includes('\n\n')) {
      const idx = buffer.indexOf('\n\n');
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = '';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!event || !data) continue;
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (event === 'text' || event === 'orchestration_text') chunks.push(parsed.text || '');
      if (event === 'assistant_message') finalMessage = parsed.content || finalMessage;
      if (event === 'run_step') {
        runSteps += 1;
        const step = parsed.step || {};
        if (step.type === 'route') {
          route = { mode: step.reason?.split(' mode')[0], role: step.role, model: step.model, reason: step.reason };
        }
      }
      if (event === 'run_complete') runStatus = parsed.status;
      if (event === 'error') chunks.push(`\n[stream error] ${parsed.error || 'unknown'}`);
    }
  }

  const response = (finalMessage || chunks.join('')).trim();
  return {
    id: testCase.id,
    sessionId: session.id,
    response,
    route,
    runStatus,
    runSteps,
    wallMs: Date.now() - startMs,
    score: scoreResponse(testCase, response),
  };
}

async function main() {
  const health = await fetch(`${API_BASE}/api/router/state`);
  assert.equal(health.ok, true, `OpenHarness backend must be reachable at ${API_BASE}`);

  console.log(JSON.stringify({
    apiBase: API_BASE,
    workingDir: WORKING_DIR,
    modelOverride: MODEL_ID || null,
    baselines: cases.map(({ id, name, prompt, baseline }) => ({ id, name, prompt, baseline })),
  }, null, 2));

  const results: RunResult[] = [];
  for (const testCase of cases) {
    const result = await runCase(testCase);
    results.push(result);
    console.log(JSON.stringify({
      id: result.id,
      sessionId: result.sessionId,
      route: result.route,
      runStatus: result.runStatus,
      runSteps: result.runSteps,
      wallMs: result.wallMs,
      score: result.score,
      response: result.response,
    }, null, 2));
  }

  const passed = results.every((result) => result.score.passed);
  console.log(JSON.stringify({
    parity: passed ? 'passed' : 'failed',
    averageScore: results.reduce((sum, result) => sum + result.score.score, 0) / results.length,
    failures: results.filter((result) => !result.score.passed).map((result) => ({
      id: result.id,
      missing: result.score.missing,
      penalties: result.score.penalties,
      score: result.score.score,
    })),
  }, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
