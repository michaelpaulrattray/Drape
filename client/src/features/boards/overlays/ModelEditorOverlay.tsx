/**
 * ModelEditorOverlay — Popout modal for viewing/refining a model from the board canvas.
 *
 * Opened by double-clicking a model node on the canvas.
 * Floats as a centered dialog (~90% viewport) with a frosted backdrop,
 * so the canvas context remains visible behind it.
 *
 * Shows the board item's image directly. If the casting stores have an
 * active session for this model, the full refinement tools are available.
 * Otherwise, a clean read-only viewer is shown.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { X, Maximize2, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

/* ── Types ────────────────────────────────────────────────── */

interface ModelEditorOverlayProps {
  /** The board item being edited */
  itemId: number;
  /** The image URL from the board item */
  imageUrl: string | null;
  /** The label from the board item */
  label?: string | null;
  /** Close the overlay */
  onClose: () => void;
}

/* ── Component ────────────────────────────────────────────── */

export function ModelEditorOverlay({
  itemId,
  imageUrl,
  label,
  onClose,
}: ModelEditorOverlayProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll while overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.25));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.25, Math.min(4, z + delta)));
  }, []);

  // Pan drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: posStart.current.x + (e.clientX - dragStart.current.x),
      y: posStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Download
  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label || 'model'}-${itemId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Image downloaded');
    } catch {
      toast.error('Failed to download image');
    }
  }, [imageUrl, label, itemId]);

  return (
    <>
      {/* Frosted backdrop — click to close */}
      <div
        className="fixed inset-0 z-[85]"
        style={{
          background: 'rgba(250, 250, 248, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

      {/* Popout dialog */}
      <div
        className="fixed z-[90] flex flex-col"
        style={{
          top: '4%',
          left: '4%',
          width: '92%',
          height: '92%',
          background: '#FAFAF8',
          backgroundImage: 'radial-gradient(circle, #d4d0cb 0.8px, transparent 0.8px)',
          backgroundSize: '20px 20px',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          animation: 'popout-enter 0.2s ease-out',
        }}
      >
        {/* Header bar */}
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{
            height: 48,
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-3">
            <Maximize2 size={14} style={{ color: '#71716A' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
              {label || 'Model'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{
                background: 'rgba(0,0,0,0.03)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <button
                onClick={handleZoomOut}
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ color: '#71716A', transition: 'color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#71716A')}
                title="Zoom out"
              >
                <ZoomOut size={14} strokeWidth={1.5} />
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#71716A', minWidth: 36, textAlign: 'center' }}>
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ color: '#71716A', transition: 'color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#71716A')}
                title="Zoom in"
              >
                <ZoomIn size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={handleResetView}
                className="w-6 h-6 rounded flex items-center justify-center"
                style={{ color: '#71716A', transition: 'color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#71716A')}
                title="Reset view"
              >
                <RotateCcw size={13} strokeWidth={1.5} />
              </button>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: '#71716A', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
                e.currentTarget.style.color = '#1a1a1a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#71716A';
              }}
              title="Download"
            >
              <Download size={15} strokeWidth={1.5} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ color: '#71716A', transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.06)';
                e.currentTarget.style.color = '#1a1a1a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#71716A';
              }}
              title="Close (Esc)"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Image viewer area */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden"
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={label || 'Model'}
              draggable={false}
              className="select-none"
              style={{
                maxWidth: '80%',
                maxHeight: '85%',
                objectFit: 'contain',
                borderRadius: 12,
                boxShadow: '0 8px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                pointerEvents: 'none',
              }}
            />
          ) : (
            <div
              className="flex flex-col items-center gap-3"
              style={{ color: '#a1a19a' }}
            >
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.03)' }}
              >
                <Maximize2 size={28} strokeWidth={1} style={{ color: '#ccc' }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 500 }}>No image available</p>
            </div>
          )}
        </div>

        {/* Bottom bar — keyboard hints */}
        <div
          className="flex items-center justify-center gap-4 flex-shrink-0"
          style={{
            height: 36,
            borderTop: '1px solid rgba(0,0,0,0.04)',
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {[
            { key: 'Scroll', label: 'Zoom' },
            { key: 'Drag', label: 'Pan' },
            { key: 'Esc', label: 'Close' },
          ].map(({ key, label: l }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#a1a19a',
                  background: 'rgba(0,0,0,0.04)',
                  padding: '1px 5px',
                  borderRadius: 4,
                  letterSpacing: '0.03em',
                }}
              >
                {key}
              </span>
              <span style={{ fontSize: 11, color: '#a1a19a' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Popout animation keyframes */}
      <style>{`
        @keyframes popout-enter {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </>
  );
}
