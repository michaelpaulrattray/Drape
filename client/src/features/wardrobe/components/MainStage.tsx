/**
 * MainStage — VTO canvas for the Wardrobe tool.
 *
 * Shows the clean model when no VTO result exists, or the dressed
 * result after generation. Provides undo/redo, hold-to-compare,
 * and a contextual "Dress" / "Update" button.
 */
import { useCallback, useRef, useState } from "react";
import { Loader2, Undo2, Redo2, Sparkles, Eye } from "lucide-react";
import { useWardrobeStore } from "../stores/useWardrobeStore";

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
}

/** Contextual tips shown during generation */
const GENERATION_TIPS = [
  "Matching fabric textures and drape...",
  "Preserving identity and tattoos...",
  "Layering garments with realistic physics...",
  "Adjusting fit to body proportions...",
  "Rendering construction details...",
];

export function MainStage({
  modelImageUrl,
  isGenerating,
  generatingMessage,
  errorMessage,
  onClearError,
  currentResult,
  onGenerate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
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
  const canGenerate = selectedCount > 0 && modelImageUrl && !isGenerating;

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
      {/* ── Top Controls ──────────────────────────────────── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {/* Undo / Redo */}
        {hasResult && (
          <div
            className="flex items-center gap-1 rounded-full px-1 py-1"
            style={{ background: "rgba(26,26,26,0.7)", backdropFilter: "blur(8px)" }}
          >
            <button
              onClick={onUndo}
              disabled={!canUndo || isGenerating}
              className="p-1.5 rounded-full transition-all hover:bg-white/10 disabled:opacity-30"
              title="Undo"
            >
              <Undo2 size={14} color="#fff" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo || isGenerating}
              className="p-1.5 rounded-full transition-all hover:bg-white/10 disabled:opacity-30"
              title="Redo"
            >
              <Redo2 size={14} color="#fff" />
            </button>
          </div>
        )}

        {/* Compare badge */}
        {hasResult && (
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 select-none"
            style={{
              background: isComparing
                ? "rgba(255,255,255,0.9)"
                : "rgba(26,26,26,0.7)",
              backdropFilter: "blur(8px)",
              transition: "background 0.2s",
            }}
          >
            <Eye
              size={12}
              color={isComparing ? "#1a1a1a" : "#fff"}
            />
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 8,
                color: isComparing ? "#1a1a1a" : "#fff",
                letterSpacing: "0.05em",
              }}
            >
              {isComparing ? "Original" : "Result"}
            </span>
          </div>
        )}
      </div>

      {/* ── Canvas Area ───────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
        onPointerDown={handleCompareStart}
        onPointerUp={handleCompareEnd}
        onPointerLeave={handleCompareEnd}
      >
        {displayUrl && (
          <img
            src={displayUrl}
            alt={hasResult && !isComparing ? "Virtual try-on result" : "Model"}
            className="max-h-full max-w-full object-contain rounded-xl transition-opacity duration-300"
            style={{
              opacity: isGenerating ? 0.4 : 1,
              filter: isGenerating ? "blur(2px)" : "none",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            }}
            draggable={false}
          />
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
          {hasResult ? "Update Look" : "Dress Model"}
          {selectedCount > 0 && (
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

        {/* Hold-to-compare hint */}
        {hasResult && !isGenerating && (
          <span
            className="font-mono"
            style={{ fontSize: 8, color: "#b8b3a8" }}
          >
            Hold to compare
          </span>
        )}
      </div>
    </div>
  );
}
