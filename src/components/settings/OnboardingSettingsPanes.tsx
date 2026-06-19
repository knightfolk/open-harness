import { ArrowRight } from 'lucide-react';

function PaneTitle({ children }: { children: React.ReactNode }) { return <div className="settings-pane-title">{children}</div>; }
function PaneDesc({ children }: { children: React.ReactNode }) { return <div className="settings-pane-desc">{children}</div>; }

export function OnboardingPane({ onRestartOnboarding }: { onRestartOnboarding: () => void }) {
  return (
    <>
      <PaneTitle>Onboarding</PaneTitle>
      <PaneDesc>Re-run the guided setup wizard at any time. Your existing providers, keys, and settings will be preserved.</PaneDesc>
      <div className="settings-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Rerun setup wizard</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 12 }}>
          The wizard starts at the beginning and walks through theme, provider, personality, trust mode, and project setup again.
        </div>
        <button className="onboarding-btn-primary" onClick={onRestartOnboarding}>
          <ArrowRight size={14} /> Rerun wizard
        </button>
      </div>
    </>
  );
}
