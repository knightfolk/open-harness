import type express from 'express';
import { randomBytes } from 'crypto';
import type { StoredConfig, StoredProvider } from '../config';
import { removeProvider, upsertProvider } from '../config';
import { assertProviderBaseURLAllowed, fetchProviderModels, testProviderConnection } from '../providers';
import { getAdapterInfo, discoverLocalProviders } from '../providers/registry';
import * as providerHealth from '../providerHealth';
import { detectModelFamily, getModelConfig } from '../modelProfiles';
import {
  applyOfficialMetadata,
  buildModelCatalogAuditReport,
  enrichModelsFromSecondarySources,
  fetchOpenRouterModelMetadata,
} from '../modelMetadata';
import { objectSchema, optionalArray, optionalString, parseBody, requiredArray, requiredString } from '../requestSchemas';
import { auditRouteFailure, auditRouteMutation, sendRouteError } from '../routeSupport';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };
type OAuthProviderId = 'openai' | 'anthropic' | 'google';

interface ProviderOAuthConfig {
  id: OAuthProviderId;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
}

interface ProviderOAuthTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  error?: unknown;
  error_description?: unknown;
}

export interface ProviderRouteDeps {
  getConfig: () => StoredConfig;
  setConfig: (config: StoredConfig) => void;
  saveConfig: (config: StoredConfig) => void;
  ensureLocalControl: (req: express.Request) => ControlResult;
  ensureLocalMutationWithControl: (req: express.Request) => ControlResult;
  getProviderRateLimitStatus: () => unknown;
}

const PROVIDER_OAUTH_CONFIG: Record<OAuthProviderId, ProviderOAuthConfig> = {
  openai: {
    id: 'openai',
    authUrl: process.env.OPENAI_OAUTH_AUTH_URL || 'https://auth.openai.com/oauth/authorize',
    tokenUrl: process.env.OPENAI_OAUTH_TOKEN_URL || 'https://auth.openai.com/oauth/token',
    scopes: (process.env.OPENAI_OAUTH_SCOPES || 'openid profile email offline_access').split(/\s+/).filter(Boolean),
    clientIdEnv: 'OPENAI_OAUTH_CLIENT_ID',
    clientSecretEnv: 'OPENAI_OAUTH_CLIENT_SECRET',
  },
  anthropic: {
    id: 'anthropic',
    authUrl: process.env.ANTHROPIC_OAUTH_AUTH_URL || 'https://claude.ai/oauth/authorize',
    tokenUrl: process.env.ANTHROPIC_OAUTH_TOKEN_URL || 'https://claude.ai/oauth/token',
    scopes: (process.env.ANTHROPIC_OAUTH_SCOPES || 'openid profile email offline_access').split(/\s+/).filter(Boolean),
    clientIdEnv: 'ANTHROPIC_OAUTH_CLIENT_ID',
    clientSecretEnv: 'ANTHROPIC_OAUTH_CLIENT_SECRET',
  },
  google: {
    id: 'google',
    authUrl: process.env.GOOGLE_OAUTH_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: process.env.GOOGLE_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token',
    scopes: (process.env.GOOGLE_OAUTH_SCOPES || 'openid profile email https://www.googleapis.com/auth/generative-language').split(/\s+/).filter(Boolean),
    clientIdEnv: 'GOOGLE_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_OAUTH_CLIENT_SECRET',
  },
};

const pendingProviderOAuth = new Map<string, { providerId: string; oauthProviderId: OAuthProviderId; createdAt: number }>();

const providerBatchSchema = objectSchema({
  providers: requiredArray({ max: 100 }),
});

const createProviderSchema = objectSchema({
  id: optionalString({ max: 120 }),
  name: requiredString({ max: 200 }),
  type: requiredString({ max: 80 }),
  apiKey: optionalString({ trim: false, max: 20_000 }),
  baseURL: requiredString({ max: 2048 }),
  accessMode: optionalString({ max: 40 }),
  planId: optionalString({ max: 200 }),
  models: optionalArray({ max: 2000 }),
});

const updateProviderSchema = objectSchema({
  name: optionalString({ max: 200 }),
  type: optionalString({ max: 80 }),
  apiKey: optionalString({ trim: false, max: 20_000, allowEmpty: true }),
  baseURL: optionalString({ max: 2048 }),
  accessMode: optionalString({ max: 40 }),
  planId: optionalString({ max: 200, allowEmpty: true }),
  models: optionalArray({ max: 2000 }),
});

const providerCredentialProbeSchema = objectSchema({
  apiKey: optionalString({ trim: false, max: 20_000, allowEmpty: true }),
  baseURL: optionalString({ max: 2048 }),
});

export function maskProviderOAuth(oauth: StoredProvider['oauth']) {
  if (!oauth?.accessToken && !oauth?.refreshToken) {
    return oauth?.connectedAt
      ? { connected: true, connectedAt: oauth.connectedAt, accountLabel: oauth.accountLabel, scopes: oauth.scopes, expiresAt: oauth.expiresAt }
      : undefined;
  }
  return {
    connected: true,
    connectedAt: oauth.connectedAt,
    accountLabel: oauth.accountLabel,
    scopes: oauth.scopes || [],
    expiresAt: oauth.expiresAt,
    hasRefreshToken: !!oauth.refreshToken,
  };
}

function oauthProviderForStoredProvider(provider: StoredProvider): OAuthProviderId | null {
  const id = provider.id.toLowerCase();
  const name = provider.name.toLowerCase();
  if (id.includes('openai') || name.includes('openai')) return 'openai';
  if (id.includes('anthropic') || name.includes('anthropic') || name.includes('claude')) return 'anthropic';
  if (id.includes('google') || id.includes('gemini') || name.includes('google') || name.includes('gemini')) return 'google';
  return null;
}

function getOAuthRedirectUri(req: express.Request, oauthProviderId: OAuthProviderId): string {
  const explicit = process.env.OPENHARNESS_OAUTH_REDIRECT_BASE;
  const base = explicit || `${req.protocol}://${req.get('host')}`;
  return `${base.replace(/\/+$/, '')}/api/providers/oauth/${oauthProviderId}/callback`;
}

function providerWithMaskedSecrets(provider: StoredProvider) {
  return {
    ...provider,
    apiKey: provider.apiKey ? '••••' + provider.apiKey.slice(-4) : '',
    hasKey: !!provider.apiKey,
    oauth: maskProviderOAuth(provider.oauth),
  };
}

async function refreshConfiguredModelMetadata(deps: ProviderRouteDeps): Promise<{ refreshedAt: string; providers: Array<{ providerId: string; models: number }>; modelCount: number }> {
  const appConfig = deps.getConfig();
  let modelCount = 0;
  const refreshedProviders: Array<{ providerId: string; models: number }> = [];

  for (const provider of appConfig.providers) {
    if (!Array.isArray(provider.models) || provider.models.length === 0) continue;
    const enriched = await enrichModelsFromSecondarySources(provider.models, provider);
    provider.models = enriched.map((model) => ({ ...model, enabled: model.enabled !== false }));
    modelCount += provider.models.length;
    refreshedProviders.push({ providerId: provider.id, models: provider.models.length });
  }

  deps.saveConfig(appConfig);
  deps.setConfig(appConfig);
  return {
    refreshedAt: new Date().toISOString(),
    providers: refreshedProviders,
    modelCount,
  };
}

export function scheduleStartupModelMetadataRefresh(deps: ProviderRouteDeps, delayMs = 2500): void {
  setTimeout(() => {
    void refreshConfiguredModelMetadata(deps)
      .then((result) => {
        console.log(`[models] Background metadata refresh complete: ${result.modelCount} model(s), ${result.providers.length} provider(s)`);
      })
      .catch((err: any) => {
        console.log(`[models] Background metadata refresh skipped: ${err?.message || err}`);
      });
  }, delayMs);
}

export function registerProviderRoutes(app: express.Express, deps: ProviderRouteDeps) {
  app.get('/api/providers/rate-limits/status', (_req, res) => {
    res.json(deps.getProviderRateLimitStatus());
  });

  app.get('/api/providers', (_req, res) => {
    res.json(deps.getConfig().providers.map(providerWithMaskedSecrets));
  });

  app.get('/api/providers/adapter', (req, res) => {
    const providerId = req.query.providerId as string;
    const provider = deps.getConfig().providers.find((p) => p.id === providerId);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const info = getAdapterInfo(provider.type);
    res.json(info || { id: 'unknown', name: 'Unknown' });
  });

  app.get('/api/providers/local-discovery', async (_req, res) => {
    const results = await discoverLocalProviders();
    res.json(results);
  });

  app.post('/api/providers/:id/health/probe', async (req, res) => {
    const provider = deps.getConfig().providers.find((p) => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    try {
      const record = await providerHealth.probeProvider(provider);
      res.json(record);
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/providers/:id/health/probe', status: 500, fallback: 'Health probe failed', err });
    }
  });

  app.get('/api/providers/:id/health', (req, res) => {
    res.json({
      history: providerHealth.getProviderHealth(req.params.id),
      summary: providerHealth.getProviderHealthSummary(req.params.id),
    });
  });

  app.get('/api/providers/health', (_req, res) => {
    res.json(providerHealth.listAllProviderHealth());
  });

  app.get('/api/providers/:id/oauth/status', (req, res) => {
    const provider = deps.getConfig().providers.find((p) => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const oauthProviderId = oauthProviderForStoredProvider(provider);
    const oauthConfig = oauthProviderId ? PROVIDER_OAUTH_CONFIG[oauthProviderId] : null;
    res.json({
      providerId: provider.id,
      oauthProvider: oauthProviderId,
      available: !!oauthProviderId,
      configured: !!(oauthConfig && process.env[oauthConfig.clientIdEnv] && process.env[oauthConfig.clientSecretEnv]),
      connected: !!provider.oauth?.accessToken,
      accountLabel: provider.oauth?.accountLabel,
      connectedAt: provider.oauth?.connectedAt,
      scopes: provider.oauth?.scopes || [],
      expiresAt: provider.oauth?.expiresAt,
    });
  });

  app.post('/api/providers/:id/oauth/start', (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    const provider = deps.getConfig().providers.find((p) => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const oauthProviderId = oauthProviderForStoredProvider(provider);
    if (!oauthProviderId) return res.status(400).json({ error: 'OAuth is only available for OpenAI, Anthropic, and Google providers' });
    const oauthConfig = PROVIDER_OAUTH_CONFIG[oauthProviderId];
    const clientId = process.env[oauthConfig.clientIdEnv];
    const clientSecret = process.env[oauthConfig.clientSecretEnv];
    if (!clientId || !clientSecret) {
      return res.status(400).json({ error: `OAuth is not configured. Set ${oauthConfig.clientIdEnv} and ${oauthConfig.clientSecretEnv}.` });
    }
    const state = randomBytes(24).toString('hex');
    pendingProviderOAuth.set(state, { providerId: provider.id, oauthProviderId, createdAt: Date.now() });
    const authUrl = new URL(oauthConfig.authUrl);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', getOAuthRedirectUri(req, oauthProviderId));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', oauthConfig.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    res.json({ authUrl: authUrl.toString() });
  });

  app.get('/api/providers/oauth/:oauthProvider/callback', async (req, res) => {
    const oauthProviderId = req.params.oauthProvider as OAuthProviderId;
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const pending = pendingProviderOAuth.get(state);
    if (!code || !pending || pending.oauthProviderId !== oauthProviderId || Date.now() - pending.createdAt > 10 * 60 * 1000) {
      return res.status(400).send('OpenHarness OAuth callback is invalid or expired.');
    }
    pendingProviderOAuth.delete(state);
    const appConfig = deps.getConfig();
    const provider = appConfig.providers.find((p) => p.id === pending.providerId);
    const oauthConfig = PROVIDER_OAUTH_CONFIG[oauthProviderId];
    const clientId = process.env[oauthConfig.clientIdEnv];
    const clientSecret = process.env[oauthConfig.clientSecretEnv];
    if (!provider || !clientId || !clientSecret) return res.status(400).send('OpenHarness OAuth provider is no longer configured.');

    try {
      const tokenRes = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: getOAuthRedirectUri(req, oauthProviderId),
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const tokenBody = await tokenRes.json().catch(() => ({})) as ProviderOAuthTokenResponse;
      if (!tokenRes.ok || !tokenBody.access_token) {
        return res.status(400).send(`OpenHarness OAuth token exchange failed: ${tokenBody.error_description || tokenBody.error || tokenRes.status}`);
      }
      provider.oauth = {
        accessToken: String(tokenBody.access_token),
        refreshToken: typeof tokenBody.refresh_token === 'string' ? tokenBody.refresh_token : provider.oauth?.refreshToken,
        expiresAt: typeof tokenBody.expires_in === 'number' ? Date.now() + tokenBody.expires_in * 1000 : undefined,
        scopes: typeof tokenBody.scope === 'string' ? tokenBody.scope.split(/\s+/).filter(Boolean) : oauthConfig.scopes,
        accountLabel: provider.name,
        connectedAt: new Date().toISOString(),
      };
      provider.accessMode = 'subscription';
      const nextConfig = upsertProvider(appConfig, provider);
      deps.setConfig(nextConfig);
      deps.saveConfig(nextConfig);
      auditRouteMutation('GET /api/providers/oauth/:oauthProvider/callback', 'oauth-connected', {
        providerId: provider.id,
        oauthProvider: oauthProviderId,
      });
      res.send('<html><body><h1>OpenHarness OAuth connected</h1><p>You can close this tab and return to OpenHarness.</p></body></html>');
    } catch (err: any) {
      const message = err?.message || 'Unknown error';
      res.status(500).send(`OpenHarness OAuth token exchange failed: ${message}`);
      auditRouteFailure('GET /api/providers/oauth/:oauthProvider/callback', 500, String(message));
    }
  });

  app.delete('/api/providers/:id/oauth', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const appConfig = deps.getConfig();
    const provider = appConfig.providers.find((p) => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    provider.oauth = undefined;
    const nextConfig = upsertProvider(appConfig, provider);
    deps.setConfig(nextConfig);
    deps.saveConfig(nextConfig);
    auditRouteMutation('DELETE /api/providers/:id/oauth', 'oauth-deleted', { providerId: provider.id });
    res.status(204).end();
  });

  app.post('/api/providers/batch', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const appConfig = deps.getConfig();
    const body = parseBody(req, res, providerBatchSchema);
    if (!body) return;
    const list = body.providers as any[];
    const created: any[] = [];
    let nextConfig = appConfig;
    for (const raw of list) {
      if (!raw?.name || !raw?.type || !raw?.baseURL) continue;
      const id = raw.id || String(raw.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const existing = nextConfig.providers.find((p) => p.id === id);
      const incomingModels = Array.isArray(raw.models) ? raw.models : undefined;
      const incomingApiKey = typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '';
      const provider: StoredProvider = {
        id,
        name: raw.name,
        type: raw.type as StoredProvider['type'],
        apiKey: incomingApiKey || existing?.apiKey || '',
        baseURL: raw.baseURL,
        accessMode: raw.accessMode === 'subscription' ? 'subscription' : (existing?.accessMode || 'api-key'),
        planId: typeof raw.planId === 'string' && raw.planId ? raw.planId : existing?.planId,
        models: incomingModels && incomingModels.length > 0 ? incomingModels : (existing?.models || []),
      };
      try {
        assertProviderBaseURLAllowed(provider);
      } catch (err: any) {
        return res.status(400).json({ error: err?.message || 'Provider URL is not allowed' });
      }
      nextConfig = upsertProvider(nextConfig, provider);
      created.push(providerWithMaskedSecrets(provider));
    }
    deps.setConfig(nextConfig);
    deps.saveConfig(nextConfig);
    auditRouteMutation('POST /api/providers/batch', 'saved', { count: created.length });
    res.status(201).json({ providers: created, count: created.length });
  });

  app.post('/api/providers', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const { id, name, type, apiKey, baseURL, accessMode, planId, models } = parseBody(req, res, createProviderSchema) || {};
    if (!name || !type || !baseURL) return;
    const provider: StoredProvider = {
      id: id || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      type: type as StoredProvider['type'],
      apiKey: typeof apiKey === 'string' ? apiKey.trim() : '',
      baseURL,
      accessMode: accessMode === 'subscription' ? 'subscription' : 'api-key',
      planId: typeof planId === 'string' && planId ? planId : undefined,
      models: (models || []) as StoredProvider['models'],
    };
    try {
      assertProviderBaseURLAllowed(provider);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Provider URL is not allowed' });
    }
    const nextConfig = upsertProvider(deps.getConfig(), provider);
    deps.setConfig(nextConfig);
    deps.saveConfig(nextConfig);
    auditRouteMutation('POST /api/providers', 'created', { providerId: provider.id, providerType: provider.type });
    res.status(201).json(providerWithMaskedSecrets(provider));
  });

  app.put('/api/providers/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const appConfig = deps.getConfig();
    const existing = appConfig.providers.find((p) => p.id === req.params.id);
    if (!existing) return res.status(404).json({ error: 'Provider not found' });

    const updates = parseBody(req, res, updateProviderSchema);
    if (!updates) return;
    if (updates.name !== undefined) existing.name = updates.name;
    if (updates.type !== undefined) existing.type = updates.type as StoredProvider['type'];
    if (updates.baseURL !== undefined) existing.baseURL = updates.baseURL;
    if (updates.accessMode !== undefined) existing.accessMode = updates.accessMode === 'subscription' ? 'subscription' : 'api-key';
    if (updates.planId !== undefined) existing.planId = typeof updates.planId === 'string' && updates.planId ? updates.planId : undefined;
    if (typeof updates.apiKey === 'string' && !updates.apiKey.startsWith('••••')) {
      existing.apiKey = updates.apiKey.trim();
    }
    if (updates.models !== undefined) existing.models = updates.models as StoredProvider['models'];
    try {
      assertProviderBaseURLAllowed(existing);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Provider URL is not allowed' });
    }

    const nextConfig = upsertProvider(appConfig, existing);
    deps.setConfig(nextConfig);
    deps.saveConfig(nextConfig);
    auditRouteMutation('PUT /api/providers/:id', 'updated', { providerId: existing.id, providerType: existing.type });
    res.json(providerWithMaskedSecrets(existing));
  });

  app.delete('/api/providers/:id', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const nextConfig = removeProvider(deps.getConfig(), req.params.id);
    deps.setConfig(nextConfig);
    deps.saveConfig(nextConfig);
    auditRouteMutation('DELETE /api/providers/:id', 'deleted', { providerId: req.params.id });
    res.status(204).end();
  });

  app.post('/api/providers/:id/test', async (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    const provider = deps.getConfig().providers.find((p) => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const body = parseBody(req, res, providerCredentialProbeSchema);
    if (!body) return;
    const testProvider = { ...provider };
    if (typeof body.apiKey === 'string' && !body.apiKey.startsWith('••••')) {
      testProvider.apiKey = body.apiKey.trim();
    }
    if (body.baseURL) testProvider.baseURL = body.baseURL;
    try {
      assertProviderBaseURLAllowed(testProvider);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Provider URL is not allowed' });
    }

    const result = await testProviderConnection(testProvider);
    res.json(result);
  });

  app.post('/api/providers/:id/models', async (req, res) => {
    const control = deps.ensureLocalControl(req);
    if (!control.ok) return res.status(control.status).json({ error: control.error });
    const appConfig = deps.getConfig();
    const provider = appConfig.providers.find((p) => p.id === req.params.id);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });

    const body = parseBody(req, res, providerCredentialProbeSchema);
    if (!body) return;
    const fetchProvider = { ...provider };
    if (typeof body.apiKey === 'string' && !body.apiKey.startsWith('••••')) {
      fetchProvider.apiKey = body.apiKey.trim();
    }
    if (body.baseURL) fetchProvider.baseURL = body.baseURL;
    try {
      assertProviderBaseURLAllowed(fetchProvider);
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Provider URL is not allowed' });
    }

    try {
      const fetchedModels = await fetchProviderModels(fetchProvider);
      const existingMap = new Map(provider.models.map((m) => [m.id, m]));
      const merged = fetchedModels.map((fm) => {
        const existing = existingMap.get(fm.id);
        return { ...fm, enabled: existing ? existing.enabled : true };
      });

      provider.models = merged;
      const nextConfig = upsertProvider(appConfig, provider);
      deps.setConfig(nextConfig);
      deps.saveConfig(nextConfig);
      auditRouteMutation('POST /api/providers/:id/models', 'models-refreshed', { providerId: provider.id, modelCount: merged.length });
      res.json(merged);
    } catch (err: any) {
      sendRouteError(res, { route: 'POST /api/providers/:id/models', status: 502, fallback: 'Failed to fetch provider models', err });
    }
  });

  app.get('/api/models', (_req, res) => {
    const models = deps.getConfig().providers
      .filter((p) => {
        const supported = p.type === 'openai-compatible' || p.type === 'anthropic' || p.type === 'google' || p.type === 'local' || p.type === 'custom';
        if (!supported) return false;
        if (p.type === 'local') return true;
        return !!p.apiKey;
      })
      .flatMap((p) =>
        p.models
          .filter((m) => m.enabled)
          .map((m) => {
            const family = detectModelFamily(m.id);
            const profile = getModelConfig(m.id);
            const hydrated = applyOfficialMetadata(m, p);
            return {
              id: m.id,
              name: m.name,
              providerId: p.id,
              providerName: p.name,
              type: p.type,
              family,
              contextWindowTokens: hydrated.contextWindowTokens || profile.contextWindowTokens,
              maxOutputTokens: hydrated.maxOutputTokens || profile.recommendedMaxTokens,
              inputCostPerMTok: hydrated.inputCostPerMTok,
              outputCostPerMTok: hydrated.outputCostPerMTok,
              supportsImages: hydrated.supportsImages,
              supportsTools: hydrated.supportsTools,
              metadataSource: hydrated.metadataSource || 'static-profile',
              metadataUpdatedAt: hydrated.metadataUpdatedAt,
              metadataNotes: hydrated.metadataNotes || [],
            };
          })
      );
    res.json(models);
  });

  app.post('/api/models/metadata/refresh', async (_req, res) => {
    const result = await refreshConfiguredModelMetadata(deps);
    res.json({
      ok: true,
      ...result,
    });
  });

  app.get('/api/models/catalog/audit', async (req, res) => {
    const includeOpenRouter = req.query.openRouter !== 'false';
    let openRouterMetadata = null;
    if (includeOpenRouter) {
      try {
        openRouterMetadata = await fetchOpenRouterModelMetadata(AbortSignal.timeout(5000));
      } catch {
        openRouterMetadata = null;
      }
    }
    res.json(buildModelCatalogAuditReport(deps.getConfig(), openRouterMetadata));
  });
}
