import { useState } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronRight, AlertTriangle, Cpu, Wrench, MessageSquare, Zap } from 'lucide-react';
import type { HarnessRun, HarnessRunStep } from '../types';

interface Props {
  runTrace: HarnessRun | undefined;
}

export function PromptMicroscope({ runTrace }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!runTrace) return null;

  const routeStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'route' }> => s.type === 'route');
  const promptStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'prompt_built' }> => s.type === 'prompt_built');
  const orchestrationStep = runTrace.steps.find((s): s is Extract<HarnessRunStep, { type: 'orchestration' }> => s.type === 'orchestration');
  const errorSteps = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'error' }> => s.type === 'error');
  const modelRequests = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'model_request' }> => s.type === 'model_request');
  const toolCalls = runTrace.steps.filter((s): s is Extract<HarnessRunStep, { type: 'tool_call' }> => s.type === 'tool_call');

  return (
    <div className="prompt-microscope">
      <button className="pm-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? <EyeOff size={12} /> : <Eye size={12} />}
        <span>Prompt microscope</span>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>

      {expanded && (
        <div className="pm-panel">
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
                    <pre className="pm-pre">{promptStep.promptPreview}</pre>
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
