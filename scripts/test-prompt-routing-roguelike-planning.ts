import { strict as assert } from 'node:assert';
import { runOrchestratorPipeline } from '../server/orchestrator';
import { routeRequest } from '../server/router';
import type { StoredConfig } from '../server/config';

const ROGUELIKE_PROMPT = [
  'Spawn a Planning Room team of sub agents and produce a full-scale plan for a new roguelike game',
  'based on 1980s icons, events, and era-specific items unique to the decade.',
  'The plan must cover creative pillars, procedural systems, enemy/item/event taxonomy, progression,',
  'risk controls for cultural references, production phases, and validation criteria.',
].join(' ');

const config: StoredConfig = {
  version: 1,
  providers: [
    {
      id: 'mock',
      name: 'Mock Planning Provider',
      type: 'openai-compatible',
      apiKey: 'test-key',
      baseURL: 'https://mock.provider/v1',
      models: [
        { id: 'arcade-planner', name: 'Arcade Planner', enabled: true },
        { id: 'culture-planner', name: 'Culture Planner', enabled: true },
        { id: 'systems-reviewer', name: 'Systems Reviewer', enabled: true },
      ],
    },
  ],
  mcpServers: [],
  personality: '',
  activeModel: 'Auto',
  activeTheme: 'midnight',
  roleAssignments: {
    planner: 'mock:arcade-planner',
    reasoner: 'mock:culture-planner',
    reviewer: 'mock:systems-reviewer',
    summarizer: 'mock:systems-reviewer',
  },
  trustMode: 'workspace-write',
  autoRouter: {
    enabled: true,
    classifierModel: 'mock:systems-reviewer',
    threshold: 0.8,
    defaultModel: 'mock:arcade-planner',
    cacheTTLMs: 0,
    candidates: [
      {
        modelId: 'mock:arcade-planner',
        cost: 0.2,
        supportsImages: false,
        card: 'Strong at arcade-era theme, player fantasy, core loops, and production plans.',
      },
      {
        modelId: 'mock:culture-planner',
        cost: 0.3,
        supportsImages: false,
        card: 'Strong at cultural references, 1980s events, items, tone risk, and era authenticity.',
      },
      {
        modelId: 'mock:systems-reviewer',
        cost: 0.4,
        supportsImages: false,
        card: 'Strong at roguelike systems, procedural taxonomy, validation rubrics, and critique.',
      },
    ],
  },
};

const originalFetch = globalThis.fetch;
const calls: Array<{ model: string; prompt: string }> = [];

function responseFor(model: string, prompt: string): string {
  if (prompt.includes('Planning Room: Final Synthesis')) {
    return [
      '## Final recommendation',
      'Build **Neon Decade Descent**, a turn-based roguelike where each floor is a warped 1980s memory arcade.',
      '',
      '## Success criteria',
      '- The plan names distinct Planning Room participant ideas and resolves disagreements.',
      '- The core loop supports procedural rooms, enemies, items, events, meta progression, and validation.',
      '- 1980s references are evocative rather than dependent on protected likenesses.',
      '',
      '## Ordered implementation plan',
      '1. Prototype grid movement, fog of war, energy economy, and run-ending permadeath.',
      '2. Add themed districts: arcade mall, mixtape subway, cold-war broadcast tower, aerobics studio, and video-rental labyrinth.',
      '3. Seed items such as mixtape charms, plastic sunglasses, arcade tokens, portable cassette players, floppy disks, and neon keycards.',
      '4. Add era events including market-panic terminals, space-shuttle newsrooms, Berlin-wall checkpoint rooms, and cable-TV signal storms.',
      '5. Build enemy families from era icons: cabinet ghosts, mall sentries, breakdance duelists, synth phantoms, and corporate mascot mimics.',
      '6. Validate balance with deterministic seeds, item-pool snapshots, floor-completion telemetry, and dead-end generation checks.',
      '',
      '## Risks, tradeoffs, and assumptions',
      '- Avoid direct celebrity or brand dependency; use archetypes and public-era events with fictionalized names.',
      '- The roguelike should feel historically specific without becoming trivia homework.',
      '',
      '## Validation checklist',
      '- Each floor has at least one viable path, one meaningful choice, and one era-specific interaction.',
      '- Item, enemy, and event pools include no fake file or implementation claims.',
      '- A human tester can evaluate theme, route clarity, progression, and replayability from this artifact.',
      '',
      '## What the Planning Room changed or improved',
      'The arcade planner supplied the core fantasy, the culture planner added era authenticity and safety bounds, and the systems reviewer turned it into a testable roguelike production plan.',
    ].join('\n');
  }

  if (prompt.includes('Planning Room: Peer Review')) {
    return [
      `Peer review from ${model}: keep the mall/arcade fantasy, but add explicit procedural validation and avoid named-brand dependency.`,
      'Strongest idea: combine 1980s items with roguelike verbs instead of treating references as cosmetic skins.',
      'Missing step: define item/event/enemy taxonomies before production art.',
    ].join('\n');
  }

  return [
    `Independent plan from ${model}.`,
    'Recommendation: make the game a tactical roguelike about escaping a neon 1980s time loop.',
    'Success criteria: clear 1980s identity, procedural replayability, safe fictionalized references, and measurable balance.',
    'Step-by-step plan: define pillars, build grid prototype, add era districts, create item/event/enemy pools, then validate seeds.',
    'Risks and unknowns: brand/cultural overreach, theme overload, and unbalanced item synergies.',
    'Validation proof: seeded generation tests, taxonomy coverage checks, and human playtest rubrics.',
  ].join('\n');
}

try {
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    const prompt = body.messages?.find((message: any) => message.role === 'user')?.content || '';
    calls.push({ model: body.model, prompt });

    return new Response(JSON.stringify({
      choices: [{ message: { content: responseFor(body.model, prompt) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  const route = routeRequest(ROGUELIKE_PROMPT, 'Auto', config.roleAssignments);
  assert.equal(route.mode, 'plan', '1980s roguelike team prompt should route to Planning Room');
  assert.equal(route.role, 'planner', '1980s roguelike team prompt should use planner role');

  const result = await runOrchestratorPipeline(
    route,
    ROGUELIKE_PROMPT,
    config,
    '/Users/kevink/Projects/OpenHarness',
  );

  const independentCalls = calls.filter((call) => call.prompt.includes('Planning Room: Independent Plan'));
  const peerCalls = calls.filter((call) => call.prompt.includes('Planning Room: Peer Review'));
  const synthesisCalls = calls.filter((call) => call.prompt.includes('Planning Room: Final Synthesis'));

  assert.equal(independentCalls.length, 3, 'Planning Room should spawn three independent planner agents');
  assert.equal(peerCalls.length, 3, 'Planning Room should run peer cross-checks for each usable participant');
  assert.equal(synthesisCalls.length, 1, 'Planning Room should run one final synthesis pass');
  assert.deepEqual(
    [...new Set(independentCalls.map((call) => call.model))].sort(),
    ['arcade-planner', 'culture-planner', 'systems-reviewer'],
    'independent plans should use three distinct configured participant models',
  );

  assert.equal(result.ok, true, 'all mocked Planning Room phases should complete');
  assert.equal(result.phases.length, 7, 'three plans, three cross-checks, and one synthesis should be recorded');
  assert.equal(result.artifacts?.length, 1, 'Planning Room should produce one reusable team-plan artifact');
  const teamPlan = result.artifacts?.[0];
  assert.equal(teamPlan?.type, 'team_plan', 'Planning Room artifact should use the team_plan type');
  assert.match(teamPlan?.id || '', /^team-plan-/, 'Planning Room artifact should have a stable team-plan id prefix');
  assert.equal(teamPlan?.data.participants.length, 3, 'team-plan artifact should preserve participant metadata');
  assert.match(teamPlan?.data.recommendation || '', /Neon Decade Descent/, 'team-plan artifact should expose the final recommendation');
  assert.ok(teamPlan?.data.successCriteria.some((item) => /participant ideas/i.test(item)), 'team-plan artifact should expose success criteria');
  assert.ok(teamPlan?.data.executionPhases.some((item) => /grid movement/i.test(item)), 'team-plan artifact should expose execution phases');
  assert.ok(teamPlan?.data.risks.some((item) => /celebrity|brand/i.test(item)), 'team-plan artifact should expose risks');
  assert.ok(teamPlan?.data.validation.some((item) => /floor/i.test(item)), 'team-plan artifact should expose validation checklist');
  assert.ok(teamPlan?.data.participantDeltas.some((item) => /arcade planner/i.test(item)), 'team-plan artifact should expose participant deltas');
  assert.ok(teamPlan?.data.finalDecisionLog.some((item) => /Synthesis model/i.test(item)), 'team-plan artifact should expose a decision log');
  assert.match(teamPlan?.data.rawMarkdown || '', /Validation checklist/, 'team-plan artifact should keep raw markdown for rendering');
  assert.match(result.finalText, /Planning Room/, 'final artifact should be labeled as Planning Room output');
  assert.match(result.finalText, /Neon Decade Descent/, 'final artifact should include the synthesized game concept');
  assert.match(result.finalText, /arcade mall|mixtape subway|video-rental labyrinth/i, 'final artifact should include 1980s locations');
  assert.match(result.finalText, /mixtape charms|arcade tokens|floppy disks/i, 'final artifact should include era-specific items');
  assert.match(result.finalText, /Berlin-wall checkpoint|space-shuttle newsrooms|market-panic terminals/i, 'final artifact should include 1980s events');
  assert.match(result.finalText, /Validation checklist/, 'final artifact should include validation criteria');
  assert.doesNotMatch(result.finalText, /\bI need to\b|\bLet me\b|\bThe user wants\b/i, 'final artifact should not leak monologue preamble');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('1980s roguelike Planning Room orchestration test passed.');
