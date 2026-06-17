import { X } from 'lucide-react';
import type { PanelId } from '../../types/layout';
import { getPanelConfig, getPanelIcon } from './panelRegistry';

interface Props {
  panelId: PanelId;
  onClose: (id: PanelId) => void;
  children: React.ReactNode;
}

export function PanelWrapper({ panelId, onClose, children }: Props) {
  const config = getPanelConfig(panelId);
  const Icon = getPanelIcon(panelId);

  return (
    <div
      className={`panel-frame panel-frame--${panelId}`}
      data-panel-id={panelId}
    >
      <div
        className="panel-header"
      >
        <div className="panel-header-title">
          <Icon size={14} aria-hidden="true" />
          <span>{config.label}</span>
        </div>
        <button
          className="panel-close"
          type="button"
          onClick={() => onClose(panelId)}
          title={`Close ${config.label}`}
          aria-label={`Close ${config.label} panel`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="panel-body">
        {children}
      </div>
    </div>
  );
}
