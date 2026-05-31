import { useState, useRef, useEffect } from 'react';
import {
  Wifi, WifiOff, ChevronUp, Cpu, Zap, Brain,
  Check, Search,
} from 'lucide-react';

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
  onModelChange: (modelId: string) => void;
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  return `${Math.round(tokens / 1024)}K`;
}

export function StatusBar({ activeModel, providerName, connected, messageCount, workingDir, models, onModelChange }: Props) {
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelPickerOpen]);

  const filtered = models.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.providerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by provider
  const grouped = new Map<string, ModelOption[]>();
  for (const m of filtered) {
    const list = grouped.get(m.providerName) || [];
    list.push(m);
    grouped.set(m.providerName, list);
  }

  const currentModel = models.find(m => m.id === activeModel);

  return (
    <div className="status-bar">
      {/* Connection status */}
      <div className="status-bar-item status-bar-connection">
        {connected ? (
          <Wifi size={12} style={{ color: 'var(--accent-success)' }} />
        ) : (
          <WifiOff size={12} style={{ color: 'var(--accent-error)' }} />
        )}
        {connected ? 'Connected' : 'Offline'}
      </div>

      <div className="status-bar-separator" />

      {/* Model switcher */}
      <div ref={pickerRef} style={{ position: 'relative' }}>
        <button
          className="status-bar-item status-bar-model-btn"
          onClick={() => setModelPickerOpen(!modelPickerOpen)}
        >
          <Cpu size={12} />
          <span className="status-bar-model-name">{activeModel}</span>
          {currentModel && (
            <span className="status-bar-model-ctx">{formatContext(currentModel.contextWindow)}</span>
          )}
          <ChevronUp size={10} style={{ transform: modelPickerOpen ? 'rotate(0)' : 'rotate(180deg)', transition: 'transform 0.15s' }} />
        </button>

        {modelPickerOpen && (
          <div className="model-picker">
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
              {Array.from(grouped.entries()).map(([provider, models]) => (
                <div key={provider} className="model-picker-group">
                  <div className="model-picker-group-label">{provider}</div>
                  {models.map(m => (
                    <button
                      key={m.id}
                      className={`model-picker-item ${m.id === activeModel ? 'active' : ''}`}
                      onClick={() => { onModelChange(m.id); setModelPickerOpen(false); setSearchQuery(''); }}
                    >
                      <span className="model-picker-item-name">{m.name}</span>
                      <span className="model-picker-item-ctx">{formatContext(m.contextWindow)}</span>
                      {m.id === activeModel && <Check size={14} className="model-picker-item-check" />}
                    </button>
                  ))}
                </div>
              ))}
              {filtered.length === 0 && (
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
        {providerName || 'No provider'}
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

      {/* Message count */}
      <div className="status-bar-item">
        <Brain size={12} />
        {messageCount} messages
      </div>
    </div>
  );
}
