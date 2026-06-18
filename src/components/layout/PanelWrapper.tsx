import { ExternalLink, X } from 'lucide-react';
import type { PanelId } from '../../types/layout';
import { getPanelConfig, getPanelIcon } from './panelRegistry';

interface Props {
  panelId: PanelId;
  onClose: (id: PanelId) => void;
  onPopOut?: (id: PanelId) => void;
  children: React.ReactNode;
}

export function PanelWrapper({ panelId, onClose, onPopOut, children }: Props) {
  const config = getPanelConfig(panelId);
  const Icon = getPanelIcon(panelId);
  const canPopOut = panelId !== 'chat' && Boolean(onPopOut);

  return (
    <div
      className={`panel-frame panel-frame--${panelId}`}
      data-panel-id={panelId}
    >
      <div
        className="panel-header"
      >
        <div className="panel-header-title">
          <Icon size={14} />
          <span>{config.label}</span>
        </div>
        <div className="panel-header-actions">
          {canPopOut && (
            <button
              className="panel-popout"
              type="button"
              onClick={() => onPopOut?.(panelId)}
              title={`Pop out ${config.label}`}
              aria-label={`Pop out ${config.label} panel`}
            >
              <ExternalLink size={13} aria-hidden="true" />
            </button>
          )}
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
      </div>
      <div className="panel-body">
        {children}
      </div>
    </div>
  );
}
