/**
 * WardrobeCanvasOverlays — Tool-specific overlay content for StudioCanvas.
 *
 * Returns the overlay slot props that DrapeStudio passes to StudioCanvas
 * when the active tool is "wardrobe". Keeps wardrobe-specific rendering
 * logic co-located with the wardrobe feature.
 */
import { Download } from 'lucide-react';
import { GarmentOverlay } from "./GarmentOverlay";
import type { DetectedItem } from "../types";

// ── Shortcuts bar ──

const SHORTCUT_HINTS = [
  { key: "Space", label: "Generate" },
  { key: "Z", label: "Undo" },
  { key: "⇧Z", label: "Redo" },
];

const SHORTCUT_HINTS_WITH_COMPARE = [
  ...SHORTCUT_HINTS,
  { key: "Hold", label: "Compare" },
];

interface ShortcutsBarProps {
  hasResult: boolean;
  isGenerating: boolean;
  controlsVisible: boolean;
  onDownload?: () => void;
}

export function WardrobeShortcutsBar({ hasResult, isGenerating, controlsVisible, onDownload }: ShortcutsBarProps) {
  if (isGenerating) return null;
  return (
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
              fontSize: 11,
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
          <span style={{ fontSize: 11, color: "#bbb" }}>{s.label}</span>
        </div>
      ))}

      {/* Download button — only shown when a VTO result exists */}
      {hasResult && onDownload && (
        <>
          <div style={{ width: 1, height: 12, background: 'rgba(0,0,0,0.08)' }} />
          <button
            onClick={onDownload}
            className="flex items-center gap-1 pointer-events-auto rounded-md px-2 py-0.5 transition-colors"
            style={{ background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            title="Download image"
          >
            <Download className="w-3 h-3" style={{ color: '#52524B' }} />
            <span style={{ fontSize: 11, color: '#52524B', fontWeight: 500 }}>Save</span>
          </button>
        </>
      )}
    </div>
  );
}

// ── Empty state ──

export function WardrobeEmptyState() {
  return (
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
      <p style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>No model on canvas</p>
      <p style={{ fontSize: 12, color: "#52524B", marginTop: 4 }}>Cast a model first, then switch to Wardrobe</p>
    </div>
  );
}

// ── Image overlay (garment bounding boxes) ──

interface WardrobeImageOverlayProps {
  resultOverlayItems: DetectedItem[];
  isGenerating: boolean;
  isComparing: boolean;
  onStyleNote?: (note: { garmentLabel: string; category: string; instruction: string }) => void;
}

export function WardrobeImageOverlay({ resultOverlayItems, isGenerating, isComparing, onStyleNote }: WardrobeImageOverlayProps) {
  if (resultOverlayItems.length === 0 || isGenerating || isComparing || !onStyleNote) return null;
  return (
    <GarmentOverlay
      items={resultOverlayItems}
      onStyleNote={onStyleNote}
      disabled={isGenerating}
    />
  );
}
