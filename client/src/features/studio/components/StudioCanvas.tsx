/**
 * StudioCanvas — Unified, persistent canvas shared across all studio tools.
 *
 * Architecture: Procreate/Figma-style — this component is mounted ONCE in
 * DrapeStudio and never unmounts when switching tools. Only the overlay
 * slots and props change per tool, giving a seamless, flicker-free experience.
 *
 * Shared features:
 *   - Work-area field (canvas-field token + dot grid — the viewer's language)
 *   - Camera (R6 spatial fallback, ruling R-2a): wheel zooms, dragging the
 *     field background pans, double-click on the background resets. The image
 *     itself keeps hold-to-compare and mask painting — the camera never
 *     steals those gestures.
 *   - Undo/redo floating pill (bottom-left of image, Higgsfield-style)
 *   - ImageActionBar slot (top-right of image — download, copy, menu, optional heart)
 *   - Error banner (inline, dismiss + retry)
 *   - Image display with shadow, border-radius, generating effects
 *   - Hold-to-compare with badge
 *   - LoadingOverlay (scan line + contextual tips)
 *   - Keyboard shortcuts (Z / ⇧Z)
 *
 * Tool-specific features are injected via overlay slots:
 *   - imageOverlay: GarmentOverlay (wardrobe), MaskCanvas (casting)
 *   - topOverlay: ViewTabs, identity warnings (casting)
 *   - bottomOverlay: RefinePanel, suggestions (casting)
 *   - sideOverlay: Tool buttons, next stage CTA (casting)
 *   - statusOverlay: Locked source, active tool pills (casting)
 *   - floatingOverlay: Floating reference image (casting)
 *   - actionBar: ImageActionBar (all tools)
 */
import { useCallback, useEffect, useRef, useState, type RefObject, type ReactNode } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { LoadingOverlay } from "@/features/casting/components/ImageViewer";

// ============ Types ============

export interface StudioCanvasProps {
  /** Primary image URL to display */
  displayUrl: string | null;
  /** Alt text for the image */
  imageAlt?: string;
  /** Ref forwarded to the <img> element (used by Casting for mask alignment) */
  imageRef?: RefObject<HTMLImageElement | null>;
  /** Extra inline styles on the <img> (e.g. marginTop for wardrobe) */
  imageStyle?: React.CSSProperties;

  // ── State ──
  isGenerating: boolean;
  generatingMessage?: string | null;
  hasResult: boolean;

  // ── Toolbar ──
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Text shown in the status pill, e.g. "White Tee + Jeans · v2" or "Headshot · v2" */
  statusLabel: string;
  /** @deprecated — kept for interface compat, no longer rendered */
  statusColor?: string;
  /** @deprecated — kept for interface compat, no longer rendered */
  statusGlow?: string;

  // ── Error ──
  errorMessage?: string | null;
  onClearError?: () => void;

  // ── Actions ──
  onRetry: () => void;

  // ── Compare ──
  /** URL to show when comparing (previous version or original) */
  compareUrl?: string | null;
  compareLabel?: string;

  // ── Loading ──
  loadingMessage?: string;
  /** @deprecated — isFirstGeneration is now derived automatically from displayUrl presence */
  isFirstGeneration?: boolean;

  // ── Empty state ──
  emptyState?: ReactNode;

  // ── Overlay slots (tool-specific) ──
  /** Rendered inside the image wrapper, on top of the image (GarmentOverlay, MaskCanvas) */
  imageOverlay?: ReactNode;
  /** Rendered at the top of the canvas area (ViewTabs, identity warnings) */
  topOverlay?: ReactNode;
  /** Rendered at the bottom of the canvas area (RefinePanel, shortcuts, suggestions) */
  bottomOverlay?: ReactNode;
  /** Rendered on the side of the canvas area (tool buttons, next stage CTA) */
  sideOverlay?: ReactNode;
  /** Rendered at top-left for status pills (locked source, active tool) */
  statusOverlay?: ReactNode;
  /** Rendered as floating elements (reference image) */
  floatingOverlay?: ReactNode;
  /** ImageActionBar rendered in top-right of image (download, copy, menu, optional heart) */
  actionBar?: ReactNode;
  /** NextStepChip rendered at bottom-right of image (contextual next step CTA) */
  nextStepOverlay?: ReactNode;

  // ── Keyboard ──
  /** Extra keyboard handler; return true if the event was consumed */
  extraKeyHandler?: (e: KeyboardEvent) => boolean;

  // ── Image events ──
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onImageMouseDown?: (e: React.MouseEvent) => void;
  onImageMouseUp?: (e: React.MouseEvent) => void;

  // ── Toolbar visibility ──
  /** Whether to show the undo/redo pill. Defaults to true when displayUrl is set */
  showToolbar?: boolean;

  // ── Hover state ──
  /** Callback when image area hover state changes (for parent overlays that need hover awareness) */
  onHoverChange?: (hovered: boolean) => void;

  // ── Generating-only empty state ──
  /** Shown when generating but no image yet (first generation) */
  generatingEmptyState?: ReactNode;
}

// ============ Component ============

export function StudioCanvas({
  displayUrl,
  imageAlt = "Studio canvas",
  imageRef,
  imageStyle,
  isGenerating,
  generatingMessage,
  hasResult,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  statusLabel,
  errorMessage,
  onClearError,
  onRetry,
  compareUrl,
  compareLabel = "Previous",
  loadingMessage,
  isFirstGeneration,
  emptyState,
  imageOverlay,
  topOverlay,
  bottomOverlay,
  sideOverlay,
  statusOverlay,
  floatingOverlay,
  actionBar,
  nextStepOverlay,
  extraKeyHandler,
  onImageLoad,
  onImageMouseDown,
  onImageMouseUp,
  showToolbar,
  onHoverChange,
  generatingEmptyState,
}: StudioCanvasProps) {
  const [isComparing, setIsComparing] = useState(false);
  const [imageAreaHovered, setImageAreaHovered] = useState(false);
  const compareTimerRef = useRef<number | null>(null);

  // ── Camera (R6 spatial fallback) ──────────────────────────────────────────
  const CAMERA_MIN = 0.5;
  const CAMERA_MAX = 4;
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const cameraDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [cameraDragging, setCameraDragging] = useState(false);

  const onFieldWheel = useCallback((e: React.WheelEvent) => {
    setCamera((c) => ({
      ...c,
      zoom: Math.min(CAMERA_MAX, Math.max(CAMERA_MIN, c.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12))),
    }));
  }, []);

  // Pan starts only on the field BACKGROUND — a press on the image belongs
  // to hold-to-compare / mask painting, never the camera
  const onFieldMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (e.target !== e.currentTarget) return;
      cameraDragRef.current = { startX: e.clientX, startY: e.clientY, baseX: camera.x, baseY: camera.y };
      setCameraDragging(true);
    },
    [camera.x, camera.y],
  );
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = cameraDragRef.current;
      if (!d) return;
      setCamera((c) => ({ ...c, x: d.baseX + (e.clientX - d.startX), y: d.baseY + (e.clientY - d.startY) }));
    };
    const onUp = () => {
      cameraDragRef.current = null;
      setCameraDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);
  const onFieldDoubleClick = useCallback((e: React.MouseEvent) => {
    // Reset on any double-click that isn't ON the image (the image's own
    // dblclick stays free for future D-54-style focus semantics)
    if ((e.target as HTMLElement).closest("[data-camera-image]")) return;
    setCamera({ zoom: 1, x: 0, y: 0 });
  }, []);

  // Hold-to-compare
  const handleCompareStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!compareUrl) {
      onImageMouseDown?.(e);
      return;
    }
    compareTimerRef.current = window.setTimeout(() => {
      setIsComparing(true);
    }, 150);
    onImageMouseDown?.(e);
  }, [compareUrl, onImageMouseDown]);

  const handleCompareEnd = useCallback(() => {
    if (compareTimerRef.current) {
      clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
    setIsComparing(false);
    onImageMouseUp?.({} as React.MouseEvent);
  }, [onImageMouseUp]);

  useEffect(() => {
    return () => {
      if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || (e.target as HTMLElement).tagName === 'SELECT') return;

      // Let tool-specific handler consume first
      if (extraKeyHandler?.(e)) return;

      switch (e.key) {
        case "z":
          if (e.metaKey || e.ctrlKey) break;
          if (!e.shiftKey) { e.preventDefault(); if (canUndo && !isGenerating) onUndo(); }
          break;
        case "Z":
          if (e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (canRedo && !isGenerating) onRedo(); }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, isGenerating, onUndo, onRedo, extraKeyHandler]);

  const controlsVisible = imageAreaHovered || isGenerating;
  const toolbarVisible = showToolbar !== undefined ? showToolbar : !!displayUrl;
  const activeDisplayUrl = isComparing && compareUrl ? compareUrl : displayUrl;

  // ── Empty state ──
  if (!displayUrl && !isGenerating && emptyState) {
    return (
      <div
        className="flex-1 h-full flex items-center justify-center"
        style={{
          background: "var(--color-canvas-field)",
          backgroundImage: "radial-gradient(circle, var(--color-canvas-field-dot) 0.8px, transparent 0.8px)",
          backgroundSize: "20px 20px",
        }}
      >
        {emptyState}
      </div>
    );
  }

  // ── Generating with no image yet (first generation) ──
  if (!displayUrl && isGenerating) {
    return (
      <div
        className="flex-1 h-full flex flex-col relative overflow-hidden"
        style={{
          background: "var(--color-canvas-field)",
          backgroundImage: "radial-gradient(circle, var(--color-canvas-field-dot) 0.8px, transparent 0.8px)",
          backgroundSize: "20px 20px",
        }}
      >
        {topOverlay}
        <div className="flex-1 relative">
          <LoadingOverlay
            statusMessage={loadingMessage || generatingMessage || "Processing..."}
            isFirstGeneration={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 h-full flex flex-col relative overflow-hidden"
      style={{
        background: "var(--color-canvas-field)",
        backgroundImage: "radial-gradient(circle, var(--color-canvas-field-dot) 0.8px, transparent 0.8px)",
        backgroundSize: "20px 20px",
      }}
    >
      {/* ── Top overlay slot (ViewTabs, identity warnings) ── */}
      {topOverlay}

      {/* ── Error banner ── */}
      {errorMessage && !isGenerating && (
        <div className="absolute top-14 left-4 right-4 z-30 flex items-center justify-between gap-3 px-4 py-3 rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border-strong">
          <div className="flex items-center gap-2 min-w-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-canvas-destructive)" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="m15 9-6 6M9 9l6 6" />
            </svg>
            <span className="text-canvas-lg font-medium text-canvas-ink-soft">{errorMessage}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onClearError && (
              <button
                onClick={onClearError}
                className="text-canvas-md font-medium text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors"
              >
                Dismiss
              </button>
            )}
            <button
              onClick={onRetry}
              className="text-canvas-md font-medium text-canvas-ink underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Floating overlay slot (reference image) ── */}
      {floatingOverlay}

      {/* ── Status overlay slot (locked source, active tool pills) ── */}
      {statusOverlay}

      {/* ── Image area — the camera's field (wheel zoom, bg drag pan) ── */}
      <div
        className="flex-1 relative min-h-0 flex items-center justify-center bg-transparent"
        style={{ cursor: cameraDragging ? "grabbing" : undefined }}
        onWheel={onFieldWheel}
        onMouseDown={onFieldMouseDown}
        onDoubleClick={onFieldDoubleClick}
      >
        {/* Image + overlays hover container — the camera transforms this
            whole unit, so attached chrome (action bar, undo pill, mask)
            travels with the image */}
        <div
          className="relative max-w-full max-h-full flex items-center justify-center select-none"
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
            transformOrigin: "center center",
            transition: cameraDragging ? "none" : "transform 120ms ease-out",
          }}
          onMouseEnter={() => { setImageAreaHovered(true); onHoverChange?.(true); }}
          onMouseLeave={() => { setImageAreaHovered(false); onHoverChange?.(false); }}
        >
          {/* Side overlay slot (tool buttons, next stage CTA) */}
          {sideOverlay}
          {/* Image wrapper */}
          {activeDisplayUrl && (
            <div
              className="relative"
              data-camera-image
              style={{ borderRadius: 16, overflow: "hidden" }}
              onPointerDown={handleCompareStart}
              onPointerUp={handleCompareEnd}
              onPointerLeave={handleCompareEnd}
            >
              <img
                ref={imageRef}
                src={activeDisplayUrl}
                alt={imageAlt}
                className="block transition-all duration-300 select-none"
                style={{
                  maxWidth: "calc(100vw - 620px)",
                  maxHeight: "calc(100vh - 140px)",
                  borderRadius: "var(--radius-canvas-lg)",
                  border: "0.5px solid var(--color-canvas-border)",
                  opacity: isGenerating ? 0.5 : 1,
                  filter: isGenerating ? "blur(2px)" : "none",
                  cursor: compareUrl ? "grab" : "default",
                  ...imageStyle,
                }}
                onLoad={onImageLoad}
                draggable={false}
              />

              {/* Image overlay slot (GarmentOverlay, MaskCanvas) */}
              {imageOverlay}

              {/* Compare badge */}
              {isComparing && (
                <div
                  className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-canvas-pill text-canvas-sm font-medium"
                  style={{ background: "rgba(10,10,10,0.75)", color: "var(--color-canvas-surface)" }}
                >
                  {compareLabel}
                </div>
              )}

              {/* ── ImageActionBar slot (top-right, Higgsfield-style) ── */}
              {actionBar}

              {/* ── NextStep chip (bottom-right of image) ── */}
              {nextStepOverlay && !isGenerating && !isComparing && (
                <div
                  className="absolute bottom-3 right-3 z-20 pointer-events-auto transition-all duration-300 ease-out"
                  style={{
                    opacity: imageAreaHovered ? 1 : 0,
                    transform: imageAreaHovered ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.95)',
                    pointerEvents: imageAreaHovered ? 'auto' : 'none',
                  }}
                >
                  {nextStepOverlay}
                </div>
              )}

              {/* ── Undo/Redo floating pill (bottom-left of image) ── */}
              {toolbarVisible && !isGenerating && !isComparing && (canUndo || canRedo) && (
                <div
                  className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 pointer-events-auto transition-all duration-200 rounded-canvas-md bg-canvas-surface border-hairline border-canvas-border"
                  style={{
                    padding: "2px 3px",
                    opacity: imageAreaHovered ? 1 : 0,
                    transform: imageAreaHovered ? "translateY(0)" : "translateY(4px)",
                    pointerEvents: imageAreaHovered ? "auto" : "none",
                  }}
                >
                  <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="w-7 h-7 rounded-canvas-sm flex items-center justify-center transition-colors disabled:opacity-20 text-canvas-ink-soft hover:text-canvas-ink hover:bg-canvas-surface-inset"
                    title="Undo (Z)"
                  >
                    <Undo2 size={14} strokeWidth={2.5} />
                  </button>

                  <div className="w-px h-3 bg-canvas-border" />

                  <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="w-7 h-7 rounded-canvas-sm flex items-center justify-center transition-colors disabled:opacity-20 text-canvas-ink-soft hover:text-canvas-ink hover:bg-canvas-surface-inset"
                    title="Redo (⇧Z)"
                  >
                    <Redo2 size={14} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Bottom overlay slot (RefinePanel, suggestions) */}
          {bottomOverlay}

          {/* Generation overlay — isFirstGeneration is always false here because an image is behind the overlay */}
          {isGenerating && (
            <LoadingOverlay
              statusMessage={loadingMessage || generatingMessage || "Processing..."}
              isFirstGeneration={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default StudioCanvas;
