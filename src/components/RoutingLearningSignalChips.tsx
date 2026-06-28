import type { RoutingEvent } from '../utils/api';
import { buildRouteLearningSignalChips } from '../utils/routeLearningSignalSummary';

interface Props {
  signal: RoutingEvent['routeSignal'];
  selectedModel: string;
}

export function RoutingLearningSignalChips({ signal, selectedModel }: Props) {
  const chips = buildRouteLearningSignalChips(signal);
  if (chips.length === 0) return null;

  return (
    <div className="routing-score-chips routing-signal-chips" role="list" aria-label={`Route input features for ${selectedModel}`}>
      {chips.map((chip) => (
        <span key={`${chip.label}:${chip.value}`} role="listitem" title={`${chip.label}: ${chip.value}`}>
          {chip.label} {chip.value}
        </span>
      ))}
    </div>
  );
}
