import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Wifi, WifiOff, ChevronUp, Cpu, Brain, DollarSign,
  Check, Search, Shield, Settings, Star, Eye, Wrench, Layers,
} from 'lucide-react';
import { estimateModelCost } from '../utils/api';
import { modelCatalogSummary, modelCatalogTooltip } from '../data/modelCatalog';
import { providerPlanLabel } from '../data/providerPlans';
import { modelCapabilityFlags, modelSupportsThinking, THINKING_EFFORTS } from '../utils/modelCapabilities';
import type { ThinkingEffort } from '../types';

interface ModelOption {
  id: string;
  name: string;
  providerName: string;
  providerId?: string;
  accessMode?: 'api-key' | 'subscription';
  planId?: string;
  contextWindow: number;
}

interface Props {
  activeModel: string;
  providerName: string;
  connected: boolean;
  messageCount: number;
  workingDir: string | null;
  models: ModelOption[];
  activeProviderId?: string;
  activeProviderAccessMode?: 'api-key' | 'subscription';
  activeProviderPlanId?: string;
  thinkingEffort: ThinkingEffort;
  trustMode: string;
  enabledToolCount?: number;
  configuredProviderCount?: number;
  onModelChange: (modelId: string) => void;
  onThinkingEffortChange: (effort: ThinkingEffort) => void;
  favoriteModelIds?: string[];
  onToggleFavoriteModel?: (modelId: string) => void;
  onTrustModeChange?: (mode: string) => void;
  runningModel?: string | null;
  onOpenSettings?: () => void;
}

const AUTO_MODEL_ID = 'Auto';
const AUTO_MODEL_LABEL = 'Auto';

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  return `${Math.round(tokens / 1024)}K`;
}

const TRUST_LABELS: Record<string, string> = {
  'chat-only': 'Chat Only',
  'read-only': 'Read Only',
  'ask-before-write': 'Ask Before Write',
  'workspace-write': 'Workspace',
  'full-local': 'Full Access',
};

const TRUST_COLORS: Record<string, string> = {
  'chat-only': '#6b7280',
  'read-only': '#3b82f6',
  'ask-before-write': '#f59e0b',
  'workspace-write': '#22c55e',
  'full-local': '#ef4444',
};

const ALL_TRUST_MODES = ['chat-only', 'read-only', 'ask-before-write', 'workspace-write', 'full-local'];

export function StatusBar({
  activeModel,
  providerName,
  connected,
  messageCount,
  workingDir,
  models,
  activeProviderId,
  activeProviderAccessMode,
  activeProviderPlanId,
  thinkingEffort,
  trustMode,
  enabledToolCount,
  configuredProviderCount,
  onModelChange,
  onThinkingEffortChange,
  favoriteModelIds,
  onToggleFavoriteModel,
  onTrustModeChange,
  runningModel,
  onOpenSettings,
}: Props) {
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [trustPickerOpen, setTrustPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerPos, setPickerPos] = useState<{ left: number; bottom: number } | null>(null);
  const [trustPickerPos, setTrustPickerPos] = useState<{ left: number; bottom: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const trustRef = useRef<HTMLDivElement>(null);
  const trustBtnRef = useRef<HTMLButtonElement>(null);
  const trustPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelPickerOpen && !trustPickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedModelButton = modelBtnRef.current?.contains(target);
      const clickedModelPicker = pickerPanelRef.current?.contains(target);
      const clickedTrustButton = trustBtnRef.current?.contains(target);
      const clickedTrustPicker = trustPanelRef.current?.contains(target);
      if (modelPickerOpen && !clickedModelButton && !clickedModelPicker) {
        setModelPickerOpen(false);
        setSearchQuery('');
      }
      if (trustPickerOpen && !clickedTrustButton && !clickedTrustPicker) {
        setTrustPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelPickerOpen, trustPickerOpen]);

  const filtered = models.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (modelCatalogSummary(m.id, m.providerName) || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const hasSearch = searchQuery.trim().length > 0;
  const autoModel: ModelOption = { id: AUTO_MODEL_ID, name: AUTO_MODEL_LABEL, providerName: 'Router', contextWindow: 0 };
  const favoriteSet = useMemo(() => new Set(favoriteModelIds || []), [favoriteModelIds]);
  const favoriteModels = filtered.filter((m) => m.id !== AUTO_MODEL_ID && favoriteSet.has(m.id));
  const regularModels = filtered.filter((m) => m.id !== AUTO_MODEL_ID && !favoriteSet.has(m.id));

  const groupModelsByProvider = (list: ModelOption[]) => {
    const grouped = new Map<string, ModelOption[]>();
    for (const m of list) {
      const existing = grouped.get(m.providerName);
      if (existing) existing.push(m);
      else grouped.set(m.providerName, [m]);
    }
    return Array.from(grouped.entries());
  };
  const groupedFavorites = groupModelsByProvider(favoriteModels);
  const groupedRegular = groupModelsByProvider(regularModels);

  const modelGroups: Array<{ label: string; models: ModelOption[] }> = [];
  if (groupedFavorites.length > 0) {
    modelGroups.push({ label: 'Favorites', models: groupedFavorites.flatMap(([_, list]) => list) });
  }
  for (const [provider, providerModels] of groupedRegular) {
    modelGroups.push({ label: provider, models: providerModels });
  }

  const currentModel = models.find(m => m.id === activeModel);
  const isAuto = activeModel === AUTO_MODEL_ID;
  const autoModelLabel = runningModel ? `Auto · ${runningModel}` : 'Auto';
  const configuredProviderNames = Array.from(new Set(models.map((m) => m.providerName).filter((name) => name && name !== 'Unknown')));
  const providerCount = configuredProviderCount ?? configuredProviderNames.length;
  const servingProvider = currentModel?.providerName || providerName;
  const currentProviderId = currentModel?.providerId || activeProviderId;
  const supportsThinking = modelSupportsThinking(activeModel, currentProviderId);
  const capabilityFlags = modelCapabilityFlags(activeModel, currentProviderId);
  const connectionLabel = connected
    ? isAuto
      ? `Router ready · ${providerCount || 0} provider${providerCount === 1 ? '' : 's'}`
      : `Serving: ${servingProvider || 'Unknown provider'}`
    : 'No provider configured';
  const connectionTitle = connected
    ? isAuto
      ? `Auto routes each request across ${providerCount || 0} configured provider${providerCount === 1 ? '' : 's'}.`
      : `${servingProvider || 'Unknown provider'} is serving ${activeModel}.`
    : 'Add a configured model provider in Settings.';
  const trustColor = TRUST_COLORS[trustMode] || '#6b7280';
  const trustLabel = TRUST_LABELS[trustMode] || trustMode;

  return (
    <div className="status-bar">
      {/* Connection status */}
      <div className="status-bar-item status-bar-connection" title={connectionTitle}>
        {connected ? (
          <Wifi size={12} style={{ color: 'var(--accent-success)' }} />
        ) : (
          <WifiOff size={12} style={{ color: 'var(--accent-error)' }} />
        )}
        {connectionLabel}
      </div>

      <div className="status-bar-separator" />

      {/* Trust mode badge */}
      <div ref={trustRef} style={{ position: 'relative' }}>
        <button
          ref={trustBtnRef}
          className="status-bar-item"
          onClick={() => {
            const nextOpen = !trustPickerOpen;
            setTrustPickerOpen(nextOpen);
            setModelPickerOpen(false);
            setSearchQuery('');
            if (nextOpen && trustBtnRef.current) {
              // Match the model picker: anchor above the status button in a
              // portal so the menu stays above the chat input.
              const rect = trustBtnRef.current.getBoundingClientRect();
              setTrustPickerPos({ left: rect.left, bottom: window.innerHeight - rect.top + 6 });
            }
          }}
          style={{ cursor: 'pointer', gap: 4, display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: 'inherit', fontSize: 'inherit', padding: 0 }}
        >
          <Shield size={12} style={{ color: trustColor }} />
          <span style={{ color: trustColor, fontWeight: 600 }}>{trustLabel}</span>
          {enabledToolCount != null && (
            <span style={{ fontSize: 10, opacity: 0.6 }}>({enabledToolCount} tools)</span>
          )}
        </button>

        {trustPickerOpen && trustPickerPos && createPortal(
          <div ref={trustPanelRef} style={{
            position: 'fixed', left: trustPickerPos.left, bottom: trustPickerPos.bottom,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 6, padding: 4, minWidth: 200, zIndex: 20001,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Trust Mode
            </div>
            {ALL_TRUST_MODES.map(mode => (
              <button
                key={mode}
                onClick={() => { onTrustModeChange?.(mode); setTrustPickerOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '6px 8px', border: 'none', borderRadius: 4,
                  background: mode === trustMode ? 'rgba(99,102,241,0.15)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: TRUST_COLORS[mode], flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: mode === trustMode ? 600 : 400, color: 'var(--text-primary)' }}>
                    {TRUST_LABELS[mode]}
                    {mode === trustMode && <Check size={12} style={{ marginLeft: 4, display: 'inline', color: 'var(--accent-primary)' }} />}
                  </div>
                </div>
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>

      <div className="status-bar-separator" />

      {onOpenSettings && (
        <>
          <button
            className="status-bar-item status-bar-settings-btn"
            type="button"
            onClick={onOpenSettings}
            title="Open settings"
            aria-label="Open settings"
          >
            <Settings size={12} />
          </button>
          <div className="status-bar-separator" />
        </>
      )}

      {/* Model switcher */}
      <div ref={pickerRef} style={{ position: 'relative' }}>
        <button
          ref={modelBtnRef}
          className={`status-bar-item status-bar-model-btn ${isAuto ? 'status-bar-model-btn-auto' : ''}`}
          title={isAuto ? 'Auto: route each request to the best configured candidate model.' : modelCatalogTooltip(activeModel, providerName)}
          onClick={() => {
            const nextOpen = !modelPickerOpen;
            setModelPickerOpen(nextOpen);
            setTrustPickerOpen(false);
            if (nextOpen && modelBtnRef.current) {
              // Anchor the floating picker above the button so it escapes
              // any overflow-hidden ancestor in the chat panel column.
              const rect = modelBtnRef.current.getBoundingClientRect();
              setPickerPos({ left: rect.left, bottom: window.innerHeight - rect.top + 6 });
            }
          }}
        >
          {isAuto ? <span className="status-bar-auto-dot" aria-hidden="true" /> : <Cpu size={12} />}
          <span className="status-bar-model-name">{isAuto ? autoModelLabel : activeModel}</span>
          {currentModel && (
            <span className="status-bar-model-ctx">{formatContext(currentModel.contextWindow)}</span>
          )}
          <ChevronUp size={10} style={{ transform: modelPickerOpen ? 'rotate(0)' : 'rotate(180deg)', transition: 'transform 0.15s' }} />
        </button>

        {modelPickerOpen && pickerPos && createPortal(
          <div
            ref={pickerPanelRef}
            className="model-picker"
            style={{ position: 'fixed', left: pickerPos.left, bottom: pickerPos.bottom, zIndex: 20001 }}
          >
            <div className="model-picker-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="model-picker-list">
              <div className="model-picker-group">
                <div className="model-picker-group-label">Router</div>
                <button
                  key={autoModel.id}
                  className={`model-picker-item ${autoModel.id === activeModel ? 'active' : ''}`}
                  onClick={() => { onModelChange(autoModel.id); setModelPickerOpen(false); setSearchQuery(''); }}
                  title="Route each request through configured Auto-Router candidates."
                >
                  <span className="model-picker-item-main">
                    <span className="model-picker-item-name">{autoModel.name}</span>
                    <span className="model-picker-item-desc">Route each request through configured Auto-Router candidates.</span>
                  </span>
                  {autoModel.contextWindow ? <span className="model-picker-item-ctx">{formatContext(autoModel.contextWindow)}</span> : null}
                  {autoModel.id === activeModel && <Check size={14} className="model-picker-item-check" />}
                </button>
              </div>
              {modelGroups.map(({ label, models: providerModels }) => (
                <div key={label} className="model-picker-group">
                  <div className="model-picker-group-label">{label}</div>
                  {providerModels.map((m) => {
                    const isFavorite = favoriteSet.has(m.id);
                    const description = modelCatalogSummary(m.id, m.providerName);
                    const rowTitle = m.id === AUTO_MODEL_ID ? '' : modelCatalogTooltip(m.id, m.providerName);
                    const rowLabel = `${m.providerName} • ${m.id}`;
                    return (
                      <button
                        key={`${m.providerName}:${m.id}`}
                        className={`model-picker-item ${m.id === activeModel ? 'active' : ''}`}
                        onClick={() => { onModelChange(m.id); setModelPickerOpen(false); setSearchQuery(''); }}
                        title={rowTitle || rowLabel}
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          aria-pressed={isFavorite}
                          className="model-picker-favorite-btn"
                          title={isFavorite ? `Unfavorite ${m.id}` : `Favorite ${m.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleFavoriteModel?.(m.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onToggleFavoriteModel?.(m.id);
                            }
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                          }}
                        >
                          {isFavorite ? <Star size={14} fill="currentColor" color="var(--accent-primary)" /> : <Star size={14} />}
                        </span>
                        <span className="model-picker-item-main">
                          <span className="model-picker-item-name">{m.name}</span>
                          {description && <span className="model-picker-item-desc">{description}</span>}
                        </span>
                        {!!m.contextWindow && <span className="model-picker-item-ctx">{formatContext(m.contextWindow)}</span>}
                        {m.id === activeModel && <Check size={14} className="model-picker-item-check" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {hasSearch && filtered.length === 0 && (
                <div className="model-picker-empty">No models found</div>
              )}
            </div>
          </div>,
          document.body,
        )}
      </div>

      <div className="status-bar-separator" />

      {supportsThinking && (
        <>
          <div className="status-bar-item" title="Thinking effort">
            <Brain size={12} />
            <select
              value={thinkingEffort}
              onChange={(e) => onThinkingEffortChange(e.target.value as ThinkingEffort)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
                padding: 0,
                outline: 'none',
                cursor: 'pointer',
              }}
              aria-label="Thinking effort"
            >
              {THINKING_EFFORTS.map((effort) => (
                <option key={effort.id} value={effort.id}>{effort.label}</option>
              ))}
            </select>
          </div>
          <div className="status-bar-separator" />
        </>
      )}

      {/* Model abilities */}
      <div className="status-bar-item" title="Model abilities" aria-label="Model abilities">
        {[
          { id: 'thinking', label: 'Thinking', active: capabilityFlags.thinking, icon: Brain },
          { id: 'vision', label: 'Vision', active: capabilityFlags.vision, icon: Eye },
          { id: 'tools', label: 'Tools', active: capabilityFlags.tools, icon: Wrench },
          { id: 'context', label: 'Long context', active: capabilityFlags.longContext, icon: Layers },
        ].map(({ id, label, active, icon: Icon }) => (
          <span
            key={id}
            title={active ? label : `${label} not detected`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              color: active ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              opacity: active ? 1 : 0.45,
            }}
          >
            <Icon size={12} />
          </span>
        ))}
      </div>

      {/* Working dir */}
      {workingDir && (
        <>
          <div className="status-bar-separator" />
          <div className="status-bar-item status-bar-path">
            {workingDir.split('/').pop()}
          </div>
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Cost estimate */}
      {(() => {
        const activeProvider = models.find((m) => m.id === activeModel) || (
          activeModel.toLowerCase() === 'auto'
            ? undefined
            : models.find((m) => m.providerName === servingProvider)
        );
        const accessMode = activeProvider?.accessMode || 'api-key';
        if (isAuto) {
          const activeProviderLabel = activeProviderAccessMode
            ? providerPlanLabel(activeProviderId, activeProviderPlanId, activeProvider?.providerName || providerName)
            : null;
          if (activeProviderAccessMode === 'subscription' || accessMode === 'subscription') {
            return (
              <div className="status-bar-item" title={`Billing mode: subscription${activeProviderLabel ? ` (${activeProviderLabel})` : ''}`}>
                <DollarSign size={12} />
                Subscription{activeProviderLabel ? ` · ${activeProviderLabel}` : ''}
              </div>
            );
          }
        }

        if (accessMode === 'subscription') {
          const planLabel = providerPlanLabel(
            activeProvider?.providerId || activeProviderId,
            activeProvider?.planId || activeProviderPlanId,
            activeProvider?.providerName || providerName,
          );
          return (
            <div className="status-bar-item" title={`Billing mode: subscription${planLabel ? ` (${planLabel})` : ''}`}>
              <DollarSign size={12} />
              Subscription · {planLabel}
            </div>
          );
        }

        // Rough estimate: ~300 input tokens + ~150 output tokens per message
        const est = estimateModelCost(activeModel, messageCount * 300, messageCount * 150);
        if (!est || est.total < 0.001) return null;
        const label = est.total < 0.01 ? '< $0.01' : `~$${est.total.toFixed(2)}`;
        return (
          <div className="status-bar-item" title={`Est. cost: $${est.total.toFixed(4)} (${messageCount} msgs)`}>
            <DollarSign size={12} />
            {label}
          </div>
        );
      })()}

      <div className="status-bar-separator" />

      {/* Message count */}
      <div className="status-bar-item">
        <Brain size={12} />
        {messageCount} messages
      </div>
    </div>
  );
}
