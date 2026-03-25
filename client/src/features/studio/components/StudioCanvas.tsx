/**
 * StudioCanvas — Unified, persistent canvas shared across all studio tools.
 *
 * Architecture: Procreate/Figma-style — this component is mounted ONCE in
 * DrapeStudio and never unmounts when switching tools. Only the overlay
 * slots and props change per tool, giving a seamless, flicker-free experience.
 *
 * Shared features:
 *   - Canvas background (#f0ebe3)
 *   - Persistent toolbar (undo/redo + status pill)
 *   - Error banner (inline, dismiss + retry)
 *   - Image display with shadow, border-radius, generating effects
 *   - Hold-to-compare with badge
 *   - Retry button (auto-hides on hover)
 *   - LoadingOverlay (scan line + contextual tips)
 *   - Keyboard shortcuts (Z / ⇧Z)
 *
 * Tool-specific features are injected via overlay slots:
 *   - imageOverlay: GarmentOverlay (wardrobe), MaskCanvas (casting)
 *   - topOverlay: ViewTabs, identity warnings (casting)
 *   - bottomOverlay: RefinePanel, shortcuts bar, suggestions (casting)
 *   - sideOverlay: Tool buttons, next stage CTA (casting)
 *   - statusOverlay: Locked source, active tool pills (casting)
 *   - floatingOverlay: Floating reference image (casting)
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
  /** Text shown in the status pill, e.g. "Dressed · v1" or "Headshot · v2" */
  statusLabel: string;
  /** Dot color: green for result, amber for generating, grey for idle */
  statusColor: string;
  /** Optional glow on the status dot */
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

  // ── Keyboard ──
  /** Extra keyboard handler; return true if the event was consumed */
  extraKeyHandler?: (e: KeyboardEvent) => boolean;

  // ── Image events ──
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onImageMouseDown?: (e: React.MouseEvent) => void;
  onImageMouseUp?: (e: React.MouseEvent) => void;

  // ── Toolbar visibility ──
  /** Whether to show the toolbar. Defaults to true when displayUrl is set */
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
  statusColor,
  statusGlow,
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
        className="flex-1 flex items-center justify-center"
        style={{ background: "#f0ebe3" }}
      >
        {emptyState}
      </div>
    );
  }

  // ── Generating with no image yet (first generation) ──
  if (!displayUrl && isGenerating) {
    return (
      <div
        className="flex-1 flex flex-col relative overflow-hidden"
        style={{ background: "#f0ebe3" }}
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
      className="flex-1 flex flex-col relative overflow-hidden"
      style={{ background: "#f0ebe3" }}
    >
      {/* ── Top overlay slot (ViewTabs, identity warnings) ── */}
      {topOverlay}

      {/* ── Persistent Toolbar ── */}
      {toolbarVisible && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 pointer-events-auto"
          style={{
            padding: "3px 4px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.85)",
            boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Undo */}
          <button
            onClick={onUndo}
            disabled={!canUndo || isGenerating}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-20"
            style={{ color: "#888" }}
            title="Undo (Z)"
          >
            <Undo2 size={14} />
          </button>

          <div style={{ width: 1, height: 14, background: "rgba(0,0,0,0.06)" }} />

          {/* Status pill */}
          <div className="flex items-center gap-2 px-2.5">
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isComparing ? "#7c8aef" : statusColor,
                boxShadow: statusGlow || "none",
                transition: "background 0.2s",
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 500, color: "#888" }}>
              {isComparing ? "Comparing..." : statusLabel}
            </span>
          </div>

          <div style={{ width: 1, height: 14, background: "rgba(0,0,0,0.06)" }} />

          {/* Redo */}
          <button
            onClick={onRedo}
            disabled={!canRedo || isGenerating}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-20"
            style={{ color: "#888" }}
            title="Redo (⇧Z)"
          >
            <Redo2 size={14} />
          </button>
        </div>
      )}

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
          <span style={{ fontSize: 11, color: "#c33", fontWeight: 500 }}>{errorMessage}</span>
          <div className="flex items-center gap-2">
            {onClearError && (
              <button
                onClick={onClearError}
                style={{ fontSize: 10, fontWeight: 500, color: "#999" }}
              >
                Dismiss
              </button>
            )}
            <button
              onClick={onRetry}
              style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", textDecoration: "underline" }}
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
        {/* Side overlay slot (tool buttons, next stage CTA) */}
        {sideOverlay}

        {/* Image + overlays hover container */}
        <div
          className="relative h-full max-w-full flex items-center justify-center select-none"
          onMouseEnter={() => { setImageAreaHovered(true); onHoverChange?.(true); }}
          onMouseLeave={() => { setImageAreaHovered(false); onHoverChange?.(false); }}
        >
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
                  maxHeight: "calc(100vh - 100px)",
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
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#fff",
                    letterSpacing: "0.02em",
                  }}
                >
                  {compareLabel}
                </div>
              )}

              {/* Retry button — auto-hides on hover */}
              {!isGenerating && !isComparing && hasResult && (
                <button
                  onClick={onRetry}
                  className="absolute top-3 right-3 z-10 flex items-center gap-1.5 transition-opacity duration-200"
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.88)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    backdropFilter: "blur(12px)",
                    fontSize: 9,
                    fontWeight: 600,
                    color: "#777",
                    opacity: imageAreaHovered ? 1 : 0,
                    pointerEvents: imageAreaHovered ? "auto" : "none",
                  }}
                  title="Regenerate"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 105.69-11.49L1 10" />
                  </svg>
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Bottom overlay slot (RefinePanel, shortcuts, suggestions) */}
          {bottomOverlay}

          {/* Generation overlay */}
          {isGenerating && (
            <LoadingOverlay
              statusMessage={loadingMessage || generatingMessage || "Processing..."}
              isFirstGeneration={isFirstGeneration}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default StudioCanvas;
