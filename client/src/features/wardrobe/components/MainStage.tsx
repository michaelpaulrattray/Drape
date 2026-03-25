/**
 * MainStage — VTO canvas for the Wardrobe tool.
 *
 * Shows the clean model when no VTO result exists, or the dressed
 * result after generation. Provides undo/redo, hold-to-compare,
 * and a contextual "Dress" / "Update" button.
 *
 * Shares a unified canvas language with Casting's ImageViewerPanel:
 *   - Same background, border-radius, shadow, generating effects
 *   - Same auto-hide behavior for toolbar + shortcuts on mouse-out
 *   - Same smart "Original" / "Previous" compare badge
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Undo2, Redo2, Sparkles, RotateCcw } from "lucide-react";
import { useWardrobeStore } from "../stores/useWardrobeStore";
import { GarmentOverlay } from "./GarmentOverlay";
import type { DetectedItem } from "../types";

interface MainStageProps {
  /** Clean full-body model image URL */
  modelImageUrl: string | null;
  /** Whether a VTO generation is in progress */
  isGenerating: boolean;
  /** Current generation step message */
  generatingMessage: string | null;
  /** Error message from last generation */
  errorMessage: string | null;
  /** Clear error */
  onClearError: () => void;
  /** Cooldown seconds remaining */
  cooldownSeconds: number;
  /** Retry last failed operation */
  onRetry: () => void;
  /** Current VTO result URL (null = show clean model) */
  currentResult: string | null;
  /** Trigger VTO generation */
  onGenerate: () => void;
  /** Undo to previous result */
  onUndo: () => void;
  /** Redo to next result */
  onRedo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Current index in the undo/redo history (0 = original) */
  historyIndex?: number;
  /** Detected garments in the result image for overlay */
  resultOverlayItems?: DetectedItem[];
  /** Called when user submits a style note via overlay */
  onStyleNote?: (note: { garmentLabel: string; category: string; instruction: string }) => void;
}

/** Contextual tips shown during generation */
const GENERATION_TIPS = [
  "Matching fabric textures and drape...",
  "Preserving identity and tattoos...",
  "Layering garments with realistic physics...",
  "Adjusting fit to body proportions...",
  "Rendering construction details...",
];

/** Keyboard shortcut definitions */
const SHORTCUT_HINTS = [
  { key: "Space", label: "Generate" },
  { key: "Z", label: "Undo" },
  { key: "⇧Z", label: "Redo" },
];

const SHORTCUT_HINTS_WITH_COMPARE = [
  ...SHORTCUT_HINTS,
  { key: "Hold", label: "Compare" },
];

export function MainStage({
  modelImageUrl,
  isGenerating,
  generatingMessage,
  errorMessage,
  onClearError,
  cooldownSeconds,
  onRetry,
  currentResult,
  onGenerate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  historyIndex = 0,
  resultOverlayItems = [],
  onStyleNote,
}: MainStageProps) {
  const selectedCount = useWardrobeStore((s) => s.selectedGarmentIds.size);
  const [isComparing, setIsComparing] = useState(false);
  const tipIndexRef = useRef(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [imageAreaHovered, setImageAreaHovered] = useState(false);

  // Cycle tips during generation
  const cycleTip = useCallback(() => {
    tipIndexRef.current = (tipIndexRef.current + 1) % GENERATION_TIPS.length;
    setTipIndex(tipIndexRef.current);
  }, []);

  // Hold-to-compare handlers (150ms delay so quick clicks go to overlay)
  const compareTimerRef = useRef<number | null>(null);

  const handleCompareStart = useCallback(() => {
    if (!currentResult || !modelImageUrl) return;
    compareTimerRef.current = window.setTimeout(() => {
      setIsComparing(true);
    }, 150);
  }, [currentResult, modelImageUrl]);

  const handleCompareEnd = useCallback(() => {
    if (compareTimerRef.current) {
      clearTimeout(compareTimerRef.current);
      compareTimerRef.current = null;
    }
    setIsComparing(false);
  }, []);

  // Cleanup compare timer on unmount
  useEffect(() => {
    return () => {
      if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
    };
  }, []);

  // Determine which image to show
  const displayUrl = isComparing ? modelImageUrl : (currentResult || modelImageUrl);
  const hasResult = currentResult !== null;
  const canGenerate = selectedCount > 0 && modelImageUrl && !isGenerating && cooldownSeconds <= 0;

  // Smart compare label: "Original" if at v1 (first result), "Previous" for iterations
  const compareLabel = historyIndex <= 0 ? "Original" : "Previous";

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (canGenerate && !isGenerating && cooldownSeconds <= 0) onGenerate();
          break;
        case "z":
        case "Z":
          if (e.metaKey || e.ctrlKey) break;
          if (e.shiftKey) { if (canRedo && !isGenerating) onRedo(); }
          else { if (canUndo && !isGenerating) onUndo(); }
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGenerate, isGenerating, cooldownSeconds, canUndo, canRedo, onGenerate, onUndo, onRedo]);

  // Controls visible when hovered OR generating (always show during gen)
  const controlsVisible = imageAreaHovered || isGenerating;

  // ── No model loaded state ──────────────────────────────────
  if (!modelImageUrl) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "#f0ebe3" }}
      >
        <div className="text-center max-w-xs">
          <div
            className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "#eae7e1" }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ccc"
              strokeWidth="1.5"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a" }}>
            No model on canvas
          </p>
          <p style={{ fontSize: 10, color: "#b8b3a8", marginTop: 4 }}>
            Cast a model first, then switch to Wardrobe
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col relative overflow-hidden"
      style={{ background: "#f0ebe3" }}
    >
      {/* ── Unified Floating Toolbar (auto-hide) ──────────────── */}
      <div
        className="absolute top-3 left-1/2 z-20 flex items-center gap-1 pointer-events-auto transition-all duration-200"
        style={{
          padding: "3px 4px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.85)",
          boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
          backdropFilter: "blur(12px)",
          opacity: controlsVisible ? 1 : 0,
          transform: controlsVisible
            ? "translateX(-50%) translateY(0)"
            : "translateX(-50%) translateY(-8px)",
          pointerEvents: controlsVisible ? "auto" : "none",
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

        {/* Compare label — only visible during compare */}
        {isComparing && (
          <>
            <div style={{ width: 1, height: 14, background: "rgba(0,0,0,0.06)" }} />
            <span className="px-2" style={{ fontSize: 10, fontWeight: 500, color: "#888" }}>
              {compareLabel}
            </span>
            <div style={{ width: 1, height: 14, background: "rgba(0,0,0,0.06)" }} />
          </>
        )}

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

      {/* ── Canvas Area ───────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center relative min-h-0 h-0"
        onMouseEnter={() => setImageAreaHovered(true)}
        onMouseLeave={() => setImageAreaHovered(false)}
      >
        {displayUrl && (
          <div
            className="relative"
            style={{ borderRadius: 16, overflow: "hidden" }}
            onPointerDown={handleCompareStart}
            onPointerUp={handleCompareEnd}
            onPointerLeave={handleCompareEnd}
          >
            <img
              src={displayUrl}
              alt={hasResult && !isComparing ? "Virtual try-on result" : "Model"}
              className="block transition-all duration-300 select-none"
              style={{
                maxWidth: "calc(100% - 2rem)",
                maxHeight: "calc(100vh - 100px)",
                borderRadius: 16,
                boxShadow: "0 24px 80px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
                opacity: isGenerating ? 0.5 : 1,
                filter: isGenerating ? "blur(2px)" : "none",
                cursor: hasResult && !isGenerating ? "grab" : "default",
              }}
              draggable={false}
            />
            {/* Garment overlay — clickable bounding boxes */}
            {resultOverlayItems.length > 0 && !isGenerating && !isComparing && onStyleNote && (
              <GarmentOverlay
                items={resultOverlayItems}
                onStyleNote={onStyleNote}
                disabled={isGenerating}
              />
            )}

            {/* Compare badge — top-left of image */}
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
          </div>
        )}

        {/* Shortcuts hint bar — auto-hide with controls */}
        {displayUrl && (
          <div
            className="absolute bottom-2 left-1/2 z-10 flex items-center gap-3 pointer-events-none transition-all duration-200"
            style={{
              padding: "5px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              opacity: controlsVisible && !isGenerating ? 1 : 0,
              transform: controlsVisible && !isGenerating
                ? "translateX(-50%) translateY(0)"
                : "translateX(-50%) translateY(8px)",
            }}
          >
            {(hasResult ? SHORTCUT_HINTS_WITH_COMPARE : SHORTCUT_HINTS).map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "#bbb",
                    padding: "1px 4px",
                    borderRadius: 3,
                    background: "rgba(0,0,0,0.04)",
                    fontFamily: "monospace",
                  }}
                >
                  {s.key}
                </span>
                <span style={{ fontSize: 9, color: "#bbb" }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Generation overlay */}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div
              className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl"
              style={{
                background: "rgba(26,26,26,0.85)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Loader2 size={24} color="#fff" className="animate-spin" />
              <p
                className="font-medium"
                style={{ fontSize: 11, color: "#fff" }}
              >
                {generatingMessage || "Generating..."}
              </p>
              <p
                className="font-mono"
                style={{ fontSize: 8, color: "rgba(255,255,255,0.5)" }}
                onClick={cycleTip}
              >
                {GENERATION_TIPS[tipIndex]}
              </p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {errorMessage && !isGenerating && (
          <div className="absolute bottom-6 left-1/2 z-10" style={{ transform: "translateX(-50%)" }}>
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: "rgba(220,38,38,0.9)", backdropFilter: "blur(8px)" }}
            >
              <p style={{ fontSize: 10, color: "#fff" }}>{errorMessage}</p>
              <button
                onClick={onClearError}
                className="ml-1 text-white/70 hover:text-white"
                style={{ fontSize: 10 }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Action Bar ─────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 px-6 py-2">
        {/* Retry button (shown when there's an error) */}
        {errorMessage && !isGenerating && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all hover:opacity-90"
            style={{
              background: "rgba(220,38,38,0.9)",
              color: "#fff",
              fontSize: 10,
            }}
          >
            <RotateCcw size={12} />
            Retry
          </button>
        )}

        {/* Generate / Update button */}
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex items-center gap-2 px-6 py-2.5 rounded-full font-medium transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 11,
          }}
        >
          <Sparkles size={14} />
          {cooldownSeconds > 0
            ? `Wait ${cooldownSeconds}s`
            : hasResult
              ? "Update Look"
              : "Dress Model"}
          {selectedCount > 0 && cooldownSeconds <= 0 && (
            <span
              className="font-mono ml-1 px-1.5 py-0.5 rounded-full"
              style={{
                fontSize: 8,
                background: "rgba(255,255,255,0.2)",
              }}
            >
              {selectedCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
