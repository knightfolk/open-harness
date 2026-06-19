import { Code, Bug, FileText, Sparkles, Search, Cpu, Layers } from 'lucide-react';
import { welcomeSuggestions } from '../utils/mockData';

interface Props {
  onSuggestionClick: (text: string) => void;
}

const icons = [Search, Code, Bug, FileText];

export function WelcomeScreen({ onSuggestionClick }: Props) {
  return (
    <div className="welcome-screen">
      <div className="welcome-logo" style={{ animation: 'slideUp 300ms ease-out both' }}>
        <Cpu size={28} color="white" />
      </div>
      <h1 className="welcome-title" style={{ animation: 'slideUp 300ms ease-out 80ms both' }}>OpenHarness</h1>
      <p className="welcome-subtitle" style={{ animation: 'slideUp 300ms ease-out 160ms both' }}>
        An open-source, agent-first harness for coding, routing, and evaluation.
        Ask anything — write code, debug issues, inspect repos, and coordinate agents.
      </p>
      <div className="welcome-suggestions">
        {welcomeSuggestions.map((s, i) => {
          const Icon = icons[i];
          return (
            <button
              key={i}
              className="welcome-suggestion"
              onClick={() => onSuggestionClick(s.desc)}
              style={{ animation: `slideUp 300ms ease-out ${320 + i * 80}ms both` } as React.CSSProperties}
            >
              <div className="welcome-suggestion-title">
                <Icon size={14} style={{ color: 'var(--accent-primary)' }} />
                {s.title}
              </div>
              <div className="welcome-suggestion-desc">{s.desc}</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 40, display: 'flex', gap: 20, fontSize: 11, color: 'var(--text-tertiary)', animation: 'fadeIn 400ms ease-out 600ms both' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Layers size={12} /> Multi-agent support
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Code size={12} /> Syntax highlighting
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={12} /> Plan tracking
        </span>
      </div>
    </div>
  );
}
