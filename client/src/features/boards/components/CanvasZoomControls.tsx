/**
 * CanvasZoomControls — Polished zoom pill pinned bottom-left of canvas.
 *
 * Shows −  zoom%  + in a frosted-glass capsule pill.
 * Zoom steps in 25% increments. Click percentage to reset to 100%.
 * Must be rendered inside a <ReactFlowProvider> to access useReactFlow().
 */
import { useCallback, useEffect, useState } from 'react';
import { useReactFlow, useViewport } from '@xyflow/react';
import { Minus, Plus } from 'lucide-react';

/** Snap to nearest 25% step */
function snapToStep(zoom: number, direction: 'in' | 'out'): number {
  const pct = zoom * 100;
  if (direction === 'in') {
    const next = Math.ceil(pct / 25) * 25;
    // If we're already on a step, go to the next one
    return (next === Math.round(pct) ? next + 25 : next) / 100;
  } else {
    const next = Math.floor(pct / 25) * 25;
    return (next === Math.round(pct) ? next - 25 : next) / 100;
  }
}

export function CanvasZoomControls() {
  const { zoomTo } = useReactFlow();
  const viewport = useViewport();
  const [zoomPct, setZoomPct] = useState(100);

  useEffect(() => {
    setZoomPct(Math.round(viewport.zoom * 100));
  }, [viewport.zoom]);

  const handleZoomIn = useCallback(() => {
    const target = snapToStep(viewport.zoom, 'in');
    const clamped = Math.min(target, 3); // maxZoom
    zoomTo(clamped, { duration: 200 });
  }, [zoomTo, viewport.zoom]);

  const handleZoomOut = useCallback(() => {
    const target = snapToStep(viewport.zoom, 'out');
    const clamped = Math.max(target, 0.1); // minZoom
    zoomTo(clamped, { duration: 200 });
  }, [zoomTo, viewport.zoom]);

  const handleResetZoom = useCallback(() => {
    zoomTo(1, { duration: 250 });
  }, [zoomTo]);

  return (
    <div
      className="absolute bottom-4 left-4 flex items-center gap-0 select-none"
      style={{
        zIndex: 10,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.07)',
        height: 40,
        padding: '0 4px',
      }}
    >
      {/* Zoom out */}
      <button
        onClick={handleZoomOut}
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          border: 'none',
          background: 'transparent',
          color: '#52524B',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Zoom out (−25%)"
      >
        <Minus size={14} strokeWidth={2} />
      </button>

      {/* Zoom percentage */}
      <button
        onClick={handleResetZoom}
        className="flex items-center justify-center"
        style={{
          minWidth: 48,
          height: 32,
          borderRadius: 16,
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
          borderRadius: 16,
          border: 'none',
          background: 'transparent',
          color: '#52524B',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.05)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        title="Zoom in (+25%)"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
