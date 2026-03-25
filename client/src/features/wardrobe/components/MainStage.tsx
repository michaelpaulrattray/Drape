/**
 * MainStage — VTO canvas for the Wardrobe tool.
 *
 * Shows the clean model when no VTO result exists, or the dressed
 * result after generation. Provides undo/redo, hold-to-compare,
 * and a contextual "Dress" / "Update" button.
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
  resultOverlayItems = [],
  onStyleNote,
}: MainStageProps) {
  const selectedCount = useWardrobeStore((s) => s.selectedGarmentIds.size);
  const [isComparing, setIsComparing] = useState(false);
  const tipIndexRef = useRef(0);
  const [tipIndex, setTipIndex] = useState(0);

  // Cycle tips during generation
  const cycleTip = useCallback(() => {
    tipIndexRef.current = (tipIndexRef.current + 1) % GENERATION_TIPS.length;
    setTipIndex(tipIndexRef.current);
  }, []);

  // Hold-to-compare handlers
  const handleCompareStart = useCallback(() => {
    if (currentResult && modelImageUrl) {
      setIsComparing(true);
    }
  }, [currentResult, modelImageUrl]);

  const handleCompareEnd = useCallback(() => {
    setIsComparing(false);
  }, []);

  // Determine which image to show
  const displayUrl = isComparing ? modelImageUrl : (currentResult || modelImageUrl);
  const hasResult = currentResult !== null;
  const canGenerate = selectedCount > 0 && modelImageUrl && !isGenerating && cooldownSeconds <= 0;

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

  // Status dot color
  const statusDotBg = isComparing
    ? "#7c8aef"
    : isGenerating
      ? "#e8a83e"
      : hasResult
        ? "#5cad5c"
        : "#ccc";

  const statusDotShadow = isGenerating ? "0 0 6px rgba(232,168,62,0.4)" : "none";

  // Status text
  const statusText = isComparing
    ? "Comparing..."
    : isGenerating
      ? (generatingMessage || "Processing...")
      : cooldownSeconds > 0
        ? `Rate limited · ${cooldownSeconds}s`
        : "Wardrobe Studio";

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
      className="flex-1 flex flex-col relative"
      style={{ background: "#f0ebe3" }}
    >
      {/* ── Unified Floating Toolbar ─────────────────────────── */}
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

        {/* Divider */}
        <div style={{ width: 1, height: 14, background: "rgba(0,0,0,0.06)" }} />

        {/* Status */}
        <div className="flex items-center gap-2 px-2.5">
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: statusDotBg,
              boxShadow: statusDotShadow,
              transition: "background 0.3s",
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 500, color: "#888" }}>
            {statusText}
          </span>
        </div>

        {/* Divider */}
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

      {/* ── Canvas Area ───────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {displayUrl && (
          <div className="relative max-h-full max-w-full">
            <img
              src={displayUrl}
              alt={hasResult && !isComparing ? "Virtual try-on result" : "Model"}
              className="max-h-full max-w-full object-contain rounded-xl transition-opacity duration-300 select-none"
              style={{
                opacity: isGenerating ? 0.4 : 1,
                filter: isGenerating ? "blur(2px)" : "none",
                boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              }}
              draggable={false}
              onPointerDown={handleCompareStart}
              onPointerUp={handleCompareEnd}
              onPointerLeave={handleCompareEnd}
            />
            {/* Garment overlay — clickable bounding boxes */}
            {resultOverlayItems.length > 0 && !isGenerating && !isComparing && onStyleNote && (
              <GarmentOverlay
                items={resultOverlayItems}
                onStyleNote={onStyleNote}
                disabled={isGenerating}
              />
            )}
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
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
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
      <div
        className="flex items-center justify-center gap-3 px-6 py-4"
        style={{ borderTop: "1px solid #e5e0d8" }}
      >
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

        {/* Shortcuts hint bar */}
        {!isGenerating && (
          <div
            className="flex items-center gap-3 pointer-events-none"
            style={{
              padding: "5px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.7)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
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
      </div>
    </div>
  );
}
