/**
 * CanvasZoomControls — Polished zoom pill pinned bottom-left of canvas.
 *
 * Shows −  zoom%  + in a frosted-glass pill.
 * Must be rendered inside a <ReactFlowProvider> to access useReactFlow().
 */
import { useCallback, useEffect, useState } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { Minus, Plus } from 'lucide-react';

export function CanvasZoomControls() {
  const { zoomIn, zoomOut, zoomTo } = useReactFlow();
  const viewport = useViewport();
  const [zoomPct, setZoomPct] = useState(100);

  useEffect(() => {
    setZoomPct(Math.round(viewport.zoom * 100));
  }, [viewport.zoom]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const handleResetZoom = useCallback(() => {
    zoomTo(1, { duration: 250 });
  }, [zoomTo]);

  return (
    <div
      className="absolute bottom-4 left-4 flex items-center gap-0 select-none"
      style={{
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 10,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.06)',
        height: 36,
        padding: '0 2px',
      }}
    >
      {/* Zoom out */}
      <button
        onClick={handleZoomOut}
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          color: '#52524B',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Zoom out"
      >
        <Minus size={14} strokeWidth={2} />
      </button>

      {/* Zoom percentage */}
      <button
        onClick={handleResetZoom}
        className="flex items-center justify-center"
        style={{
          minWidth: 44,
          height: 32,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          color: '#1a1a1a',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Reset to 100%"
      >
        {zoomPct}%
      </button>

      {/* Zoom in */}
      <button
        onClick={handleZoomIn}
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          color: '#52524B',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Zoom in"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
