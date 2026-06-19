import type express from 'express';
import type { StoredConfig } from '../config';
import { getConfigPath, saveConfig } from '../config';
import { isTrustMode, normalizeTrustMode } from '../toolPolicy';
import { maskProviderOAuth } from './providerRoutes';

type ControlResult = { ok: true } | { ok: false; status: number; error: string };

interface ConfigRouteDeps {
  getConfig: () => StoredConfig;
  ensureLocalMutationWithControl: (req: express.Request) => ControlResult;
  configureAutoRouter: (config: StoredConfig) => void;
}

export function registerConfigRoutes(app: express.Express, deps: ConfigRouteDeps) {
  app.get('/api/config', (req, res) => {
    const appConfig = deps.getConfig();
    const safeConfig = {
      ...appConfig,
      configPath: getConfigPath(),
      providers: appConfig.providers.map((p) => ({
        ...p,
        apiKey: p.apiKey ? '••••' + p.apiKey.slice(-4) : '',
        hasKey: !!p.apiKey,
        oauth: maskProviderOAuth(p.oauth),
      })),
      mcpServers: appConfig.mcpServers.map((s) => ({
        ...s,
        authToken: s.authToken ? '••••' + s.authToken.slice(-4) : '',
      })),
    };
    (safeConfig as any).autoRouter = appConfig.autoRouter;
    const electronHandshake = process.env.OPENHARNESS_ELECTRON_HANDSHAKE || '';
    if (electronHandshake && req.get('x-openharness-electron-handshake') === electronHandshake) {
      res.setHeader('x-openharness-electron-handshake-ok', '1');
    }
    res.json(safeConfig);
  });

  app.put('/api/config', (req, res) => {
    const mutation = deps.ensureLocalMutationWithControl(req);
    if (!mutation.ok) return res.status(mutation.status).json({ error: mutation.error });
    const appConfig = deps.getConfig();
    const updates = req.body;
    if (updates.personality !== undefined) appConfig.personality = updates.personality;
    if (updates.activeModel !== undefined) appConfig.activeModel = updates.activeModel;
    if (updates.trustMode !== undefined) {
      if (!isTrustMode(updates.trustMode)) {
        return res.status(400).json({ error: 'Invalid trustMode' });
      }
      appConfig.trustMode = normalizeTrustMode(updates.trustMode);
    }
    if (updates.activeTheme !== undefined) appConfig.activeTheme = updates.activeTheme;
    if (updates.roleAssignments !== undefined) appConfig.roleAssignments = updates.roleAssignments;
    if (updates.thinkingEffort !== undefined) appConfig.thinkingEffort = updates.thinkingEffort;
    if (updates.roleThinking !== undefined) appConfig.roleThinking = updates.roleThinking;
    if (updates.installedThemePluginManifests !== undefined) {
      appConfig.installedThemePluginManifests = Array.isArray(updates.installedThemePluginManifests)
        ? updates.installedThemePluginManifests
          .filter((entry: unknown): entry is string => typeof entry === 'string')
          .map((entry: string) => entry.trim())
          .filter((entry: string) => entry.length > 0)
        : [];
    }
    if (updates.favoriteModels !== undefined) {
      const favoriteModels: string[] = Array.isArray(updates.favoriteModels)
        ? updates.favoriteModels
          .filter((id: unknown): id is string => typeof id === 'string')
          .map((id: string) => id.trim())
          .filter(Boolean)
        : [];
      appConfig.favoriteModels = [...new Set(favoriteModels)];
    }
    if (updates.modelBudgets !== undefined) {
      appConfig.modelBudgets = Array.isArray(updates.modelBudgets)
        ? updates.modelBudgets
          .map((entry: any) => ({
            modelId: typeof entry?.modelId === 'string' ? entry.modelId.trim() : '',
            maxInputTokens: Math.max(0, Number(entry?.maxInputTokens) || 0),
            maxOutputTokens: Math.max(0, Number(entry?.maxOutputTokens) || 0),
            maxCost: Math.max(0, Number(entry?.maxCost) || 0),
            period: entry?.period === 'daily' || entry?.period === 'weekly' || entry?.period === 'monthly' ? entry.period : 'monthly',
            onExceeded: entry?.onExceeded === 'block' || entry?.onExceeded === 'warn' || entry?.onExceeded === 'allow' ? entry.onExceeded : 'warn',
          }))
          .filter((entry: any) => entry.modelId)
        : [];
    }
    if (updates.providerRateLimits !== undefined) {
      appConfig.providerRateLimits = Array.isArray(updates.providerRateLimits)
        ? updates.providerRateLimits
          .map((entry: any) => ({
            providerId: typeof entry?.providerId === 'string' ? entry.providerId.trim() : '',
            maxRequestsPerMinute: Math.max(0, Number(entry?.maxRequestsPerMinute) || 0),
            maxTokensPerMinute: Math.max(0, Number(entry?.maxTokensPerMinute) || 0),
            onExceeded: entry?.onExceeded === 'block' || entry?.onExceeded === 'warn' || entry?.onExceeded === 'allow' ? entry.onExceeded : 'warn',
          }))
          .filter((entry: any) => entry.providerId)
        : [];
    }
    if (updates.capabilitySettings !== undefined) {
      const raw = updates.capabilitySettings || {};
      const normalizeIds = (value: unknown) => Array.isArray(value)
        ? [...new Set(value
          .filter((entry: unknown): entry is string => typeof entry === 'string')
          .map((entry: string) => entry.trim())
          .filter(Boolean))]
        : [];
      appConfig.capabilitySettings = {
        disabledSkills: normalizeIds(raw.disabledSkills),
        disabledPlugins: normalizeIds(raw.disabledPlugins),
      };
    }
    if (updates.autoRouter !== undefined) {
      (appConfig as any).autoRouter = updates.autoRouter;
      deps.configureAutoRouter(appConfig);
    }
    if (updates.onboardingStep !== undefined) {
      (appConfig as any).onboardingStep = updates.onboardingStep;
    }
    saveConfig(appConfig);
    res.json({ ok: true });
  });
}
