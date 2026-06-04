import { useState, useEffect } from 'react';
import * as api from '../utils/api';

export function RoutingLearningPane() {
  const [summary, setSummary] = useState<api.RouterLearningSummary | null>(null);
  const [events, setEvents] = useState<api.RoutingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, e] = await Promise.all([
          api.getRouterLearning(),
          api.getRouterLearningEvents(undefined, 20),
        ]);
        setSummary(s);
        setEvents(e);
      } catch {}
      setLoading(false);
    })();
  }, []);

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

  return (
    <div>
      <div className="settings-pane-title">Routing Learning</div>
      <div className="settings-pane-desc">How each model has performed for routing decisions across sessions.</div>

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

        {events.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Recent Events</div>
            {events.slice(0, 10).map((ev: api.RoutingEvent) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', marginBottom: 1, borderRadius: 3, fontSize: 11 }}>
                <span style={{ color: ev.outcome === 'success' ? 'var(--accent-success)' : ev.outcome === 'failure' ? 'var(--accent-error)' : 'var(--text-tertiary)' }}>
                  {ev.outcome === 'success' ? '\u2713' : ev.outcome === 'failure' ? '\u2717' : '?'}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.selectedModel}</span>
                <span style={{ color: 'var(--text-tertiary)' }}>score={ev.score.toFixed(2)}</span>
                {ev.wasFallback && <span style={{ color: 'var(--accent-warning)' }}>fallback</span>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
