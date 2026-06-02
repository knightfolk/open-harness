import { useState, useEffect, useCallback } from 'react';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
  models: Array<{ id: string; name: string }>;
}

export function ModelLabPanel({ workingDir, models }: Props) {
  const [prompts, setPrompts] = useState<api.PromptCase[]>([]);
  const [reports, setReports] = useState<api.EvalReportSummary[]>([]);
  const [tasks, setTasks] = useState<api.HarnessTask[]>([]);
  const [, setSuites] = useState<api.TaskSuite[]>([]);
  const [benchRuns, setBenchRuns] = useState<api.BenchRunSummary[]>([]);
  const [selectedReport, setSelectedReport] = useState<api.EvalReport | null>(null);
  const [selectedBenchRun, setSelectedBenchRun] = useState<api.BenchRun | null>(null);
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [runName, setRunName] = useState('');
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeBenchId, setActiveBenchId] = useState<string | null>(null);
  const [tab, setTab] = useState<'configure' | 'results' | 'history' | 'tasks' | 'bench'>('configure');
  const [loading, setLoading] = useState(true);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [p, r, t, s, b] = await Promise.all([
          api.getEvalPrompts(),
          api.getEvalReports(),
          api.getTasks().catch(() => []),
          api.getTaskSuites().catch(() => []),
          api.getBenchRuns().catch(() => []),
        ]);
        setPrompts(p);
        setReports(r);
        setTasks(t);
        setSuites(s);
        setBenchRuns(b);
      } catch (err) {
        console.error('Failed to load Model Lab data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Poll active eval run
  useEffect(() => {
    if (!activeRunId) return;
    const interval = setInterval(async () => {
      try {
        const report = await api.getEvalReport(activeRunId);
        setSelectedReport(report);
        if (report.status === 'complete') {
          setRunning(false);
          setActiveRunId(null);
          setReports(await api.getEvalReports());
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeRunId]);

  // Poll active bench run
  useEffect(() => {
    if (!activeBenchId) return;
    const interval = setInterval(async () => {
      try {
        const run = await api.getBenchRun(activeBenchId);
        setSelectedBenchRun(run);
        if (run.status === 'complete') {
          setRunning(false);
          setActiveBenchId(null);
          setBenchRuns(await api.getBenchRuns());
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeBenchId]);

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

  const toggleTask = useCallback((id: string) => {
    setSelectedTaskIds(prev => {
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

  const selectAllTasks = useCallback(() => {
    setSelectedTaskIds(new Set(tasks.map(t => t.id)));
  }, [tasks]);

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
      const report = await api.getEvalReport(result.id);
      setSelectedReport(report);
    } catch (err) {
      console.error('Eval run failed:', err);
      setRunning(false);
    }
  }, [selectedPromptIds, selectedModelIds, runName, workingDir]);

  const handleBenchRun = useCallback(async () => {
    if (selectedTaskIds.size === 0 || selectedModelIds.size === 0) return;
    setRunning(true);
    setTab('bench');
    try {
      const result = await api.runBench({
        name: runName || `Bench ${new Date().toLocaleDateString()}`,
        taskIds: Array.from(selectedTaskIds),
        modelIds: Array.from(selectedModelIds),
        workingDir: workingDir || undefined,
      });
      setActiveBenchId(result.id);
      const run = await api.getBenchRun(result.id);
      setSelectedBenchRun(run);
    } catch (err) {
      console.error('Bench run failed:', err);
      setRunning(false);
    }
  }, [selectedTaskIds, selectedModelIds, runName, workingDir]);

  const handleSeedTasks = useCallback(async () => {
    try {
      await api.seedTasks(workingDir || undefined);
      setTasks(await api.getTasks());
      setSuites(await api.getTaskSuites());
    } catch (err) {
      console.error('Failed to seed tasks:', err);
    }
  }, [workingDir]);

  const handleSelectReport = useCallback(async (id: string) => {
    try {
      const report = await api.getEvalReport(id);
      setSelectedReport(report);
      setTab('results');
    } catch { /* ignore */ }
  }, []);

  const handleSelectBenchRun = useCallback(async (id: string) => {
    try {
      const run = await api.getBenchRun(id);
      setSelectedBenchRun(run);
      setTab('bench');
    } catch { /* ignore */ }
  }, []);

  const categories = [...new Set(prompts.map(p => p.category))];

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
        Loading Model Lab...
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
        <button onClick={() => setTab('configure')} style={tabBtnStyle(tab === 'configure')}>Eval</button>
        <button onClick={() => setTab('tasks')} style={tabBtnStyle(tab === 'tasks')}>Tasks</button>
        <button onClick={() => setTab('bench')} style={tabBtnStyle(tab === 'bench')}>Bench</button>
        <button onClick={() => setTab('results')} style={tabBtnStyle(tab === 'results')}>Results</button>
        <button onClick={() => setTab('history')} style={tabBtnStyle(tab === 'history')}>History</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* ── Eval Configure Tab ── */}
        {tab === 'configure' && (
          <div style={{ padding: 10 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Run Name</label>
              <input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder={`Eval ${new Date().toLocaleDateString()}`}
                style={inputStyle}
              />
            </div>

            {/* Prompt Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={labelStyle}>Prompts ({selectedPromptIds.size} selected)</label>
                <button onClick={selectAllPrompts} style={linkBtnStyle}>Select all</button>
              </div>
              {categories.map(cat => (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'capitalize' }}>{cat}</div>
                  {prompts.filter(p => p.category === cat).map(p => (
                    <label key={p.id} style={checkboxRowStyle(selectedPromptIds.has(p.id))}>
                      <input type="checkbox" checked={selectedPromptIds.has(p.id)} onChange={() => togglePrompt(p.id)} style={{ marginTop: 2 }} />
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
            <ModelSelection models={models} selected={selectedModelIds} onToggle={toggleModel} onSelectAll={selectAllModels} />

            <button
              onClick={handleRun}
              disabled={running || selectedPromptIds.size === 0 || selectedModelIds.size === 0}
              style={runBtnStyle(running || selectedPromptIds.size === 0 || selectedModelIds.size === 0)}
            >
              {running ? 'Running...' : `Run Eval (${selectedPromptIds.size} × ${selectedModelIds.size} = ${selectedPromptIds.size * selectedModelIds.size})`}
            </button>
          </div>
        )}

        {/* ── Tasks Tab ── */}
        {tab === 'tasks' && (
          <div style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                Harness Tasks ({tasks.length})
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSeedTasks} style={smallBtnStyle}>Seed fixtures</button>
              </div>
            </div>

            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
                No tasks yet. Click "Seed fixtures" to create built-in tasks.
              </div>
            ) : (
              <>
                {/* Task selection for bench run */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={labelStyle}>Select tasks for bench ({selectedTaskIds.size})</label>
                    <button onClick={selectAllTasks} style={linkBtnStyle}>Select all</button>
                  </div>
                  {tasks.map(t => (
                    <label key={t.id} style={checkboxRowStyle(selectedTaskIds.has(t.id))}>
                      <input type="checkbox" checked={selectedTaskIds.has(t.id)} onChange={() => toggleTask(t.id)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 12 }}>{t.name}</span>
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 3,
                            background: t.trustMode === 'read-only' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                            color: t.trustMode === 'read-only' ? '#3b82f6' : '#f59e0b',
                          }}>{t.trustMode}</span>
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {t.prompt.slice(0, 80)}...
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {t.tags.map(tag => (
                            <span key={tag} style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>{tag}</span>
                          ))}
                          {t.verificationCommands.length > 0 && (
                            <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                              {t.verificationCommands.length} verify cmd{t.verificationCommands.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {t.rubric.length > 0 && (
                            <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                              {t.rubric.reduce((s, r) => s + r.points, 0)} pts
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Model selection & run */}
                <ModelSelection models={models} selected={selectedModelIds} onToggle={toggleModel} onSelectAll={selectAllModels} />

                <button
                  onClick={handleBenchRun}
                  disabled={running || selectedTaskIds.size === 0 || selectedModelIds.size === 0}
                  style={runBtnStyle(running || selectedTaskIds.size === 0 || selectedModelIds.size === 0)}
                >
                  {running ? 'Running...' : `Run Bench (${selectedTaskIds.size} tasks × ${selectedModelIds.size} models = ${selectedTaskIds.size * selectedModelIds.size})`}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Bench Results Tab ── */}
        {tab === 'bench' && (
          <div style={{ padding: 10 }}>
            {!selectedBenchRun ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
                No bench results yet. Select tasks and run a bench.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedBenchRun.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {selectedBenchRun.status === 'running'
                      ? `Running... ${selectedBenchRun.completed}/${selectedBenchRun.total}`
                      : `${selectedBenchRun.completed} tasks completed`}
                    {selectedBenchRun.completedAt && ` · ${new Date(selectedBenchRun.completedAt).toLocaleTimeString()}`}
                  </div>
                  {selectedBenchRun.status === 'running' && (
                    <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: 'var(--accent-primary)', borderRadius: 2,
                        width: `${selectedBenchRun.total > 0 ? (selectedBenchRun.completed / selectedBenchRun.total * 100) : 0}%`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  )}
                </div>

                {selectedBenchRun.previousDelta && (
                  <BenchDeltaCallout delta={selectedBenchRun.previousDelta} />
                )}

                {/* Bench Summary */}
                {selectedBenchRun.summary && (
                  <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                    <div style={sectionLabelStyle}>Summary</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {Object.entries(selectedBenchRun.summary.byModel).map(([modelId, data]) => (
                        <div key={modelId} style={{
                          padding: 6, background: 'var(--bg-tertiary)', borderRadius: 4,
                          border: modelId === selectedBenchRun.summary?.bestModel ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {modelId} {modelId === selectedBenchRun.summary?.bestModel && '👑'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                            <span style={{ color: '#22c55e' }}>{data.resolved} resolved</span>
                            {' · '}<span style={{ color: '#f59e0b' }}>{data.partial} partial</span>
                            {' · '}<span style={{ color: '#ef4444' }}>{data.unresolved} failed</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            Score: {data.avgScore}/10 · Validation: {data.avgValidationScore}/2 · Latency: {(data.avgLatencyMs / 1000).toFixed(1)}s
                          </div>
                          <StackedScoreBreakdown breakdown={averageBreakdown(selectedBenchRun.results.filter(r => r.modelId === modelId))} />
                        </div>
                      ))}
                    </div>
                    <WeakestSignalCallout results={selectedBenchRun.results} />
                    {selectedBenchRun.summary.regressionFlags.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>
                          ⚠ {selectedBenchRun.summary.regressionFlags.length} regression(s)
                        </div>
                        {selectedBenchRun.summary.regressionFlags.slice(0, 5).map((flag, i) => (
                          <div key={i} style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                            <span style={{ color: 'var(--accent-primary)' }}>{flag.modelId}</span>: {flag.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <PerTaskScoreTable run={selectedBenchRun} />

                {/* Per-result table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <th style={thStyle}>Task</th>
                      <th style={thStyle}>Model</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Score</th>
                      <th style={thStyle}>Breakdown</th>
                      <th style={thStyle}>Weakest</th>
                      <th style={thStyle}>Validation</th>
                      <th style={thStyle}>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBenchRun.results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                        <td style={tdStyle}>{r.taskName}</td>
                        <td style={tdStyle}>{r.modelId}</td>
                        <td style={{ ...tdStyle, color: resolvedColor(r.scores.resolvedStatus) }}>
                          {r.scores.resolvedStatus}
                        </td>
                        <td style={{ ...tdStyle, color: scoreColor(r.scores.overallScore) }}>
                          {r.scores.overallScore}/10
                        </td>
                        <td style={tdStyle}>
                          <StackedScoreBreakdown breakdown={r.scores.breakdown} compact />
                        </td>
                        <td style={tdStyle}>{r.scores.breakdown?.weakestSignal?.label ?? '—'}</td>
                        <td style={{ ...tdStyle, color: r.validationPassed ? '#22c55e' : '#ef4444' }}>
                          {r.validationResults.length > 0 ? (r.validationPassed ? '✓ Pass' : '✗ Fail') : '—'}
                        </td>
                        <td style={tdStyle}>{(r.wallMs / 1000).toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ── Eval Results Tab ── */}
        {tab === 'results' && (
          <div style={{ padding: 10 }}>
            {!selectedReport ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
                No results yet. Configure and run an eval.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedReport.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {selectedReport.status === 'running'
                      ? `Running... ${selectedReport.completed}/${selectedReport.total}`
                      : `${selectedReport.completed} runs`}
                    {selectedReport.completedAt && ` · ${new Date(selectedReport.completedAt).toLocaleTimeString()}`}
                  </div>
                  {selectedReport.status === 'running' && (
                    <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: 'var(--accent-primary)', borderRadius: 2,
                        width: `${selectedReport.total > 0 ? (selectedReport.completed / selectedReport.total * 100) : 0}%`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  )}
                </div>

                {selectedReport.summary && (
                  <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                    <div style={sectionLabelStyle}>Summary</div>
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
                          <StackedScoreBreakdown breakdown={averageBreakdown(selectedReport.results.filter(r => r.modelId === modelId))} />
                        </div>
                      ))}
                    </div>
                    <WeakestSignalCallout results={selectedReport.results} />
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

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <th style={thStyle}>Model</th>
                      <th style={thStyle}>Prompt</th>
                      <th style={thStyle}>Score</th>
                      <th style={thStyle}>Breakdown</th>
                      <th style={thStyle}>Weakest</th>
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
                        <td style={{ ...tdStyle, color: scoreColor(r.scores.overallScore) }}>{r.scores.overallScore}/10</td>
                        <td style={tdStyle}><StackedScoreBreakdown breakdown={r.scores.breakdown} compact /></td>
                        <td style={tdStyle}>{r.scores.breakdown?.weakestSignal?.label ?? '—'}</td>
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

        {/* ── History Tab ── */}
        {tab === 'history' && (
          <div style={{ padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Eval Reports
            </div>
            {reports.length === 0 && <div style={{ textAlign: 'center', padding: 15, color: 'var(--text-tertiary)', fontSize: 11 }}>No eval runs yet.</div>}
            {reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(r => (
              <div key={r.id} onClick={() => handleSelectReport(r.id)} style={historyItemStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: r.status === 'complete' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: r.status === 'complete' ? 'var(--accent-success)' : 'var(--accent-warning)',
                  }}>{r.status}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {r.total} runs · {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
            ))}

            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>
              Bench Runs
            </div>
            {benchRuns.length === 0 && <div style={{ textAlign: 'center', padding: 15, color: 'var(--text-tertiary)', fontSize: 11 }}>No bench runs yet.</div>}
            {benchRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(r => (
              <div key={r.id} onClick={() => handleSelectBenchRun(r.id)} style={historyItemStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: r.status === 'complete' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: r.status === 'complete' ? 'var(--accent-success)' : 'var(--accent-warning)',
                  }}>{r.status}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {r.total} tasks · {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────

function averageBreakdown(results: Array<{ scores: api.EvalScores }>): api.EvalScoreBreakdown {
  const count = results.length || 1;
  const structural = results.reduce((sum, r) => sum + (r.scores.breakdown?.structural ?? 0), 0) / count;
  const runtime = results.reduce((sum, r) => sum + (r.scores.breakdown?.runtime ?? 0), 0) / count;
  const style = results.reduce((sum, r) => sum + (r.scores.breakdown?.style ?? 0), 0) / count;
  const weakest = results
    .flatMap(r => r.scores.breakdown?.signals ?? [])
    .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))[0] ?? {
      id: 'none',
      label: 'No signals',
      category: 'style' as const,
      passed: false,
      score: 0,
      maxScore: 1,
    };
  return {
    structural: Math.round(structural * 10) / 10,
    runtime: Math.round(runtime * 10) / 10,
    style: Math.round(style * 10) / 10,
    total: Math.round((structural + runtime + style) * 10) / 10,
    weakestSignal: weakest,
    signals: [],
  };
}

function StackedScoreBreakdown({ breakdown, compact = false }: { breakdown?: api.EvalScoreBreakdown; compact?: boolean }) {
  if (!breakdown) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
  const total = Math.max(10, breakdown.structural + breakdown.runtime + breakdown.style);
  const height = compact ? 6 : 8;
  return (
    <div style={{ marginTop: compact ? 0 : 6, minWidth: compact ? 90 : 0 }}>
      <div style={{ display: 'flex', height, borderRadius: 999, overflow: 'hidden', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        <div title={`Structural ${breakdown.structural}/4.5`} style={{ width: `${(breakdown.structural / total) * 100}%`, background: 'var(--accent-primary)' }} />
        <div title={`Runtime ${breakdown.runtime}/3.5`} style={{ width: `${(breakdown.runtime / total) * 100}%`, background: '#22c55e' }} />
        <div title={`Style ${breakdown.style}/2`} style={{ width: `${(breakdown.style / total) * 100}%`, background: '#f59e0b' }} />
      </div>
      {!compact && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 9, color: 'var(--text-tertiary)' }}>
          <span>Structural {breakdown.structural}</span>
          <span>Runtime {breakdown.runtime}</span>
          <span>Style {breakdown.style}</span>
        </div>
      )}
    </div>
  );
}

function WeakestSignalCallout({ results }: { results: Array<{ scores: api.EvalScores }> }) {
  const weakest = averageBreakdown(results).weakestSignal;
  return (
    <div style={{ marginTop: 8, padding: 6, borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: 10 }}>
      Weakest signal: <span style={{ color: weakest.passed ? 'var(--accent-success)' : 'var(--accent-error)', fontWeight: 600 }}>{weakest.label}</span>
      <span style={{ color: 'var(--text-tertiary)' }}> · {weakest.score}/{weakest.maxScore}</span>
    </div>
  );
}

function BenchDeltaCallout({ delta }: { delta: NonNullable<api.BenchRun['previousDelta']> }) {
  const positive = delta.avgScoreDelta >= 0;
  return (
    <div style={{ marginBottom: 12, padding: 8, borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        Compared with previous run
      </div>
      <div style={{ fontSize: 12, color: positive ? 'var(--accent-success)' : 'var(--accent-error)', fontWeight: 600 }}>
        {positive ? '+' : ''}{delta.avgScoreDeltaPct}% score ({positive ? '+' : ''}{delta.avgScoreDelta}/10)
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
        vs {delta.previousRunName} · validation {formatSigned(delta.avgValidationDelta)} · style {formatSigned(delta.avgStyleDelta)}
      </div>
    </div>
  );
}

function PerTaskScoreTable({ run }: { run: api.BenchRun }) {
  const rows = [...new Set(run.results.map(r => r.taskId))].map(taskId => {
    const taskResults = run.results.filter(r => r.taskId === taskId);
    const first = taskResults[0];
    const avgScore = taskResults.reduce((sum, r) => sum + r.scores.overallScore, 0) / (taskResults.length || 1);
    const avgValidation = taskResults.reduce((sum, r) => sum + r.scores.validationScore, 0) / (taskResults.length || 1);
    const avgStyle = taskResults.reduce((sum, r) => sum + (r.scores.breakdown?.style ?? 0), 0) / (taskResults.length || 1);
    const delta = run.previousDelta?.taskDeltas.find(d => d.taskId === taskId);
    return {
      taskId,
      taskName: first?.taskName ?? taskId,
      avgScore: Math.round(avgScore * 10) / 10,
      avgValidation: Math.round(avgValidation * 10) / 10,
      avgStyle: Math.round(avgStyle * 10) / 10,
      delta: delta?.delta,
    };
  });
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={sectionLabelStyle}>Per-task scores</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <th style={thStyle}>Task</th>
            <th style={thStyle}>Avg score</th>
            <th style={thStyle}>Validation</th>
            <th style={thStyle}>Style</th>
            <th style={thStyle}>Delta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.taskId} style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <td style={tdStyle}>{row.taskName}</td>
              <td style={{ ...tdStyle, color: scoreColor(row.avgScore) }}>{row.avgScore}/10</td>
              <td style={tdStyle}>{row.avgValidation}</td>
              <td style={tdStyle}>{row.avgStyle}</td>
              <td style={{ ...tdStyle, color: row.delta == null ? 'var(--text-tertiary)' : row.delta >= 0 ? 'var(--accent-success)' : 'var(--accent-error)' }}>
                {row.delta == null ? '—' : formatSigned(row.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatSigned(n: number): string {
  return `${n >= 0 ? '+' : ''}${n}`;
}

function ModelSelection({ models, selected, onToggle, onSelectAll }: {
  models: Array<{ id: string; name: string }>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={labelStyle}>Models ({selected.size} selected)</label>
        <button onClick={onSelectAll} style={linkBtnStyle}>Select all</button>
      </div>
      {models.map(m => (
        <label key={m.id} style={checkboxRowStyle(selected.has(m.id))}>
          <input type="checkbox" checked={selected.has(m.id)} onChange={() => onToggle(m.id)} />
          <span style={{ color: 'var(--text-primary)' }}>{m.name}</span>
        </label>
      ))}
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--accent-primary)' : 'none',
    color: active ? '#fff' : 'var(--text-tertiary)',
    border: active ? 'none' : '1px solid var(--border-primary)',
    borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer',
  };
}

function runBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '10px 16px', fontSize: 13, fontWeight: 600,
    background: disabled ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
    color: disabled ? 'var(--text-tertiary)' : '#fff',
    border: 'none', borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
  };
}

function scoreColor(score: number): string {
  if (score >= 7) return 'var(--accent-success)';
  if (score >= 4) return 'var(--accent-warning)';
  return 'var(--accent-error)';
}

function resolvedColor(status: string): string {
  if (status === 'resolved') return '#22c55e';
  if (status === 'partial') return '#f59e0b';
  return '#ef4444';
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', marginTop: 4, padding: '6px 8px',
  background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
  borderRadius: 4, color: 'var(--text-primary)', fontSize: 12,
  outline: 'none', boxSizing: 'border-box',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 10, cursor: 'pointer',
};

const smallBtnStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
  borderRadius: 4, padding: '4px 10px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
};

function checkboxRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'flex-start', gap: 6,
    padding: '4px 6px', marginBottom: 2, borderRadius: 4,
    background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
    cursor: 'pointer', fontSize: 12,
  };
}

const historyItemStyle: React.CSSProperties = {
  padding: '8px 10px', marginBottom: 4, borderRadius: 6,
  background: 'var(--bg-secondary)', cursor: 'pointer',
  border: '1px solid var(--border-primary)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '4px 6px', color: 'var(--text-tertiary)',
  fontWeight: 600, fontSize: 10,
};

const tdStyle: React.CSSProperties = {
  padding: '4px 6px', color: 'var(--text-secondary)',
};
