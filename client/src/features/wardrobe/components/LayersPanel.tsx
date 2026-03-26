/**
 * LayersPanel — Right context panel for the Wardrobe tool.
 *
 * Shows the stack of selected garments with thumbnails, per-garment
 * style note chips (from suggestedActions), freeform tags, custom
 * refinement input, color dots, and action buttons.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Sparkles,
  Save,
  Trash2,
  RefreshCw,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useWardrobeStore } from "../stores/useWardrobeStore";
import { SLOT_DISPLAY_NAMES } from "../constants";
import type { GarmentSlotType } from "../types";
import { parseStyleNote, buildStyleNote, extractColors } from "./layerHelpers";

interface LayersPanelProps {
  isGenerating: boolean;
  hasResult: boolean;
  onGenerate: () => void;
  currentResultUrl: string | null;
  onRefine?: (garmentId: number, instruction: string) => void;
  isRefining?: boolean;
  hasDirtyStyles?: boolean;
  onApplyStyleChanges?: () => void;
  /** Whether any selected garment is still processing */
  hasProcessingSelected?: boolean;
  /** Reset VTO state to original model */
  onResetLook?: () => void;
}

// ── Garment Row ─────────────────────────────────────────────────
interface GarmentRowProps {
  garment: {
    id: number;
    shortName: string | null;
    slotType: string;
    isolatedImageUrl: string | null;
    originalImageUrl: string;
    suggestedActions?: string[];
  };
  isExpanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  styleNote: string;
  onUpdateNote: (note: string) => void;
}

function GarmentRow({
  garment,
  isExpanded,
  onToggle,
  onRemove,
  styleNote,
  onUpdateNote,
}: GarmentRowProps) {
  const [customText, setCustomText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipScrollRef = useRef<HTMLDivElement>(null);
  const chipDrag = useRef({ isDown: false, isDragging: false, startX: 0, scrollStart: 0 });

  const allActions: string[] = garment.suggestedActions ?? [];
  const { chips: activeChips, freeform } = parseStyleNote(styleNote, allActions);
  const editCount = activeChips.length + freeform.length;
  const imgUrl = garment.isolatedImageUrl || garment.originalImageUrl || "";
  const colors = extractColors(imgUrl);
  const slotLabel = SLOT_DISPLAY_NAMES[garment.slotType as GarmentSlotType] || garment.slotType;

  useEffect(() => {
    if (showInput && inputRef.current) inputRef.current.focus();
  }, [showInput]);

  // Suppress click events during chip drag
  useEffect(() => {
    const el = chipScrollRef.current;
    if (!el) return;
    const suppress = (e: MouseEvent) => {
      if (chipDrag.current.isDragging) {
        e.stopPropagation();
        chipDrag.current.isDragging = false;
      }
    };
    el.addEventListener("click", suppress, true);
    return () => el.removeEventListener("click", suppress, true);
  }, [isExpanded]);

  const toggleChip = (label: string) => {
    const { chips, freeform: ff } = parseStyleNote(styleNote, allActions);
    const idx = chips.indexOf(label);
    if (idx >= 0) chips.splice(idx, 1);
    else chips.push(label);
    onUpdateNote(buildStyleNote(chips, ff));
  };

  const removeFreeform = (text: string) => {
    const { chips, freeform: ff } = parseStyleNote(styleNote, allActions);
    onUpdateNote(buildStyleNote(chips, ff.filter((f) => f !== text)));
  };

  const addCustom = () => {
    if (!customText.trim()) return;
    const { chips, freeform: ff } = parseStyleNote(styleNote, allActions);
    ff.push(customText.trim());
    onUpdateNote(buildStyleNote(chips, ff));
    setCustomText("");
    setShowInput(false);
  };

  return (
    <div>
      {/* Collapsed row */}
      <div
        onClick={onToggle}
        className="flex items-center gap-2 rounded-xl transition-colors cursor-pointer"
        style={{ padding: "7px 8px" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {/* Remove button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="flex-shrink-0 flex justify-center"
          style={{ color: "#aaa", width: 16, background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ opacity: 0.4 }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        {/* Thumbnail */}
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden"
          style={{ width: 30, height: 38, background: "#eae7e1", border: "1px solid rgba(0,0,0,0.04)" }}
        >
          {imgUrl && <img src={imgUrl} alt="" className="w-full h-full object-contain" />}
        </div>

        {/* Name + color dots */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            {colors.length > 0 && !isExpanded && (
              <div className="flex -space-x-0.5 flex-shrink-0">
                {colors.slice(0, 3).map((c, i) => (
                  <div key={i} className="rounded-full" style={{
                    width: i === 0 ? 7 : 5, height: i === 0 ? 7 : 5,
                    background: c.hex,
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.9)",
                  }} title={c.name} />
                ))}
              </div>
            )}
            <span className="block truncate" style={{ fontSize: 11, fontWeight: 500, color: "#1a1a1a" }}>
              {garment.shortName || "Untitled"}
            </span>
          </div>
          <span className="block" style={{ fontSize: 7, color: "#b8b3a8", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {slotLabel}
          </span>
        </div>

        {/* Edit count badge */}
        {editCount > 0 && !isExpanded && (
          <div className="flex-shrink-0 rounded-full flex items-center justify-center" style={{
            minWidth: 14, height: 14, padding: "0 4px",
            background: "#1a1a1a", color: "#fff", fontSize: 8, fontWeight: 700,
          }}>
            {editCount}
          </div>
        )}
      </div>

      {/* Expanded section */}
      {isExpanded && (
        <div style={{ padding: "0 8px 8px 48px" }}>
          {/* Color swatches */}
          {colors.length > 0 && (
            <div className="flex items-center gap-1.5" style={{ marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
              {colors.slice(0, 3).map((c, i) => (
                <div key={i} className="rounded-full cursor-default" title={c.name} style={{
                  width: 12, height: 12, background: c.hex,
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.06), inset 0 0 0 1px rgba(0,0,0,0.04)",
                }} />
              ))}
            </div>
          )}

          {/* Suggested action chips */}
          {allActions.length > 0 && (
            <div
              ref={chipScrollRef}
              className="flex gap-1 overflow-x-auto pb-1 no-scrollbar"
              style={{ cursor: "grab" }}
              onMouseDown={(e) => { chipDrag.current = { isDown: true, isDragging: false, startX: e.clientX, scrollStart: chipScrollRef.current?.scrollLeft || 0 }; }}
              onMouseMove={(e) => {
                const d = chipDrag.current;
                if (!d.isDown) return;
                const dx = e.clientX - d.startX;
                if (!d.isDragging && Math.abs(dx) > 4) d.isDragging = true;
                if (d.isDragging && chipScrollRef.current) chipScrollRef.current.scrollLeft = d.scrollStart - dx;
              }}
              onMouseUp={() => { chipDrag.current.isDown = false; }}
              onMouseLeave={() => { chipDrag.current.isDown = false; }}
            >
              {allActions.map((label) => {
                const isActive = activeChips.includes(label);
                return (
                  <button
                    key={label}
                    onClick={(e) => { e.stopPropagation(); toggleChip(label); }}
                    className="flex-shrink-0 transition-all"
                    style={{
                      fontSize: 9, fontWeight: isActive ? 600 : 400,
                      padding: "3px 9px", borderRadius: 20,
                      background: isActive ? "#1a1a1a" : "transparent",
                      color: isActive ? "#f0ede8" : "#bbb",
                      border: isActive ? "none" : "1px solid rgba(0,0,0,0.06)",
                      cursor: "pointer", whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {allActions.length === 0 && (
            <div style={{ fontSize: 9, color: "#ddd", padding: "2px 0" }}>No suggested actions</div>
          )}

          {/* Freeform overlay edits */}
          {freeform.length > 0 && (
            <div className="flex flex-wrap gap-1" style={{ marginTop: 5 }}>
              {freeform.map((text) => (
                <span
                  key={text}
                  onClick={(e) => { e.stopPropagation(); removeFreeform(text); }}
                  className="cursor-pointer transition-colors"
                  style={{
                    fontSize: 9, color: "#aaa", fontStyle: "italic",
                    borderBottom: "1px dashed rgba(0,0,0,0.1)", lineHeight: 1.6,
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#c33"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#aaa"; }}
                  title="Click to remove"
                >
                  {text}
                </span>
              ))}
            </div>
          )}

          {/* Custom input */}
          {!showInput ? (
            <div
              onClick={(e) => { e.stopPropagation(); setShowInput(true); }}
              style={{ marginTop: 5, fontSize: 9, color: "#d4d0c8", cursor: "text", padding: "3px 0" }}
            >
              + custom edit
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
                if (e.key === "Escape") { setShowInput(false); setCustomText(""); }
              }}
              onBlur={() => { if (!customText.trim()) setShowInput(false); }}
              onClick={(e) => e.stopPropagation()}
              placeholder="describe a change..."
              className="outline-none"
              style={{
                marginTop: 4, width: "100%", fontSize: 9, padding: "4px 0",
                border: "none", borderBottom: "1px solid rgba(0,0,0,0.08)",
                background: "transparent", color: "#1a1a1a", boxSizing: "border-box",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Main LayersPanel ────────────────────────────────────────────
export function LayersPanel({
  isGenerating,
  hasResult,
  onGenerate,
  currentResultUrl,
  hasDirtyStyles = false,
  onApplyStyleChanges,
  hasProcessingSelected = false,
  onResetLook,
}: LayersPanelProps) {
  const selectedGarmentIds = useWardrobeStore((s) => s.selectedGarmentIds);
  const toggleGarmentSelection = useWardrobeStore((s) => s.toggleGarmentSelection);
  const clearSelection = useWardrobeStore((s) => s.clearSelection);
  const styleNotes = useWardrobeStore((s) => s.styleNotes);
  const setStyleNote = useWardrobeStore((s) => s.setStyleNote);

  const [expandedGarmentId, setExpandedGarmentId] = useState<number | null>(null);
  const [outfitName, setOutfitName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Force re-render after color extraction completes
  const [, forceUpdate] = useState(0);
  const { data: allGarments = [] } = trpc.wardrobe.garments.list.useQuery(undefined, { staleTime: 30_000 });
  const selectedGarments = allGarments.filter((g) => selectedGarmentIds.has(g.id));

  useEffect(() => {
    const timer = setTimeout(() => forceUpdate((n) => n + 1), 600);
    return () => clearTimeout(timer);
  }, [selectedGarments.length]);

  const utils = trpc.useUtils();
  const saveOutfitMutation = trpc.wardrobe.outfits.save.useMutation({
    onSuccess: () => { toast.success("Outfit saved"); setOutfitName(""); utils.wardrobe.outfits.list.invalidate(); },
    onError: () => { toast.error("Failed to save outfit"); },
  });

  const handleSaveOutfit = useCallback(async () => {
    if (!outfitName.trim()) { toast.error("Enter a name for the outfit"); return; }
    if (selectedGarments.length === 0) { toast.error("No garments selected"); return; }
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
    } finally { setIsSaving(false); }
  }, [outfitName, selectedGarments, styleNotes, currentResultUrl, saveOutfitMutation]);

  // ── Empty state ────────────────────────────────────────────
  if (selectedGarments.length === 0) {
    return (
      <div className="flex flex-col h-full" style={{ background: "#faf8f5" }}>
        <div className="px-4 pt-4 pb-2">
          <h3 className="font-semibold" style={{ fontSize: 13, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Layers</h3>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: "#f0ebe3" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
                <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <p style={{ fontSize: 10, color: "#b8b3a8" }}>Select garments from the rack to build your look</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#faf8f5" }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold" style={{ fontSize: 13, color: "#1a1a1a", letterSpacing: "-0.02em" }}>Layers</h3>
          <div className="flex items-center gap-2">
            <span className="font-mono" style={{ fontSize: 9, color: "#b8b3a8" }}>
              {selectedGarments.length} item{selectedGarments.length !== 1 ? "s" : ""}
            </span>
            {hasResult && onResetLook && (
              <button
                onClick={onResetLook}
                disabled={isGenerating}
                className="p-1 rounded hover:bg-[#f0ebe3] transition-colors disabled:opacity-30"
                title="Reset Look (R)"
              >
                <RotateCcw size={12} color="#999" />
              </button>
            )}
            <button onClick={clearSelection} className="p-1 rounded hover:bg-[#f0ebe3] transition-colors" title="Clear all">
              <Trash2 size={12} color="#999" />
            </button>
          </div>
        </div>
      </div>

      {/* Garment Stack */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: "4px 6px" }}>
        {selectedGarments.map((garment) => (
          <GarmentRow
            key={garment.id}
            garment={garment as GarmentRowProps["garment"]}
            isExpanded={expandedGarmentId === garment.id}
            onToggle={() => setExpandedGarmentId((prev) => (prev === garment.id ? null : garment.id))}
            onRemove={() => toggleGarmentSelection(garment.id)}
            styleNote={styleNotes[String(garment.id)] || ""}
            onUpdateNote={(note) => setStyleNote(garment.id, note)}
          />
        ))}
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: "1px solid #e5e0d8" }}>
        <button
          onClick={onGenerate}
          disabled={isGenerating || selectedGarments.length === 0 || !!hasProcessingSelected}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all hover:opacity-90 disabled:opacity-30"
          style={{ background: "#1a1a1a", color: "#fff", fontSize: 10 }}
        >
          {isGenerating ? (
            <><Loader2 size={12} className="animate-spin" />Generating...</>
          ) : hasResult ? (
            <><RefreshCw size={12} />Update Look</>
          ) : (
            <><Sparkles size={12} />Dress Model</>
          )}
        </button>

        {hasDirtyStyles && hasResult && onApplyStyleChanges && (
          <button
            onClick={onApplyStyleChanges}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-full font-medium transition-all hover:opacity-90 disabled:opacity-30"
            style={{ background: "transparent", color: "#1a1a1a", fontSize: 10, border: "1px solid #d4cfc7" }}
          >
            <RefreshCw size={12} />Apply Style Changes
          </button>
        )}

        {hasResult && (
          <div className="flex gap-2">
            <input
              type="text"
              value={outfitName}
              onChange={(e) => setOutfitName(e.target.value)}
              placeholder="Outfit name..."
              className="flex-1 px-3 py-1.5 rounded-lg border-none outline-none"
              style={{ background: "#f0ebe3", fontSize: 9, color: "#1a1a1a" }}
              maxLength={128}
            />
            <button
              onClick={handleSaveOutfit}
              disabled={isSaving || !outfitName.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80 disabled:opacity-30"
              style={{ background: "#f0ebe3", color: "#1a1a1a", fontSize: 9 }}
            >
              <Save size={10} />Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
