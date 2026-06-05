import { Code, Bug, FileText, Sparkles, Search, Cpu, Layers } from 'lucide-react';
import { welcomeSuggestions } from '../utils/mockData';

interface Props {
  onSuggestionClick: (text: string) => void;
}

const icons = [Search, Code, Bug, FileText];

export function WelcomeScreen({ onSuggestionClick }: Props) {
  return (
    <div className="welcome-screen">
      <div className="welcome-logo">
        <Cpu size={28} color="white" />
      </div>
      <h1 className="welcome-title">OpenHarness</h1>
      <p className="welcome-subtitle">
        A local-first AI workbench for coding, routing, and evaluation.
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

      <div style={{ marginTop: 40, display: 'flex', gap: 20, fontSize: 11, color: 'var(--text-tertiary)' }}>
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
