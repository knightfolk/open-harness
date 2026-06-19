import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { fetchProviderModels } from '../server/providers';
import { applyOfficialMetadata, buildModelCatalogAuditReport, mergeModelMetadata } from '../server/modelMetadata';
import type { StoredProvider } from '../server/config';

const serverIndex = await import('node:fs').then(({ readFileSync }) => readFileSync('server/index.ts', 'utf-8'));
assert.ok(
  serverIndex.includes('scheduleStartupModelMetadataRefresh();'),
  'server startup should schedule a non-blocking model metadata refresh',
);
assert.ok(
  serverIndex.includes('Background metadata refresh complete'),
  'startup refresh should log completion without blocking launch',
);

const server = createServer((req, res) => {
  if (req.url === '/v1/models') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      data: [
        {
          id: 'glm-5.2',
          name: 'GLM-5.2 served',
          context_length: 262144,
          top_provider: { max_completion_tokens: 65536 },
          supported_parameters: ['tools', 'tool_choice'],
          pricing: { prompt: '0.0000003', completion: '0.0000025' },
        },
      ],
    }));
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');

try {
  const provider: StoredProvider = {
    id: 'z-ai-zhipu',
    name: 'Z.ai',
    type: 'openai-compatible',
    apiKey: 'test-key',
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    models: [],
  };

  const models = await fetchProviderModels(provider);
  const glm = models.find((model) => model.id === 'glm-5.2');
  assert.ok(glm, 'provider fetch should return GLM-5.2');
  assert.equal(glm.contextWindowTokens, 262144, 'direct provider /models context should win over official-docs fallback');
  assert.equal(glm.maxOutputTokens, 65536, 'direct provider max output should be preserved');
  assert.equal(glm.inputCostPerMTok, 0.3, 'OpenRouter-style token pricing should normalize to per-million input cost');
  assert.equal(glm.outputCostPerMTok, 2.5, 'OpenRouter-style token pricing should normalize to per-million output cost');
  assert.equal(glm.supportsTools, true, 'supported_parameters should detect tool support');
  assert.equal(glm.metadataSource, 'provider-models-api', 'direct /models metadata should keep highest provenance');

  const officialOnly = applyOfficialMetadata({ id: 'glm-5.2', name: 'GLM-5.2' }, provider);
  assert.equal(officialOnly.contextWindowTokens, 1048576, 'official GLM-5.2 fallback should capture the 1M window when API metadata is absent');

  const merged = mergeModelMetadata(
    { id: 'glm-5.2', contextWindowTokens: 262144, metadataSource: 'provider-models-api' },
    { contextWindowTokens: 1048576, metadataSource: 'openrouter-models-api' },
  );
  assert.equal(merged.contextWindowTokens, 262144, 'secondary metadata must not overwrite provider API source-of-truth values');

  const secondaryMerge = mergeModelMetadata(
    { id: 'glm-5.2', metadataSource: 'static-profile' },
    { contextWindowTokens: 1048576, metadataSource: 'official-docs' },
  );
  assert.equal(secondaryMerge.contextWindowTokens, 1048576, 'official secondary metadata should replace static fallback values');

  const audit = buildModelCatalogAuditReport({
    version: 1,
    providers: [
      {
        ...provider,
        models: [
          { id: 'glm-5.2', name: 'GLM-5.2', enabled: true, contextWindowTokens: 262144, metadataSource: 'provider-models-api' },
          { id: 'vendor/new-user-model', name: 'New User Model', enabled: true, contextWindowTokens: 131072, metadataSource: 'provider-models-api' },
        ],
      },
    ],
    mcpServers: [],
    personality: '',
    activeModel: 'glm-5.2',
    activeTheme: 'system',
    roleAssignments: {},
    trustMode: 'workspace-write',
  });
  assert.ok(
    audit.metadataDisagreements.some((item) =>
      item.modelId === 'glm-5.2' && item.field === 'contextWindowTokens' && item.catalogValue === 1048576 && item.liveValue === 262144
    ),
    'catalog audit should flag provider API values that disagree with static catalog cards',
  );
  assert.ok(
    audit.missingCatalogCards.some((item) => item.modelId === 'vendor/new-user-model'),
    'catalog audit should flag enabled user-added models that do not have catalog cards yet',
  );
  assert.ok(
    audit.suggestedCatalogCards.some((item) =>
      item.id === 'vendor/new-user-model' && item.contextWindowTokens === 131072 && item.metadataSource === 'provider-models-api'
    ),
    'catalog audit should draft catalog-card data for enabled user-added models',
  );
  assert.deepEqual(
    audit.sourcePrecedence,
    ['provider-models-api', 'official-docs', 'openrouter-models-api', 'static-profile'],
    'catalog audit should expose the source precedence policy',
  );
} finally {
  await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
}
