/**
 * WardrobeCanvasOverlays — Tool-specific overlay content for StudioCanvas.
 *
 * Returns the overlay slot props that DrapeStudio passes to StudioCanvas
 * when the active tool is "wardrobe". Keeps wardrobe-specific rendering
 * logic co-located with the wardrobe feature.
 */
import { GarmentOverlay } from "./GarmentOverlay";
import type { DetectedItem } from "../types";

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
      <p style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>No model on <span className="font-heading italic" style={{ fontWeight: 400 }}>canvas</span></p>
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
