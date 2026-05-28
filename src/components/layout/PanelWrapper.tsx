import { useState, useRef, useCallback } from 'react';
import { X, GripVertical } from 'lucide-react';
import type { PanelId } from '../../types/layout';
import { getPanelConfig, getPanelIcon } from './panelRegistry';

interface Props {
  panelId: PanelId;
  onClose: (id: PanelId) => void;
  onSwap?: (from: PanelId, to: PanelId) => void;
  children: React.ReactNode;
}

export function PanelWrapper({ panelId, onClose, onSwap, children }: Props) {
  const config = getPanelConfig(panelId);
  const Icon = getPanelIcon(panelId);
  const [dragOver, setDragOver] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', panelId);
    e.dataTransfer.effectAllowed = 'move';
    // Add a slight delay so the browser captures the drag image before we dim
    requestAnimationFrame(() => {
      frameRef.current?.classList.add('dragging');
    });
  }, [panelId]);

  const handleDragEnd = useCallback(() => {
    frameRef.current?.classList.remove('dragging');
    setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're actually leaving the frame (not entering a child)
    if (!frameRef.current?.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    frameRef.current?.classList.remove('dragging');
    const fromId = e.dataTransfer.getData('text/plain') as PanelId;
    if (fromId && fromId !== panelId && onSwap) {
      onSwap(fromId, panelId);
    }
  }, [panelId, onSwap]);

  return (
    <div
      ref={frameRef}
      className={`panel-frame ${dragOver ? 'panel-drop-target' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="panel-header"
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="panel-header-title">
          <GripVertical size={14} className="panel-grip" />
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
