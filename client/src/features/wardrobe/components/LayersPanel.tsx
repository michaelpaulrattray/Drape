/**
 * LayersPanel — Right context panel for the Wardrobe tool.
 *
 * Shows the stack of selected garments with thumbnails, per-garment
 * style note inputs, suggested action chips, custom refinement input,
 * and action buttons (generate, save outfit, clear).
 */
import { useCallback, useRef, useState } from "react";
import {
  X,
  Sparkles,
  Save,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useWardrobeStore } from "../stores/useWardrobeStore";
import { SLOT_DISPLAY_NAMES } from "../constants";
import type { GarmentSlotType } from "../types";

interface LayersPanelProps {
  /** Whether VTO generation is in progress */
  isGenerating: boolean;
  /** Whether a VTO result exists */
  hasResult: boolean;
  /** Trigger VTO generation */
  onGenerate: () => void;
  /** Current VTO result URL (for outfit save) */
  currentResultUrl: string | null;
  /** Refine a specific garment with an instruction */
  onRefine?: (garmentId: number, instruction: string) => void;
  /** Whether refinement is in progress */
  isRefining?: boolean;
  /** Whether any selected garment has dirty style notes */
  hasDirtyStyles?: boolean;
  /** Apply only the changed style notes */
  onApplyStyleChanges?: () => void;
}

// ── Garment Refinement Row ──────────────────────────────────────
function GarmentRefinementSection({
  garmentId,
  suggestedActions,
  onRefine,
  isRefining,
}: {
  garmentId: number;
  suggestedActions: string[];
  onRefine: (garmentId: number, instruction: string) => void;
  isRefining: boolean;
}) {
  const [customText, setCustomText] = useState("");
  const [activeChipLabel, setActiveChipLabel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChipClick = (label: string) => {
    if (isRefining) return;
    setActiveChipLabel(label);
    onRefine(garmentId, label);
  };

  const handleCustomSubmit = () => {
    if (!customText.trim() || isRefining) return;
    setActiveChipLabel(null);
    onRefine(garmentId, customText.trim());
    setCustomText("");
  };

  return (
    <div className="px-3 pb-2" style={{ borderTop: "1px solid rgba(0,0,0,0.03)" }}>
      {/* Suggested action chips */}
      {suggestedActions.length > 0 && (
        <div
          className="flex gap-1 overflow-x-auto pb-1 pt-2 no-scrollbar"
          style={{ scrollbarWidth: "none" }}
        >
          {suggestedActions.map((label) => {
            const isActive = activeChipLabel === label && isRefining;
            return (
              <button
                key={label}
                onClick={() => handleChipClick(label)}
                disabled={isRefining}
                className="flex-shrink-0 flex items-center gap-1 transition-all disabled:opacity-40"
                style={{
                  fontSize: 8,
                  fontWeight: isActive ? 600 : 400,
                  padding: "3px 8px",
                  borderRadius: 20,
                  background: isActive ? "#1a1a1a" : "transparent",
                  color: isActive ? "#f0ede8" : "#999",
                  border: isActive ? "none" : "1px solid rgba(0,0,0,0.08)",
                  cursor: isRefining ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {isActive && <Loader2 size={8} className="animate-spin" />}
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Custom instruction input */}
      <div className="flex items-center gap-1.5 mt-1.5">
        <input
          ref={inputRef}
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCustomSubmit();
            if (e.key === "Escape") {
              setCustomText("");
              inputRef.current?.blur();
            }
          }}
          disabled={isRefining}
          placeholder="Type a styling instruction..."
          className="flex-1 px-2 py-1.5 rounded-lg border-none outline-none disabled:opacity-40"
          style={{
            background: "#f8f6f2",
            fontSize: 8,
            color: "#1a1a1a",
          }}
          maxLength={200}
        />
        {customText.trim() && (
          <button
            onClick={handleCustomSubmit}
            disabled={isRefining}
            className="flex-shrink-0 px-2 py-1.5 rounded-lg font-medium transition-all hover:opacity-80 disabled:opacity-40"
            style={{
              background: "#1a1a1a",
              color: "#f0ede8",
              fontSize: 8,
            }}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main LayersPanel ────────────────────────────────────────────
export function LayersPanel({
  isGenerating,
  hasResult,
  onGenerate,
  currentResultUrl,
  onRefine,
  isRefining = false,
  hasDirtyStyles = false,
  onApplyStyleChanges,
}: LayersPanelProps) {
  const selectedGarmentIds = useWardrobeStore((s) => s.selectedGarmentIds);
  const toggleGarmentSelection = useWardrobeStore((s) => s.toggleGarmentSelection);
  const clearSelection = useWardrobeStore((s) => s.clearSelection);
  const styleNotes = useWardrobeStore((s) => s.styleNotes);
  const setStyleNote = useWardrobeStore((s) => s.setStyleNote);

  const [expandedGarmentId, setExpandedGarmentId] = useState<number | null>(null);
  const [outfitName, setOutfitName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Fetch all garments to get details for selected ones
  const { data: allGarments = [] } = trpc.wardrobe.garments.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  const selectedGarments = allGarments.filter((g) =>
    selectedGarmentIds.has(g.id),
  );

  // Save outfit mutation
  const saveOutfitMutation = trpc.wardrobe.outfits.save.useMutation({
    onSuccess: () => {
      toast.success("Outfit saved");
      setOutfitName("");
    },
    onError: () => {
      toast.error("Failed to save outfit");
    },
  });

  const handleSaveOutfit = useCallback(async () => {
    if (!outfitName.trim()) {
      toast.error("Enter a name for the outfit");
      return;
    }
    if (selectedGarments.length === 0) {
      toast.error("No garments selected");
      return;
    }

    setIsSaving(true);
    try {
      const notes: Record<string, string> = {};
      for (const g of selectedGarments) {
        const note = styleNotes[String(g.id)];
        if (note?.trim()) notes[String(g.id)] = note;
      }

      await saveOutfitMutation.mutateAsync({
        name: outfitName.trim(),
        garmentIds: selectedGarments.map((g) => g.id),
        styleNotes: Object.keys(notes).length > 0 ? notes : undefined,
        resultThumbUrl: currentResultUrl ?? undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }, [outfitName, selectedGarments, styleNotes, currentResultUrl, saveOutfitMutation]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedGarmentId((prev) => (prev === id ? null : id));
  }, []);

  // ── Empty state ────────────────────────────────────────────
  if (selectedGarments.length === 0) {
    return (
      <div className="flex flex-col h-full" style={{ background: "#faf8f5" }}>
        <div className="px-4 pt-4 pb-2">
          <h3
            className="font-semibold"
            style={{ fontSize: 13, color: "#1a1a1a", letterSpacing: "-0.02em" }}
          >
            Layers
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: "#f0ebe3" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ccc"
                strokeWidth="1.5"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <p style={{ fontSize: 10, color: "#b8b3a8" }}>
              Select garments from the rack to build your look
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#faf8f5" }}>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <h3
            className="font-semibold"
            style={{ fontSize: 13, color: "#1a1a1a", letterSpacing: "-0.02em" }}
          >
            Layers
          </h3>
          <div className="flex items-center gap-2">
            <span
              className="font-mono"
              style={{ fontSize: 9, color: "#b8b3a8" }}
            >
              {selectedGarments.length} item{selectedGarments.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={clearSelection}
              className="p-1 rounded hover:bg-[#f0ebe3] transition-colors"
              title="Clear all"
            >
              <Trash2 size={12} color="#999" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Garment Stack ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="flex flex-col gap-2">
          {selectedGarments.map((garment) => {
            const isExpanded = expandedGarmentId === garment.id;
            const note = styleNotes[String(garment.id)] || "";
            const slotLabel =
              SLOT_DISPLAY_NAMES[garment.slotType as GarmentSlotType] ||
              garment.slotType;
            const actions: string[] = (garment as Record<string, unknown>).suggestedActions as string[] ?? [];

            return (
              <div
                key={garment.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {/* Garment row */}
                <div className="flex items-center gap-3 px-3 py-2">
                  {/* Thumbnail */}
                  <div
                    className="w-10 h-12 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ background: "#f0ebe3" }}
                  >
                    <img
                      src={garment.isolatedImageUrl || garment.originalImageUrl}
                      alt={garment.shortName || "Garment"}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium truncate"
                      style={{ fontSize: 10, color: "#1a1a1a" }}
                    >
                      {garment.shortName || "Untitled"}
                    </p>
                    <p
                      className="font-mono uppercase"
                      style={{ fontSize: 7, color: "#b8b3a8", letterSpacing: "0.05em" }}
                    >
                      {slotLabel}
                    </p>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => toggleExpand(garment.id)}
                    className="p-1 rounded hover:bg-[#f0ebe3] transition-colors"
                    title={isExpanded ? "Collapse" : "Style note"}
                  >
                    {isExpanded ? (
                      <ChevronUp size={12} color="#999" />
                    ) : (
                      <ChevronDown size={12} color="#999" />
                    )}
                  </button>
                  <button
                    onClick={() => toggleGarmentSelection(garment.id)}
                    className="p-1 rounded hover:bg-red-50 transition-colors"
                    title="Remove from layers"
                  >
                    <X size={12} color="#dc2626" />
                  </button>
                </div>

                {/* Expanded: style note input */}
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <textarea
                      value={note}
                      onChange={(e) => setStyleNote(garment.id, e.target.value)}
                      placeholder="Style note (e.g. tucked in, sleeves rolled up, open collar)"
                      className="w-full px-2.5 py-2 rounded-lg border-none outline-none resize-none"
                      style={{
                        background: "#f8f6f2",
                        fontSize: 9,
                        color: "#1a1a1a",
                        minHeight: 48,
                      }}
                      maxLength={200}
                    />
                    <div className="flex justify-end mt-1">
                      <span
                        className="font-mono"
                        style={{ fontSize: 7, color: "#ccc" }}
                      >
                        {note.length}/200
                      </span>
                    </div>
                  </div>
                )}

                {/* Refinement UI: chips + custom input (only when result exists) */}
                {isExpanded && hasResult && onRefine && (
                  <GarmentRefinementSection
                    garmentId={garment.id}
                    suggestedActions={actions}
                    onRefine={onRefine}
                    isRefining={isRefining}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Action Buttons ──────────────────────────────── */}
      <div
        className="px-4 py-3 flex flex-col gap-2"
        style={{ borderTop: "1px solid #e5e0d8" }}
      >
        {/* Generate / Update */}
        <button
          onClick={onGenerate}
          disabled={isGenerating || selectedGarments.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all hover:opacity-90 disabled:opacity-30"
          style={{
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 10,
          }}
        >
          {isGenerating ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Generating...
            </>
          ) : hasResult ? (
            <>
              <RefreshCw size={12} />
              Update Look
            </>
          ) : (
            <>
              <Sparkles size={12} />
              Dress Model
            </>
          )}
        </button>

        {/* Apply Style Changes (only when dirty notes exist) */}
        {hasDirtyStyles && hasResult && onApplyStyleChanges && (
          <button
            onClick={onApplyStyleChanges}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full font-medium transition-all hover:opacity-90 disabled:opacity-30"
            style={{
              background: "transparent",
              color: "#1a1a1a",
              fontSize: 10,
              border: "1px solid #d4cfc7",
            }}
          >
            <RefreshCw size={12} />
            Apply Style Changes
          </button>
        )}

        {/* Save outfit (only when result exists) */}
        {hasResult && (
          <div className="flex gap-2">
            <input
              type="text"
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              placeholder="Outfit name..."
              className="flex-1 px-3 py-1.5 rounded-lg border-none outline-none"
              style={{
                background: "#f0ebe3",
                fontSize: 9,
                color: "#1a1a1a",
              }}
              maxLength={128}
            />
            <button
              onClick={handleSaveOutfit}
              disabled={isSaving || !outfitName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80 disabled:opacity-30"
              style={{
                background: "#f0ebe3",
                color: "#1a1a1a",
                fontSize: 9,
              }}
            >
              <Save size={10} />
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
