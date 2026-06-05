import { useState, useRef, useEffect } from 'react';
import {
  Wifi, WifiOff, ChevronUp, Cpu, Zap, Brain, DollarSign,
  Check, Search, Shield, Settings,
} from 'lucide-react';
import { estimateModelCost } from '../utils/api';

interface ModelOption {
  id: string;
  name: string;
  providerName: string;
  contextWindow: number;
}

interface Props {
  activeModel: string;
  providerName: string;
  connected: boolean;
  messageCount: number;
  workingDir: string | null;
  models: ModelOption[];
  trustMode: string;
  enabledToolCount?: number;
  onModelChange: (modelId: string) => void;
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

export function StatusBar({ activeModel, providerName, connected, messageCount, workingDir, models, trustMode, enabledToolCount, onModelChange, onTrustModeChange, runningModel, onOpenSettings }: Props) {
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [trustPickerOpen, setTrustPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pickerPos, setPickerPos] = useState<{ left: number; bottom: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const trustRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelPickerOpen && !trustPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (modelPickerOpen && pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
        setSearchQuery('');
      }
      if (trustPickerOpen && trustRef.current && !trustRef.current.contains(e.target as Node)) {
        setTrustPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelPickerOpen, trustPickerOpen]);

  const filtered = models.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.providerName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const hasSearch = searchQuery.trim().length > 0;
  const pickerModels = [
    { id: AUTO_MODEL_ID, name: AUTO_MODEL_LABEL, providerName: 'Router', contextWindow: 0 },
    ...filtered,
  ];

  const grouped = new Map<string, ModelOption[]>();
  for (const m of pickerModels) {
    const list = grouped.get(m.providerName) || [];
    list.push(m);
    grouped.set(m.providerName, list);
  }

  const currentModel = models.find(m => m.id === activeModel);
  const isAuto = activeModel === AUTO_MODEL_ID;
  const autoModelLabel = runningModel ? `Auto · ${runningModel}` : 'Auto';
  const trustColor = TRUST_COLORS[trustMode] || '#6b7280';
  const trustLabel = TRUST_LABELS[trustMode] || trustMode;

  return (
    <div className="status-bar">
      {/* Connection status */}
      <div className="status-bar-item status-bar-connection">
        {connected ? (
          <Wifi size={12} style={{ color: 'var(--accent-success)' }} />
        ) : (
          <WifiOff size={12} style={{ color: 'var(--accent-error)' }} />
        )}
        {connected ? 'Provider connected' : 'No model provider'}
      </div>

      <div className="status-bar-separator" />

      {/* Trust mode badge */}
      <div ref={trustRef} style={{ position: 'relative' }}>
        <button
          className="status-bar-item"
          onClick={() => { setTrustPickerOpen(!trustPickerOpen); setModelPickerOpen(false); }}
          style={{ cursor: 'pointer', gap: 4, display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: 'inherit', fontSize: 'inherit', padding: 0 }}
        >
          <Shield size={12} style={{ color: trustColor }} />
          <span style={{ color: trustColor, fontWeight: 600 }}>{trustLabel}</span>
          {enabledToolCount != null && (
            <span style={{ fontSize: 10, opacity: 0.6 }}>({enabledToolCount} tools)</span>
          )}
        </button>

        {trustPickerOpen && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
            borderRadius: 6, padding: 4, minWidth: 200, zIndex: 1000,
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
          </div>
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

        {modelPickerOpen && pickerPos && (
          <div
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
              {Array.from(grouped.entries()).map(([provider, providerModels]) => (
                <div key={provider} className="model-picker-group">
                  <div className="model-picker-group-label">{provider}</div>
                  {providerModels.map(m => (
                    <button
                      key={m.id}
                      className={`model-picker-item ${m.id === activeModel ? 'active' : ''}`}
                      onClick={() => { onModelChange(m.id); setModelPickerOpen(false); setSearchQuery(''); }}
                    >
                      <span className="model-picker-item-name">{m.name}</span>
                      {!!m.contextWindow && <span className="model-picker-item-ctx">{formatContext(m.contextWindow)}</span>}
                      {m.id === activeModel && <Check size={14} className="model-picker-item-check" />}
                    </button>
                  ))}
                </div>
              ))}
              {hasSearch && filtered.length === 0 && (
                <div className="model-picker-empty">No models found</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="status-bar-separator" />

      {/* Provider */}
      <div className="status-bar-item">
        <Zap size={12} />
        {providerName || (isAuto ? 'Router' : 'No provider')}
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
        // Rough estimate: ~500 input tokens + ~200 output tokens per message
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
