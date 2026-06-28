import { strict as assert } from 'node:assert';
import * as api from '../src/utils/api';

const originalFetch = globalThis.fetch;
const originalDateNow = Date.now;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function provider(id: string): api.ProviderInfo {
  return {
    id,
    name: `Provider ${id}`,
    type: 'openai-compatible',
    baseURL: `https://${id}.example.test/v1`,
    hasKey: true,
    enabled: true,
    models: [],
  };
}

let now = 10_000;
Date.now = () => now;

try {
  let providerGetCount = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/providers') && init?.method !== 'POST') {
      providerGetCount += 1;
      return jsonResponse([provider('cached')]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  const parallelProviders = await Promise.all([
    api.getProviders(),
    api.getProviders(),
    api.getProviders(),
  ]);
  assert.equal(providerGetCount, 1, 'parallel provider reads should share one in-flight fetch');
  assert.deepEqual(
    parallelProviders.map((providers) => providers.map((item) => item.id)),
    [['cached'], ['cached'], ['cached']],
    'parallel provider reads should receive the shared provider payload',
  );

  await api.getProviders();
  assert.equal(providerGetCount, 1, 'provider reads should use the short-lived success cache');
  const cachedProviders = await api.getProviders();
  cachedProviders.push(provider('mutated'));
  assert.deepEqual(
    (await api.getProviders()).map((item) => item.id),
    ['cached'],
    'cached provider reads should return copies so callers cannot mutate the shared cache entry',
  );

  now += 60_000;
  await api.getProviders();
  assert.equal(providerGetCount, 2, 'provider cache should expire and refresh');

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/models')) return jsonResponse([{ id: 'm1', name: 'Model 1' }]);
    if (url.endsWith('/api/mcp-servers')) return jsonResponse([{ id: 'mcp1', name: 'MCP 1' }]);
    throw new Error(`Unexpected fetch: ${url} ${init?.method || 'GET'}`);
  }) as typeof fetch;
  const [modelsA, modelsB, mcpServersA, mcpServersB] = await Promise.all([
    api.getModels(),
    api.getModels(),
    api.getMCPServers(),
    api.getMCPServers(),
  ]);
  assert.equal(modelsA[0]?.id, 'm1', 'model reads should resolve from the shared cache helper');
  assert.equal(modelsB[0]?.id, 'm1', 'parallel model reads should share the same payload');
  assert.equal(mcpServersA[0]?.id, 'mcp1', 'MCP server reads should resolve from the shared cache helper');
  assert.equal(mcpServersB[0]?.id, 'mcp1', 'parallel MCP server reads should share the same payload');

  now += 60_000;
  let providerWriteGetCount = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/providers') && init?.method === 'POST') return jsonResponse(provider('new'));
    if (url.endsWith('/api/providers')) {
      providerWriteGetCount += 1;
      return jsonResponse([provider(providerWriteGetCount === 1 ? 'before-write' : 'after-write')]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  assert.equal((await api.getProviders())[0]?.id, 'before-write', 'provider read should seed the cache before a write');
  await api.addProvider({ name: 'New provider', type: 'openai-compatible', apiKey: 'test', baseURL: 'https://new.example.test/v1' });
  assert.equal((await api.getProviders())[0]?.id, 'after-write', 'provider writes should invalidate cached provider reads');
  assert.equal(providerWriteGetCount, 2, 'provider writes should force the next provider read back to the server');

  now += 60_000;
  let resolveStaleProviderRead: ((response: Response) => void) | null = null;
  let providerRaceGetCount = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/providers') && init?.method === 'POST') return jsonResponse(provider('race-new'));
    if (url.endsWith('/api/providers')) {
      providerRaceGetCount += 1;
      if (providerRaceGetCount === 1) {
        return await new Promise<Response>((resolve) => {
          resolveStaleProviderRead = resolve;
        });
      }
      return jsonResponse([provider('after-race')]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;

  const staleProviderRead = api.getProviders();
  await api.addProvider({ name: 'Race provider', type: 'openai-compatible', apiKey: 'test', baseURL: 'https://race.example.test/v1' });
  resolveStaleProviderRead?.(jsonResponse([provider('stale-inflight')]));
  assert.equal((await staleProviderRead)[0]?.id, 'stale-inflight', 'the original in-flight read should resolve for its caller');
  assert.equal(
    (await api.getProviders())[0]?.id,
    'after-race',
    'invalidated in-flight reads should not repopulate stale provider cache after a write',
  );
  assert.equal(providerRaceGetCount, 2, 'post-write provider reads should fetch after an invalidated in-flight read resolves');

  now += 60_000;
  let transientFailureCount = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/api/providers')) {
      transientFailureCount += 1;
      if (transientFailureCount === 1) return new Response('temporary outage', { status: 503 });
      return jsonResponse([provider('recovered')]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  assert.deepEqual(await api.getProviders(), [], 'failed optional reads should still return []');
  assert.equal((await api.getProviders())[0]?.id, 'recovered', 'failed optional reads should not cache []');
  assert.equal(transientFailureCount, 2, 'a transient failed read should allow the next read to retry');

  now += 60_000;
  let curatedReadCount = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/mcp-servers/curated-one') && init?.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/api/mcp/curated')) {
      curatedReadCount += 1;
      return jsonResponse([
        {
          id: 'curated-one',
          name: 'Curated One',
          tagline: 'Test',
          description: 'Test curated server',
          category: 'files',
          transport: 'stdio',
          permissions: [],
          requiresTrustMode: 'workspace-write',
          installHint: 'test',
          installed: curatedReadCount === 1,
          permissionSummary: 'None',
        },
      ]);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  assert.equal((await api.getCuratedMcpServers())[0]?.installed, true, 'curated MCP read should seed installed state');
  await api.deleteMCPServer('curated-one');
  assert.equal((await api.getCuratedMcpServers())[0]?.installed, false, 'deleting an MCP server should refresh curated installed state');
  assert.equal(curatedReadCount, 2, 'curated MCP reads should refetch after MCP server delete');

  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  assert.deepEqual(await api.discoverLocalProviders(), [], 'uncached optional discovery should still fail soft to []');
} finally {
  globalThis.fetch = originalFetch;
  Date.now = originalDateNow;
}
