/**
 * CanvasImageViewer — the double-click image viewer, VIEW-ONLY by ruling
 * (VC-R5 R3): on the canvas it's a viewer — zoom, pan, download, full stop.
 * No refine, no surgical, no editing affordances; editing lives in the
 * casting environment via Edit, inside the D-11 ceremony.
 *
 * Replaces ModelEditorOverlay as the double-click surface (that component
 * was a D-25 violation living on borrowed time; R7 sweeps the file).
 * Background kept from the old viewer — founder-flagged as the better
 * canvas color (R6 restyle reference).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { X, Download } from "lucide-react";
import { downloadImage } from "./imageActions";
import { SafeImage } from "./ImageFallback";

export interface CanvasImageViewerProps {
  imageUrl: string;
  label?: string | null;
  onClose: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export function CanvasImageViewer({ imageUrl, label, onClose }: CanvasImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // Esc closes — capture, so the board's keyboard model never sees it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    },
    [offset],
  );
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setOffset({ x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className="relative flex flex-col rounded-canvas-lg overflow-hidden border-hairline border-canvas-border-strong"
        style={{ inset: 16, position: "absolute", background: "var(--color-canvas-field)" }}
      >
        {/* Slim top bar — title left, the two viewer verbs right */}
        <div className="flex items-center justify-between px-4 h-12 border-b-hairline border-canvas-border bg-canvas-surface flex-shrink-0">
          <span className="text-canvas-sm font-medium text-canvas-ink truncate">
            {label || "Image"}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Download"
              onClick={() => void downloadImage(imageUrl, `drape-${label || "image"}.png`)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-canvas-ink-soft hover:bg-canvas-surface-inset hover:text-canvas-ink transition-colors"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.6} />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-canvas-ink-soft hover:bg-canvas-surface-inset hover:text-canvas-ink transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* The image field — wheel zooms, drag pans, double-click resets */}
        <div
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-canvas-field-dot) 0.8px, transparent 0.8px)",
            backgroundSize: "20px 20px",
          }}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onDoubleClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <SafeImage
              src={imageUrl}
              alt={label ?? ""}
              draggable={false}
              className="max-w-full max-h-full object-contain"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                transition: dragRef.current ? "none" : "transform 120ms ease-out",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
