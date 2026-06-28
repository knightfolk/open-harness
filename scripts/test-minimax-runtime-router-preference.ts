import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { configureAutoRouter, clearRouterCache, routeTask } from '../server/autoRouter';
import type { StoredConfig } from '../server/config';

function runtimeConfig(baseURL: string): StoredConfig {
  return {
    version: 1,
    providers: [
      {
        id: 'minimax',
        name: 'MiniMax',
        type: 'local',
        apiKey: '',
        baseURL,
        models: [
          { id: 'MiniMax-M3', name: 'MiniMax M3', enabled: true },
          { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', enabled: true },
        ],
      },
      {
        id: 'local',
        name: 'Local Test Provider',
        type: 'local',
        apiKey: '',
        baseURL,
        models: [{ id: 'phi-4', name: 'Phi 4', enabled: true }],
      },
    ],
    mcpServers: [],
    personality: '',
    activeModel: 'Auto',
    activeTheme: 'midnight',
    roleAssignments: {},
    trustMode: 'workspace-write',
    autoRouter: {
      enabled: true,
      classifierModel: 'local:phi-4',
      threshold: 0.7,
      defaultModel: 'minimax:MiniMax-M2.7',
      cacheTTLMs: 0,
      candidates: [
        {
          modelId: 'minimax:MiniMax-M2.7',
          cost: 0.01,
          supportsImages: true,
          supportsThinking: false,
          card: 'Older MiniMax candidate retained from stale stored config.',
        },
        {
          modelId: 'minimax:MiniMax-M3',
          cost: 0.5,
          supportsImages: true,
          supportsThinking: true,
          card: 'MiniMax M3, preferred MiniMax runtime candidate.',
        },
      ],
    },
  };
}

function signal(overrides: Partial<Parameters<typeof routeTask>[0]> = {}): Parameters<typeof routeTask>[0] {
  return {
    task: 'Create a medium coding plan with routing evidence.',
    surface: 'orchestrator',
    hasImages: false,
    turns: 3,
    toolCount: 6,
    estimatedInputTokens: 8_000,
    ...overrides,
  };
}

configureAutoRouter(runtimeConfig('http://127.0.0.1:9/v1'));
clearRouterCache();
const staleCostDecision = await routeTask(
  signal({ task: 'Use the cheapest deterministic MiniMax runtime route.' }),
  runtimeConfig('http://127.0.0.1:9/v1'),
  { forceCostStrategy: 'cheapest' },
);
assert.equal(
  staleCostDecision?.modelId,
  'minimax:MiniMax-M3',
  'Runtime cheapest policy should prefer MiniMax-M3 over same-provider MiniMax-M2.x when both are viable',
);
assert.match(
  staleCostDecision?.reason || '',
  /MiniMax M3 preference/i,
  'Runtime route reason should explain when M3 supersedes older MiniMax candidates',
);

const noM3Config = {
  ...runtimeConfig('http://127.0.0.1:9/v1'),
  autoRouter: {
    ...runtimeConfig('http://127.0.0.1:9/v1').autoRouter!,
    defaultModel: 'minimax:MiniMax-M2.7',
    candidates: [
      {
        modelId: 'minimax:MiniMax-M2.7',
        cost: 0.01,
        supportsImages: true,
        supportsThinking: false,
        card: 'Older MiniMax fallback when M3 is unavailable.',
      },
    ],
  },
};
configureAutoRouter(noM3Config);
clearRouterCache();
const noM3Decision = await routeTask(
  signal({ task: 'Use the only available MiniMax runtime route.' }),
  noM3Config,
  { forceCostStrategy: 'cheapest' },
);
assert.equal(
  noM3Decision?.modelId,
  'minimax:MiniMax-M2.7',
  'Older MiniMax should remain selectable when MiniMax-M3 is unavailable',
);

configureAutoRouter({
  ...runtimeConfig('http://127.0.0.1:9/v1'),
  autoRouter: {
    ...runtimeConfig('http://127.0.0.1:9/v1').autoRouter!,
    candidates: [
      {
        modelId: 'minimax:MiniMax-M2.7',
        cost: 0.01,
        supportsImages: true,
        supportsThinking: false,
        card: 'Older MiniMax image fallback.',
      },
      {
        modelId: 'minimax:MiniMax-M3',
        cost: 0.5,
        supportsImages: false,
        supportsThinking: true,
        card: 'M3 is present but filtered out for image input in this test.',
      },
    ],
  },
});
clearRouterCache();
const m3FilteredDecision = await routeTask(
  signal({ hasImages: true }),
  runtimeConfig('http://127.0.0.1:9/v1'),
  { forceCostStrategy: 'cheapest' },
);
assert.equal(
  m3FilteredDecision?.modelId,
  'minimax:MiniMax-M2.7',
  'Older MiniMax should remain usable when MiniMax-M3 is filtered out for the current request',
);

const nonMiniMaxConfig = {
  ...runtimeConfig('http://127.0.0.1:9/v1'),
  autoRouter: {
    ...runtimeConfig('http://127.0.0.1:9/v1').autoRouter!,
    defaultModel: 'local:phi-4',
    candidates: [
      {
        modelId: 'local:phi-4',
        cost: 0.001,
        supportsImages: false,
        supportsThinking: false,
        card: 'Cheapest non-MiniMax text candidate.',
      },
      ...runtimeConfig('http://127.0.0.1:9/v1').autoRouter!.candidates,
    ],
  },
};
configureAutoRouter(nonMiniMaxConfig);
clearRouterCache();
const nonMiniMaxDecision = await routeTask(
  signal({ task: 'Route a tiny text-only task without MiniMax-specific needs.' }),
  nonMiniMaxConfig,
  { forceCostStrategy: 'cheapest' },
);
assert.equal(
  nonMiniMaxDecision?.modelId,
  'local:phi-4',
  'MiniMax M3 preference should not promote M3 above a cheaper viable non-MiniMax candidate',
);

const scopedProviderConfig: StoredConfig = {
  ...runtimeConfig('http://127.0.0.1:9/v1'),
  providers: [
    {
      id: 'minimax',
      name: 'MiniMax',
      type: 'local',
      apiKey: '',
      baseURL: 'http://127.0.0.1:9/v1',
      models: [{ id: 'MiniMax-M3', name: 'MiniMax M3', enabled: true }],
    },
    {
      id: 'lab',
      name: 'Lab Provider',
      type: 'local',
      apiKey: '',
      baseURL: 'http://127.0.0.1:9/v1',
      models: [{ id: 'MiniMax-M2.7', name: 'MiniMax M2.7', enabled: true }],
    },
  ],
  autoRouter: {
    ...runtimeConfig('http://127.0.0.1:9/v1').autoRouter!,
    defaultModel: 'lab:MiniMax-M2.7',
    candidates: [
      {
        modelId: 'lab:MiniMax-M2.7',
        cost: 0.01,
        supportsImages: true,
        supportsThinking: false,
        card: 'Older MiniMax on a separate provider namespace.',
      },
      {
        modelId: 'minimax:MiniMax-M3',
        cost: 0.5,
        supportsImages: true,
        supportsThinking: true,
        card: 'MiniMax M3 on the normal MiniMax provider namespace.',
      },
    ],
  },
};
configureAutoRouter(scopedProviderConfig);
clearRouterCache();
const scopedProviderDecision = await routeTask(
  signal({ task: 'Route across separate MiniMax provider namespaces.' }),
  scopedProviderConfig,
  { forceCostStrategy: 'cheapest' },
);
assert.equal(
  scopedProviderDecision?.modelId,
  'lab:MiniMax-M2.7',
  'MiniMax M3 preference should not apply across different provider namespaces',
);

let classifierRequests = 0;
const classifierServer = createServer((req, res) => {
  classifierRequests += 1;
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const viableProbe = body.includes('viable MiniMax runtime route');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            scores: viableProbe
              ? {
                'minimax:MiniMax-M2.7': 0.82,
                'minimax:MiniMax-M3': 0.82,
              }
              : {
                'minimax:MiniMax-M2.7': 0.69,
                'minimax:MiniMax-M3': 0.62,
              },
            reasoning: viableProbe
              ? 'Both MiniMax candidates clear threshold, but stale cost data makes M2.7 look cheaper.'
              : 'Both below threshold; stale score data slightly favors the older MiniMax model.',
          }),
        },
      }],
    }));
  });
});

await new Promise<void>((resolve) => classifierServer.listen(0, '127.0.0.1', resolve));
const address = classifierServer.address();
assert.ok(address && typeof address === 'object', 'classifier test server should bind');

try {
  const cfg = runtimeConfig(`http://127.0.0.1:${address.port}/v1`);
  configureAutoRouter(cfg);
  clearRouterCache();
  const viableClassifierDecision = await routeTask(
    signal({ task: 'Choose the viable MiniMax runtime route.' }),
    cfg,
  );
  assert.equal(
    viableClassifierDecision?.modelId,
    'minimax:MiniMax-M3',
    'Classifier viable path should prefer MiniMax-M3 over same-provider MiniMax-M2.x when both clear threshold',
  );

  const classifierDecision = await routeTask(signal(), cfg);
  assert.equal(classifierRequests, 2, 'classifier tests should exercise both viable and fallback classifier paths');
  assert.equal(
    classifierDecision?.modelId,
    'minimax:MiniMax-M3',
    'Classifier fallback should prefer MiniMax-M3 over same-provider MiniMax-M2.x even when stale scores favor M2.x',
  );
  assert.match(
    classifierDecision?.reason || '',
    /MiniMax M3 preference/i,
    'Classifier fallback reason should explain the MiniMax M3 preference',
  );
} finally {
  await new Promise<void>((resolve, reject) => classifierServer.close((err) => err ? reject(err) : resolve()));
}

console.log('MiniMax runtime router preference checks passed.');
