import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Brain,
  Command,
  FileCode,
  FileText,
  Globe,
  Grid,
  Layers,
  Layout,
  Loader,
  Lock,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import * as api from '../../utils/api';
import {
  buildPromptPluginInjectionRows,
  normalizePromptPluginRenderingConfig,
  togglePromptPluginInjectionAllowed,
  togglePromptPluginRenderingEnabled,
} from '../../utils/promptPluginRenderingSettings';
import { buildAssistantMemoryEntries } from '../../utils/assistantMemoryInventory';

function PaneTitle({ children }: { children: ReactNode }) {
  return <div className="settings-pane-title">{children}</div>;
}

function PaneDesc({ children }: { children: ReactNode }) {
  return <div className="settings-pane-desc">{children}</div>;
}

const skillCategoryIcons: Record<string, typeof Sparkles> = {
  media: Sparkles,
  reference: FileText,
  meta: Settings,
  automation: Globe,
  web: Layout,
  review: Search,
  tools: Command,
  browser: Globe,
};

const memoryTypeIcons: Record<string, typeof Brain> = {
  file: FileCode,
  skill: Zap,
  context: Brain,
  plugin: Layers,
};

const EMPTY_CAPABILITY_ITEMS: api.CapabilityItem[] = [];

export function ClickySettingsPane({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <>
      <PaneTitle>Clicky</PaneTitle>
      <PaneDesc>A small animated helper for quick tips in the left sidebar.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div className="settings-item">
          <div>
            <div className="settings-item-label">Show Clicky</div>
            <div className="settings-item-desc">Display the helper icon and tip popover in the sidebar</div>
          </div>
          <div className={`toggle ${enabled ? 'active' : ''}`} onClick={() => onChange(!enabled)} />
        </div>
      </div>
    </>
  );
}

export function AssistantCapabilityPane({ kind, workingDir }: { kind: 'skills' | 'plugins'; workingDir?: string | null }) {
  const [registry, setRegistry] = useState<api.CapabilityRegistry | null>(null);
  const [promptPluginRendering, setPromptPluginRendering] = useState<api.PromptPluginRenderingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingRenderingId, setSavingRenderingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const isSkills = kind === 'skills';
  const items = registry?.[kind] || EMPTY_CAPABILITY_ITEMS;
  const enabledCount = items.filter((item) => item.enabled).length;
  const renderingConfig = useMemo(() => (
    normalizePromptPluginRenderingConfig(promptPluginRendering)
  ), [promptPluginRendering]);
  const promptPluginInjectionRows = useMemo(() => (
    buildPromptPluginInjectionRows(items, renderingConfig)
  ), [items, renderingConfig]);
  const promptPluginAllowedCount = promptPluginInjectionRows.filter((row) => row.allowed).length;

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [nextRegistry, nextConfig] = await Promise.all([
        api.getCapabilities(workingDir),
        kind === 'plugins' ? api.getConfig() : Promise.resolve(null),
      ]);
      setRegistry(nextRegistry);
      if (kind === 'plugins') setPromptPluginRendering(nextConfig?.promptPluginRendering || null);
    } catch (err: any) {
      setMessage(err?.message || 'Could not load capabilities.');
    } finally {
      setLoading(false);
    }
  }, [kind, workingDir]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage('');
    Promise.all([
      api.getCapabilities(workingDir),
      kind === 'plugins' ? api.getConfig() : Promise.resolve(null),
    ])
      .then(([nextRegistry, nextConfig]) => {
        if (cancelled) return;
        setRegistry(nextRegistry);
        if (kind === 'plugins') setPromptPluginRendering(nextConfig?.promptPluginRendering || null);
      })
      .catch((err) => {
        if (!cancelled) setMessage(err?.message || 'Could not load capabilities.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [kind, workingDir]);

  const toggle = async (item: api.CapabilityItem) => {
    if (!item.configurable) return;
    setSavingId(item.id);
    setMessage('');
    try {
      setRegistry(await api.setCapabilityEnabled(kind, item.id, !item.enabled, workingDir));
      setMessage(`${item.name} ${item.enabled ? 'turned off' : 'turned on'}.`);
    } catch (err: any) {
      setMessage(err?.message || `Could not update ${item.name}.`);
    } finally {
      setSavingId(null);
    }
  };

  const togglePromptPluginRendering = async () => {
    const nextConfig = togglePromptPluginRenderingEnabled(renderingConfig, !renderingConfig.enabled);
    setSavingRenderingId('prompt-plugin-rendering');
    setMessage('');
    try {
      setPromptPluginRendering(await api.setPromptPluginRenderingEnabled(!renderingConfig.enabled, workingDir));
      setMessage(nextConfig.enabled ? 'Prompt plugin injection is on.' : 'Prompt plugin injection is off.');
    } catch (err: any) {
      setMessage(err?.message || 'Could not update prompt plugin injection.');
    } finally {
      setSavingRenderingId(null);
    }
  };

  const togglePromptPluginInjection = async (row: ReturnType<typeof buildPromptPluginInjectionRows>[number]) => {
    const nextConfig = togglePromptPluginInjectionAllowed(renderingConfig, row.id, !row.allowed);
    setSavingRenderingId(row.id);
    setMessage('');
    try {
      setPromptPluginRendering(await api.setPromptPluginInjectionAllowed(row.id, !row.allowed, workingDir));
      const changed = nextConfig.allowedPluginIds.includes(row.manifestId);
      setMessage(`${row.name} prompt injection ${changed ? 'allowed' : 'disallowed'}.`);
    } catch (err: any) {
      setMessage(err?.message || `Could not update prompt injection for ${row.name}.`);
    } finally {
      setSavingRenderingId(null);
    }
  };

  return (
    <>
      <PaneTitle>{isSkills ? 'Skills' : 'Plugins'}</PaneTitle>
      <PaneDesc>
        {isSkills
          ? 'Top assistant skills available to the harness. Turn off anything you do not want surfaced for future assisted work.'
          : 'Top plugin groups and discovered prompt plugins. Prompt plugins are listed from the active project, user, and imported plugin folders.'}
      </PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div className="settings-section-header">
          <div>
            <div className="settings-section-title">
              {isSkills ? 'Top 20 Skills' : 'Plugin System'} {items.length > 0 ? `(${enabledCount}/${items.length} on)` : ''}
            </div>
            <div className="settings-item-desc">
              {isSkills ? 'Curated defaults stay local to OpenHarness settings.' : 'Curated plugin groups appear first; project prompt plugins follow when present.'}
            </div>
          </div>
          <button className="settings-mini-button" type="button" onClick={refresh} disabled={loading || !!savingId} aria-label={`Refresh ${isSkills ? 'skills' : 'plugins'}`}>
            {loading ? <Loader size={11} className="spin" aria-hidden="true" /> : <RefreshCw size={11} aria-hidden="true" />}
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="settings-item-desc" role="status">Loading {isSkills ? 'skills' : 'plugins'}...</div>
        ) : items.length === 0 ? (
          <div className="settings-item-desc" role="status">No {isSkills ? 'skills' : 'plugins'} found.</div>
        ) : (
          <div className="assistant-capability-list" role="list" aria-label={`${items.length} ${isSkills ? 'skills' : 'plugins'}`}>
            {items.map((item) => {
            const Icon = item.status === 'blocked' || item.status === 'invalid'
              ? Lock
              : skillCategoryIcons[item.category] || (isSkills ? Command : Grid);
            return (
              <div
                key={item.id}
                className={`assistant-capability-row ${item.enabled ? '' : 'muted'} ${item.status !== 'ready' ? 'blocked' : ''}`}
                role="listitem"
                aria-label={`${item.name}, ${item.enabled ? 'on' : 'off'}, ${item.status}`}
              >
                <span className="assistant-capability-icon"><Icon size={14} aria-hidden="true" /></span>
                <span className="assistant-capability-main">
                  <span className="assistant-capability-title-row">
                    <span className="assistant-capability-name">{item.name}</span>
                    <span className={`assistant-capability-pill ${item.enabled ? 'on' : ''}`}>
                      {item.enabled ? 'On' : 'Off'}
                    </span>
                  </span>
                  <span className="assistant-capability-desc">{item.description}</span>
                  <span className="assistant-capability-meta">
                    {item.source === 'prompt-plugin' ? 'Prompt plugin' : item.category}
                    {item.status !== 'ready' ? ` · ${item.status}` : ''}
                    {item.issue ? ` · ${item.issue}` : ''}
                  </span>
                  {item.path && <span className="assistant-capability-path">{item.path}</span>}
                </span>
                <button
                  className={`compact-toggle ${item.enabled ? 'active' : ''}`}
                  type="button"
                  onClick={() => toggle(item)}
                  disabled={!item.configurable || savingId === item.id}
                  title={item.configurable ? `${item.enabled ? 'Turn off' : 'Turn on'} ${item.name}` : `${item.name} cannot be toggled until its issues are fixed`}
                  aria-label={`${item.enabled ? 'Turn off' : 'Turn on'} ${item.name}`}
                  aria-pressed={item.enabled}
                />
              </div>
            );
            })}
          </div>
        )}
        <div className="settings-item-desc" role={message ? 'status' : undefined} style={{ marginTop: 12 }}>
          {message || 'Changes are saved immediately.'}
        </div>
      </div>
      {!isSkills && (
        <div className="settings-card" style={{ marginTop: 12 }}>
          <div className="settings-section-header">
            <div>
              <div className="settings-section-title">
                Prompt plugin injection {renderingConfig.enabled ? `(${promptPluginAllowedCount}/${promptPluginInjectionRows.length} allowed)` : '(off)'}
              </div>
              <div className="settings-item-desc">
                Off by default. Allow ready prompt plugins here before their sections can be added to future prompts.
              </div>
            </div>
            <button
              className={`settings-mini-button ${renderingConfig.enabled ? 'active' : ''}`}
              type="button"
              onClick={togglePromptPluginRendering}
              disabled={loading || !!savingRenderingId}
              aria-pressed={renderingConfig.enabled}
              aria-label={`${renderingConfig.enabled ? 'Turn off' : 'Turn on'} prompt plugin injection`}
            >
              {savingRenderingId === 'prompt-plugin-rendering' ? <Loader size={11} className="spin" aria-hidden="true" /> : <Layers size={11} aria-hidden="true" />}
              {renderingConfig.enabled ? 'On' : 'Off'}
            </button>
          </div>
          {promptPluginInjectionRows.length === 0 ? (
            <div className="settings-item-desc" role="status">No prompt plugins are available for injection.</div>
          ) : (
            <div className="assistant-capability-list" role="list" aria-label={`${promptPluginInjectionRows.length} prompt plugin injection controls`}>
              {promptPluginInjectionRows.map((row) => {
                const Icon = row.injectable ? Layers : Lock;
                const disabled = !renderingConfig.enabled || !row.injectable || savingRenderingId === row.id;
                const disabledReason = !renderingConfig.enabled ? 'Turn on prompt plugin injection first.' : row.reason;
                return (
                  <div
                    key={`inject:${row.id}`}
                    className={`assistant-capability-row ${row.allowed ? '' : 'muted'} ${!row.injectable ? 'blocked' : ''}`}
                    role="listitem"
                    aria-label={`${row.name}, prompt injection ${row.allowed ? 'allowed' : 'not allowed'}${row.reason ? `, ${row.reason}` : ''}`}
                  >
                    <span className="assistant-capability-icon"><Icon size={14} aria-hidden="true" /></span>
                    <span className="assistant-capability-main">
                      <span className="assistant-capability-title-row">
                        <span className="assistant-capability-name">{row.name}</span>
                        <span className={`assistant-capability-pill ${row.allowed ? 'on' : ''}`}>
                          {row.allowed ? 'Injects' : 'No injection'}
                        </span>
                      </span>
                      <span className="assistant-capability-desc">{row.description}</span>
                      <span className="assistant-capability-meta">
                        {row.injectable ? 'Ready for prompt injection' : row.reason}
                      </span>
                      {row.path && <span className="assistant-capability-path">{row.path}</span>}
                    </span>
                    <button
                      className={`compact-toggle ${row.allowed ? 'active' : ''}`}
                      type="button"
                      onClick={() => togglePromptPluginInjection(row)}
                      disabled={disabled}
                      title={disabled ? disabledReason : `${row.allowed ? 'Disallow' : 'Allow'} prompt injection for ${row.name}`}
                      aria-label={`${row.allowed ? 'Disallow' : 'Allow'} prompt injection for ${row.name}`}
                      aria-pressed={row.allowed}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function AssistantMemoryPane({ workingDir }: { workingDir?: string | null }) {
  const [memory, setMemory] = useState<api.ProjectMemoryInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(workingDir));
  const [message, setMessage] = useState('');
  const memoryLoadSeq = useRef(0);
  const entries = useMemo(() => buildAssistantMemoryEntries(memory), [memory]);

  const loadProjectMemory = useCallback(async () => {
    const requestId = memoryLoadSeq.current + 1;
    memoryLoadSeq.current = requestId;
    if (!workingDir) {
      setMemory(null);
      setMessage('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const nextMemory = await api.getProjectMemory(workingDir);
      if (requestId !== memoryLoadSeq.current) return;
      setMemory(nextMemory);
    } catch (err: any) {
      if (requestId !== memoryLoadSeq.current) return;
      setMemory(null);
      setMessage(err?.message || 'Could not load project memory.');
    } finally {
      if (requestId === memoryLoadSeq.current) setLoading(false);
    }
  }, [workingDir]);

  const refresh = useCallback(() => {
    void loadProjectMemory();
  }, [loadProjectMemory]);

  useEffect(() => {
    void loadProjectMemory();
    return () => { memoryLoadSeq.current += 1; };
  }, [loadProjectMemory]);

  return (
    <>
      <PaneTitle>Memory</PaneTitle>
      <PaneDesc>Live project memory for the active workspace. These notes are treated as untrusted context when used in prompts.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div className="settings-section-header">
          <div>
            <div className="settings-section-title">Project Memory Inventory</div>
            <div className="settings-item-desc">
              {workingDir ? workingDir : 'Open a folder to inspect project memory.'}
            </div>
          </div>
          <button className="settings-mini-button" type="button" onClick={refresh} disabled={loading || !workingDir} aria-label="Refresh project memory inventory">
            {loading ? <Loader size={11} className="spin" aria-hidden="true" /> : <RefreshCw size={11} aria-hidden="true" />}
            Refresh
          </button>
        </div>
        {!workingDir ? (
          <div className="settings-item-desc" role="status">Open a folder to view project memory inventory.</div>
        ) : loading ? (
          <div className="settings-item-desc" role="status">Loading project memory...</div>
        ) : message ? (
          <div className="settings-item-desc" role="alert">{message}</div>
        ) : (
        <div className="assistant-capability-list" role="list" aria-label={`${entries.length} project memory inventor${entries.length === 1 ? 'y' : 'ies'}`}>
          {entries.map((entry) => {
            const Icon = memoryTypeIcons[entry.type] || Brain;
            return (
              <div key={entry.id} className="assistant-capability-row" role="listitem" aria-label={`${entry.name}: ${entry.description}`}>
                <span className="assistant-capability-icon"><Icon size={14} aria-hidden="true" /></span>
                <span className="assistant-capability-main">
                  <span className="assistant-capability-title-row">
                    <span className="assistant-capability-name">{entry.name}</span>
                    <span className="assistant-capability-pill on">Live</span>
                  </span>
                  <span className="assistant-capability-desc">{entry.description}</span>
                  {entry.path && <span className="assistant-capability-path">{entry.path}</span>}
                  {entry.lastAccessed && (
                    <span className="assistant-capability-meta">Updated {entry.lastAccessed.toLocaleString()}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </>
  );
}
