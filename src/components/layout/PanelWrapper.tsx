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
    <div className="panel-frame">
      <div className="panel-header">
        <div className="panel-header-title">
          <Icon size={14} />
          <span>{config.label}</span>
        </div>
        <button className="panel-close" onClick={() => onClose(panelId)} title={`Close ${config.label}`}>
          <X size={14} />
        </button>
      </div>
      <div className="panel-body">
        {children}
      </div>
    </div>
  );
}
