import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, CircleHelp, Lightbulb, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import * as api from '../utils/api';
import { ROUTING_FEEDBACK_GUIDANCE, candidateScoresUnavailableLabel, routingEventDecisionLabel, routingOutcomeHelp, routingOutcomeLabel, sortedCandidateScores } from '../utils/autoRouterTrace';

interface EnabledModelRef {
  id: string;
  name: string;
  providerId: string;
  providerName: string;
}

interface Props {
  enabledModels?: EnabledModelRef[];
  onApplyRoleRecommendation?: (roleId: string, modelId: string) => void;
}

function normalizeModelId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function sampleLabel(total: number): string {
  if (total === 0) return 'No reviewed outcomes yet';
  if (total < 5) return 'Very low confidence';
  if (total < 20) return 'Early signal';
  return 'Enough signal to trust trends';
}

function sampleTone(total: number): 'empty' | 'low' | 'ok' {
  if (total === 0) return 'empty';
  if (total < 20) return 'low';
  return 'ok';
}

function eventStatus(event: api.RoutingEvent) {
  if (event.outcome === 'success') return { label: routingOutcomeLabel(event.outcome), icon: CheckCircle2, tone: 'success' };
  if (event.outcome === 'failure') return { label: routingOutcomeLabel(event.outcome), icon: XCircle, tone: 'error' };
  if (event.outcome === 'ambiguous') return { label: routingOutcomeLabel(event.outcome), icon: CircleHelp, tone: 'muted' };
  return { label: routingOutcomeLabel(event.outcome), icon: CircleHelp, tone: 'warning' };
}

export function RoutingLearningPane({ enabledModels = [], onApplyRoleRecommendation }: Props) {
  const [summary, setSummary] = useState<api.RouterLearningSummary | null>(null);
  const [events, setEvents] = useState<api.RoutingEvent[]>([]);
  const [recommendations, setRecommendations] = useState<api.EvalRecommendation[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const enabledModelKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const model of enabledModels) {
      keys.add(normalizeModelId(model.id));
      keys.add(normalizeModelId(`${model.providerId}:${model.id}`));
      keys.add(normalizeModelId(model.name));
    }
    return keys;
  }, [enabledModels]);

  const loadData = useCallback(async () => {
    const [s, e, r] = await Promise.all([
      api.getRouterLearning(),
      api.getRouterLearningEvents(undefined, 25),
      api.getEvalRecommendations(),
    ]);
    setSummary(s);
    setEvents(e);
    setRecommendations(r);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch {
        setSaving('Could not load routing learning data');
      }
      setLoading(false);
    })();
  }, [loadData]);

  const accessibleRecommendations = useMemo(
    () => recommendations.filter((rec) => enabledModelKeys.has(normalizeModelId(rec.modelId))),
    [enabledModelKeys, recommendations],
  );

  const unavailableRecommendations = useMemo(
    () => recommendations.filter((rec) => !enabledModelKeys.has(normalizeModelId(rec.modelId))),
    [enabledModelKeys, recommendations],
  );

  const modelList = useMemo(
    () => Object.entries(summary?.models || {}).sort(([, a]: any, [, b]: any) => b.total - a.total),
    [summary],
  );

  const handleApplyRecommendation = (roleId: string, modelId: string) => {
    if (!onApplyRoleRecommendation) return;
    onApplyRoleRecommendation(roleId, modelId);
    setSaving(`Applied ${modelId} to ${roleId}`);
    setTimeout(() => setSaving(null), 1200);
    loadData().catch(() => {});
  };

  const handleApplyAll = () => {
    if (!onApplyRoleRecommendation || accessibleRecommendations.length === 0) return;
    for (const rec of accessibleRecommendations) onApplyRoleRecommendation(rec.role, rec.modelId);
    setSaving(`Applied ${accessibleRecommendations.length} available recommendation${accessibleRecommendations.length === 1 ? '' : 's'}`);
    setTimeout(() => setSaving(null), 1200);
    loadData().catch(() => {});
  };

  const handleMarkOutcome = async (eventId: string, outcome: 'success' | 'failure' | 'ambiguous') => {
    const ok = await api.recordRoutingOutcome(eventId, outcome);
    if (ok) {
      await loadData();
      return;
    }
    setSaving('Failed to record outcome');
    setTimeout(() => setSaving(null), 1200);
  };

  if (loading) {
    return (
      <div className="routing-learning-pane">
        <div className="settings-pane-title">Routing Learning</div>
        <div className="settings-pane-desc">Loading routing statistics...</div>
      </div>
    );
  }

  const totalEvents = summary?.totalEvents || 0;
  const successRate = summary?.successRate || 0;
  const byTaskType = summary?.byTaskType || {};
  const byRole = summary?.byRole || {};
  const byComplexity = summary?.byComplexity || {};

  return (
    <div className="routing-learning-pane">
      <div className="routing-learning-header">
        <div>
          <div className="settings-pane-title">Routing Learning</div>
          <div className="settings-pane-desc">
            Learns from marked routing outcomes and eval reports. It does not change routing by itself until you apply a recommendation.
          </div>
        </div>
        <button className="settings-mini-button" onClick={() => loadData().catch(() => {})}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {saving && <div className="routing-learning-toast">{saving}</div>}

      <section className="routing-explain">
        <div className="routing-explain-item">
          <BarChart3 size={15} />
          <div>
            <strong>Observed outcomes</strong>
            <span>Only decisions marked worked, failed, or unclear count toward success rates.</span>
          </div>
        </div>
        <div className="routing-explain-item">
          <Lightbulb size={15} />
          <div>
            <strong>Recommendations</strong>
            <span>Eval suggestions are filtered to models enabled in your Providers settings.</span>
          </div>
        </div>
        <div className="routing-explain-item">
          <ShieldCheck size={15} />
          <div>
            <strong>Manual apply</strong>
            <span>Use Apply to update an agent role. Auto-Router candidates stay separate.</span>
          </div>
        </div>
      </section>

      <section className="routing-metrics">
        <div className="routing-metric-card">
          <span>Reviewed outcomes</span>
          <strong>{totalEvents}</strong>
          <small>{sampleLabel(totalEvents)}</small>
        </div>
        <div className="routing-metric-card">
          <span>Observed success</span>
          <strong>{pct(successRate)}</strong>
          <small>Based on marked outcomes only</small>
        </div>
        <div className={`routing-metric-card ${sampleTone(totalEvents)}`}>
          <span>Confidence</span>
          <strong>{totalEvents < 20 ? 'Learning' : 'Stable'}</strong>
          <small>{totalEvents < 20 ? 'Mark more recent events before trusting winners' : 'Enough samples for trend checks'}</small>
        </div>
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Recommended Role Updates</h3>
            <p>Safe actions from eval reports that match enabled provider models.</p>
          </div>
          <button className="settings-mini-button" onClick={handleApplyAll} disabled={accessibleRecommendations.length === 0}>
            Apply available
          </button>
        </div>

        {accessibleRecommendations.length === 0 ? (
          <div className="routing-empty">
            No applicable recommendations for your enabled models. Enable the recommended model in Providers, or run evals against models you already use.
          </div>
        ) : (
          <div className="routing-recommendation-list">
            {accessibleRecommendations.map((rec) => (
              <div key={`${rec.reportId}:${rec.role}:${rec.modelId}`} className="routing-recommendation-card">
                <div>
                  <div className="routing-rec-title">{rec.role} {'->'} {rec.modelId}</div>
                  <div className="routing-rec-reason">{rec.reason}</div>
                  <div className="routing-rec-source">{rec.reportName}</div>
                </div>
                <button className="settings-mini-button" onClick={() => handleApplyRecommendation(rec.role, rec.modelId)}>
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}

        {unavailableRecommendations.length > 0 && (
          <details className="routing-unavailable">
            <summary>
              <AlertTriangle size={13} />
              {unavailableRecommendations.length} recommendation{unavailableRecommendations.length === 1 ? '' : 's'} for models you do not have enabled
            </summary>
            {unavailableRecommendations.map((rec) => (
              <div key={`${rec.reportId}:${rec.role}:${rec.modelId}:unavailable`} className="routing-unavailable-row">
                <span>{rec.role} {'->'} {rec.modelId}</span>
                <span>{rec.reportName}</span>
              </div>
            ))}
          </details>
        )}
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Observed Performance</h3>
            <p>Historical routing decisions after you mark whether they worked.</p>
          </div>
        </div>

        {modelList.length === 0 ? (
          <div className="routing-empty">No marked routing outcomes yet. Review recent events below to start teaching the router.</div>
        ) : (
          <div className="routing-model-list">
            {modelList.map(([model, stats]: [string, any]) => (
              <div key={model} className="routing-model-row">
                <div className="routing-model-name">{model}</div>
                <div className="routing-model-meta">{stats.total} reviewed</div>
                <div className={`routing-rate ${stats.rate > 0.8 ? 'good' : stats.rate > 0.6 ? 'warn' : 'bad'}`}>{pct(stats.rate)}</div>
                <div className="routing-rate-track">
                  <div style={{ width: pct(stats.rate) }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!!summary?.bestByTaskType.length && (
          <div className="routing-mini-grid">
            {summary.bestByTaskType.map((row) => (
              <div key={row.taskType} className="routing-mini-card">
                <span>{row.taskType}</span>
                <strong>{row.model}</strong>
                <small>{pct(row.rate)} from {row.total} reviewed</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Breakdowns</h3>
            <p>Use this to spot whether a model is only good for a role, task type, or complexity.</p>
          </div>
        </div>
        <div className="routing-breakdown-grid">
          <BreakdownColumn title="Task type" data={byTaskType} />
          <BreakdownColumn title="Role" data={byRole} />
          <BreakdownColumn title="Complexity" data={byComplexity} />
        </div>
      </section>

      <section className="routing-section">
        <div className="routing-section-header">
          <div>
            <h3>Recent Routing Decisions</h3>
            <p>{ROUTING_FEEDBACK_GUIDANCE} These labels are what make the learning data useful.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="routing-empty">No routing events recorded yet.</div>
        ) : (
          <div className="routing-event-list">
            {events.slice(0, 12).map((event) => {
              const status = eventStatus(event);
              const Icon = status.icon;
              const topScores = sortedCandidateScores(event.candidateScores, 4);
              return (
                <div key={event.id} className="routing-event-row">
                  <div className={`routing-event-status ${status.tone}`}>
                    <Icon size={13} />
                    {status.label}
                  </div>
                  <div className="routing-event-main">
                    <div>{event.selectedModel}</div>
                    <span>
                      {event.taskType || 'unknown'} / {event.role || 'unknown'} / {event.complexity || 'unknown'} / score {event.score.toFixed(2)}
                    </span>
                    <div className="routing-event-trace">
                      <span>{routingEventDecisionLabel(event)}</span>
                      {event.classifierModel && <span>classifier: {event.classifierModel}</span>}
                      {event.wasCached && <span>cached</span>}
                      {event.wasFallback && <span>fallback used</span>}
                    </div>
                    <div className="routing-score-chips">
                      {topScores.length > 0 ? (
                        topScores.map(([model, score]) => (
                          <span key={model} title={`${model}: ${score.toFixed(2)}`}>
                            {model} {score.toFixed(2)}
                          </span>
                        ))
                      ) : (
                        <span className="muted">{candidateScoresUnavailableLabel({ fallback: event.wasFallback })}</span>
                      )}
                    </div>
                    <div className="routing-event-help">{routingOutcomeHelp(event.outcome)}</div>
                  </div>
                  <div className="routing-event-actions">
                    <button title={routingOutcomeHelp('success')} onClick={() => handleMarkOutcome(event.id, 'success')} disabled={event.outcome === 'success'}>{routingOutcomeLabel('success')}</button>
                    <button title={routingOutcomeHelp('failure')} onClick={() => handleMarkOutcome(event.id, 'failure')} disabled={event.outcome === 'failure'}>{routingOutcomeLabel('failure')}</button>
                    <button title={routingOutcomeHelp('ambiguous')} onClick={() => handleMarkOutcome(event.id, 'ambiguous')} disabled={event.outcome === 'ambiguous'}>{routingOutcomeLabel('ambiguous')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function BreakdownColumn({
  title,
  data,
}: {
  title: string;
  data: Record<string, { total: number; success: number; rate: number; byModel: Record<string, { total: number; success: number; rate: number }> }>;
}) {
  const rows = Object.entries(data).sort(([, a], [, b]) => b.total - a.total);
  return (
    <div className="routing-breakdown-card">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <div className="routing-empty compact">No reviewed data</div>
      ) : (
        rows.map(([label, item]) => (
          <details key={`${title}:${label}`} className="routing-breakdown-detail">
            <summary>
              <span>{label}</span>
              <span>{item.total} / {pct(item.rate)}</span>
            </summary>
            {Object.entries(item.byModel).map(([model, stats]) => (
              <div key={`${label}:${model}`} className="routing-breakdown-model">
                <span>{model}</span>
                <span>{stats.success}/{stats.total}</span>
              </div>
            ))}
          </details>
        ))
      )}
    </div>
  );
}
