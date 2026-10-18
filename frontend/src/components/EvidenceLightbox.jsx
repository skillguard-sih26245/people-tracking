import React, { useEffect, useState } from 'react';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';

export default function EvidenceLightbox({ src, alt = 'Evidence image', onClose }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(4, value + 0.25));
      if (event.key === '-') setZoom((value) => Math.max(1, value - 0.25));
      if (event.key === '0') setZoom(1);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const zoomBy = (amount) => setZoom((value) => Math.min(4, Math.max(1, value + amount)));

  return (
    <div className="evidence-lightbox-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="evidence-lightbox" role="dialog" aria-modal="true" aria-label="Evidence image viewer">
        <div className="evidence-lightbox-toolbar">
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => zoomBy(-0.25)} disabled={zoom <= 1} aria-label="Zoom out"><Minus size={18}/></button>
          <button type="button" onClick={() => setZoom(1)} aria-label="Reset zoom"><RotateCcw size={17}/></button>
          <button type="button" onClick={() => zoomBy(0.25)} disabled={zoom >= 4} aria-label="Zoom in"><Plus size={18}/></button>
          <button type="button" onClick={onClose} aria-label="Close image viewer"><X size={20}/></button>
        </div>
        <div className="evidence-lightbox-stage" onWheel={(event) => {
          event.preventDefault();
          zoomBy(event.deltaY < 0 ? 0.15 : -0.15);
        }}>
          <img
            src={src}
            alt={alt}
            draggable="false"
            style={{ width: `${zoom * 90}vw`, maxHeight: zoom === 1 ? '84vh' : 'none' }}
          />
        </div>
        <div className="evidence-lightbox-hint">Use +/− or the mouse wheel to zoom · Esc to close</div>
      </section>
    </div>
  );
}
