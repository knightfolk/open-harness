import { useState, useEffect, useCallback, useMemo } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight, AlertTriangle, Cpu, Wrench, MessageSquare, Zap, ShieldCheck } from 'lucide-react';
import type { HarnessRun, HarnessRunStep } from '../types';
import * as api from '../utils/api';

interface Props {
  runTrace: HarnessRun | undefined;
}

export function PromptMicroscope({ runTrace }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [redactionOn, setRedactionOn] = useState(true);
  const [estimates, setEstimates] = useState<api.SectionEstimate[] | null>(null);

  const sections = useMemo(() => {
    if (!runTrace) return [];
    const out: Array<{ id: string; label: string; text: string }> = [];
    for (const step of runTrace.steps) {
      if (step.type === 'prompt_built') {
        out.push({ id: `prompt:${step.toolCount}`, label: 'System prompt', text: step.promptPreview });
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

  if (!runTrace) return null;

  const routeStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'route' }> => s.type === 'route');
  const promptStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'prompt_built' }> => s.type === 'prompt_built');
  const orchestrationStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'orchestration' }> => s.type === 'orchestration');
  const errorSteps = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'error' }> => s.type === 'error');
  const modelRequests = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'model_request' }> => s.type === 'model_request');
  const toolCalls = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'tool_call' }> => s.type === 'tool_call');
  const totalTokens = estimates?.reduce((sum, s) => sum + s.tokens, 0) ?? 0;
  const totalRedactions = estimates?.reduce((sum, s) => sum + s.redactedHits, 0) ?? 0;

  return (
    <div className="prompt-microscope">
      <button className="pm-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? <EyeOff size={12} /> : <Eye size={12} />}
        <span>Prompt microscope</span>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {totalRedactions > 0 && (
          <span className="pm-redact-pill" title={`${totalRedactions} secret(s) redacted`}>
            <ShieldCheck size={10} /> {totalRedactions}
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

          {/* Route decision */}
          {routeStep && (
            <div className="pm-section">
              <div className="pm-section-header">
                <Cpu size={12} />
                <span>Route Decision</span>
              </div>
              <div className="pm-section-body">
                <div className="pm-row">
                  <span className="pm-key">Role</span>
                  <span className="pm-value">{routeStep.role}</span>
                </div>
                <div className="pm-row">
                  <span className="pm-key">Model</span>
                  <span className="pm-value">{routeStep.model}</span>
                </div>
                {routeStep.reason && (
                  <div className="pm-row">
                    <span className="pm-key">Reason</span>
                    <span className="pm-value">{routeStep.reason}</span>
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
