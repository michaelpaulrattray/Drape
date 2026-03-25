/**
 * MainStage — VTO canvas for the Wardrobe tool.
 *
 * Shares a unified canvas language with Casting's ImageViewerPanel:
 *   - Persistent toolbar (undo/redo + status pill) outside image hover container
 *   - Retry button inside image hover container (auto-hides)
 *   - Same positioning so switching between tools feels seamless
 *   - Same background, border-radius, shadow, generating effects
 *   - Same smart "Original" / "Previous" compare badge
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Undo2, Redo2 } from "lucide-react";
import { useWardrobeStore } from "../stores/useWardrobeStore";
import { GarmentOverlay } from "./GarmentOverlay";
import type { DetectedItem } from "../types";

interface MainStageProps {
  modelImageUrl: string | null;
  isGenerating: boolean;
  generatingMessage: string | null;
  errorMessage: string | null;
  onClearError: () => void;
  cooldownSeconds: number;
  onRetry: () => void;
  currentResult: string | null;
  onGenerate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  historyIndex?: number;
  resultOverlayItems?: DetectedItem[];
  onStyleNote?: (note: { garmentLabel: string; category: string; instruction: string }) => void;
}

const GENERATION_TIPS = [
  "Matching fabric textures and drape...",
  "Preserving identity and tattoos...",
  "Layering garments with realistic physics...",
  "Adjusting fit to body proportions...",
  "Rendering construction details...",
];

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

  const cycleTip = useCallback(() => {
    tipIndexRef.current = (tipIndexRef.current + 1) % GENERATION_TIPS.length;
    setTipIndex(tipIndexRef.current);
  }, []);

  // Hold-to-compare
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

  useEffect(() => {
    return () => {
      if (compareTimerRef.current) clearTimeout(compareTimerRef.current);
    };
  }, []);

  const displayUrl = isComparing ? modelImageUrl : (currentResult || modelImageUrl);
  const hasResult = currentResult !== null;
  const canGenerate = selectedCount > 0 && modelImageUrl && !isGenerating && cooldownSeconds <= 0;
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

  // Controls visible when hovered OR generating
  const controlsVisible = imageAreaHovered || isGenerating;

  // ── No model loaded ────────────────────────────────────
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
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a" }}>No model on canvas</p>
          <p style={{ fontSize: 10, color: "#b8b3a8", marginTop: 4 }}>Cast a model first, then switch to Wardrobe</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col relative overflow-hidden"
      style={{ background: "#f0ebe3" }}
    >
      {/* ── Persistent Toolbar (matches Casting's exact pattern) ──────
       * Sits OUTSIDE the image hover container so it's always visible.
       * Same position: absolute top-3 left-1/2 -translate-x-1/2 z-20
       */}
      {modelImageUrl && (
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

          {/* Status pill — green dot + version label (matches Casting) */}
          <div className="flex items-center gap-2 px-2.5">
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isComparing
                  ? "#7c8aef"
                  : isGenerating
                    ? "#e8a83e"
                    : hasResult
                      ? "#5cad5c"
                      : "#ccc",
                boxShadow: isGenerating ? "0 0 6px rgba(232,168,62,0.4)" : "none",
                transition: "background 0.2s",
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 500, color: "#888" }}>
              {isComparing
                ? "Comparing..."
                : isGenerating
                  ? (generatingMessage || "Generating...")
                  : hasResult
                    ? `Dressed · v${historyIndex + 1}`
                    : "Wardrobe Studio"}
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

      {/* Error banner (inline, matches Casting pattern) */}
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
            <button
              onClick={onClearError}
              style={{ fontSize: 10, fontWeight: 500, color: "#999" }}
            >
              Dismiss
            </button>
            <button
              onClick={onRetry}
              style={{ fontSize: 10, fontWeight: 600, color: "#1a1a1a", textDecoration: "underline" }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Image area ─────────────────────────────────────── */}
      <div className="flex-1 relative min-h-0 flex items-center justify-center bg-transparent">
        {/* Image + overlays hover container (matches Casting) */}
        <div
          className="relative h-full max-w-full flex items-center justify-center select-none"
          onMouseEnter={() => setImageAreaHovered(true)}
          onMouseLeave={() => setImageAreaHovered(false)}
        >
          {/* Image wrapper */}
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
                  maxWidth: "calc(100vw - 620px)",
                  maxHeight: "calc(100vh - 100px)",
                  borderRadius: 16,
                  boxShadow: "0 24px 80px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)",
                  opacity: isGenerating ? 0.5 : 1,
                  filter: isGenerating ? "blur(2px)" : "none",
                  cursor: hasResult && !isGenerating ? "grab" : "default", marginTop: '50px',
                }}
                draggable={false}
              />

              {/* Garment overlay */}
              {resultOverlayItems.length > 0 && !isGenerating && !isComparing && onStyleNote && (
                <GarmentOverlay
                  items={resultOverlayItems}
                  onStyleNote={onStyleNote}
                  disabled={isGenerating}
                />
              )}

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

              {/* Retry button — auto-hides with image hover (matches Casting) */}
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
                  title="Regenerate this look"
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

          {/* Shortcuts hint bar — auto-hides with image hover */}
          {displayUrl && !isGenerating && (
            <div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 pointer-events-none transition-all duration-200"
              style={{
                padding: "5px 14px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.7)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                opacity: controlsVisible ? 1 : 0,
                transform: controlsVisible ? "translateY(0)" : "translateY(8px)",
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
                <p className="font-medium" style={{ fontSize: 11, color: "#fff" }}>
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
        </div>
      </div>
    </div>
  );
}
