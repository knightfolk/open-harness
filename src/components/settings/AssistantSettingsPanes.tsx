import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
import type { MemoryEntry } from '../../types';
import * as api from '../../utils/api';

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
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const isSkills = kind === 'skills';
  const items = registry?.[kind] || [];
  const enabledCount = items.filter((item) => item.enabled).length;

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setRegistry(await api.getCapabilities(workingDir));
    } catch (err: any) {
      setMessage(err?.message || 'Could not load capabilities.');
    } finally {
      setLoading(false);
    }
  }, [workingDir]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage('');
    api.getCapabilities(workingDir)
      .then((next) => {
        if (!cancelled) setRegistry(next);
      })
      .catch((err) => {
        if (!cancelled) setMessage(err?.message || 'Could not load capabilities.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workingDir]);

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
    </>
  );
}

export function AssistantMemoryPane({ entries }: { entries: MemoryEntry[] }) {
  return (
    <>
      <PaneTitle>Memory</PaneTitle>
      <PaneDesc>Demo memory examples. Live Codex memory inventory is not wired into this Settings pane yet.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div className="settings-section-header">
          <div className="settings-section-title">Demo Memory</div>
        </div>
        <div className="assistant-capability-list">
          {entries.map((entry) => {
            const Icon = memoryTypeIcons[entry.type] || Brain;
            return (
              <div key={entry.id} className="assistant-capability-row">
                <span className="assistant-capability-icon"><Icon size={14} /></span>
                <span className="assistant-capability-main">
                  <span className="assistant-capability-name">{entry.name}</span>
                  <span className="assistant-capability-desc">{entry.description}</span>
                  {entry.path && <span className="assistant-capability-path">{entry.path}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
