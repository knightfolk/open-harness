import { useState, useEffect, useCallback } from 'react';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
  models: Array<{ id: string; name: string }>;
}

export function ModelLabPanel({ workingDir, models }: Props) {
  const [prompts, setPrompts] = useState<api.PromptCase[]>([]);
  const [reports, setReports] = useState<api.EvalReportSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<api.EvalReport | null>(null);
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [runName, setRunName] = useState('');
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [tab, setTab] = useState<'configure' | 'results' | 'history'>('configure');
  const [loading, setLoading] = useState(true);

  // Load prompts and reports
  useEffect(() => {
    (async () => {
      try {
        const [p, r] = await Promise.all([api.getEvalPrompts(), api.getEvalReports()]);
        setPrompts(p);
        setReports(r);
      } catch (err) {
        console.error('Failed to load eval data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Poll active run
  useEffect(() => {
    if (!activeRunId) return;
    const interval = setInterval(async () => {
      try {
        const report = await api.getEvalReport(activeRunId);
        setSelectedReport(report);
        if (report.status === 'complete') {
          setRunning(false);
          setActiveRunId(null);
          // Refresh reports list
          const r = await api.getEvalReports();
          setReports(r);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeRunId]);

  const togglePrompt = useCallback((id: string) => {
    setSelectedPromptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleModel = useCallback((id: string) => {
    setSelectedModelIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAllPrompts = useCallback(() => {
    setSelectedPromptIds(new Set(prompts.map(p => p.id)));
  }, [prompts]);

  const selectAllModels = useCallback(() => {
    setSelectedModelIds(new Set(models.map(m => m.id)));
  }, [models]);

  const handleRun = useCallback(async () => {
    if (selectedPromptIds.size === 0 || selectedModelIds.size === 0) return;
    setRunning(true);
    setTab('results');
    try {
      const result = await api.runEval({
        name: runName || `Eval ${new Date().toLocaleDateString()}`,
        promptIds: Array.from(selectedPromptIds),
        modelIds: Array.from(selectedModelIds),
        workingDir: workingDir || undefined,
      });
      setActiveRunId(result.id);
      // Load initial report
      const report = await api.getEvalReport(result.id);
      setSelectedReport(report);
    } catch (err) {
      console.error('Eval run failed:', err);
      setRunning(false);
    }
  }, [selectedPromptIds, selectedModelIds, runName, workingDir]);

  const handleSelectReport = useCallback(async (id: string) => {
    try {
      const report = await api.getEvalReport(id);
      setSelectedReport(report);
      setTab('results');
    } catch { /* ignore */ }
  }, []);

  const categories = [...new Set(prompts.map(p => p.category))];

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Loading prompts...
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          Model Lab
        </span>
        <button onClick={() => setTab('configure')} style={tabBtnStyle(tab === 'configure')}>Configure</button>
        <button onClick={() => setTab('results')} style={tabBtnStyle(tab === 'results')}>Results</button>
        <button onClick={() => setTab('history')} style={tabBtnStyle(tab === 'history')}>History</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'configure' && (
          <div style={{ padding: 10 }}>
            {/* Run name */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Run Name
              </label>
              <input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder={`Eval ${new Date().toLocaleDateString()}`}
                style={{
                  width: '100%', marginTop: 4, padding: '6px 8px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                  borderRadius: 4, color: 'var(--text-primary)', fontSize: 12,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Prompt Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Prompts ({selectedPromptIds.size} selected)
                </label>
                <button onClick={selectAllPrompts} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 10, cursor: 'pointer' }}>
                  Select all
                </button>
              </div>
              {categories.map(cat => (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'capitalize' }}>{cat}</div>
                  {prompts.filter(p => p.category === cat).map(p => (
                    <label key={p.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      padding: '4px 6px', marginBottom: 2, borderRadius: 4,
                      background: selectedPromptIds.has(p.id) ? 'rgba(99,102,241,0.1)' : 'transparent',
                      cursor: 'pointer', fontSize: 12,
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedPromptIds.has(p.id)}
                        onChange={() => togglePrompt(p.id)}
                        style={{ marginTop: 2 }}
                      />
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 1 }}>{p.prompt.slice(0, 80)}...</div>
                      </div>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            {/* Model Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Models ({selectedModelIds.size} selected)
                </label>
                <button onClick={selectAllModels} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 10, cursor: 'pointer' }}>
                  Select all
                </button>
              </div>
              {models.map(m => (
                <label key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 6px', marginBottom: 2, borderRadius: 4,
                  background: selectedModelIds.has(m.id) ? 'rgba(99,102,241,0.1)' : 'transparent',
                  cursor: 'pointer', fontSize: 12,
                }}>
                  <input
                    type="checkbox"
                    checked={selectedModelIds.has(m.id)}
                    onChange={() => toggleModel(m.id)}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                </label>
              ))}
            </div>

            {/* Run button */}
            <button
              onClick={handleRun}
              disabled={running || selectedPromptIds.size === 0 || selectedModelIds.size === 0}
              style={{
                width: '100%', padding: '10px 16px', fontSize: 13, fontWeight: 600,
                background: running || selectedPromptIds.size === 0 || selectedModelIds.size === 0 ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                color: running || selectedPromptIds.size === 0 || selectedModelIds.size === 0 ? 'var(--text-tertiary)' : '#fff',
                border: 'none', borderRadius: 6, cursor: running ? 'wait' : 'pointer',
              }}
            >
              {running ? 'Running...' : `Run Eval (${selectedPromptIds.size} prompts × ${selectedModelIds.size} models = ${selectedPromptIds.size * selectedModelIds.size} runs)`}
            </button>
          </div>
        )}

        {tab === 'results' && (
          <div style={{ padding: 10 }}>
            {!selectedReport ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
                No results yet. Configure and run an eval to see results here.
              </div>
            ) : (
              <>
                {/* Report header */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedReport.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {selectedReport.status === 'running'
                      ? `Running... ${selectedReport.completed}/${selectedReport.total} completed`
                      : `Completed ${selectedReport.completed} runs`}
                    {selectedReport.completedAt && ` · ${new Date(selectedReport.completedAt).toLocaleTimeString()}`}
                  </div>
                  {selectedReport.status === 'running' && (
                    <div style={{
                      height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, marginTop: 6, overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', background: 'var(--accent-primary)', borderRadius: 2,
                        width: `${selectedReport.total > 0 ? (selectedReport.completed / selectedReport.total * 100) : 0}%`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  )}
                </div>

                {/* Summary */}
                {selectedReport.summary && (
                  <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                      Summary
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {Object.entries(selectedReport.summary.byModel).map(([modelId, data]) => (
                        <div key={modelId} style={{
                          padding: 6, background: 'var(--bg-tertiary)', borderRadius: 4,
                          border: modelId === selectedReport.summary?.bestModel ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {modelId} {modelId === selectedReport.summary?.bestModel && '👑'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                            Score: <span style={{ color: 'var(--accent-success)' }}>{data.avgScore}/10</span>
                            {' · '}Latency: {(data.avgLatencyMs / 1000).toFixed(1)}s
                            {' · '}Tools: {data.avgToolCount}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Recommendations */}
                    {selectedReport.summary.recommendations.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 4 }}>Recommendations</div>
                        {selectedReport.summary.recommendations.slice(0, 4).map(r => (
                          <div key={r.role} style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                            <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{r.role}</span>: {r.modelId} — {r.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Per-result table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <th style={thStyle}>Model</th>
                      <th style={thStyle}>Prompt</th>
                      <th style={thStyle}>Score</th>
                      <th style={thStyle}>Latency</th>
                      <th style={thStyle}>Tools</th>
                      <th style={thStyle}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <td style={tdStyle}>{r.modelId}</td>
                        <td style={tdStyle}>{r.promptName}</td>
                        <td style={{ ...tdStyle, color: r.scores.overallScore >= 7 ? 'var(--accent-success)' : r.scores.overallScore >= 4 ? 'var(--accent-warning)' : 'var(--accent-error)' }}>
                          {r.scores.overallScore}/10
                        </td>
                        <td style={tdStyle}>{(r.wallMs / 1000).toFixed(1)}s</td>
                        <td style={tdStyle}>{r.toolCallCount}</td>
                        <td style={{ ...tdStyle, color: r.status === 'ok' ? 'var(--accent-success)' : 'var(--accent-error)' }}>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div style={{ padding: 10 }}>
            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
                No eval runs yet.
              </div>
            ) : (
              reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(r => (
                <div
                  key={r.id}
                  onClick={() => handleSelectReport(r.id)}
                  style={{
                    padding: '8px 10px', marginBottom: 4, borderRadius: 6,
                    background: 'var(--bg-secondary)', cursor: 'pointer',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                    <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 3,
                      background: r.status === 'complete' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      color: r.status === 'complete' ? 'var(--accent-success)' : 'var(--accent-warning)',
                    }}>
                      {r.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {r.total} runs · {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--accent-primary)' : 'none',
    color: active ? '#fff' : 'var(--text-tertiary)',
    border: active ? 'none' : '1px solid var(--border-primary)',
    borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer',
  };
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '4px 6px', color: 'var(--text-tertiary)',
  fontWeight: 600, fontSize: 10,
};

const tdStyle: React.CSSProperties = {
  padding: '4px 6px', color: 'var(--text-secondary)',
};
