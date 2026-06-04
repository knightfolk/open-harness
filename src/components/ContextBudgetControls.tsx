import { useState, useEffect } from 'react';
import * as api from '../utils/api';

export function ContextBudgetControls() {
  const [contextConfig, setContextConfig] = useState<api.ContextConfig>({
    repoMapBudget: 2000,
    contextPackBudget: 3000,
    includePatterns: ['system', 'projectProfile'],
    neverIncludePatterns: [],
    compressToolOutputs: true,
    safetyMargin: 0.05,
    minRecentPairs: 2,
  });
  const [newIncludePattern, setNewIncludePattern] = useState('');
  const [newExcludePattern, setNewExcludePattern] = useState('');

  useEffect(() => {
    api.getConfig().then((cfg) => {
      if (cfg?.contextConfig) {
        setContextConfig(cfg.contextConfig);
      }
    }).catch(() => {});
  }, []);

  const saveCfg = async (updated: api.ContextConfig) => {
    setContextConfig(updated);
    await api.updateConfig({ contextConfig: updated }).catch(() => {});
  };

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Context Budget</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 12 }}>
        Controls how conversation history is compressed within the model token window.
      </div>

      <div className="settings-item">
        <div>
          <div className="settings-item-label">Always-Include Sections</div>
          <div className="settings-item-desc">Section IDs always kept in context</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {contextConfig.includePatterns.map((pat, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, fontSize: 11, background: 'var(--accent-bg, #eef2ff)', color: 'var(--accent-color, #6366f1)' }}>
            {pat}
            <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 13, lineHeight: 1 }}
              onClick={() => saveCfg({ ...contextConfig, includePatterns: contextConfig.includePatterns.filter((_, j) => j !== i) })}>x</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <input placeholder="Section ID" value={newIncludePattern}
          style={{ flex: 1, fontSize: 11, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          onChange={(e) => setNewIncludePattern(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newIncludePattern.trim()) {
              saveCfg({ ...contextConfig, includePatterns: [...contextConfig.includePatterns, newIncludePattern.trim()] });
              setNewIncludePattern('');
            }
          }} />
        <button className="btn btn-secondary btn-small" style={{ fontSize: 11, padding: '3px 8px' }}
          onClick={() => {
            if (!newIncludePattern.trim()) return;
            saveCfg({ ...contextConfig, includePatterns: [...contextConfig.includePatterns, newIncludePattern.trim()] });
            setNewIncludePattern('');
          }}>Add</button>
      </div>

      <div className="settings-item">
        <div>
          <div className="settings-item-label">Never-Include Sections</div>
          <div className="settings-item-desc">Section IDs excluded from context</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {contextConfig.neverIncludePatterns.map((pat, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 12, fontSize: 11, background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
            {pat}
            <button style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 13, lineHeight: 1 }}
              onClick={() => saveCfg({ ...contextConfig, neverIncludePatterns: contextConfig.neverIncludePatterns.filter((_, j) => j !== i) })}>x</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <input placeholder="Section ID to exclude" value={newExcludePattern}
          style={{ flex: 1, fontSize: 11, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          onChange={(e) => setNewExcludePattern(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newExcludePattern.trim()) {
              saveCfg({ ...contextConfig, neverIncludePatterns: [...contextConfig.neverIncludePatterns, newExcludePattern.trim()] });
              setNewExcludePattern('');
            }
          }} />
        <button className="btn btn-secondary btn-small" style={{ fontSize: 11, padding: '3px 8px' }}
          onClick={() => {
            if (!newExcludePattern.trim()) return;
            saveCfg({ ...contextConfig, neverIncludePatterns: [...contextConfig.neverIncludePatterns, newExcludePattern.trim()] });
            setNewExcludePattern('');
          }}>Add</button>
      </div>

      <div className="settings-item" style={{ marginBottom: 4 }}>
        <div><div className="settings-item-label">Repo Map Budget</div><div className="settings-item-desc">Max tokens ({contextConfig.repoMapBudget})</div></div>
        <input type="range" min="500" max="8000" step="500" value={contextConfig.repoMapBudget}
          style={{ width: 120 }} onChange={(e) => saveCfg({ ...contextConfig, repoMapBudget: parseInt(e.target.value) })} />
      </div>
      <div className="settings-item" style={{ marginBottom: 4 }}>
        <div><div className="settings-item-label">Context Pack Budget</div><div className="settings-item-desc">Max tokens ({contextConfig.contextPackBudget})</div></div>
        <input type="range" min="500" max="8000" step="500" value={contextConfig.contextPackBudget}
          style={{ width: 120 }} onChange={(e) => saveCfg({ ...contextConfig, contextPackBudget: parseInt(e.target.value) })} />
      </div>
      <div className="settings-item" style={{ marginBottom: 4 }}>
        <div><div className="settings-item-label">Safety Margin</div><div className="settings-item-desc">{(contextConfig.safetyMargin * 100).toFixed(0)}% reserved</div></div>
        <input type="range" min="0" max="0.2" step="0.01" value={contextConfig.safetyMargin}
          style={{ width: 120 }} onChange={(e) => saveCfg({ ...contextConfig, safetyMargin: parseFloat(e.target.value) })} />
      </div>
      <div className="settings-item" style={{ marginBottom: 4 }}>
        <div><div className="settings-item-label">Compress Tool Outputs</div><div className="settings-item-desc">Shorten tool results to save tokens</div></div>
        <div className={'toggle ' + (contextConfig.compressToolOutputs ? 'active' : '')}
          onClick={() => saveCfg({ ...contextConfig, compressToolOutputs: !contextConfig.compressToolOutputs })} />
      </div>
    </div>
  );
}
