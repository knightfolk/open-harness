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
  const [promptPlugins, setPromptPlugins] = useState<api.PromptPluginRegistry | null>(null);
  const [selectedReport, setSelectedReport] = useState<api.EvalReport | null>(null);
  const [selectedBenchRun, setSelectedBenchRun] = useState<api.BenchRun | null>(null);
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [runName, setRunName] = useState('');
  const [includePlanningRoomBaseline, setIncludePlanningRoomBaseline] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeBenchId, setActiveBenchId] = useState<string | null>(null);
  const [tab, setTab] = useState<'configure' | 'results' | 'history' | 'tasks' | 'bench' | 'packs'>('configure');
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState<{ tone: 'error' | 'warning' | 'info'; title: string; detail: string } | null>(null);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [p, r, t, s, b, plugins] = await Promise.all([
          api.getEvalPrompts(),
          api.getEvalReports(),
          api.getTasks().catch(() => []),
          api.getTaskSuites().catch(() => []),
          api.getBenchRuns().catch(() => []),
          api.getPromptPlugins(workingDir).catch(() => null),
        ]);
        setPrompts(p);
        setReports(r);
        setTasks(t);
        setSuites(s);
        setBenchRuns(b);
        setPromptPlugins(plugins);
      } catch (err) {
        console.error('Failed to load Model Lab data:', err);
        setDiagnostic({
          tone: 'error',
          title: 'Model Lab data did not load',
          detail: err instanceof Error ? err.message : 'The prompt and run lists could not be loaded.',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [workingDir]);

  // Poll active eval run
  useEffect(() => {
    if (!activeRunId) return;
    const interval = setInterval(async () => {
      try {
        const report = await api.getEvalReport(activeRunId);
        setSelectedReport(report);
        if (report.status === 'complete' || report.status === 'error') {
          setRunning(false);
          setActiveRunId(null);
          setReports(await api.getEvalReports());
          if (report.status === 'error') {
            setDiagnostic({
              tone: 'error',
              title: 'Eval run stopped with an error',
              detail: `${report.completed}/${report.total} runs completed. Open the result rows below for model output and scoring evidence.`,
            });
          }
        }
      } catch (err) {
        setRunning(false);
        setActiveRunId(null);
        setDiagnostic({
          tone: 'error',
          title: 'Eval run could not be refreshed',
          detail: err instanceof Error ? err.message : 'The active eval report could not be loaded.',
        });
      }
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
        if (run.status === 'complete' || run.status === 'error') {
          setRunning(false);
          setActiveBenchId(null);
          setBenchRuns(await api.getBenchRuns());
          if (run.status === 'error') {
            setDiagnostic({
              tone: 'error',
              title: 'Bench run stopped with an error',
              detail: `${run.completed}/${run.total} tasks completed. Inspect the result evidence below before trusting model rankings.`,
            });
          }
        }
      } catch (err) {
        setRunning(false);
        setActiveBenchId(null);
        setDiagnostic({
          tone: 'error',
          title: 'Bench run could not be refreshed',
          detail: err instanceof Error ? err.message : 'The active bench run could not be loaded.',
        });
      }
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
    setDiagnostic(null);
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
      setDiagnostic({
        tone: 'error',
        title: 'Eval run failed to start',
        detail: err instanceof Error ? err.message : 'The eval request failed before a report was created.',
      });
      setRunning(false);
    }
  }, [selectedPromptIds, selectedModelIds, runName, workingDir]);

  const handleBenchRun = useCallback(async () => {
    if (selectedTaskIds.size === 0 || selectedModelIds.size === 0) return;
    setRunning(true);
    setDiagnostic(null);
    setTab('bench');
    try {
      const result = await api.runBench({
        name: runName || `Bench ${new Date().toLocaleDateString()}`,
        taskIds: Array.from(selectedTaskIds),
        modelIds: Array.from(selectedModelIds),
        workingDir: workingDir || undefined,
        includePlanningRoomBaseline,
      });
      setActiveBenchId(result.id);
      const run = await api.getBenchRun(result.id);
      setSelectedBenchRun(run);
    } catch (err) {
      console.error('Bench run failed:', err);
      setDiagnostic({
        tone: 'error',
        title: 'Bench run failed to start',
        detail: err instanceof Error ? err.message : 'The bench request failed before a run was created.',
      });
      setRunning(false);
    }
  }, [selectedTaskIds, selectedModelIds, runName, workingDir, includePlanningRoomBaseline]);

  const handleSeedTasks = useCallback(async () => {
    try {
      await api.seedTasks(workingDir || undefined);
      setTasks(await api.getTasks());
      setSuites(await api.getTaskSuites());
    } catch (err) {
      console.error('Failed to seed tasks:', err);
      setDiagnostic({
        tone: 'error',
        title: 'Could not seed tasks',
        detail: err instanceof Error ? err.message : 'Built-in harness tasks could not be created.',
      });
    }
  }, [workingDir]);

  const handlePreparePromptPluginRoots = useCallback(async () => {
    try {
      setPromptPlugins(await api.ensurePromptPluginRoots(workingDir));
      setDiagnostic({
        tone: 'info',
        title: 'Prompt pack folders are ready',
        detail: 'OpenHarness will inspect project, user, and imported prompt plugin manifests from those folders.',
      });
    } catch (err) {
      setDiagnostic({
        tone: 'error',
        title: 'Could not prepare prompt pack folders',
        detail: err instanceof Error ? err.message : 'The prompt plugin folders could not be created.',
      });
    }
  }, [workingDir]);

  const handleImportPromptSkill = useCallback(async (sourcePath: string) => {
    if (!workingDir) throw new Error('Open a project before importing a skill.');
    const result = await api.importSkillPromptPlugin(workingDir, sourcePath);
    setPromptPlugins(result.registry);
    setDiagnostic({
      tone: 'info',
      title: 'Skill imported as prompt pack',
      detail: result.manifestPath || 'The imported prompt plugin manifest is ready for review.',
    });
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

  const handleExportEvalReport = useCallback(async () => {
    if (!selectedReport) return;
    try {
      await api.downloadEvalRecommendationReport(selectedReport.id);
    } catch (err) {
      setDiagnostic({
        tone: 'error',
        title: 'Could not export recommendation report',
        detail: err instanceof Error ? err.message : 'The eval recommendation report could not be downloaded.',
      });
    }
  }, [selectedReport]);

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
        <button onClick={() => setTab('packs')} style={tabBtnStyle(tab === 'packs')}>Packs</button>
        <button onClick={() => setTab('results')} style={tabBtnStyle(tab === 'results')}>Results</button>
        <button onClick={() => setTab('history')} style={tabBtnStyle(tab === 'history')}>History</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {diagnostic && (
          <ModelLabDiagnostic diagnostic={diagnostic} onDismiss={() => setDiagnostic(null)} />
        )}

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

                <label style={{ ...checkboxRowStyle(includePlanningRoomBaseline), marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={includePlanningRoomBaseline}
                    onChange={(event) => setIncludePlanningRoomBaseline(event.target.checked)}
                  />
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Compare Planning Room baseline</div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 1 }}>
                      For plan-mode tasks, add the configured team plan beside the selected single-model runs.
                    </div>
                  </div>
                </label>

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

        {/* ── Prompt Packs Tab ── */}
        {tab === 'packs' && (
          <PromptPacksTab registry={promptPlugins} onPrepare={handlePreparePromptPluginRoots} onImportSkill={handleImportPromptSkill} />
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
                    {runProgressLabel(selectedBenchRun.status, selectedBenchRun.completed, selectedBenchRun.total, 'tasks')}
                    {selectedBenchRun.completedAt && ` · ${new Date(selectedBenchRun.completedAt).toLocaleTimeString()}`}
                  </div>
                  {(selectedBenchRun.status === 'running' || selectedBenchRun.status === 'error') && (
                    <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: selectedBenchRun.status === 'error' ? 'var(--accent-error)' : 'var(--accent-primary)', borderRadius: 2,
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
                            {' · '}<span style={{ color: '#38bdf8' }}>{data.assisted || 0} assisted</span>
                            {' · '}<span style={{ color: '#f59e0b' }}>{data.partial} partial</span>
                            {' · '}<span style={{ color: '#ef4444' }}>{data.unresolved} failed</span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            Score: {data.avgScore}/10 · Validation: {data.avgValidationScore}/2 · Latency: {(data.avgLatencyMs / 1000).toFixed(1)}s
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                            Value: {data.valueScore} · Resolved: {Math.round(data.resolvedRate * 100)}% · Cost: ${data.avgCost.toFixed(6)}
                          </div>
                          {modelId === selectedBenchRun.summary?.bestModel && selectedBenchRun.summary?.bestModelReason && (
                            <div style={{ fontSize: 10, color: 'var(--accent-primary)', marginTop: 4 }}>
                              {selectedBenchRun.summary.bestModelReason}
                            </div>
                          )}
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
                      <th style={thStyle}>Rubric</th>
                      <th style={thStyle}>Trace</th>
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
                        <td style={{ ...tdStyle, color: rubricCoverageColor(r.scores.rubricCoverage) }}>
                          {rubricCoverageLabel(r.scores.rubricCoverage)}
                        </td>
                        <td style={{ ...tdStyle, color: traceProofColor(r.traceProof) }}>
                          {traceProofLabel(r.traceProof)}
                        </td>
                        <td style={tdStyle}>{r.scores.breakdown?.weakestSignal?.label ?? '—'}</td>
	                        <td style={{ ...tdStyle, color: r.validationPassed ? '#22c55e' : '#ef4444' }}>
	                          {r.validationResults.length > 0 ? (
	                            r.validationPassed ? '✓ Pass' : `✗ ${firstValidationFinding(r) || 'Fail'}`
	                          ) : '—'}
	                        </td>
                        <td style={tdStyle}>{(r.wallMs / 1000).toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
	                </table>
	                <ValidationFindingsPanel run={selectedBenchRun} />
	                <BenchEvidencePanel run={selectedBenchRun} />
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedReport.name}</div>
                    <button onClick={handleExportEvalReport} style={smallBtnStyle}>Export report</button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {runProgressLabel(selectedReport.status, selectedReport.completed, selectedReport.total, 'runs')}
                    {selectedReport.completedAt && ` · ${new Date(selectedReport.completedAt).toLocaleTimeString()}`}
                  </div>
                  {(selectedReport.status === 'running' || selectedReport.status === 'error') && (
                    <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: selectedReport.status === 'error' ? 'var(--accent-error)' : 'var(--accent-primary)', borderRadius: 2,
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
                <EvalEvidencePanel report={selectedReport} />
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
                    background: statusPillColors(r.status).background,
                    color: statusPillColors(r.status).color,
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
                    background: statusPillColors(r.status).background,
                    color: statusPillColors(r.status).color,
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

function ModelLabDiagnostic({ diagnostic, onDismiss }: {
  diagnostic: { tone: 'error' | 'warning' | 'info'; title: string; detail: string };
  onDismiss: () => void;
}) {
  const color = diagnostic.tone === 'error'
    ? 'var(--accent-error)'
    : diagnostic.tone === 'warning'
      ? 'var(--accent-warning)'
      : 'var(--accent-primary)';
  return (
    <div style={{
      margin: 10,
      padding: 10,
      borderRadius: 6,
      border: `1px solid ${color}`,
      background: 'var(--bg-secondary)',
      color: 'var(--text-secondary)',
      fontSize: 11,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ color, fontWeight: 700, marginBottom: 3 }}>{diagnostic.title}</div>
          <div style={{ color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{diagnostic.detail}</div>
        </div>
        <button onClick={onDismiss} style={{ ...linkBtnStyle, color: 'var(--text-tertiary)' }}>Dismiss</button>
      </div>
    </div>
  );
}

function runProgressLabel(status: string, completed: number, total: number, unit: string): string {
  if (status === 'running') return `Running... ${completed}/${total}`;
  if (status === 'error') return `Error after ${completed}/${total} ${unit}`;
  return `${completed} ${unit} completed`;
}

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

function firstValidationFinding(result: api.BenchRunResult): string {
  const finding = validationFindingSnippets(result.validationResults)[0];
  if (!finding) return '';
  return finding.length > 48 ? `${finding.slice(0, 45)}...` : finding;
}

function validationFindingSnippets(results: api.ValidationCommandResult[]): string[] {
  const snippets: string[] = [];
  for (const validation of results.filter(v => !v.passed || (v.findings || []).length > 0)) {
    snippets.push(...(validation.findings || []));
    const output = `${validation.stdout || ''}\n${validation.stderr || ''}`;
    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (
        /^(FAIL|ERROR):/i.test(line) ||
        /^-\s*FAIL\b/i.test(line) ||
        /ship readiness failed/i.test(line) ||
        /browser smoke/i.test(line)
      ) {
        snippets.push(line);
      }
    }
  }
  return [...new Set(snippets)];
}

function ValidationFindingsPanel({ run }: { run: api.BenchRun }) {
  const failed = run.results
    .map(result => ({
      result,
      findings: validationFindingSnippets(result.validationResults),
    }))
    .filter(row => !row.result.validationPassed || row.findings.length > 0);

  if (failed.length === 0) return null;

  return (
    <div style={{ marginTop: 12, padding: 8, borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
      <div style={sectionLabelStyle}>Validation findings</div>
      {failed.slice(0, 8).map(({ result, findings }, index) => (
        <div key={`${result.taskId}-${result.modelId}-${index}`} style={{ marginTop: index === 0 ? 0 : 8, fontSize: 10, color: 'var(--text-secondary)' }}>
          <div style={{ fontWeight: 600, color: result.validationPassed ? 'var(--accent-success)' : 'var(--accent-error)' }}>
            {result.taskName} · {result.modelId}
          </div>
          {findings.length > 0 ? (
            findings.slice(0, 4).map((finding, i) => (
              <div key={i} style={{ marginTop: 2, color: 'var(--text-tertiary)' }}>- {finding}</div>
            ))
          ) : (
            <div style={{ marginTop: 2, color: 'var(--text-tertiary)' }}>Validation command failed without structured findings.</div>
          )}
        </div>
      ))}
    </div>
  );
}

function EvalEvidencePanel({ report }: { report: api.EvalReport }) {
  if (report.results.length === 0) return null;
  const sorted = [...report.results].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'error' ? -1 : 1;
    return a.scores.overallScore - b.scores.overallScore;
  });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={sectionLabelStyle}>Inspectable output evidence</div>
      {sorted.slice(0, 12).map((result, index) => (
        <details key={`${result.modelId}-${result.promptId}-${index}`} style={evidenceDetailsStyle}>
          <summary style={evidenceSummaryStyle}>
            <span style={{ color: result.status === 'ok' ? 'var(--text-primary)' : 'var(--accent-error)', fontWeight: 600 }}>
              {result.promptName}
            </span>
            <span>{result.modelId}</span>
            <span style={{ color: scoreColor(result.scores.overallScore) }}>{result.scores.overallScore}/10</span>
            <span style={{ color: result.status === 'ok' ? 'var(--accent-success)' : 'var(--accent-error)' }}>{result.status}</span>
          </summary>
          <EvidenceBlock title="Failed or weak signals">
            <SignalList signals={result.scores.breakdown?.signals || []} />
          </EvidenceBlock>
          <EvidenceBlock title="Tool calls">
            {result.toolCalls.length > 0 ? result.toolCalls.map((tool, i) => (
              <div key={i}>{tool.name} · {tool.status}</div>
            )) : <span>No tool calls recorded.</span>}
          </EvidenceBlock>
          <EvidenceBlock title="Response">
            <pre style={evidencePreStyle}>{trimEvidence(result.response || '(empty response)', 1800)}</pre>
          </EvidenceBlock>
        </details>
      ))}
    </div>
  );
}

function BenchEvidencePanel({ run }: { run: api.BenchRun }) {
  if (run.results.length === 0) return null;
  const sorted = [...run.results].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ok' ? 1 : -1;
    return a.scores.overallScore - b.scores.overallScore;
  });

  return (
    <div style={{ marginTop: 12 }}>
      <div style={sectionLabelStyle}>Inspectable bench evidence</div>
      {sorted.slice(0, 12).map((result, index) => (
        <details key={`${result.taskId}-${result.modelId}-${index}`} style={evidenceDetailsStyle}>
          <summary style={evidenceSummaryStyle}>
            <span style={{ color: result.status === 'ok' ? 'var(--text-primary)' : 'var(--accent-error)', fontWeight: 600 }}>
              {result.taskName}
            </span>
            <span>{result.modelId}</span>
            <span style={{ color: resolvedColor(result.scores.resolvedStatus) }}>{result.scores.resolvedStatus}</span>
            <span style={{ color: scoreColor(result.scores.overallScore) }}>{result.scores.overallScore}/10</span>
          </summary>
          {result.error && (
            <EvidenceBlock title="Run error">
              <pre style={evidencePreStyle}>{trimEvidence(result.error, 1200)}</pre>
            </EvidenceBlock>
          )}
          <EvidenceBlock title="Prompt">
            <pre style={evidencePreStyle}>{trimEvidence(result.prompt, 1400)}</pre>
          </EvidenceBlock>
          <EvidenceBlock title="Failed or weak signals">
            <SignalList signals={result.scores.breakdown?.signals || []} />
          </EvidenceBlock>
          {result.scores.rubricCoverage && (
            <EvidenceBlock title="Rubric coverage">
              <RubricCoverageList coverage={result.scores.rubricCoverage} />
            </EvidenceBlock>
          )}
          <EvidenceBlock title="Trace proof">
            <TraceProofBlock trace={result.traceProof} />
          </EvidenceBlock>
          <EvidenceBlock title="Validation">
            {result.validationResults.length > 0 ? result.validationResults.map((validation, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ color: validation.passed ? 'var(--accent-success)' : 'var(--accent-error)', fontWeight: 600 }}>
                  {validation.passed ? 'PASS' : 'FAIL'} · {validation.command}
                </div>
                {validation.findings.length > 0 && (
                  <div style={{ marginTop: 3 }}>
                    {validation.findings.slice(0, 4).map((finding, findingIndex) => (
                      <div key={findingIndex}>- {finding}</div>
                    ))}
                  </div>
                )}
                {(validation.stdout || validation.stderr) && (
                  <pre style={evidencePreStyle}>{trimEvidence([validation.stdout, validation.stderr].filter(Boolean).join('\n'), 1200)}</pre>
                )}
              </div>
            )) : <span>No validation results recorded.</span>}
          </EvidenceBlock>
          <EvidenceBlock title="Response">
            <pre style={evidencePreStyle}>{trimEvidence(result.response || '(empty response)', 1800)}</pre>
          </EvidenceBlock>
        </details>
      ))}
    </div>
  );
}

function RubricCoverageList({ coverage }: { coverage: NonNullable<api.BenchScores['rubricCoverage']> }) {
  const sortedItems = [...coverage.items].sort((a, b) => Number(a.passed) - Number(b.passed));
  return (
    <div>
      <div style={{ color: rubricCoverageColor(coverage), fontWeight: 600, marginBottom: 4 }}>
        {rubricCoverageLabel(coverage)}
      </div>
      {sortedItems.map((item) => (
        <div key={item.id} style={{ marginBottom: 3 }}>
          <span style={{ color: item.passed ? 'var(--accent-success)' : 'var(--accent-error)', fontWeight: 600 }}>
            {item.passed ? 'PASS' : 'FAIL'}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}> · {item.id} · {item.points} pt{item.points === 1 ? '' : 's'}</span>
          {item.evidence && <span> · {item.evidence}</span>}
        </div>
      ))}
    </div>
  );
}

function TraceProofBlock({ trace }: { trace?: api.BenchRunResult['traceProof'] }) {
  if (!trace) {
    return <span style={{ color: 'var(--accent-error)', fontWeight: 600 }}>No route trace was recorded.</span>;
  }
  return (
    <div>
      <div style={{ color: traceProofColor(trace), fontWeight: 600, marginBottom: 4 }}>
        {trace.summary}
      </div>
      <div>Selected: {trace.selectedModel} via {trace.providerId}</div>
      <div>Route: {trace.mode} / {trace.role} / {trace.complexity} ({trace.routeSource})</div>
      {trace.warnings.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {trace.warnings.slice(0, 5).map((warning, i) => (
            <div key={i}>- {warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

function traceProofLabel(trace?: api.BenchRunResult['traceProof']) {
  if (!trace) return 'No trace';
  return `${trace.mode}/${trace.role} · ${trace.modelRequests} req · ${trace.toolCalls} tools`;
}

function traceProofColor(trace?: api.BenchRunResult['traceProof']) {
  if (!trace) return 'var(--accent-error)';
  if (trace.assistedByFallback || trace.warnings.length > 0) return '#f59e0b';
  if (trace.modelRequests > 0) return 'var(--accent-success)';
  return 'var(--accent-error)';
}

function rubricCoverageLabel(coverage?: api.BenchScores['rubricCoverage']) {
  if (!coverage || coverage.totalPoints <= 0) return '—';
  const passed = roundTenth(coverage.passedPoints);
  const total = roundTenth(coverage.totalPoints);
  return `${passed}/${total} pts · ${Math.round(coverage.ratio * 100)}%`;
}

function rubricCoverageColor(coverage?: api.BenchScores['rubricCoverage']) {
  if (!coverage) return 'var(--text-tertiary)';
  if (coverage.ratio >= 0.7) return 'var(--accent-success)';
  if (coverage.ratio >= 0.4) return '#f59e0b';
  return 'var(--accent-error)';
}

function roundTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function SignalList({ signals }: { signals: api.EvalSignalScore[] }) {
  const weak = signals
    .filter((signal) => !signal.passed || signal.score < signal.maxScore)
    .sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore))
    .slice(0, 8);
  if (weak.length === 0) return <span>No weak signals recorded.</span>;
  return (
    <>
      {weak.map((signal) => (
        <div key={signal.id} style={{ color: signal.passed ? 'var(--text-tertiary)' : 'var(--accent-error)' }}>
          {signal.label}: {signal.score}/{signal.maxScore}
        </div>
      ))}
    </>
  );
}

function trimEvidence(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 40).trimEnd()}\n\n... truncated ${trimmed.length - max + 40} chars`;
}

function formatSigned(n: number): string {
  return `${n >= 0 ? '+' : ''}${n}`;
}

function PromptPacksTab({ registry, onPrepare, onImportSkill }: {
  registry: api.PromptPluginRegistry | null;
  onPrepare: () => void;
  onImportSkill: (sourcePath: string) => Promise<void>;
}) {
  const [sourcePath, setSourcePath] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const plugins = registry?.plugins || [];
  const packs = registry?.packs || [];
  const roots = registry?.roots || [];
  const importSkill = async () => {
    if (!sourcePath.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      await onImportSkill(sourcePath.trim());
      setSourcePath('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };
  return (
    <div style={{ padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Prompt Packs</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Read-only manifests for route, model, and output-contract experiments.
          </div>
        </div>
        <button onClick={onPrepare} style={smallBtnStyle}>Prepare folders</button>
      </div>

      <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
        <div style={sectionLabelStyle}>Registry roots</div>
        {roots.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No registry roots loaded.</div>
        ) : roots.map((root) => (
          <div key={root.path} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 10 }}>
            <span style={{ color: root.exists ? 'var(--accent-success)' : 'var(--text-tertiary)', width: 54 }}>{root.exists ? 'Ready' : 'Missing'}</span>
            <span style={{ color: 'var(--text-secondary)', width: 54, textTransform: 'capitalize' }}>{root.location}</span>
            <span style={{ color: 'var(--text-tertiary)', fontFamily: 'SF Mono, Menlo, Consolas, monospace', wordBreak: 'break-all' }}>{root.path}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
        <div style={sectionLabelStyle}>Import skill</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={sourcePath}
            onChange={(event) => setSourcePath(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && importSkill()}
            placeholder="/path/to/skill-folder or /path/to/SKILL.md"
            style={inputStyle}
          />
          <button onClick={importSkill} disabled={importing || !sourcePath.trim()} style={smallBtnStyle}>
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
        {importError && <div style={{ marginTop: 6, fontSize: 10, color: 'var(--accent-error)' }}>{importError}</div>}
      </div>

      {packs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={sectionLabelStyle}>Packs</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
            {packs.map((pack) => (
              <div key={pack.id} style={{ padding: 8, border: '1px solid var(--border-primary)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{pack.name}</span>
                  <TrustPill trust={pack.trust} />
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {pack.pluginCount} manifest{pack.pluginCount === 1 ? '' : 's'} · {pack.pluginIds.length} plugin id{pack.pluginIds.length === 1 ? '' : 's'}
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {pack.sources.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={sectionLabelStyle}>Manifests ({plugins.length})</div>
      {plugins.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
          No prompt plugin manifests found.
        </div>
      ) : plugins.map((plugin) => (
        <div key={`${plugin.location}:${plugin.id}:${plugin.path}`} style={{ marginBottom: 8, padding: 8, border: '1px solid var(--border-primary)', borderRadius: 6, background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                {plugin.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>v{plugin.version}</span>
              </div>
              <div style={{ marginTop: 2, fontSize: 10, color: 'var(--text-tertiary)' }}>{plugin.description || plugin.id}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <TrustPill trust={plugin.trust} />
              <StatusPill status={plugin.status} />
            </div>
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...plugin.targets.roles, ...plugin.targets.routeModes, ...plugin.targets.modelFamilies, ...plugin.targets.modelIds].slice(0, 10).map((target) => (
              <span key={target} style={tagStyle}>{target}</span>
            ))}
            {plugin.sections.length > 0 && <span style={tagStyle}>{plugin.sections.length} section{plugin.sections.length === 1 ? '' : 's'}</span>}
            {plugin.evals.length > 0 && <span style={tagStyle}>{plugin.evals.length} eval{plugin.evals.length === 1 ? '' : 's'}</span>}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'SF Mono, Menlo, Consolas, monospace', wordBreak: 'break-all' }}>
            {plugin.path}
          </div>
          {plugin.issues.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: 'var(--accent-error)' }}>
              {plugin.issues.slice(0, 4).join(' · ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TrustPill({ trust }: { trust: api.PromptPluginSummary['trust'] }) {
  const colors = trust === 'trusted'
    ? { background: 'rgba(34,197,94,0.14)', color: 'var(--accent-success)' }
    : trust === 'blocked'
      ? { background: 'rgba(239,68,68,0.14)', color: 'var(--accent-error)' }
      : { background: 'rgba(245,158,11,0.14)', color: 'var(--accent-warning)' };
  return <span style={{ ...pillStyle, ...colors }}>{trust}</span>;
}

function StatusPill({ status }: { status: api.PromptPluginSummary['status'] }) {
  const colors = status === 'ready'
    ? { background: 'rgba(34,197,94,0.14)', color: 'var(--accent-success)' }
    : status === 'blocked'
      ? { background: 'rgba(239,68,68,0.14)', color: 'var(--accent-error)' }
      : { background: 'rgba(245,158,11,0.14)', color: 'var(--accent-warning)' };
  return <span style={{ ...pillStyle, ...colors }}>{status}</span>;
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
  if (status === 'assisted') return '#38bdf8';
  if (status === 'partial') return '#f59e0b';
  return '#ef4444';
}

function statusPillColors(status: string): { background: string; color: string } {
  if (status === 'complete') return { background: 'rgba(34,197,94,0.15)', color: 'var(--accent-success)' };
  if (status === 'error') return { background: 'rgba(239,68,68,0.15)', color: 'var(--accent-error)' };
  return { background: 'rgba(245,158,11,0.15)', color: 'var(--accent-warning)' };
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

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 18,
  padding: '1px 5px',
  borderRadius: 4,
  fontSize: 9,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tagStyle: React.CSSProperties = {
  fontSize: 9,
  padding: '1px 5px',
  borderRadius: 4,
  background: 'var(--bg-tertiary)',
  color: 'var(--text-tertiary)',
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

const evidenceDetailsStyle: React.CSSProperties = {
  marginBottom: 6,
  padding: '7px 8px',
  borderRadius: 6,
  border: '1px solid var(--border-primary)',
  background: 'var(--bg-secondary)',
};

const evidenceSummaryStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr) auto auto',
  gap: 8,
  alignItems: 'center',
  cursor: 'pointer',
  color: 'var(--text-tertiary)',
  fontSize: 10,
};

const evidencePreStyle: React.CSSProperties = {
  margin: '4px 0 0',
  padding: 8,
  maxHeight: 220,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  borderRadius: 4,
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-primary)',
  color: 'var(--text-secondary)',
  fontSize: 10,
};
