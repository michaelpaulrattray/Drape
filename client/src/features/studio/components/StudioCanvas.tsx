/**
 * StudioCanvas — Unified, persistent canvas shared across all studio tools.
 *
 * Architecture: Procreate/Figma-style — this component is mounted ONCE in
 * DrapeStudio and never unmounts when switching tools. Only the overlay
 * slots and props change per tool, giving a seamless, flicker-free experience.
 *
 * Shared features:
 *   - Canvas background (warm off-white #FAFAF8 with subtle warm dot grid)
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
          background: "#FAFAF8",
          backgroundImage: "radial-gradient(circle, #d4d0cb 0.8px, transparent 0.8px)",
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
          background: "#FAFAF8",
          backgroundImage: "radial-gradient(circle, #d4d0cb 0.8px, transparent 0.8px)",
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
        background: "#FAFAF8",
        backgroundImage: "radial-gradient(circle, #d4d0cb 0.8px, transparent 0.8px)",
        backgroundSize: "20px 20px",
      }}
    >
      {/* ── Top overlay slot (ViewTabs, identity warnings) ── */}
      {topOverlay}

      {/* ── Error banner ── */}
      {errorMessage && !isGenerating && (
        <div
          className="absolute top-14 left-4 right-4 z-30 flex items-center justify-between px-4 py-3 rounded-xl"
          style={{
            background: "rgba(220,50,50,0.08)",
            border: "1px solid rgba(220,50,50,0.15)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: 13, color: "#c33", fontWeight: 500 }}>{errorMessage}</span>
          <div className="flex items-center gap-2">
            {onClearError && (
              <button
                onClick={onClearError}
                style={{ fontSize: 12, fontWeight: 500, color: "#999" }}
              >
                Dismiss
              </button>
            )}
            <button
              onClick={onRetry}
              style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", textDecoration: "underline" }}
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

      {/* ── Image area ── */}
      <div className="flex-1 relative min-h-0 flex items-center justify-center bg-transparent">
        {/* Image + overlays hover container */}
        <div
          className="relative h-full max-w-full flex items-center justify-center select-none"
          onMouseEnter={() => { setImageAreaHovered(true); onHoverChange?.(true); }}
          onMouseLeave={() => { setImageAreaHovered(false); onHoverChange?.(false); }}
        >
          {/* Side overlay slot (tool buttons, next stage CTA) */}
          {sideOverlay}
          {/* Image wrapper */}
          {activeDisplayUrl && (
            <div
              className="relative"
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
                  borderRadius: 16,
                  boxShadow: "0 24px 80px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
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
                  className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full"
                  style={{
                    background: "rgba(124,138,239,0.85)",
                    backdropFilter: "blur(8px)",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#fff",
                    letterSpacing: "0.02em",
                  }}
                >
                  {compareLabel}
                </div>
              )}

              {/* ── ImageActionBar slot (top-right, Higgsfield-style) ── */}
              {actionBar}

              {/* ── NextStep chip (bottom-right of image) ── */}
              {nextStepOverlay && !isGenerating && !isComparing && (
                <div
                  className="absolute bottom-3 right-3 z-20 pointer-events-auto transition-all duration-200"
                  style={{
                    padding: '5px 14px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                    opacity: imageAreaHovered ? 1 : 0,
                    transform: imageAreaHovered ? 'translateY(0)' : 'translateY(4px)',
                    pointerEvents: imageAreaHovered ? 'auto' : 'none',
                  }}
                >
                  {nextStepOverlay}
                </div>
              )}

              {/* ── Undo/Redo floating pill (bottom-left of image) ── */}
              {toolbarVisible && !isGenerating && !isComparing && (
                <div
                  className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 pointer-events-auto transition-all duration-200"
                  style={{
                    padding: "2px 3px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                    opacity: imageAreaHovered ? 1 : 0,
                    transform: imageAreaHovered ? "translateY(0)" : "translateY(4px)",
                    pointerEvents: imageAreaHovered ? "auto" : "none",
                  }}
                >
                  <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-20"
                    style={{ color: "#71716A" }}
                    title="Undo (Z)"
                    onMouseEnter={(e) => { if (canUndo) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "#1a1a1a"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71716A"; }}
                  >
                    <Undo2 size={14} strokeWidth={2.5} />
                  </button>

                  <div style={{ width: 1, height: 12, background: "rgba(0,0,0,0.08)" }} />

                  <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-20"
                    style={{ color: "#71716A" }}
                    title="Redo (⇧Z)"
                    onMouseEnter={(e) => { if (canRedo) { e.currentTarget.style.background = "rgba(0,0,0,0.04)"; e.currentTarget.style.color = "#1a1a1a"; } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#71716A"; }}
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
