import { useState, useEffect, useCallback, useMemo } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight, AlertTriangle, Cpu, Wrench, MessageSquare, Zap, ShieldCheck, Download } from 'lucide-react';
import type { HarnessRun, HarnessRunStep } from '../types';
import * as api from '../utils/api';
import { ROUTING_FEEDBACK_GUIDANCE, autoRouterDecisionLabel, autoRouterStepTraceText, candidateScoresUnavailableLabel, sortedCandidateScores } from '../utils/autoRouterTrace';

interface Props {
  runTrace: HarnessRun | undefined;
}

export function PromptMicroscope({ runTrace }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [redactionOn, setRedactionOn] = useState(true);
  const [estimates, setEstimates] = useState<api.SectionEstimate[] | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const sections = useMemo(() => {
    if (!runTrace) return [];
    const out: Array<{ id: string; label: string; text: string }> = [];
    for (const step of runTrace.steps) {
      if (step.type === 'prompt_built') {
        if (step.assembly?.sections?.length) {
          for (const section of step.assembly.sections) {
            if (section.id === 'output-style') continue;
            if (!section.included && !section.preview) continue;
            out.push({
              id: `assembly:${section.id}`,
              label: `${section.label} · ${section.source} · ${section.reason}`,
              text: section.preview || '(not included)',
            });
          }
        } else {
          out.push({ id: `prompt:${step.toolCount}`, label: 'System prompt', text: step.promptPreview });
        }
      } else if (step.type === 'repo_map') {
        out.push({ id: `repomap:${step.tokenBudget}`, label: `Repo map (budget ${step.tokenBudget})`, text: step.topFiles.join('\n') });
      } else if (step.type === 'context_pack') {
        out.push({ id: `contextpack:${step.tokens}`, label: `Context pack (${step.tokens} tokens)`, text: step.pack });
      } else if (step.type === 'model_text') {
        out.push({ id: `modeltext:${step.chars}`, label: `Model output (${step.chars} chars)`, text: step.chars > 0 ? '(streamed text)' : '(empty)' });
      } else if (step.type === 'model_thinking') {
        out.push({
          id: `modelthinking:${step.source}:${step.chars}`,
          label: step.source === 'router' ? `Router rationale (${step.chars} chars)` : `Model thinking (${step.chars} chars)`,
          text: step.preview || (step.source === 'router' ? '(classifier rationale)' : '(provider thinking stream)'),
        });
      } else if (step.type === 'auto_router') {
        out.push({
          id: `autorouter:${step.modelId}:${step.score}`,
          label: `Auto-Router ${step.fallback ? 'fallback' : 'decision'}`,
          text: autoRouterStepTraceText(step),
        });
      } else if (step.type === 'tool_call') {
        out.push({ id: `toolcall:${step.id}`, label: `Tool call: ${step.name}`, text: typeof step.input === 'string' ? step.input : JSON.stringify(step.input) });
      } else if (step.type === 'final_answer') {
        out.push({ id: `final:${step.chars}`, label: `Final answer (${step.chars} chars)`, text: '(streamed to user)' });
      } else if (step.type === 'route') {
        out.push({ id: `route:${step.role}`, label: `Route → ${step.role}`, text: step.reason ?? '' });
      }
    }
    return out;
  }, [runTrace]);

  // Server-side redaction + token estimate.
  useEffect(() => {
    if (!expanded || sections.length === 0) return;
    let cancelled = false;
    api.estimatePromptSections(sections).then((res) => {
      if (!cancelled) setEstimates(res);
    }).catch(() => {
      if (!cancelled) setEstimates(null);
    });
    return () => { cancelled = true; };
  }, [expanded, sections]);

  const reapplyRedaction = useCallback((text: string): string => {
    if (!redactionOn) return text;
    // We use the cached estimate's redacted text; if no estimate yet, just return the raw text.
    return text;
  }, [redactionOn]);

  const handleExportDebugBundle = useCallback(async () => {
    if (!runTrace) return;
    try {
      await api.downloadRunDebugBundle(runTrace.id);
      setExportStatus('Exported');
      window.setTimeout(() => setExportStatus(null), 2000);
    } catch (err) {
      setExportStatus(err instanceof Error ? err.message : 'Export failed');
    }
  }, [runTrace]);

  if (!runTrace) return null;

  const routeStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'route' }> => s.type === 'route');
  const autoRouterStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'auto_router' }> => s.type === 'auto_router');
  const autoRouterScores = sortedCandidateScores(autoRouterStep?.candidateScores);
  const promptStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'prompt_built' }> => s.type === 'prompt_built');
  const outputStyle = promptStep?.outputStyle || promptStep?.assembly?.outputStyle;
  const orchestrationStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'orchestration' }> => s.type === 'orchestration');
  const errorSteps = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'error' }> => s.type === 'error');
  const modelRequests = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'model_request' }> => s.type === 'model_request');
  const toolCalls = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'tool_call' }> => s.type === 'tool_call');
  const worktreeIsolation = runTrace.steps.slice().reverse().find((s): s is Extract<HarnessRunStep, { type: 'worktree_isolation' }> => s.type === 'worktree_isolation');
  const totalTokens = estimates?.reduce((sum, s) => sum + s.tokens, 0) ?? 0;
  const totalRedactions = estimates?.reduce((sum, s) => sum + s.redactedHits, 0) ?? 0;

  return (
    <div className="prompt-microscope">
      <button className="pm-toggle" type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} prompt microscope for route, prompt, tool, and model evidence`}>
        {expanded ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
        <span>Prompt microscope</span>
        {expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
        {totalRedactions > 0 && (
          <span className="pm-redact-pill" title={`${totalRedactions} secret(s) redacted`}>
            <ShieldCheck size={10} aria-hidden="true" /> {totalRedactions}
          </span>
        )}
      </button>

      {expanded && (
        <div className="pm-panel">
          {sections.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-header">
                <MessageSquare size={12} />
                <span>Token Budget ({totalTokens} estimated tokens across {sections.length} sections)</span>
                <label className="pm-redact-toggle" title="Redact API keys and other secrets in the preview">
                  <input type="checkbox" checked={redactionOn} onChange={(e) => setRedactionOn(e.target.checked)} />
                  Redact secrets
                </label>
              </div>
              <div className="pm-section-body">
                {sections.map((s, i) => {
                  const est = estimates?.find((e) => e.id === s.id);
                  const display = est ? est.text : s.text;
                  return (
                    <div key={s.id + i} className="pm-row pm-row-block">
                      <span className="pm-key">{s.label} · {est?.tokens ?? Math.ceil((display.length || 0) * 0.25)} tokens{est && est.redactedHits > 0 ? ` · ${est.redactedHits} redacted` : ''}</span>
                      <pre className="pm-pre">{reapplyRedaction(display)}</pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Output style */}
          {outputStyle && (
            <div className="pm-section">
              <div className="pm-section-header">
                <ShieldCheck size={12} />
                <span>Output Style</span>
              </div>
              <div className="pm-section-body">
                <div className="pm-row">
                  <span className="pm-key">Style</span>
                  <span className="pm-value">{outputStyle.label}</span>
                </div>
                <div className="pm-row">
                  <span className="pm-key">Role</span>
                  <span className="pm-value">{outputStyle.role}</span>
                </div>
                <div className="pm-row">
                  <span className="pm-key">Source</span>
                  <span className="pm-value">{outputStyle.source}</span>
                </div>
                {outputStyle.mustHave.length > 0 && (
                  <div className="pm-row pm-row-block">
                    <span className="pm-key">Expected shape</span>
                    <div className="pm-score-list">
                      {outputStyle.mustHave.map((item) => (
                        <div key={item} className="pm-score-row">
                          <span className="pm-score-model">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pm-row pm-row-block">
                  <span className="pm-key">Contract</span>
                  <pre className="pm-pre">{outputStyle.contract}</pre>
                </div>
              </div>
            </div>
          )}

          {/* Auto-router */}
          {autoRouterStep && (
            <div className="pm-section" role="group" aria-label={`Auto-Router decision: selected ${autoRouterStep.modelId}, score ${autoRouterStep.score.toFixed(2)}, ${autoRouterDecisionLabel({ fallback: autoRouterStep.fallback, cached: autoRouterStep.cached })}`}>
              <div className="pm-section-header">
                <Cpu size={12} aria-hidden="true" />
                <span>Auto-Router</span>
              </div>
              <div className="pm-section-body" role="list" aria-label="Auto-Router selected model and decision evidence">
                <div className="pm-row" role="listitem" aria-label={`Selected model ${autoRouterStep.modelId}`}>
                  <span className="pm-key">Selected model</span>
                  <span className="pm-value">{autoRouterStep.modelId}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Decision ${autoRouterDecisionLabel({ fallback: autoRouterStep.fallback, cached: autoRouterStep.cached })}`}>
                  <span className="pm-key">Decision</span>
                  <span className="pm-value">{autoRouterDecisionLabel({ fallback: autoRouterStep.fallback, cached: autoRouterStep.cached })}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Router reason: ${autoRouterStep.reason}`}>
                  <span className="pm-key">Reason</span>
                  <span className="pm-value">{autoRouterStep.reason}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Classifier model ${autoRouterStep.classifierModel || 'unavailable'}`}>
                  <span className="pm-key">Classifier</span>
                  <span className="pm-value">{autoRouterStep.classifierModel || 'unavailable'}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Selected score ${autoRouterStep.score.toFixed(2)}${autoRouterStep.cached ? ', cached' : ''}`}>
                  <span className="pm-key">Score</span>
                  <span className="pm-value">{autoRouterStep.score.toFixed(2)}{autoRouterStep.cached ? ' · cached' : ''}</span>
                </div>
                {autoRouterStep.stages?.heuristic && (
                  <div className="pm-row" role="listitem" aria-label={`Heuristic route ${autoRouterStep.stages.heuristic.mode}, ${autoRouterStep.stages.heuristic.role}, ${autoRouterStep.stages.heuristic.complexity}`}>
                    <span className="pm-key">Heuristic route</span>
                    <span className="pm-value">
                      {autoRouterStep.stages.heuristic.mode} · {autoRouterStep.stages.heuristic.role} · {autoRouterStep.stages.heuristic.complexity}
                    </span>
                  </div>
                )}
                {autoRouterStep.stages?.policy && (
                  <div className="pm-row" role="listitem" aria-label={`Policy gate ${autoRouterStep.stages.policy}`}>
                    <span className="pm-key">Policy gate</span>
                    <span className="pm-value">{autoRouterStep.stages.policy}</span>
                  </div>
                )}
                {autoRouterStep.stages?.signal && (
                  <div className="pm-row pm-row-block" role="listitem" aria-label="Route input features used by Auto-Router">
                    <span className="pm-key">Route input features</span>
                    <pre className="pm-pre">{JSON.stringify(autoRouterStep.stages.signal, null, 2)}</pre>
                  </div>
                )}
                <div className="pm-row" role="listitem" aria-label={`Routing feedback guidance: ${ROUTING_FEEDBACK_GUIDANCE}`}>
                  <span className="pm-key">Feedback</span>
                  <span className="pm-value">{ROUTING_FEEDBACK_GUIDANCE}</span>
                </div>
                {autoRouterScores.length > 0 ? (
                  <div className="pm-row pm-row-block" role="listitem" aria-label={`${autoRouterScores.length} Auto-Router candidate scores, including selected model ${autoRouterStep.modelId}`}>
                    <span className="pm-key">Candidate scores</span>
                    <div className="pm-score-list" role="list" aria-label="Ranked Auto-Router selected model and rejected alternatives">
                      {autoRouterScores.map(([model, score]) => (
                        <div key={model} className="pm-score-row" role="listitem" aria-label={`${model === autoRouterStep.modelId ? 'Selected model' : 'Rejected alternative'} ${model}, classifier score ${score.toFixed(2)}`}>
                          <span className="pm-score-model">{model}{model === autoRouterStep.modelId ? ' · selected' : ''}</span>
                          <span className="pm-score-value">{score.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pm-row" role="listitem" aria-label={`Candidate scores unavailable: ${candidateScoresUnavailableLabel({ fallback: autoRouterStep.fallback })}`}>
                    <span className="pm-key">Candidate scores</span>
                    <span className="pm-value">{candidateScoresUnavailableLabel({ fallback: autoRouterStep.fallback })}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Route decision */}
          {routeStep && (
            <div className="pm-section" role="group" aria-label={`Route decision: ${routeStep.role} role uses ${routeStep.model}`}>
              <div className="pm-section-header">
                <Cpu size={12} aria-hidden="true" />
                <span>Route Decision</span>
              </div>
              <div className="pm-section-body" role="list" aria-label="Heuristic route decision evidence">
                <div className="pm-row" role="listitem" aria-label={`Role ${routeStep.role}`}>
                  <span className="pm-key">Role</span>
                  <span className="pm-value">{routeStep.role}</span>
                </div>
                <div className="pm-row" role="listitem" aria-label={`Route model ${routeStep.model}`}>
                  <span className="pm-key">Model</span>
                  <span className="pm-value">{routeStep.model}</span>
                </div>
                {routeStep.reason && (
                  <div className="pm-row" role="listitem" aria-label={`Route reason: ${routeStep.reason}`}>
                    <span className="pm-key">Reason</span>
                    <span className="pm-value">{routeStep.reason}</span>
                  </div>
                )}
                {routeStep.stages?.heuristic && (
                  <div className="pm-row" role="listitem" aria-label={`Heuristic route ${routeStep.stages.heuristic.mode}, ${routeStep.stages.heuristic.role}, ${routeStep.stages.heuristic.complexity}`}>
                    <span className="pm-key">Heuristic route</span>
                    <span className="pm-value">
                      {routeStep.stages.heuristic.mode} · {routeStep.stages.heuristic.role} · {routeStep.stages.heuristic.complexity}
                    </span>
                  </div>
                )}
                {routeStep.stages?.policy && (
                  <div className="pm-row" role="listitem" aria-label={`Policy gate ${routeStep.stages.policy}`}>
                    <span className="pm-key">Policy gate</span>
                    <span className="pm-value">{routeStep.stages.policy}</span>
                  </div>
                )}
                {routeStep.stages?.signal && (
                  <div className="pm-row pm-row-block" role="listitem" aria-label="Route input features used by heuristic router">
                    <span className="pm-key">Route input features</span>
                    <pre className="pm-pre">{JSON.stringify(routeStep.stages.signal, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orchestration mode */}
          {orchestrationStep && (
            <div className="pm-section">
              <div className="pm-section-header">
                <Zap size={12} />
                <span>Orchestration</span>
              </div>
              <div className="pm-section-body">
                <div className="pm-row">
                  <span className="pm-key">Mode</span>
                  <span className="pm-value">{orchestrationStep.mode}</span>
                </div>
                <div className="pm-row">
                  <span className="pm-key">Label</span>
                  <span className="pm-value">{orchestrationStep.label}</span>
                </div>
                {orchestrationStep.detail && (
                  <div className="pm-row">
                    <span className="pm-key">Detail</span>
                    <span className="pm-value">{orchestrationStep.detail}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt build info */}
          {promptStep && (
            <div className="pm-section">
              <div className="pm-section-header">
                <MessageSquare size={12} />
                <span>Prompt Context</span>
              </div>
              <div className="pm-section-body">
                <div className="pm-row">
                  <span className="pm-key">Available tools</span>
                  <span className="pm-value">{promptStep.toolCount}</span>
                </div>
                {promptStep.assembly && (
                  <>
                    <div className="pm-row">
                      <span className="pm-key">Renderer</span>
                      <span className="pm-value">{promptStep.assembly.family} · {promptStep.assembly.style} · {promptStep.assembly.target}</span>
                    </div>
                    {promptStep.assembly.promptStrategy && (
                      <div className="pm-row pm-row-block">
                        <span className="pm-key">Prompt strategy</span>
                        <div className="pm-score-list" role="list" aria-label={`Prompt strategy ${promptStep.assembly.promptStrategy.id}; source-backed metadata is advisory prompt-contract evidence, not an automatic routing override`}>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Strategy</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.id}</span>
                          </div>
                          {promptStep.assembly.promptStrategy.modelMatch && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Model match</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.modelMatch.source} · {promptStep.assembly.promptStrategy.modelMatch.hint}</span>
                            </div>
                          )}
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Style</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.systemStyle}</span>
                          </div>
                          {promptStep.assembly.promptStrategy.variantId && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Variant</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.variantId}</span>
                            </div>
                          )}
                          {promptStep.assembly.promptStrategy.taskType && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Task type</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.taskType}</span>
                            </div>
                          )}
                          {promptStep.assembly.promptStrategy.role && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Role</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.role}</span>
                            </div>
                          )}
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Context</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.contextOrder}</span>
                          </div>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Examples</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.examplePolicy}</span>
                          </div>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Reasoning</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.reasoningPolicy}</span>
                          </div>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Tools</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.toolPolicy}</span>
                          </div>
                          <div className="pm-score-row" role="listitem">
                            <span className="pm-score-model">Output</span>
                            <span className="pm-score-value">{promptStep.assembly.promptStrategy.outputContract}</span>
                          </div>
                          {promptStep.assembly.promptStrategy.selectionReason && (
                            <div className="pm-score-row" role="listitem">
                              <span className="pm-score-model">Why</span>
                              <span className="pm-score-value">{promptStep.assembly.promptStrategy.selectionReason}</span>
                            </div>
                          )}
                          {promptStep.assembly.promptStrategy.bestPractice && (
                            <>
                              <div className="pm-score-row" role="listitem">
                                <span className="pm-score-model">Provenance use</span>
                                <span className="pm-score-value">Advisory prompt-contract evidence, not an automatic routing override</span>
                              </div>
                              <div className="pm-score-row" role="listitem">
                                <span className="pm-score-model">Best practice</span>
                                <span className="pm-score-value">{promptStep.assembly.promptStrategy.bestPractice.guidance}</span>
                              </div>
                              <div className="pm-score-row" role="listitem">
                                <span className="pm-score-model">Eval cue</span>
                                <span className="pm-score-value">{promptStep.assembly.promptStrategy.bestPractice.evaluationCue}</span>
                              </div>
                              <div className="pm-score-row" role="listitem">
                                <span className="pm-score-model">Source</span>
                                <span className="pm-score-value">{promptStep.assembly.promptStrategy.bestPractice.sourceRef}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="pm-row">
                      <span className="pm-key">Assembly sections</span>
                      <span className="pm-value">{promptStep.assembly.sections.length} · {promptStep.assembly.totalTokenEstimate} estimated tokens</span>
                    </div>
                    {promptStep.assembly.outputStyle && (
                      <div className="pm-row">
                        <span className="pm-key">Output style</span>
                        <span className="pm-value">{promptStep.assembly.outputStyle.label} · {promptStep.assembly.outputStyle.id}</span>
                      </div>
                    )}
                  </>
                )}
                {promptStep.promptPreview && (
                  <div className="pm-row pm-row-block">
                    <span className="pm-key">System prompt preview</span>
                    <pre className="pm-pre">{redactionOn ? promptStep.promptPreview : promptStep.promptPreview}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Model requests */}
          {modelRequests.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-header">
                <Cpu size={12} />
                <span>Model Requests ({modelRequests.length})</span>
              </div>
              <div className="pm-section-body">
                {modelRequests.map((req, i) => (
                  <div key={i} className="pm-row">
                    <span className="pm-key">Round {req.round}</span>
                    <span className="pm-value">{req.model}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool calls summary */}
          {toolCalls.length > 0 && (
            <div className="pm-section">
              <div className="pm-section-header">
                <Wrench size={12} />
                <span>Tool Calls ({toolCalls.length})</span>
              </div>
              <div className="pm-section-body">
                {toolCalls.map((tc, i) => (
                  <div key={i} className="pm-row">
                    <span className="pm-key">{tc.name}</span>
                    <span className="pm-value">
                      {tc.durationMs != null ? `${tc.durationMs}ms` : 'running…'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {errorSteps.length > 0 && (
            <div className="pm-section pm-section-error">
              <div className="pm-section-header">
                <AlertTriangle size={12} style={{ color: '#ef4444' }} />
                <span>Errors ({errorSteps.length})</span>
              </div>
              <div className="pm-section-body">
                {errorSteps.map((err, i) => (
                  <div key={i} className="pm-error-msg">{err.message}</div>
                ))}
              </div>
            </div>
          )}

          {/* Run metadata */}
          <div className="pm-section">
              <div className="pm-section-body pm-meta">
                <div className="pm-row">
                  <span className="pm-key">Debug bundle</span>
                <button className="pm-action-btn" type="button" onClick={handleExportDebugBundle} title="Export run replay and support data" aria-label={`Export debug bundle for run ${runTrace.id.slice(0, 8)}`}>
                  <Download size={12} aria-hidden="true" />
                  <span>{exportStatus || 'Export'}</span>
                </button>
                </div>
              <div className="pm-row">
                <span className="pm-key">Run ID</span>
                <span className="pm-value pm-mono">{runTrace.id.slice(0, 8)}</span>
              </div>
              <div className="pm-row">
                <span className="pm-key">Requested model</span>
                <span className="pm-value">{runTrace.requestedModel}</span>
              </div>
              <div className="pm-row">
                <span className="pm-key">Effective model</span>
                <span className="pm-value">{runTrace.effectiveModel}</span>
              </div>
              <div className="pm-row">
                <span className="pm-key">Provider</span>
                <span className="pm-value">{runTrace.providerId}</span>
              </div>
              {worktreeIsolation && (
                <div className="pm-row">
                  <span className="pm-key">Worktree isolation</span>
                  <span className="pm-value">
                    {worktreeIsolation.status === 'ready'
                      ? `ready · ${worktreeIsolation.worktreeId || worktreeIsolation.branch || worktreeIsolation.path || worktreeIsolation.agent} · Safety > Worktrees`
                      : worktreeIsolation.status === 'preserved'
                        ? `preserved · ${worktreeIsolation.worktreeId || worktreeIsolation.branch || worktreeIsolation.path || worktreeIsolation.agent} · Safety > Worktrees`
                      : worktreeIsolation.status === 'auto_discarded'
                        ? `auto-discarded · ${worktreeIsolation.worktreeId || worktreeIsolation.branch || worktreeIsolation.path || worktreeIsolation.agent}`
                      : `${worktreeIsolation.status} · ${worktreeIsolation.error || worktreeIsolation.reason}`}
                  </span>
                </div>
              )}
              <div className="pm-row">
                <span className="pm-key">Tokens used</span>
                <span className="pm-value">{runTrace.context.tokensUsed || '—'}</span>
              </div>
              {runTrace.context.compressedCount > 0 && (
                <div className="pm-row">
                  <span className="pm-key">Context compressed</span>
                  <span className="pm-value" style={{ color: '#f59e0b' }}>{runTrace.context.compressedCount} time(s)</span>
                </div>
              )}
              {runTrace.completedAt && (
                <div className="pm-row">
                  <span className="pm-key">Duration</span>
                  <span className="pm-value">
                    {((new Date(runTrace.completedAt).getTime() - new Date(runTrace.startedAt).getTime()) / 1000).toFixed(1)}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
