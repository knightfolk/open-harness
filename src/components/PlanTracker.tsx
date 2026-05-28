import { CheckCircle2, Circle, Loader } from 'lucide-react';
import type { Plan } from '../types';

interface Props {
  plan: Plan;
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed': return <CheckCircle2 size={14} style={{ color: 'var(--accent-success)' }} />;
    case 'in_progress': return <Loader size={14} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />;
    default: return <Circle size={14} style={{ color: 'var(--text-tertiary)' }} />;
  }
};

export function PlanTracker({ plan }: Props) {
  const completed = plan.steps.filter((s) => s.status === 'completed').length;
  const total = plan.steps.length;

  return (
    <div>
      {plan.explanation && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
          {plan.explanation}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--bg-active)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completed / total) * 100}%`, background: 'var(--accent-primary)', borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{completed}/{total}</span>
      </div>

      {plan.steps.map((step) => (
        <div key={step.id} className="plan-step">
          <div className={`plan-step-indicator ${step.status}`}>
            <StatusIcon status={step.status} />
          </div>
          <span className={`plan-step-text ${step.status}`}>{step.step}</span>
        </div>
      ))}
    </div>
  );
}
