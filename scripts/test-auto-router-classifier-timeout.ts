import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { clearRouterCache, configureAutoRouter, routeTask } from '../server/autoRouter';
import type { StoredConfig } from '../server/config';
import {
  DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS,
  SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS,
  getClassifierRequestTimeoutDecision,
} from '../server/modelTimeouts';

function config(classifierModel: string, baseURL: string): StoredConfig {
  return {
    version: 1,
    providers: [
      {
        id: 'zhipu',
        name: 'Zhipu GLM',
        type: 'openai-compatible',
        apiKey: 'test-key',
        baseURL,
        models: [{ id: 'glm-5.2', name: 'GLM 5.2', enabled: true }],
      },
      {
        id: 'local',
        name: 'Local Fast',
        type: 'openai-compatible',
        apiKey: 'test-key',
        baseURL,
        models: [
          { id: 'phi-4', name: 'Phi 4', enabled: true },
          { id: 'qwen-lite', name: 'Qwen Lite', enabled: true },
        ],
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
      classifierModel,
      threshold: 0.7,
      defaultModel: 'local:phi-4',
      cacheTTLMs: 0,
      candidates: [
        {
          modelId: 'local:phi-4',
          cost: 0.01,
          supportsImages: false,
          card: 'Fast cheap classifier test candidate.',
        },
        {
          modelId: 'local:qwen-lite',
          cost: 0.02,
          supportsImages: false,
          card: 'Second candidate so classifier routing is required.',
        },
      ],
    },
  };
}

assert.deepEqual(
  getClassifierRequestTimeoutDecision('local:phi-4', 'local'),
  {
    timeoutMs: DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS,
    timeoutPolicy: 'default',
    timeoutLabel: 'Default classifier lane',
  },
  'ordinary classifier models should keep the fast classifier timeout',
);

assert.deepEqual(
  getClassifierRequestTimeoutDecision('zhipu:glm-5.2', 'zhipu'),
  {
    timeoutMs: SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS,
    timeoutPolicy: 'slow-model',
    timeoutLabel: 'Slow classifier lane',
  },
  'GLM-5 classifier calls should use a bounded slow-classifier timeout',
);

const observedTimeouts: number[] = [];
const originalTimeout = AbortSignal.timeout;
let forceAbortTimeoutMs: number | null = null;
Object.defineProperty(AbortSignal, 'timeout', {
  configurable: true,
  value(timeoutMs: number) {
    observedTimeouts.push(timeoutMs);
    return originalTimeout.call(AbortSignal, forceAbortTimeoutMs === timeoutMs ? 1 : 30_000);
  },
});

const classifierServer = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    if (body.includes('Force classifier timeout')) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            scores: {
              'local:phi-4': 0.71,
              'local:qwen-lite': 0.72,
            },
            reasoning: 'Timeout probe response.',
          }),
        },
      }],
    }));
  });
});

await new Promise<void>((resolve) => classifierServer.listen(0, '127.0.0.1', resolve));
const address = classifierServer.address();
assert.ok(address && typeof address === 'object', 'classifier timeout test server should bind');

try {
  const baseURL = `http://127.0.0.1:${address.port}/v1`;
  const fastConfig = config('local:phi-4', baseURL);
  configureAutoRouter(fastConfig);
  clearRouterCache();
  observedTimeouts.length = 0;
  await routeTask({
    task: 'Classify with a fast ordinary classifier.',
    surface: 'orchestrator',
    hasImages: false,
    turns: 2,
    toolCount: 4,
    estimatedInputTokens: 1_000,
  }, fastConfig);
  assert.ok(
    observedTimeouts.includes(DEFAULT_CLASSIFIER_REQUEST_TIMEOUT_MS),
    'ordinary classifier route should pass the fast classifier timeout into the request',
  );

  const glmConfig = config('zhipu:glm-5.2', baseURL);
  configureAutoRouter(glmConfig);
  clearRouterCache();
  observedTimeouts.length = 0;
  await routeTask({
    task: 'Classify with GLM and give it time.',
    surface: 'orchestrator',
    hasImages: false,
    turns: 2,
    toolCount: 4,
    estimatedInputTokens: 1_000,
  }, glmConfig);
  assert.ok(
    observedTimeouts.includes(SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS),
    'GLM classifier route should pass the bounded slow-classifier timeout into the request',
  );

  forceAbortTimeoutMs = SLOW_CLASSIFIER_REQUEST_TIMEOUT_MS;
  observedTimeouts.length = 0;
  const timeoutDecision = await routeTask({
    task: 'Force classifier timeout while giving GLM its slow classifier lane.',
    surface: 'orchestrator',
    hasImages: false,
    turns: 2,
    toolCount: 4,
    estimatedInputTokens: 1_000,
  }, glmConfig);
  assert.equal(timeoutDecision?.fallback, true, 'classifier timeout should fall back rather than failing the route');
  assert.match(
    timeoutDecision?.reason || '',
    /slow-model/i,
    'classifier timeout fallback reason should preserve the timeout policy',
  );
  assert.match(
    timeoutDecision?.reason || '',
    /Slow classifier lane/i,
    'classifier timeout fallback reason should preserve the timeout label',
  );
  assert.match(
    timeoutDecision?.reason || '',
    /90000ms/i,
    'classifier timeout fallback reason should preserve the applied timeout milliseconds',
  );
} finally {
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: originalTimeout,
  });
  await new Promise<void>((resolve, reject) => classifierServer.close((err) => err ? reject(err) : resolve()));
}

console.log('Auto-router classifier timeout checks passed.');
