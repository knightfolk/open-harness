import { useState, useEffect, useCallback } from 'react';
import * as api from '../utils/api';

interface Props {
  onApplyRoleRecommendation?: (roleId: string, modelId: string) => void;
}

export function RoutingLearningPane({ onApplyRoleRecommendation }: Props) {
  const [summary, setSummary] = useState<api.RouterLearningSummary | null>(null);
  const [events, setEvents] = useState<api.RoutingEvent[]>([]);
  const [recommendations, setRecommendations] = useState<api.EvalRecommendation[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      } catch {}
      setLoading(false);
    })();
  }, [loadData]);

  const handleApplyRecommendation = (roleId: string, modelId: string) => {
    if (!onApplyRoleRecommendation) return;
    onApplyRoleRecommendation(roleId, modelId);
    setSaving(`Applied ${modelId} to ${roleId}`);
    setTimeout(() => setSaving(null), 1200);
    loadData().catch(() => {});
  };

  const handleApplyAll = () => {
    if (!onApplyRoleRecommendation || recommendations.length === 0) return;
    for (const rec of recommendations) onApplyRoleRecommendation(rec.role, rec.modelId);
    setSaving('Applied all available eval recommendations');
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
      <div style={{ padding: 16 }}>
        <div className="settings-pane-title">Routing Learning</div>
        <div className="settings-pane-desc">Loading routing statistics...</div>
      </div>
    );
  }

  const modelList = Object.entries(summary?.models || {}).sort(
    ([, a]: any, [, b]: any) => b.total - a.total
  );
  const byTaskType = summary?.byTaskType || {};
  const byRole = summary?.byRole || {};
  const byComplexity = summary?.byComplexity || {};

  return (
    <div>
      <div className="settings-pane-title">Routing Learning</div>
      <div className="settings-pane-desc">How each model has performed for routing decisions across sessions.</div>
      {saving && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-success)' }}>{saving}</div>}

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div className="settings-card" style={{ flex: 1, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-color)' }}>{summary?.totalEvents || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Total Events</div>
          </div>
          <div className="settings-card" style={{ flex: 1, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: (summary?.successRate ?? 0) > 0.8 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
              {((summary?.successRate ?? 0) * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Success Rate</div>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Model Performance</div>
        {modelList.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No routing data collected yet.</div>
        )}
        {modelList.map(([model, stats]: [string, any]) => (
          <div key={model} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 2, borderRadius: 4, fontSize: 12, background: 'var(--bg-secondary)' }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model}</span>
            <span style={{ color: 'var(--text-tertiary)' }}>{stats.total} calls</span>
            <span style={{ color: stats.rate > 0.8 ? 'var(--accent-success)' : stats.rate > 0.6 ? 'var(--accent-warning)' : 'var(--accent-error)' }}>{(stats.rate * 100).toFixed(0)}%</span>
            <div style={{ width: 50, height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
              <div style={{ width: Math.round(stats.rate * 100) + '%', height: '100%', borderRadius: 3, background: stats.rate > 0.8 ? 'var(--accent-success)' : stats.rate > 0.6 ? 'var(--accent-warning)' : 'var(--accent-error)' }} />
            </div>
          </div>
        ))}

        {summary && summary.bestByTaskType.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Best Model by Task Type</div>
            {summary.bestByTaskType.map((row) => (
              <div key={row.taskType} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', marginBottom: 2, borderRadius: 3, fontSize: 11, background: 'var(--bg-secondary)' }}>
                <span style={{ width: 110, color: 'var(--text-secondary)' }}>{row.taskType}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.model}</span>
                <span style={{ color: 'var(--accent-primary)' }}>{(row.rate * 100).toFixed(0)}%</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{row.success}/{row.total}</span>
              </div>
            ))}
          </>
        )}

        {Object.keys(byTaskType).length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Task-Type Detail</div>
            {Object.entries(byTaskType).map(([taskType, data]) => (
              <details key={taskType} style={{ marginBottom: 6 }}>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {taskType} — {data.total} calls, {(data.rate * 100).toFixed(0)}%
                </summary>
                <div style={{ marginTop: 4 }}>
                  {Object.entries(data.byModel).map(([model, stats]) => (
                    <div key={`${taskType}:${model}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-tertiary)', padding: '2px 4px' }}>
                      <span>{model}</span>
                      <span>{stats.success}/{stats.total}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </>
        )}

        {Object.keys(byRole).length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Role Detail</div>
            {Object.entries(byRole).map(([role, data]) => (
              <div key={role} style={{ fontSize: 11, padding: '3px 6px', marginBottom: 3, borderRadius: 3, background: 'var(--bg-secondary)' }}>
                <div style={{ color: 'var(--text-secondary)' }}>{role}</div>
                <div style={{ marginLeft: 6, color: 'var(--text-tertiary)' }}>{data.total} calls · {(data.rate * 100).toFixed(0)}%</div>
              </div>
            ))}
          </>
        )}

        {Object.keys(byComplexity).length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Complexity Detail</div>
            {Object.entries(byComplexity).map(([complexity, data]) => (
              <div key={complexity} style={{ fontSize: 11, padding: '3px 6px', marginBottom: 3, borderRadius: 3, background: 'var(--bg-secondary)' }}>
                <div style={{ color: 'var(--text-secondary)' }}>{complexity}</div>
                <div style={{ marginLeft: 6, color: 'var(--text-tertiary)' }}>{data.total} calls · {(data.rate * 100).toFixed(0)}%</div>
              </div>
            ))}
          </>
        )}

        {recommendations.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Eval Recommendations</div>
              <button
                onClick={handleApplyAll}
                style={{ borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', padding: '4px 8px', fontSize: 11 }}
              >
                Apply all
              </button>
            </div>
            {recommendations.map((rec) => (
              <div key={`${rec.reportId}:${rec.role}`} style={{ fontSize: 11, padding: '4px 6px', borderRadius: 3, background: 'var(--bg-secondary)', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span><strong>{rec.role}</strong> → {rec.modelId}</span>
                  <button onClick={() => handleApplyRecommendation(rec.role, rec.modelId)} style={{ borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', padding: '3px 6px', fontSize: 10 }}>
                    Apply
                  </button>
                </div>
                <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>{rec.reason}</div>
                <div style={{ color: 'var(--text-tertiary)', marginTop: 1, fontSize: 10 }}>{rec.reportName}</div>
              </div>
            ))}
          </div>
        )}

        {events.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Recent Events</div>
            {events.slice(0, 10).map((ev: api.RoutingEvent) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', marginBottom: 1, borderRadius: 3, fontSize: 11 }}>
                <span style={{ color: ev.outcome === 'success' ? 'var(--accent-success)' : ev.outcome === 'failure' ? 'var(--accent-error)' : 'var(--text-tertiary)' }}>
                  {ev.outcome === 'success' ? '\u2713' : ev.outcome === 'failure' ? '\u2717' : '?'}
                </span>
                <span style={{ width: 70, color: 'var(--text-tertiary)' }}>{ev.taskType || 'unknown'}</span>
                <span style={{ width: 56, color: 'var(--text-tertiary)' }}>{ev.role || 'unknown'}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.selectedModel}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>score={ev.score.toFixed(2)}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>{ev.complexity || 'unknown'}</span>
                {ev.wasFallback && <span style={{ color: 'var(--accent-warning)' }}>fallback</span>}
                <button
                  onClick={() => handleMarkOutcome(ev.id, 'success')}
                  disabled={ev.outcome === 'success'}
                  style={{ borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', padding: '2px 4px', fontSize: 10 }}
                >
                  +✓
                </button>
                <button
                  onClick={() => handleMarkOutcome(ev.id, 'failure')}
                  disabled={ev.outcome === 'failure'}
                  style={{ borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', padding: '2px 4px', fontSize: 10 }}
                >
                  +✗
                </button>
                <button
                  onClick={() => handleMarkOutcome(ev.id, 'ambiguous')}
                  disabled={ev.outcome === 'ambiguous'}
                  style={{ borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', padding: '2px 4px', fontSize: 10 }}
                >
                  +?
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
