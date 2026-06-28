import type { RoutingStageTrace } from '../types';
import { buildRouteInputSummary } from '../utils/routeInputSummary';

type RouteSignal = NonNullable<RoutingStageTrace['signal']>;

interface Props {
  label: string;
  signal: RouteSignal | undefined;
  source: string;
}

export function RouteInputSummarySection({ label, signal, source }: Props) {
  const rows = buildRouteInputSummary(signal);
  if (rows.length === 0) return null;

  return (
    <div className="pm-row pm-row-block" role="listitem" aria-label={`${source} route input features`}>
      <span className="pm-key">{label}</span>
      <div className="pm-score-list" role="list" aria-label={`${source} route input features`}>
        {rows.map((row) => (
          <div key={row.label} className="pm-score-row" role="listitem" aria-label={`${row.label}: ${row.value}`}>
            <span className="pm-score-model">{row.label}</span>
            <span className="pm-score-value">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
