import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '../utils/api';

interface Props {
  workingDir: string | null;
  models: Array<{ id: string; name: string }>;
  enabledModels?: Array<{ id: string; name: string; providerId: string; providerName: string; providerType?: 'openai-compatible' | 'anthropic' | 'google' | 'local' | 'custom' }>;
}

const HISTORY_VISIBLE_LIMIT = 20;
type ModelSourceCategory = 'all' | 'frontier' | 'open-source';
interface ModelLabSelectableModel {
  id: string;
  name: string;
  providerId?: string;
  providerName?: string;
  providerType?: 'openai-compatible' | 'anthropic' | 'google' | 'local' | 'custom';
  modelSource?: 'frontier' | 'open-source';
}

function inferModelSource(model: ModelLabSelectableModel): 'frontier' | 'open-source' {
  const providerType = (model.providerType || '').toLowerCase();
  const providerName = (model.providerName || '').toLowerCase();
  const providerId = (model.providerId || '').toLowerCase();
  if (providerType === 'local') return 'open-source';
  if (providerName.includes('ollama') || providerName.includes('lm studio') || providerName.includes('lmstudio') || providerName.includes('local') || providerId.includes('ollama')) {
    return 'open-source';
  }
  return 'frontier';
}

function providerModelKey(providerName?: string) {
  return providerName?.trim() || 'unknown provider';
}

export function ModelLabPanel({ workingDir, models, enabledModels = [] }: Props) {
  const selectableModels = useMemo<ModelLabSelectableModel[]>(() => {
    const source = enabledModels.length > 0 ? enabledModels : models;
    return source.map((model) => ({
      ...model,
      modelSource: inferModelSource(model),
    }));
  }, [enabledModels, models]);

  const modelSourceGroups = useMemo(() => {
    const frontier = selectableModels.filter((model) => model.modelSource === 'frontier');
    const openSource = selectableModels.filter((model) => model.modelSource === 'open-source');
    return {
      all: selectableModels.length,
      frontier: frontier.length,
      'open-source': openSource.length,
    };
  }, [selectableModels]);

  const [modelSourceFilter, setModelSourceFilter] = useState<ModelSourceCategory>('all');

  const filteredModels = useMemo(() => {
    if (modelSourceFilter === 'all') return selectableModels;
    return selectableModels.filter((model) => model.modelSource === modelSourceFilter);
  }, [modelSourceFilter, selectableModels]);

  const [prompts, setPrompts] = useState<api.PromptCase[]>([]);
  const [promptStrategies, setPromptStrategies] = useState<api.PromptStrategyProfile[]>([]);
  const [reports, setReports] = useState<api.EvalReportSummary[]>([]);
  const [tasks, setTasks] = useState<api.HarnessTask[]>([]);
  const [, setSuites] = useState<api.TaskSuite[]>([]);
  const [benchRuns, setBenchRuns] = useState<api.BenchRunSummary[]>([]);
  const [promptPlugins, setPromptPlugins] = useState<api.PromptPluginRegistry | null>(null);
  const [selectedReport, setSelectedReport] = useState<api.EvalReport | null>(null);
  const [selectedBenchRun, setSelectedBenchRun] = useState<api.BenchRun | null>(null);
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [selectedPromptStrategyIds, setSelectedPromptStrategyIds] = useState<Set<string>>(new Set());
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [runName, setRunName] = useState('');
  const [preparedPackRun, setPreparedPackRun] = useState<{ packId: string; packName: string; evalIds: string[]; matchedEvalIds: string[] } | null>(null);
  const [includePlanningRoomBaseline, setIncludePlanningRoomBaseline] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeBenchId, setActiveBenchId] = useState<string | null>(null);
  const [tab, setTab] = useState<'configure' | 'results' | 'history' | 'tasks' | 'bench' | 'packs'>('configure');
  const [loading, setLoading] = useState(true);
  const [diagnostic, setDiagnostic] = useState<{ tone: 'error' | 'warning' | 'info'; title: string; detail: string } | null>(null);
  const [providerHealthSignal, setProviderHealthSignal] = useState<ProviderHealthSignal | null>(null);

  // Load data
  useEffect(() => {
    (async () => {
      try {
        const [p, strategies, r, t, s, b, plugins, health] = await Promise.all([
          api.getEvalPrompts(),
          api.getPromptStrategies().catch(() => []),
          api.getEvalReports(),
          api.getTasks().catch(() => []),
          api.getTaskSuites().catch(() => []),
          api.getBenchRuns().catch(() => []),
          api.getPromptPlugins(workingDir).catch(() => null),
          api.getProviderHealth().catch(() => null),
        ]);
        setPrompts(p);
        setPromptStrategies(strategies);
        setReports(r);
        setTasks(t);
        setSuites(s);
        setBenchRuns(b);
        setPromptPlugins(plugins);
        setProviderHealthSignal(summarizeProviderHealth(health));
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

  const togglePromptStrategy = useCallback((id: string) => {
    setSelectedPromptStrategyIds(prev => {
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

  const selectAllModels = useCallback((nextModels?: string[]) => {
    setSelectedModelIds(new Set(nextModels || selectableModels.map(m => m.id)));
  }, [selectableModels]);

  const selectAllTasks = useCallback(() => {
    setSelectedTaskIds(new Set(tasks.map(t => t.id)));
  }, [tasks]);

  const prepareSmallEvalProofRun = useCallback(() => {
    const prompt = prompts[0];
    const model = selectableModels[0];
    if (!prompt || !model) {
      setDiagnostic({
        tone: 'warning',
        title: 'No eval proof preset available',
        detail: 'Add at least one eval prompt and one enabled model before preparing a small proof run.',
      });
      return;
    }
    setPreparedPackRun(null);
    setSelectedPromptIds(new Set([prompt.id]));
    setSelectedModelIds(new Set([model.id]));
    setRunName(`Proof eval - ${prompt.name} - ${model.name}`);
    setTab('configure');
    setDiagnostic({
      tone: 'info',
      title: 'Small eval proof prepared',
      detail: `Selected 1 prompt and 1 model. Review provider/budget cautions, then run the eval when ready.`,
    });
  }, [prompts, selectableModels]);

  const prepareSmallBenchProofRun = useCallback(() => {
    const task = tasks[0];
    const model = selectableModels[0];
    if (!task || !model) {
      setDiagnostic({
        tone: 'warning',
        title: 'No bench proof preset available',
        detail: 'Add at least one harness task and one enabled model before preparing a small bench proof run.',
      });
      return;
    }
    setSelectedTaskIds(new Set([task.id]));
    setSelectedModelIds(new Set([model.id]));
    setRunName(`Proof bench - ${task.name} - ${model.name}`);
    setTab('tasks');
    setDiagnostic({
      tone: 'info',
      title: 'Small bench proof prepared',
      detail: `Selected 1 task and 1 model. Review provider/budget cautions, then run the bench when ready.`,
    });
  }, [tasks, selectableModels]);

  const handleRun = useCallback(async () => {
    if (selectedPromptIds.size === 0 || selectedModelIds.size === 0) return;
    setRunning(true);
    setDiagnostic(null);
    setTab('results');
    try {
      const result = await api.runEval({
        name: runName || (preparedPackRun ? `Pack eval - ${preparedPackRun.packName}` : `Eval ${new Date().toLocaleDateString()}`),
        promptIds: Array.from(selectedPromptIds),
        modelIds: Array.from(selectedModelIds),
        workingDir: workingDir || undefined,
        promptStrategyIds: Array.from(selectedPromptStrategyIds),
        packContext: preparedPackRun || undefined,
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
  }, [selectedPromptIds, selectedModelIds, selectedPromptStrategyIds, runName, preparedPackRun, workingDir]);

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

  const handleExportBenchRun = useCallback(async () => {
    if (!selectedBenchRun) return;
    try {
      const json = await api.exportBenchRun(selectedBenchRun.id, 'json');
      downloadText(`openharness-bench-${selectedBenchRun.id}.json`, json, 'application/json');
    } catch (err) {
      setDiagnostic({
        tone: 'error',
        title: 'Could not export bench run',
        detail: err instanceof Error ? err.message : 'The bench run JSON could not be downloaded.',
      });
    }
  }, [selectedBenchRun]);

  const handleSaveEvalProofReview = useCallback(async (status: api.ProofReviewState['status'], note?: string) => {
    if (!selectedReport) return;
    try {
      setSelectedReport(await api.saveEvalProofReview(selectedReport.id, { status, note }));
    } catch (err) {
      setDiagnostic({
        tone: 'error',
        title: 'Could not save eval proof review',
        detail: err instanceof Error ? err.message : 'The proof review decision could not be saved.',
      });
    }
  }, [selectedReport]);

  const handleSaveBenchProofReview = useCallback(async (status: api.ProofReviewState['status'], note?: string) => {
    if (!selectedBenchRun) return;
    try {
      setSelectedBenchRun(await api.saveBenchProofReview(selectedBenchRun.id, { status, note }));
    } catch (err) {
      setDiagnostic({
        tone: 'error',
        title: 'Could not save bench proof review',
        detail: err instanceof Error ? err.message : 'The proof review decision could not be saved.',
      });
    }
  }, [selectedBenchRun]);

  const categories = [...new Set(prompts.map(p => p.category))];
  const modelLabTabs: Array<{ id: typeof tab; label: string; ariaLabel: string }> = [
    { id: 'configure', label: 'Eval', ariaLabel: 'Show Model Lab eval setup and provider-call proof preparation' },
    { id: 'tasks', label: 'Tasks', ariaLabel: 'Show Model Lab bench task selection and proof-run preparation' },
    { id: 'bench', label: 'Bench', ariaLabel: 'Show Model Lab bench rankings, proof review, and exports' },
    { id: 'packs', label: 'Packs', ariaLabel: 'Show Model Lab prompt packs and pack evidence exports' },
    { id: 'results', label: 'Results', ariaLabel: 'Show Model Lab eval recommendations, proof review, and exports' },
    { id: 'history', label: 'History', ariaLabel: 'Show Model Lab saved eval and bench proof history' },
  ];
  const tabPanelProps = (id: typeof tab) => ({
    id: `model-lab-panel-${id}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `model-lab-tab-${id}`,
    tabIndex: 0,
  });
  const handleModelLabTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentTab: typeof tab) => {
    const currentIndex = modelLabTabs.findIndex((item) => item.id === currentTab);
    if (currentIndex < 0) return;
    const lastIndex = modelLabTabs.length - 1;
    const nextIndex = event.key === 'ArrowRight'
      ? (currentIndex + 1) % modelLabTabs.length
      : event.key === 'ArrowLeft'
        ? (currentIndex - 1 + modelLabTabs.length) % modelLabTabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? lastIndex
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = modelLabTabs[nextIndex].id;
    setTab(nextTab);
    requestAnimationFrame(() => {
      document.getElementById(`model-lab-tab-${nextTab}`)?.focus();
    });
  };

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
      <div
        role="tablist"
        aria-label="Model Lab sections"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          Model Lab
        </span>
        {modelLabTabs.map((item) => (
          <button
            key={item.id}
            id={`model-lab-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`model-lab-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            aria-label={item.ariaLabel}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => handleModelLabTabKeyDown(event, item.id)}
            style={tabBtnStyle(tab === item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {diagnostic && (
          <ModelLabDiagnostic diagnostic={diagnostic} onDismiss={() => setDiagnostic(null)} />
        )}

        {/* ── Eval Configure Tab ── */}
        {tab === 'configure' && (
          <div {...tabPanelProps('configure')} style={{ padding: 10 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Run Name</label>
              <input
                value={runName}
                onChange={(e) => setRunName(e.target.value)}
                placeholder={`Eval ${new Date().toLocaleDateString()}`}
                style={inputStyle}
              />
              <button type="button" onClick={prepareSmallEvalProofRun} style={{ ...smallBtnStyle, marginTop: 6 }}>
                Prepare smallest eval proof
              </button>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 10, lineHeight: 1.4, marginTop: 6 }}>
                Proof gate: run the prepared 1x1 eval, review the proof state in Results, export the proof brief/report, then apply only approved recommendations.
              </div>
            </div>

            {/* Prompt Selection */}
            <div
              style={{ marginBottom: 16 }}
              role="group"
              aria-label={`${selectedPromptIds.size} of ${prompts.length} eval prompt${prompts.length === 1 ? '' : 's'} selected for Model Lab provider-call runs`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={labelStyle}>Prompts ({selectedPromptIds.size} selected)</div>
                <button
                  type="button"
                  onClick={selectAllPrompts}
                  style={linkBtnStyle}
                  aria-label={`Select all ${prompts.length} eval prompt${prompts.length === 1 ? '' : 's'} for Model Lab provider-call runs`}
                >
                  Select all
                </button>
              </div>
              {categories.map(cat => (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'capitalize' }}>{cat}</div>
                  {prompts.filter(p => p.category === cat).map(p => (
                    <label key={p.id} style={checkboxRowStyle(selectedPromptIds.has(p.id))}>
                      <input
                        type="checkbox"
                        checked={selectedPromptIds.has(p.id)}
                        onChange={() => togglePrompt(p.id)}
                        style={{ marginTop: 2 }}
                        aria-label={`${selectedPromptIds.has(p.id) ? 'Deselect' : 'Select'} eval prompt ${p.name} for Model Lab provider-call runs`}
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
            <ModelSourceFilter
              value={modelSourceFilter}
              counts={modelSourceGroups}
              onChange={setModelSourceFilter}
            />
            <ModelSelection
              models={filteredModels}
              selected={selectedModelIds}
              onToggle={toggleModel}
              onSelectAll={() => selectAllModels(filteredModels.map((m) => m.id))}
              onClear={() => setSelectedModelIds(new Set())}
            />

            {promptStrategies.length > 0 && (
              <div
                style={{ marginBottom: 12 }}
                role="group"
                aria-label={`${selectedPromptStrategyIds.size} prompt strateg${selectedPromptStrategyIds.size === 1 ? 'y' : 'ies'} selected for same-model Model Lab comparison`}
              >
                <div style={labelStyle}>Prompt strategy comparison ({selectedPromptStrategyIds.size || 'default'})</div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: 10, lineHeight: 1.4, marginBottom: 6 }}>
                  Leave empty to use each model's default strategy. Select one or more strategies to compare the same prompt/model across prompt contracts.
                </div>
                {promptStrategies.slice(0, 12).map((strategy) => {
                  const bestPractice = strategy.bestPracticeNotes?.[0];
                  return (
                    <label key={strategy.id} style={checkboxRowStyle(selectedPromptStrategyIds.has(strategy.id))}>
                      <input
                        type="checkbox"
                        checked={selectedPromptStrategyIds.has(strategy.id)}
                        onChange={() => togglePromptStrategy(strategy.id)}
                        aria-label={`${selectedPromptStrategyIds.has(strategy.id) ? 'Deselect' : 'Select'} prompt strategy ${strategy.id} for same-model comparison${bestPractice ? `. Source-backed guidance: ${bestPractice.guidance}. Eval cue: ${bestPractice.evaluationCue}` : ''}`}
                      />
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{strategy.id}</div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 1 }}>
                          {strategy.family} · {strategy.systemStyle} · {strategy.reasoningPolicy} · {strategy.outputContract}
                        </div>
                        {bestPractice && (
                          <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 4, lineHeight: 1.35 }}>
                            <strong>Best practice:</strong> {bestPractice.guidance}
                            <br />
                            <span style={{ color: 'var(--text-tertiary)' }}>Eval cue: {bestPractice.evaluationCue}</span>
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <MatrixRunCaution
              kind="eval"
              selectedItems={selectedPromptIds.size * Math.max(1, selectedPromptStrategyIds.size)}
              selectedModels={selectedModelIds.size}
              providerHealthSignal={providerHealthSignal}
            />

            <div style={{ color: 'var(--accent-warning)', fontSize: 10, lineHeight: 1.4, marginBottom: 8 }}>
              Provider-spend guard: Run Eval can call configured model providers. Prepare selections freely, but start proof runs only after provider-budget approval.
            </div>

            <button
              type="button"
              onClick={handleRun}
              disabled={running || selectedPromptIds.size === 0 || selectedModelIds.size === 0}
              style={runBtnStyle(running || selectedPromptIds.size === 0 || selectedModelIds.size === 0)}
              title={matrixRunApprovalTitle('eval', selectedPromptIds.size * Math.max(1, selectedPromptStrategyIds.size), selectedModelIds.size)}
              aria-label={matrixRunApprovalTitle('eval', selectedPromptIds.size * Math.max(1, selectedPromptStrategyIds.size), selectedModelIds.size)}
            >
              {running ? 'Running...' : matrixRunApprovalLabel('eval', selectedPromptIds.size * Math.max(1, selectedPromptStrategyIds.size), selectedModelIds.size)}
            </button>
          </div>
        )}

        {/* ── Tasks Tab ── */}
        {tab === 'tasks' && (
          <div {...tabPanelProps('tasks')} style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Harness Tasks ({tasks.length})
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={prepareSmallBenchProofRun} style={smallBtnStyle}>Prepare proof run</button>
                  <button type="button" onClick={handleSeedTasks} style={smallBtnStyle}>Seed fixtures</button>
                </div>
              </div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 10, lineHeight: 1.4, marginBottom: 10 }}>
                Proof gate: run the prepared bench proof, review failures and weakest signals, export the proof brief/JSON, then use it as routing evidence instead of trusting raw rankings.
              </div>

            {tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
                No tasks yet. Click "Seed fixtures" to create built-in tasks.
              </div>
            ) : (
              <>
                {/* Task selection for bench run */}
                <div
                  style={{ marginBottom: 12 }}
                  role="group"
                  aria-label={`${selectedTaskIds.size} of ${tasks.length} bench task${tasks.length === 1 ? '' : 's'} selected for Model Lab provider-call runs`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={labelStyle}>Select tasks for bench ({selectedTaskIds.size})</div>
                    <button
                      type="button"
                      onClick={selectAllTasks}
                      style={linkBtnStyle}
                      aria-label={`Select all ${tasks.length} bench task${tasks.length === 1 ? '' : 's'} for Model Lab provider-call runs`}
                    >
                      Select all
                    </button>
                  </div>
                  {tasks.map(t => (
                    <label key={t.id} style={checkboxRowStyle(selectedTaskIds.has(t.id))}>
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.has(t.id)}
                        onChange={() => toggleTask(t.id)}
                        aria-label={`${selectedTaskIds.has(t.id) ? 'Deselect' : 'Select'} bench task ${t.name} for Model Lab provider-call runs`}
                      />
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
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginBottom: 6 }}>
                    Active model filter: {modelSourceFilter}
                  </div>
                  <ModelSourceFilter
                    value={modelSourceFilter}
                    counts={modelSourceGroups}
                    onChange={setModelSourceFilter}
                  />
                </div>
                <ModelSelection
                  models={filteredModels}
                  selected={selectedModelIds}
                  onToggle={toggleModel}
                  onSelectAll={() => selectAllModels(filteredModels.map((m) => m.id))}
                  onClear={() => setSelectedModelIds(new Set())}
                />

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

                <MatrixRunCaution
                  kind="bench"
                  selectedItems={selectedTaskIds.size}
                  selectedModels={selectedModelIds.size}
                  extraRuns={includePlanningRoomBaseline ? selectedTaskIds.size : 0}
                  providerHealthSignal={providerHealthSignal}
                />

                <div style={{ color: 'var(--accent-warning)', fontSize: 10, lineHeight: 1.4, marginBottom: 8 }}>
                  Provider-spend guard: Run Bench can call configured model providers for every selected task/model pair. Prepare proof runs freely, but launch only after provider-budget approval.
                </div>

                <button
                  type="button"
                  onClick={handleBenchRun}
                  disabled={running || selectedTaskIds.size === 0 || selectedModelIds.size === 0}
                  style={runBtnStyle(running || selectedTaskIds.size === 0 || selectedModelIds.size === 0)}
                  title={matrixRunApprovalTitle('bench', selectedTaskIds.size, selectedModelIds.size, includePlanningRoomBaseline ? selectedTaskIds.size : 0)}
                  aria-label={matrixRunApprovalTitle('bench', selectedTaskIds.size, selectedModelIds.size, includePlanningRoomBaseline ? selectedTaskIds.size : 0)}
                >
                  {running ? 'Running...' : matrixRunApprovalLabel('bench', selectedTaskIds.size, selectedModelIds.size, includePlanningRoomBaseline ? selectedTaskIds.size : 0)}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Prompt Packs Tab ── */}
        {tab === 'packs' && (
          <div {...tabPanelProps('packs')}>
            <PromptPacksTab
              registry={promptPlugins}
              prompts={prompts}
              onPrepare={handlePreparePromptPluginRoots}
              onImportSkill={handleImportPromptSkill}
              onSelectEvalIds={(evalIds, pack) => {
                const available = new Set(prompts.map((prompt) => prompt.id));
                const matched = evalIds.filter((id) => available.has(id));
                setPreparedPackRun({ packId: pack.id, packName: pack.name, evalIds, matchedEvalIds: matched });
                setSelectedPromptIds(new Set(matched));
                if (matched.length > 0) setRunName(`Pack eval - ${pack.name}`);
                setTab('configure');
                setDiagnostic({
                  tone: matched.length > 0 ? 'info' : 'warning',
                  title: matched.length > 0 ? 'Pack eval prompts selected' : 'Pack has no matching eval prompts',
                  detail: matched.length > 0
                    ? `${pack.name}: selected ${matched.length}/${evalIds.length} eval prompt${matched.length === 1 ? '' : 's'} for the next Model Lab run.`
                    : `${pack.name}: the pack declares ${evalIds.length} eval id${evalIds.length === 1 ? '' : 's'}, but none match the installed eval prompt suite.`,
                });
              }}
            />
          </div>
        )}

        {/* ── Bench Results Tab ── */}
        {tab === 'bench' && (
          <div {...tabPanelProps('bench')} style={{ padding: 10 }}>
            {!selectedBenchRun ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
                No bench results yet. Select tasks and run a bench.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedBenchRun.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => downloadText(`openharness-bench-proof-${selectedBenchRun.id}.md`, buildBenchProofBrief(selectedBenchRun))}
                        style={smallBtnStyle}
                      >
                        Export proof brief
                      </button>
                      <button onClick={handleExportBenchRun} style={smallBtnStyle}>Export JSON</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {runProgressLabel(selectedBenchRun.status, selectedBenchRun.completed, selectedBenchRun.total, 'tasks')}
                    {selectedBenchRun.completedAt && ` · ${new Date(selectedBenchRun.completedAt).toLocaleTimeString()}`}
                  </div>
                  {selectedBenchRun.summary ? (
                    <div style={{ fontSize: 10, color: selectedBenchRun.proofReview?.status === 'approved' ? 'var(--accent-success)' : 'var(--accent-warning)', marginTop: 4 }}>
                      Ranking trust: {selectedBenchRun.proofReview?.status === 'approved' ? 'approved proof; safe to use as routing evidence' : 'proof not approved yet; export for review, not automatic role/router changes'}
                    </div>
                  ) : null}
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
                <BenchProofReviewCallout run={selectedBenchRun} onSaveReview={handleSaveBenchProofReview} />

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
          <div {...tabPanelProps('results')} style={{ padding: 10 }}>
            {!selectedReport ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
                No results yet. Configure and run an eval.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedReport.name}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => downloadText(`openharness-eval-proof-${selectedReport.id}.md`, buildEvalProofBrief(selectedReport, preparedPackRun))}
                        style={smallBtnStyle}
                      >
                        Export proof brief
                      </button>
                      <button onClick={handleExportEvalReport} style={smallBtnStyle}>Export report</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {runProgressLabel(selectedReport.status, selectedReport.completed, selectedReport.total, 'runs')}
                    {selectedReport.completedAt && ` · ${new Date(selectedReport.completedAt).toLocaleTimeString()}`}
                  </div>
                  {selectedReport.summary?.recommendations.length ? (
                    <div style={{ fontSize: 10, color: selectedReport.proofReview?.status === 'approved' ? 'var(--accent-success)' : 'var(--accent-warning)', marginTop: 4 }}>
                      Recommendation trust: {selectedReport.proofReview?.status === 'approved' ? 'approved proof; safe to use as routing evidence' : 'proof not approved yet; export for review, not automatic role/router changes'}
                    </div>
                  ) : null}
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
                <EvalProofReviewCallout report={selectedReport} onSaveReview={handleSaveEvalProofReview} />

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
          <div {...tabPanelProps('history')} style={{ padding: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Eval Reports
            </div>
            {reports.length === 0 && <div style={{ textAlign: 'center', padding: 15, color: 'var(--text-tertiary)', fontSize: 11 }}>No eval runs yet.</div>}
            {reports.length > HISTORY_VISIBLE_LIMIT && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Showing latest {HISTORY_VISIBLE_LIMIT} of {reports.length} eval reports.
              </div>
            )}
            {reports
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, HISTORY_VISIBLE_LIMIT)
              .map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectReport(r.id)}
                aria-label={`Open eval report ${r.name}`}
                style={historyItemStyle}
              >
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
                <div style={{ fontSize: 10, color: proofReviewHistoryColor((r as api.BenchRunSummary & { proofReview?: api.ProofReviewState }).proofReview), marginTop: 2 }}>
                  {proofReviewHistoryLabel((r as api.BenchRunSummary & { proofReview?: api.ProofReviewState }).proofReview)}
                </div>
              </button>
            ))}

            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>
              Bench Runs
            </div>
            {benchRuns.length === 0 && <div style={{ textAlign: 'center', padding: 15, color: 'var(--text-tertiary)', fontSize: 11 }}>No bench runs yet.</div>}
            {benchRuns.length > HISTORY_VISIBLE_LIMIT && (
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Showing latest {HISTORY_VISIBLE_LIMIT} of {benchRuns.length} bench runs.
              </div>
            )}
            {benchRuns
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, HISTORY_VISIBLE_LIMIT)
              .map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelectBenchRun(r.id)}
                aria-label={`Open bench run ${r.name}`}
                style={historyItemStyle}
              >
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
                <div style={{ fontSize: 10, color: proofReviewHistoryColor((r as api.BenchRunSummary & { proofReview?: api.ProofReviewState }).proofReview), marginTop: 2 }}>
                  {proofReviewHistoryLabel((r as api.BenchRunSummary & { proofReview?: api.ProofReviewState }).proofReview)}
                </div>
              </button>
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
    <div
      role={diagnostic.tone === 'error' ? 'alert' : 'status'}
      aria-live={diagnostic.tone === 'error' ? 'assertive' : 'polite'}
      style={{
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
        <button
          type="button"
          onClick={onDismiss}
          style={{ ...linkBtnStyle, color: 'var(--text-tertiary)' }}
          aria-label={`Dismiss Model Lab message: ${diagnostic.title}`}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function runProgressLabel(status: string, completed: number, total: number, unit: string): string {
  if (status === 'running') return `Running... ${completed}/${total}`;
  if (status === 'error') return `Error after ${completed}/${total} ${unit}`;
  return `${completed} ${unit} completed`;
}

function downloadText(filename: string, content: string, type = 'text/markdown') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function proofReviewHistoryLabel(review?: api.ProofReviewState): string {
  if (review?.status === 'approved') return 'proof approved';
  if (review?.status === 'needs-attention') return 'proof needs attention';
  return 'proof unreviewed';
}

function proofReviewHistoryColor(review?: api.ProofReviewState): string {
  if (review?.status === 'approved') return 'var(--accent-success)';
  if (review?.status === 'needs-attention') return 'var(--accent-warning)';
  return 'var(--text-tertiary)';
}

function buildEvalProofBrief(
  report: api.EvalReport,
  preparedPackRun?: { packId: string; packName: string; evalIds: string[]; matchedEvalIds: string[] } | null,
): string {
  const summary = report.summary;
  const byModel = summary ? Object.entries(summary.byModel) : [];
  const byPromptStrategy = summary?.byPromptStrategy ? Object.entries(summary.byPromptStrategy) : [];
  const failed = report.results.filter((result) => result.status !== 'ok');
  const weakest = averageBreakdown(report.results).weakestSignal;
  const promptIds = Array.from(new Set(report.results.map((result) => result.promptId)));
  const promptStrategies = summarizePromptStrategies(report.results);
  const sameModelComparisons = summarizeSameModelPromptStrategyComparisons(report.results);
  const packContext = report.packContext || preparedPackRun;
  return [
    '# Model Lab Eval Proof Brief',
    '',
    `Run: ${report.name}`,
    `Report id: ${report.id}`,
    `Status: ${report.status}`,
    `Created: ${report.createdAt}`,
    `Completed: ${report.completedAt || 'not complete'}`,
    `Progress: ${report.completed}/${report.total}`,
    `Proof review: ${report.proofReview?.status || 'unreviewed'}${report.proofReview?.reviewedAt ? ` at ${report.proofReview.reviewedAt}` : ''}`,
    ...(report.proofReview?.note ? [`Proof review note: ${report.proofReview.note}`] : []),
    ...(packContext ? [
      '',
      '## Pack execution context',
      '',
      `Pack: ${packContext.packName}`,
      `Pack id: ${packContext.packId}`,
      `Declared eval ids: ${packContext.evalIds.length}`,
      `Installed eval ids selected: ${packContext.matchedEvalIds.length}/${packContext.evalIds.length}`,
      `Executed prompt ids in report: ${promptIds.join(', ') || 'none recorded'}`,
    ] : []),
    '',
    '## Summary',
    '',
    `Best model: ${summary?.bestModel || 'not available'}`,
    `Weakest signal: ${weakest.label} (${weakest.score}/${weakest.maxScore})`,
    `Failures: ${failed.length}/${report.results.length}`,
    `Prompt strategies observed: ${promptStrategies.length > 0 ? promptStrategies.join('; ') : 'not recorded'}`,
    `Same-model prompt strategy comparisons: ${sameModelComparisons.length > 0 ? sameModelComparisons.join('; ') : 'not recorded'}`,
    '',
    '## Model results',
    '',
    ...(byModel.length > 0
      ? byModel.map(([modelId, data]) => `- ${modelId}: score ${data.avgScore}/10, latency ${(data.avgLatencyMs / 1000).toFixed(1)}s, tools ${data.avgToolCount}`)
      : ['- No summary by model recorded.']),
    '',
    '## Prompt strategy results',
    '',
    `Best prompt strategy: ${summary?.bestPromptStrategy || 'not available'}`,
    ...(byPromptStrategy.length > 0
      ? byPromptStrategy.map(([strategyId, data]) => `- ${strategyId}: score ${data.avgScore}/10, family ${data.family}, style ${data.systemStyle}, latency ${(data.avgLatencyMs / 1000).toFixed(1)}s, tools ${data.avgToolCount}, best model ${data.bestModel || 'not available'}`)
      : ['- No prompt strategy summary recorded.']),
    '',
    '## Recommendations',
    '',
    `Recommendation trust: ${report.proofReview?.status === 'approved' ? 'approved proof; may be used as routing evidence' : 'proof not approved; review before applying role or router changes'}`,
    ...(summary?.recommendations?.length
      ? summary.recommendations.map((rec) => `- ${rec.role}: ${rec.modelId} - ${rec.reason}`)
      : ['- No recommendations recorded.']),
    '',
    '## Failed or weak rows',
    '',
    ...report.results
      .filter((result) => result.status !== 'ok' || !result.scores.breakdown?.weakestSignal?.passed)
      .slice(0, 12)
      .map((result) => `- ${result.modelId} / ${result.promptName}: ${result.status}, score ${result.scores.overallScore}/10, weakest ${result.scores.breakdown?.weakestSignal?.label || 'none'}`),
    '',
    '## Evidence available',
    '',
    '- Inspectable output evidence in Model Lab includes response excerpts, failed/weak signals, and tool calls.',
    '- Export report provides the recommendation-oriented markdown artifact.',
  ].join('\n');
}

function buildBenchProofBrief(run: api.BenchRun): string {
  const summary = run.summary;
  const byModel = summary ? Object.entries(summary.byModel) : [];
  const failed = run.results.filter((result) => result.status === 'error' || result.status === 'validation-failed' || !result.validationPassed);
  const validationPasses = run.results.filter((result) => result.validationPassed).length;
  const traceWarnings = run.results.flatMap((result) => result.traceProof?.warnings || []);
  const promptStrategies = summarizePromptStrategies(run.results);
  const sameModelComparisons = summarizeSameModelPromptStrategyComparisons(run.results);
  return [
    '# Model Lab Bench Proof Brief',
    '',
    `Run: ${run.name}`,
    `Run id: ${run.id}`,
    `Status: ${run.status}`,
    `Created: ${run.createdAt}`,
    `Completed: ${run.completedAt || 'not complete'}`,
    `Progress: ${run.completed}/${run.total}`,
    `Proof review: ${run.proofReview?.status || 'unreviewed'}${run.proofReview?.reviewedAt ? ` at ${run.proofReview.reviewedAt}` : ''}`,
    ...(run.proofReview?.note ? [`Proof review note: ${run.proofReview.note}`] : []),
    '',
    '## Summary',
    '',
    `Best model: ${summary?.bestModel || 'not available'}`,
    `Ranking trust: ${run.proofReview?.status === 'approved' ? 'approved proof; may be used as routing evidence' : 'proof not approved; review before applying role or router changes'}`,
    `Best model reason: ${summary?.bestModelReason || 'not available'}`,
    `Validation passes: ${validationPasses}/${run.results.length}`,
    `Failures or validation failures: ${failed.length}/${run.results.length}`,
    `Regression flags: ${summary?.regressionFlags.length || 0}`,
    `Prompt strategies observed: ${promptStrategies.length > 0 ? promptStrategies.join('; ') : 'not recorded'}`,
    `Same-model prompt strategy comparisons: ${sameModelComparisons.length > 0 ? sameModelComparisons.join('; ') : 'not recorded'}`,
    '',
    '## Model results',
    '',
    ...(byModel.length > 0
      ? byModel.map(([modelId, data]) => [
        `- ${modelId}: ${data.resolved} resolved, ${data.partial} partial, ${data.unresolved} unresolved, ${data.assisted || 0} assisted`,
        `  Score ${data.avgScore}/10, validation ${data.avgValidationScore}/2, latency ${(data.avgLatencyMs / 1000).toFixed(1)}s, cost $${data.avgCost.toFixed(6)}, value ${data.valueScore}`,
      ].join('\n'))
      : ['- No summary by model recorded.']),
    '',
    '## Failed or weak rows',
    '',
    ...(failed.length > 0
      ? failed.slice(0, 12).map((result) => `- ${result.taskName} / ${result.modelId}: ${result.status}, validation ${result.validationPassed ? 'pass' : 'fail'}, score ${result.scores.overallScore}/10${firstValidationFinding(result) ? `, finding: ${firstValidationFinding(result)}` : ''}`)
      : ['- No failed rows recorded.']),
    '',
    '## Trace warnings',
    '',
    ...(traceWarnings.length > 0
      ? [...new Set(traceWarnings)].slice(0, 12).map((warning) => `- ${warning}`)
      : ['- No trace warnings recorded.']),
    '',
    '## Evidence available',
    '',
    '- Inspectable bench evidence in Model Lab includes prompts, trace proof, rubric coverage, validation output, and response excerpts.',
    '- Export JSON provides the full machine-readable bench artifact.',
  ].join('\n');
}

function buildPromptPackEvidenceBrief(
  pack: api.PromptPluginRegistry['packs'][number],
  plugins: api.PromptPluginSummary[],
  prompts: api.PromptCase[],
): string {
  const installedPromptIds = new Set(prompts.map((prompt) => prompt.id));
  const evals = plugins.flatMap((plugin) =>
    plugin.evals.map((ev) => ({
      pluginId: plugin.id,
      id: ev.id,
      minimumScore: ev.minimumScore,
      installed: installedPromptIds.has(ev.id),
    }))
  );
  const installed = evals.filter((ev) => ev.installed);
  const blockedPlugins = plugins.filter((plugin) => plugin.status !== 'ready' || plugin.trust === 'blocked');
  return [
    '# Prompt Pack Evidence Brief',
    '',
    `Pack: ${pack.name}`,
    `Pack id: ${pack.id}`,
    `Trust: ${pack.trust}`,
    `Sources: ${pack.sources.join(', ') || 'none recorded'}`,
    `Manifest count: ${pack.pluginCount}`,
    `Plugin ids: ${pack.pluginIds.join(', ') || 'none recorded'}`,
    '',
    '## Eval coverage',
    '',
    `Declared eval ids: ${evals.length}`,
    `Installed eval prompts: ${installed.length}/${evals.length}`,
    '',
    ...(evals.length > 0
      ? evals.map((ev) => `- ${ev.id}: ${ev.installed ? 'installed' : 'missing'}; minimum score ${ev.minimumScore}; plugin ${ev.pluginId}`)
      : ['- No eval IDs declared by this pack.']),
    '',
    '## Manifest health',
    '',
    ...(plugins.length > 0
      ? plugins.map((plugin) => [
        `- ${plugin.name} (${plugin.id})`,
        `  Status: ${plugin.status}; trust: ${plugin.trust}; version: ${plugin.version}`,
        `  Sections: ${plugin.sections.length}; evals: ${plugin.evals.length}; path: ${plugin.path}`,
        plugin.issues.length > 0 ? `  Issues: ${plugin.issues.join('; ')}` : '',
      ].filter(Boolean).join('\n'))
      : ['- No plugin manifests matched this pack in the current registry.']),
    '',
    '## Risks',
    '',
    ...(blockedPlugins.length > 0
      ? blockedPlugins.map((plugin) => `- ${plugin.id}: ${plugin.status}/${plugin.trust}${plugin.issues.length ? ` - ${plugin.issues.join('; ')}` : ''}`)
      : ['- No blocked or invalid plugin manifests detected for this pack.']),
    '',
    '## Next proof action',
    '',
    installed.length > 0
      ? `Run Model Lab Eval with the ${installed.length} installed prompt id${installed.length === 1 ? '' : 's'} selected from this pack, then export the eval proof brief.`
      : 'Add or install matching eval prompt cases before claiming this pack has runnable proof.',
  ].join('\n');
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

function EvalProofReviewCallout({ report, onSaveReview }: { report: api.EvalReport; onSaveReview: (status: api.ProofReviewState['status'], note?: string) => void }) {
  const failed = report.results.filter((result) => result.status !== 'ok');
  const complete = report.status === 'complete' && report.completed === report.total;
  const weakest = averageBreakdown(report.results).weakestSignal;
  const packContext = report.packContext;
  const needsAttention = !complete || failed.length > 0 || !weakest.passed;
  const checklist = [
    complete ? `Complete run: ${report.completed}/${report.total}` : `Incomplete run: ${report.completed}/${report.total}`,
    failed.length === 0 ? 'No failed eval rows' : `${failed.length} failed eval row${failed.length === 1 ? '' : 's'}`,
    weakest.passed ? `Weakest signal still passing: ${weakest.label}` : `Weakest signal needs review: ${weakest.label}`,
    packContext ? `Pack provenance saved: ${packContext.packName}` : 'No pack provenance on this run',
    'Export proof brief and recommendation report before applying role/router changes',
  ];
  return (
    <ProofReviewCallout
      title={needsAttention ? 'Eval proof needs review' : 'Eval proof ready for review'}
      tone={needsAttention ? 'warning' : 'success'}
      checklist={checklist}
      review={report.proofReview}
      onSaveReview={onSaveReview}
    />
  );
}

function BenchProofReviewCallout({ run, onSaveReview }: { run: api.BenchRun; onSaveReview: (status: api.ProofReviewState['status'], note?: string) => void }) {
  const complete = run.status === 'complete' && run.completed === run.total;
  const validationFailures = run.results.filter((result) => !result.validationPassed);
  const traceWarnings = run.results.flatMap((result) => result.traceProof?.warnings || []);
  const regressions = run.summary?.regressionFlags || [];
  const needsAttention = !complete || validationFailures.length > 0 || traceWarnings.length > 0 || regressions.length > 0;
  const checklist = [
    complete ? `Complete bench: ${run.completed}/${run.total}` : `Incomplete bench: ${run.completed}/${run.total}`,
    validationFailures.length === 0 ? 'Validation passed for every result row' : `${validationFailures.length} validation issue${validationFailures.length === 1 ? '' : 's'} need review`,
    traceWarnings.length === 0 ? 'No trace warnings recorded' : `${traceWarnings.length} trace warning${traceWarnings.length === 1 ? '' : 's'} recorded`,
    regressions.length === 0 ? 'No regression flags recorded' : `${regressions.length} regression flag${regressions.length === 1 ? '' : 's'} recorded`,
    'Export proof brief and JSON before trusting model rankings',
  ];
  return (
    <ProofReviewCallout
      title={needsAttention ? 'Bench proof needs review' : 'Bench proof ready for review'}
      tone={needsAttention ? 'warning' : 'success'}
      checklist={checklist}
      review={run.proofReview}
      onSaveReview={onSaveReview}
    />
  );
}

function ProofReviewCallout({
  title,
  tone,
  checklist,
  review,
  onSaveReview,
}: {
  title: string;
  tone: 'success' | 'warning';
  checklist: string[];
  review?: api.ProofReviewState;
  onSaveReview: (status: api.ProofReviewState['status'], note?: string) => void;
}) {
  const [note, setNote] = useState(review?.note || '');
  useEffect(() => {
    setNote(review?.note || '');
  }, [review?.note, review?.status, review?.reviewedAt]);
  const color = tone === 'success' ? 'var(--accent-success)' : 'var(--accent-warning)';
  return (
    <div role="group" aria-label={title} style={{ marginBottom: 12, padding: 8, borderRadius: 6, background: 'var(--bg-secondary)', border: `1px solid ${color}` }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
        {title}
      </div>
      <div role="list" aria-label={`${title} checklist`} style={{ display: 'grid', gap: 3 }}>
        {checklist.map((item) => (
          <div key={item} role="listitem" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>- {item}</div>
        ))}
      </div>
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-primary)' }}>
        <div role="status" aria-live="polite" style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5 }}>
          Review state: <span style={{ color: review?.status === 'approved' ? 'var(--accent-success)' : review?.status === 'needs-attention' ? 'var(--accent-warning)' : 'var(--text-secondary)', fontWeight: 700 }}>
            {review?.status || 'unreviewed'}
          </span>
          {review?.reviewedAt ? ` · ${new Date(review.reviewedAt).toLocaleString()}` : ''}
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Proof review note
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional proof review note"
            style={{ width: '100%', minHeight: 54, resize: 'vertical', borderRadius: 6, border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 11, padding: 6 }}
          />
        </label>
        <div role="group" aria-label="Proof review actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          <button
            type="button"
            style={smallBtnStyle}
            title="Mark this proof as approved so it can be used as trusted routing or role evidence"
            aria-label="Mark proof approved for trusted routing or role evidence"
            onClick={() => onSaveReview('approved', note)}
          >
            Mark approved
          </button>
          <button
            type="button"
            style={smallBtnStyle}
            title="Mark this proof as needing attention so it is blocked from trusted routing or role use"
            aria-label="Mark proof as needing attention and block trusted routing or role use"
            onClick={() => onSaveReview('needs-attention', note)}
          >
            Needs attention
          </button>
          <button
            type="button"
            style={smallBtnStyle}
            title="Clear this proof review and return it to unreviewed"
            aria-label="Clear proof review and return to unreviewed"
            onClick={() => onSaveReview('unreviewed', note)}
          >
            Clear review
          </button>
        </div>
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

function summarizePromptStrategies(results: Array<{ modelId: string; promptStrategy?: api.PromptStrategyTrace }>): string[] {
  const counts = new Map<string, { strategy: api.PromptStrategyTrace; models: Set<string>; count: number }>();
  for (const result of results) {
    if (!result.promptStrategy) continue;
    const key = promptStrategyEvidenceKey(result.promptStrategy);
    const existing = counts.get(key) || { strategy: result.promptStrategy, models: new Set<string>(), count: 0 };
    existing.models.add(result.modelId);
    existing.count++;
    counts.set(key, existing);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.strategy.id.localeCompare(b.strategy.id))
    .slice(0, 8)
    .map(({ strategy, models, count }) => `${promptStrategyEvidenceKey(strategy)} (${strategy.family}, ${strategy.systemStyle}${strategy.taskType ? `, task ${strategy.taskType}` : ''}${strategy.role ? `, role ${strategy.role}` : ''}${strategy.bestPractice ? `, eval cue: ${strategy.bestPractice.evaluationCue}, source: ${strategy.bestPractice.sourceRef}` : ''}, ${count} row${count === 1 ? '' : 's'}, models: ${[...models].slice(0, 3).join(', ')}${models.size > 3 ? ', ...' : ''})`);
}

function promptStrategyEvidenceKey(strategy: api.PromptStrategyTrace): string {
  return strategy.variantId ? `${strategy.id}:${strategy.variantId}` : strategy.id;
}

function summarizeSameModelPromptStrategyComparisons(results: Array<{ modelId: string; promptId?: string; promptName?: string; taskId?: string; taskName?: string; promptStrategy?: api.PromptStrategyTrace }>): string[] {
  const byModelAndWork = new Map<string, { modelId: string; workLabel: string; strategies: Set<string> }>();
  for (const result of results) {
    if (!result.promptStrategy) continue;
    const workLabel = result.promptName || result.promptId || result.taskName || result.taskId || 'unknown prompt/task';
    const key = `${result.modelId}::${workLabel}`;
    const existing = byModelAndWork.get(key) || { modelId: result.modelId, workLabel, strategies: new Set<string>() };
    existing.strategies.add(promptStrategyEvidenceKey(result.promptStrategy));
    byModelAndWork.set(key, existing);
  }
  return [...byModelAndWork.values()]
    .filter(({ strategies }) => strategies.size > 1)
    .sort((a, b) => a.modelId.localeCompare(b.modelId) || a.workLabel.localeCompare(b.workLabel))
    .map(({ modelId, workLabel, strategies }) => `${modelId} / ${workLabel}: ${[...strategies].sort().join(', ')}`);
}

function PromptStrategyEvidence({ strategy }: { strategy?: api.PromptStrategyTrace }) {
  if (!strategy) return <span>No prompt strategy trace recorded for this row.</span>;
  return (
    <div>
      <div>{strategy.id}</div>
      {strategy.modelMatch && <div>Model match {strategy.modelMatch.source} · {strategy.modelMatch.hint}</div>}
      {strategy.variantId && <div>Variant {strategy.variantId} · task {strategy.taskType || 'unknown'} · role {strategy.role || 'unknown'}</div>}
      <div>Family {strategy.family} · style {strategy.systemStyle} · context {strategy.contextOrder}</div>
      <div>Examples {strategy.examplePolicy} · reasoning {strategy.reasoningPolicy} · tools {strategy.toolPolicy} · output {strategy.outputContract}</div>
      {strategy.selectionReason && <div>{strategy.selectionReason}</div>}
      <div>Reviewed {strategy.updatedAt}</div>
    </div>
  );
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
          <EvidenceBlock title="Prompt strategy">
            <PromptStrategyEvidence strategy={result.promptStrategy} />
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
          <EvidenceBlock title="Prompt strategy">
            <PromptStrategyEvidence strategy={result.promptStrategy} />
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

interface ProviderHealthSignal {
  tracked: number;
  failing: number;
  stale: number;
  latestChecked?: string;
  maxLatencyMs?: number;
  errors: string[];
}

function summarizeProviderHealth(raw: unknown): ProviderHealthSignal | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as any;
  const historyMap = value.history && typeof value.history === 'object'
    ? value.history
    : value.providers && Array.isArray(value.providers)
      ? Object.fromEntries(value.providers.map((provider: any) => [provider.providerId || provider.providerName || 'provider', provider.latest ? [provider.latest] : []]))
      : value;
  const entries = Object.entries(historyMap)
    .filter(([, history]) => Array.isArray(history)) as Array<[string, any[]]>;
  if (entries.length === 0) return null;

  let failing = 0;
  let stale = 0;
  let latestChecked: string | undefined;
  let maxLatencyMs: number | undefined;
  const errors: string[] = [];

  for (const [providerId, history] of entries) {
    const latest = history.at(-1);
    if (!latest) {
      stale += 1;
      continue;
    }
    const ok = latest.ok === true || latest.status === 'ok';
    const timestamp = latest.timestamp || latest.lastChecked;
    const ageMs = timestamp ? Date.now() - new Date(timestamp).getTime() : Number.POSITIVE_INFINITY;
    const isStale = latest.stale === true || ageMs > 6 * 60 * 60 * 1000;
    if (!ok) failing += 1;
    if (isStale) stale += 1;
    if (timestamp && (!latestChecked || timestamp > latestChecked)) latestChecked = timestamp;
    const latencyMs = typeof latest.latencyMs === 'number' ? latest.latencyMs : latest.lastLatencyMs;
    if (typeof latencyMs === 'number') maxLatencyMs = Math.max(maxLatencyMs || 0, latencyMs);
    const error = latest.error || latest.lastError;
    if (error) errors.push(`${providerId}: ${String(error).slice(0, 90)}`);
  }

  return { tracked: entries.length, failing, stale, latestChecked, maxLatencyMs, errors: errors.slice(0, 3) };
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

const modelLabPackGuidance = [
  {
    label: 'Calibration',
    title: 'Open-source calibration pass',
    body: 'Start with the cheapest strong local or open candidates, then run the same prompt pack across coder, reviewer, and summarizer roles before changing defaults.',
    proof: 'Best for proving a model is safe to promote without accidentally rewarding one lucky prompt.',
  },
  {
    label: 'Comparison',
    title: 'Frontier comparison pass',
    body: 'Keep the matrix tight: current default, one premium challenger, and one low-cost challenger on identical prompts. Export the report before applying role changes.',
    proof: 'Best for showing whether a premium model earns its spend instead of merely feeling more polished.',
  },
  {
    label: 'Router',
    title: 'Auto-router trust pass',
    body: 'Use pack results to compare task fit, then check Agent Roles and Auto-Router for eval-backed cues before trusting dynamic routing in daily work.',
    proof: 'Best for turning Model Lab results into routing behavior the user can understand and reverse.',
  },
];

function PromptPacksTab({ registry, prompts, onPrepare, onImportSkill, onSelectEvalIds }: {
  registry: api.PromptPluginRegistry | null;
  prompts: api.PromptCase[];
  onPrepare: () => void;
  onImportSkill: (sourcePath: string) => Promise<void>;
  onSelectEvalIds: (evalIds: string[], pack: api.PromptPluginRegistry['packs'][number]) => void;
}) {
  const [sourcePath, setSourcePath] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const plugins = registry?.plugins || [];
  const packs = registry?.packs || [];
  const roots = registry?.roots || [];
  const promptIds = new Set(prompts.map((prompt) => prompt.id));
  const packPlugins = (pack: api.PromptPluginRegistry['packs'][number]) => plugins.filter((plugin) =>
    pack.pluginIds.includes(plugin.id) || plugin.packs.some((pluginPack) => pluginPack.id === pack.id)
  );
  const packEvalIds = (pack: api.PromptPluginRegistry['packs'][number]) => Array.from(new Set(
    packPlugins(pack).flatMap((plugin) => plugin.evals.map((ev) => ev.id))
  ));
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
        <button
          type="button"
          onClick={onPrepare}
          style={smallBtnStyle}
          aria-label="Prepare Model Lab prompt pack folders"
        >
          Prepare folders
        </button>
      </div>

      <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
        <div style={sectionLabelStyle}>Registry roots</div>
        {roots.length === 0 ? (
          <div role="status" aria-live="polite" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No registry roots loaded.</div>
        ) : roots.map((root) => (
          <div key={root.path} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, fontSize: 10 }}>
            <span
              style={{ color: root.exists ? 'var(--accent-success)' : 'var(--text-tertiary)', width: 54 }}
              aria-label={`${root.location} prompt pack registry root ${root.exists ? 'ready' : 'missing'} at ${root.path}`}
            >
              {root.exists ? 'Ready' : 'Missing'}
            </span>
            <span style={{ color: 'var(--text-secondary)', width: 54, textTransform: 'capitalize' }}>{root.location}</span>
            <span style={{ color: 'var(--text-tertiary)', fontFamily: 'SF Mono, Menlo, Consolas, monospace', wordBreak: 'break-all' }}>{root.path}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
        <div style={sectionLabelStyle}>Calibration and comparison packs</div>
        <div style={{ marginBottom: 8, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
          Use prompt packs as repeatable proof runs: calibrate cheaper candidates first, compare frontier models second, then apply only the role or router changes the report supports.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          {modelLabPackGuidance.map((card) => (
            <div key={card.title} style={{ padding: 8, border: '1px solid var(--border-primary)', borderRadius: 6, background: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ padding: '2px 5px', borderRadius: 999, background: 'var(--accent-primary-muted)', color: 'var(--accent-primary)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {card.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{card.title}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{card.body}</div>
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.35 }}>{card.proof}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
          Loaded registry signal: {packs.length} pack{packs.length === 1 ? '' : 's'} across {plugins.length} manifest{plugins.length === 1 ? '' : 's'}.
        </div>
      </div>

      <div style={{ marginBottom: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, border: '1px solid var(--border-primary)' }}>
        <div style={sectionLabelStyle}>Import skill</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={sourcePath}
            onChange={(event) => setSourcePath(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && importSkill()}
            placeholder="/path/to/skill-folder or /path/to/SKILL.md"
            aria-label="Skill folder or SKILL.md path to import as a Model Lab prompt pack"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={importSkill}
            disabled={importing || !sourcePath.trim()}
            style={smallBtnStyle}
            aria-label="Import skill as a Model Lab prompt pack"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
        {importError && <div role="alert" style={{ marginTop: 6, fontSize: 10, color: 'var(--accent-error)' }}>{importError}</div>}
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
                {(() => {
                  const evalIds = packEvalIds(pack);
                  const matched = evalIds.filter((id) => promptIds.has(id));
                  return (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-primary)' }}>
                      <div style={{ fontSize: 10, color: matched.length > 0 ? 'var(--accent-success)' : 'var(--text-tertiary)' }}>
                        Eval evidence: {matched.length}/{evalIds.length} prompt id{evalIds.length === 1 ? '' : 's'} installed
                      </div>
                      {evalIds.length > 0 && (
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {evalIds.slice(0, 5).map((id) => (
                            <span key={id} style={{ ...tagStyle, color: promptIds.has(id) ? 'var(--accent-success)' : 'var(--text-tertiary)' }}>{id}</span>
                          ))}
                          {evalIds.length > 5 && <span style={tagStyle}>+{evalIds.length - 5}</span>}
                        </div>
                      )}
                      <button
                        type="button"
                        style={{ ...smallBtnStyle, marginTop: 6, width: '100%' }}
                        disabled={evalIds.length === 0}
                        onClick={() => onSelectEvalIds(evalIds, pack)}
                        title={evalIds.length > 0 ? 'Select matching eval prompts for a Model Lab run' : 'This pack does not declare eval prompts yet'}
                        aria-label={`Prepare eval run from ${pack.name} prompt pack with ${matched.length} installed prompt${matched.length === 1 ? '' : 's'} out of ${evalIds.length}`}
                      >
                        Prepare eval run from pack
                      </button>
                      <button
                        type="button"
                        style={{ ...smallBtnStyle, marginTop: 6, width: '100%' }}
                        onClick={() => downloadText(`openharness-pack-evidence-${pack.id}.md`, buildPromptPackEvidenceBrief(pack, packPlugins(pack), prompts))}
                        aria-label={`Export evidence brief for ${pack.name} prompt pack`}
                      >
                        Export pack evidence brief
                      </button>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={sectionLabelStyle}>Manifests ({plugins.length})</div>
      {plugins.length === 0 ? (
        <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: 30, color: 'var(--text-tertiary)' }}>
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
  return <span style={{ ...pillStyle, ...colors }} aria-label={`Prompt pack trust: ${trust}`}>{trust}</span>;
}

function StatusPill({ status }: { status: api.PromptPluginSummary['status'] }) {
  const colors = status === 'ready'
    ? { background: 'rgba(34,197,94,0.14)', color: 'var(--accent-success)' }
    : status === 'blocked'
      ? { background: 'rgba(239,68,68,0.14)', color: 'var(--accent-error)' }
      : { background: 'rgba(245,158,11,0.14)', color: 'var(--accent-warning)' };
  return <span style={{ ...pillStyle, ...colors }} aria-label={`Prompt pack manifest status: ${status}`}>{status}</span>;
}

function ModelSelection({ models, selected, onToggle, onSelectAll, onClear }: {
  models: Array<ModelLabSelectableModel>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const modelGroupLabel = `${selected.size} of ${models.length} Model Lab provider-call candidate${models.length === 1 ? '' : 's'} selected`;
  return (
    <div style={{ marginBottom: 16 }} role="group" aria-label={modelGroupLabel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={labelStyle}>Models ({selected.size} selected)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onSelectAll}
            style={linkBtnStyle}
            aria-label={`Select all ${models.length} Model Lab provider-call candidate${models.length === 1 ? '' : 's'}`}
          >
            Select all
          </button>
          <button
            type="button"
            onClick={onClear}
            style={linkBtnStyle}
            aria-label="Clear all selected models for Model Lab provider-call runs"
          >
            Clear all
          </button>
        </div>
      </div>
      {models.map(m => (
        <label key={m.id} style={checkboxRowStyle(selected.has(m.id))}>
          <input
            type="checkbox"
            checked={selected.has(m.id)}
            onChange={() => onToggle(m.id)}
            aria-label={`${selected.has(m.id) ? 'Deselect' : 'Select'} ${m.name} for Model Lab provider-call runs`}
          />
          <div>
            <div style={{ color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{m.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{providerModelKey(m.providerName)}</span>
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: 10, marginTop: 2 }}>
              Source: <span style={{ color: m.modelSource === 'open-source' ? '#22c55e' : '#3b82f6' }}>{m.modelSource}</span>
              {' · '}
              Category: {m.modelSource === 'open-source' ? 'open-source / local' : 'frontier'}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}

function ModelSourceFilter({ value, counts, onChange }: {
  value: ModelSourceCategory;
  counts: Record<ModelSourceCategory, number>;
  onChange: (value: ModelSourceCategory) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Model source filter for frontier vs open-source model comparison"
      style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}
    >
      {(
        [
          ['all', 'All models'],
          ['frontier', 'Frontier'],
          ['open-source', 'Open source'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          style={value === key ? filterBtnStyle : filterBtnStyleInactive}
          aria-label={`Show ${label.toLowerCase()} models in Model Lab`}
        >
          {label} ({counts[key]})
        </button>
      ))}
    </div>
  );
}

function MatrixRunCaution({
  kind,
  selectedItems,
  selectedModels,
  extraRuns = 0,
  providerHealthSignal,
}: {
  kind: 'eval' | 'bench';
  selectedItems: number;
  selectedModels: number;
  extraRuns?: number;
  providerHealthSignal?: ProviderHealthSignal | null;
}) {
  const totalRuns = selectedItems * selectedModels + extraRuns;
  if (totalRuns === 0) return null;
  const tone = totalRuns >= 20 ? 'high' : totalRuns >= 8 ? 'medium' : 'low';
  const border = tone === 'high' ? 'var(--accent-error)' : tone === 'medium' ? 'var(--accent-warning)' : 'var(--border-primary)';
  const title = tone === 'high'
    ? 'Large background run'
    : tone === 'medium'
      ? 'Moderate background run'
      : 'Small background run';
  const unit = kind === 'eval' ? 'prompt/model call' : 'task/model run';
  const advisoryLabel = `${title}: ${totalRuns} ${unit}${totalRuns === 1 ? '' : 's'}. Provider rate-limit and metered billing caution.`;
  return (
    <div
      role={tone === 'high' ? 'alert' : 'status'}
      aria-live={tone === 'high' ? 'assertive' : 'polite'}
      aria-label={advisoryLabel}
      style={{
      margin: '10px 0',
      padding: '9px 10px',
      borderRadius: 6,
      border: `1px solid ${border}`,
      background: tone === 'low'
        ? 'var(--bg-secondary)'
        : tone === 'medium'
          ? 'color-mix(in srgb, var(--accent-warning) 10%, var(--bg-secondary))'
          : 'color-mix(in srgb, var(--accent-error) 8%, var(--bg-secondary))',
      color: 'var(--text-secondary)',
      fontSize: 11,
      lineHeight: 1.4,
    }}>
      <div style={{
        color: tone === 'high' ? 'var(--accent-error)' : tone === 'medium' ? 'var(--accent-warning)' : 'var(--text-primary)',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 3,
      }}>
        {title}: {totalRuns} {unit}{totalRuns === 1 ? '' : 's'}
      </div>
      <div>
        Model Lab runs execute in the background and can hit provider rate limits or metered billing.
        Start with a small matrix, prefer subscription/low-cost candidates for sweeps, and reserve premium models for final comparisons.
      </div>
      {providerHealthSignal && (
        <div style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: '1px solid var(--border-primary)',
          display: 'grid',
          gap: 3,
        }}>
          <div style={{ color: providerHealthSignal.failing > 0 ? 'var(--accent-error)' : providerHealthSignal.stale > 0 ? 'var(--accent-warning)' : 'var(--text-secondary)', fontWeight: 700 }}>
            Provider health: {providerHealthSignal.tracked} tracked
            {providerHealthSignal.failing > 0 ? ` · ${providerHealthSignal.failing} failing` : ''}
            {providerHealthSignal.stale > 0 ? ` · ${providerHealthSignal.stale} stale` : ''}
            {typeof providerHealthSignal.maxLatencyMs === 'number' ? ` · slowest ${providerHealthSignal.maxLatencyMs}ms` : ''}
          </div>
          {providerHealthSignal.latestChecked && (
            <div style={{ color: 'var(--text-tertiary)' }}>Latest health check: {new Date(providerHealthSignal.latestChecked).toLocaleString()}</div>
          )}
          {providerHealthSignal.errors.length > 0 && (
            <div style={{ color: 'var(--accent-error)' }}>{providerHealthSignal.errors.join(' · ')}</div>
          )}
        </div>
      )}
    </div>
  );
}

function matrixRunCount(selectedItems: number, selectedModels: number, extraRuns = 0): number {
  return selectedItems * selectedModels + extraRuns;
}

function matrixRunApprovalLabel(kind: 'eval' | 'bench', selectedItems: number, selectedModels: number, extraRuns = 0): string {
  const totalRuns = matrixRunCount(selectedItems, selectedModels, extraRuns);
  if (totalRuns === 0) return kind === 'eval' ? 'Run Eval' : 'Run Bench';
  const unit = kind === 'eval' ? 'call' : 'run';
  const base = kind === 'eval' ? 'Run Eval after approval' : 'Run Bench after approval';
  return `${base} (${totalRuns} ${unit}${totalRuns === 1 ? '' : 's'})`;
}

function matrixRunApprovalTitle(kind: 'eval' | 'bench', selectedItems: number, selectedModels: number, extraRuns = 0): string {
  const totalRuns = matrixRunCount(selectedItems, selectedModels, extraRuns);
  const label = kind === 'eval' ? 'Eval' : 'Bench';
  if (totalRuns === 0) {
    return `Select at least one ${kind === 'eval' ? 'prompt' : 'task'} and one model before running ${label}.`;
  }
  const matrix = kind === 'eval'
    ? `${selectedItems} prompt${selectedItems === 1 ? '' : 's'} by ${selectedModels} model${selectedModels === 1 ? '' : 's'}`
    : `${selectedItems} task${selectedItems === 1 ? '' : 's'} by ${selectedModels} model${selectedModels === 1 ? '' : 's'}${extraRuns ? ` plus ${extraRuns} Planning Room baseline run${extraRuns === 1 ? '' : 's'}` : ''}`;
  return `Provider-budget approval required before running ${label}. This selection may call configured providers for ${totalRuns} ${kind === 'eval' ? 'prompt/model call' : 'task/model run'}${totalRuns === 1 ? '' : 's'}: ${matrix}.`;
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

const filterBtnStyle: React.CSSProperties = {
  background: 'var(--accent-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 10,
  cursor: 'pointer',
};

const filterBtnStyleInactive: React.CSSProperties = {
  ...filterBtnStyle,
  background: 'var(--bg-secondary)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-primary)',
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
  display: 'block',
  width: '100%',
  padding: '8px 10px', marginBottom: 4, borderRadius: 6,
  background: 'var(--bg-secondary)', cursor: 'pointer',
  border: '1px solid var(--border-primary)',
  textAlign: 'left',
  font: 'inherit',
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
