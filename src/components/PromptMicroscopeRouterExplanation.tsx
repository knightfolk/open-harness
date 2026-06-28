import { HelpCircle } from 'lucide-react';
import type { RouterExplanation } from '../utils/routerExplanation';
import { formatScoreDisplay } from '../utils/scoreDisplay';

interface Props {
  explanation: RouterExplanation | null;
}

export function RouterExplanationSection({ explanation }: Props) {
  if (!explanation) return null;

  return (
    <div className="pm-section" role="group" aria-label={`Auto-Router explanation: selected ${explanation.selectedModel}`}>
      <div className="pm-section-header">
        <HelpCircle size={12} aria-hidden="true" />
        <span>Router explanation</span>
      </div>
      <div className="pm-section-body" role="list" aria-label="Auto-Router why selected and why not alternatives">
        <div className="pm-row" role="listitem" aria-label={`Router selection summary: ${explanation.selectionSummary}`}>
          <span className="pm-key">Selection summary</span>
          <span className="pm-value">{explanation.selectionSummary}</span>
        </div>

        <div className="pm-row pm-row-block" role="listitem">
          <span className="pm-key">Why selected</span>
          <div className="pm-score-list" role="list" aria-label={`Why Auto-Router selected ${explanation.selectedModel}`}>
            <div className="pm-score-row" role="listitem">
              <span className="pm-score-model">{explanation.selectedModel}</span>
              <span className="pm-score-value">{formatScoreDisplay(explanation.selectedScore)}</span>
            </div>
            <div className="pm-score-row" role="listitem">
              <span className="pm-score-model">Decision</span>
              <span className="pm-score-value">{explanation.decision}</span>
            </div>
            <div className="pm-score-row" role="listitem">
              <span className="pm-score-model">Policy</span>
              <span className="pm-score-value">{explanation.policy}</span>
            </div>
            {explanation.policyEvidence.length > 0 && (
              <div className="pm-score-row pm-score-row-block" role="listitem" aria-label={`${explanation.policyEvidence.length} router policy evidence row${explanation.policyEvidence.length === 1 ? '' : 's'}`}>
                <span className="pm-score-model">Policy evidence</span>
                <span className="pm-score-value">
                  <span className="pm-policy-evidence-list" role="list" aria-label="Router explanation policy evidence">
                    {explanation.policyEvidence.map((row) => (
                      <span key={row.id} className="pm-policy-evidence-row" role="listitem" aria-label={`${row.label}: ${row.evidence}. ${row.impact}`}>
                        <span className="pm-policy-evidence-label">{row.label}</span>
                        <span className="pm-policy-evidence-detail">{row.evidence}</span>
                      </span>
                    ))}
                  </span>
                </span>
              </div>
            )}
            {explanation.thresholdSummary && (
              <div className="pm-score-row" role="listitem" aria-label={`Threshold: ${explanation.thresholdSummary}`}>
                <span className="pm-score-model">Threshold</span>
                <span className="pm-score-value">{explanation.thresholdSummary}</span>
              </div>
            )}
            <div className="pm-score-row" role="listitem">
              <span className="pm-score-model">Classifier</span>
              <span className="pm-score-value">{explanation.classifier}</span>
            </div>
            <div className="pm-score-row" role="listitem" aria-label={`Catalog signal: ${explanation.selectedSignal.costLabel}, ${explanation.selectedSignal.routerWeightLabel}, ${explanation.selectedSignal.speedLabel}, ${explanation.selectedSignal.freshnessLabel}`}>
              <span className="pm-score-model">Catalog signal</span>
              <span className="pm-score-value">
                {explanation.selectedSignal.costLabel} · {explanation.selectedSignal.routerWeightLabel} · {explanation.selectedSignal.speedLabel} · {explanation.selectedSignal.freshnessLabel}
              </span>
            </div>
            <div className="pm-score-row" role="listitem">
              <span className="pm-score-model">Reason</span>
              <span className="pm-score-value">{explanation.selectionReason}</span>
            </div>
          </div>
        </div>

        <div className="pm-row" role="listitem">
          <span className="pm-key">Summary</span>
          <span className="pm-value">{explanation.summary}</span>
        </div>

        {explanation.alternatives.length > 0 ? (
          <div className="pm-row pm-row-block" role="listitem">
            <span className="pm-key">Why not alternatives</span>
            <div className="pm-score-list" role="list" aria-label="Rejected Auto-Router alternatives">
              {explanation.alternatives.map((alt) => (
                <div key={alt.model} className="pm-score-row" role="listitem" aria-label={`${alt.model}: ${alt.reason}`}>
                  <span className="pm-score-model">{alt.model}</span>
                  <span className="pm-score-value">
                    {formatScoreDisplay(alt.score)} · {alt.reason} · {alt.signal.costLabel} · {alt.signal.routerWeightLabel} · {alt.signal.speedLabel} · {alt.signal.freshnessLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pm-row" role="listitem">
            <span className="pm-key">Why not alternatives</span>
            <span className="pm-value">No ranked alternatives were saved for this route.</span>
          </div>
        )}
      </div>
    </div>
  );
}
