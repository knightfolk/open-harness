import { useId, useState } from 'react';
import { Shield, ChevronDown, ChevronRight, FileText, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import type { ConfidenceSignals } from '../utils/runSignals';

interface Props {
  signals: ConfidenceSignals;
}

export function ConfidenceMeter({ signals }: Props) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <div className="confidence-meter">
      <button
        className="confidence-badge"
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${expanded ? 'Hide' : 'Show'} confidence details`}
      >
        <Shield size={10} style={{ color: signals.qualityColor }} aria-hidden="true" />
        <span className="confidence-label" style={{ color: signals.qualityColor }}>
          {signals.qualityLabel}
        </span>
        <span className="confidence-detail">
          {signals.filesRead} file{signals.filesRead !== 1 ? 's' : ''} read · {signals.toolsUsed} tool{signals.toolsUsed !== 1 ? 's' : ''}
        </span>
        {expanded ? <ChevronDown size={11} aria-hidden="true" /> : <ChevronRight size={11} aria-hidden="true" />}
      </button>

      {expanded && (
        <div id={panelId} className="confidence-panel" role="region" aria-label="Confidence details">
          <div className="confidence-row">
            <FileText size={11} aria-hidden="true" />
            <span>Grounding</span>
            <span className="confidence-value">{signals.filesRead} file{signals.filesRead !== 1 ? 's' : ''} read</span>
          </div>
          <div className="confidence-row">
            <Wrench size={11} aria-hidden="true" />
            <span>Tools used</span>
            <span className="confidence-value">{signals.toolsUsed}</span>
          </div>
          {signals.hasValidation && (
            <div className="confidence-row">
              <CheckCircle size={12} style={{ color: '#22c55e' }} aria-hidden="true" />
              <span>Validation</span>
              <span className="confidence-value" style={{ color: '#22c55e' }}>ran</span>
            </div>
          )}
          {signals.errorsEncountered > 0 && (
            <div className="confidence-row">
              <AlertTriangle size={12} style={{ color: '#ef4444' }} aria-hidden="true" />
              <span>Errors</span>
              <span className="confidence-value" style={{ color: '#ef4444' }}>{signals.errorsEncountered}</span>
            </div>
          )}
          <div className="confidence-row">
            <span>Answer length</span>
            <span className="confidence-value">{signals.finalAnswerLength > 1000 ? `${(signals.finalAnswerLength / 1000).toFixed(1)}K` : signals.finalAnswerLength} chars</span>
          </div>
          <div className="confidence-bar-container">
            <div className="confidence-bar" style={{
              width: `${signals.groundingScore}%`,
              background: signals.qualityColor,
            }} />
          </div>
          <div className="confidence-score">Confidence score: {signals.groundingScore}/100</div>
          {signals.orchestrationMode && (
            <div className="confidence-row">
              <span>Mode</span>
              <span className="confidence-value">{signals.orchestrationMode}</span>
            </div>
          )}
          <div className="confidence-row">
            <span>Reliability risk</span>
            <span className="confidence-value" style={{
              color: signals.riskLevel === 'low' ? '#22c55e' : signals.riskLevel === 'medium' ? '#f59e0b' : '#ef4444',
            }}>{signals.riskLevel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
