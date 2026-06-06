import {
  Activity,
  Bot,
  Globe,
  PanelRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const recentUpdates = [
  {
    icon: PanelRight,
    title: 'Browser workspace option',
    body: 'Browser remains available as a right-side tool when you need local previews.',
  },
  {
    icon: Globe,
    title: 'Read-only web access',
    body: 'Main chat and sub-agents can share the safe web fetch fallback for current sources.',
  },
  {
    icon: Activity,
    title: 'Cleaner tool activity',
    body: 'Side chat tool chatter is condensed into one changing activity line.',
  },
  {
    icon: ShieldCheck,
    title: 'Sharper status strip',
    body: 'The bottom bar now names the serving provider, workspace scope, and routing mode.',
  },
  {
    icon: Bot,
    title: 'Clicky controls',
    body: 'The helper icon has settings-backed controls and stays out of the way when disabled.',
  },
];

interface Props {
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function LatestUpdatesPanel({ action }: Props) {
  return (
    <div className="browser-updates">
      <div className="browser-updates-kicker">
        <Sparkles size={14} />
        Latest patch notes
      </div>
      <h2>OpenHarness updates</h2>
      <p>Recent additions in this build.</p>
      <div className="browser-updates-grid">
        {recentUpdates.map(({ icon: Icon, title, body }) => (
          <div className="browser-update-card" key={title}>
            <Icon size={16} />
            <div>
              <strong>{title}</strong>
              <span>{body}</span>
            </div>
          </div>
        ))}
      </div>
      {action && (
        <button className="browser-updates-preview" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
