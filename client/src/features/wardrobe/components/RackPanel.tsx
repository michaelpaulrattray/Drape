/**
 * RackPanel — Garment inventory panel for the Wardrobe tool.
 *
 * Displays the 5-slot tab bar, garment grid, upload drop zone,
 * search filter, slot counts, and saved outfits (in the Looks tab).
 * Matches the warm minimalist aesthetic of the Drape Studio.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useWardrobeStore } from "../stores/useWardrobeStore";
import { useWardrobeInventory } from "../hooks/useWardrobeInventory";
import { GarmentCard } from "./GarmentCard";
import { SavedOutfitCard } from "./SavedOutfitCard";
import { SLOT_TABS, MAX_GARMENTS_PER_SLOT, QUALITY_ISSUE_LABELS } from "../constants";
import type { QualityIssue } from "../types";
import { Scissors } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { GarmentSlotType } from "../types";

/** Severity mapping for raw quality issue codes from the server */
const SEVERE_CODES = new Set(["MIRROR_SELFIE", "MULTIPLE_PEOPLE", "FACE_OBSCURED"]);
const MODERATE_CODES = new Set(["LOW_RESOLUTION", "HEAVY_ANGLE", "CLUTTERED_BG", "SCREENSHOT", "PARTIAL_BODY"]);

/** Convert raw issue codes (string[]) from DB into typed QualityIssue[] */
function parseQualityIssues(raw: unknown): QualityIssue[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === "string")
    .map((code) => ({
      severity: SEVERE_CODES.has(code) ? "high" : MODERATE_CODES.has(code) ? "medium" : "low" as const,
      message: QUALITY_ISSUE_LABELS[code] || code.replace(/_/g, " ").toLowerCase(),
    }));
}

export function RackPanel() {
  const activeSlot = useWardrobeStore((s) => s.activeSlot);
  const setActiveSlot = useWardrobeStore((s) => s.setActiveSlot);
  const searchTerm = useWardrobeStore((s) => s.searchTerm);
  const setSearchTerm = useWardrobeStore((s) => s.setSearchTerm);
  const selectedGarmentIds = useWardrobeStore((s) => s.selectedGarmentIds);
  const styleNotes = useWardrobeStore((s) => s.styleNotes);
  const setDecomposeOpen = useWardrobeStore((s) => s.setDecomposeOpen);
  const setSelection = useWardrobeStore((s) => s.setSelection);
  const clearStyleNotes = useWardrobeStore((s) => s.clearStyleNotes);
  const setStyleNote = useWardrobeStore((s) => s.setStyleNote);

  const {
    garments,
    filteredGarments,
    isLoading,
    slotCounts,
    uploadGarment,
    isUploading,
    removeGarment,
    toggleSelection,
  } = useWardrobeInventory();

  // ── Saved Outfits (only fetched when on Looks tab) ────────
  const isLooksTab = activeSlot === "full_look";
  const outfitsQuery = trpc.wardrobe.outfits.list.useQuery(undefined, {
    enabled: isLooksTab,
  });
  const deleteOutfitMutation = trpc.wardrobe.outfits.delete.useMutation({
    onSuccess: () => {
      toast.success("Outfit deleted");
      outfitsQuery.refetch();
    },
    onError: () => toast.error("Failed to delete outfit"),
  });

  // Build a set of all current garment IDs for fast lookup
  const inventoryIdSet = useMemo(
    () => new Set(garments.map((g) => g.id)),
    [garments],
  );

  const handleLoadOutfit = useCallback(
    (garmentIds: number[], notes: Record<string, string>) => {
      const validIds = garmentIds.filter((id) => inventoryIdSet.has(id));
      const removedCount = garmentIds.length - validIds.length;

      clearStyleNotes();
      setSelection(validIds);
      for (const [id, note] of Object.entries(notes)) {
        if (inventoryIdSet.has(Number(id))) {
          setStyleNote(Number(id), note);
        }
      }

      if (removedCount > 0) {
        toast.warning(
          `${validIds.length} of ${garmentIds.length} garments loaded — ${removedCount} ${removedCount === 1 ? "was" : "were"} removed from your wardrobe`,
        );
      }
    },
    [clearStyleNotes, setSelection, setStyleNote, inventoryIdSet],
  );

  const handleDeleteOutfit = useCallback(
    (outfitId: number) => {
      deleteOutfitMutation.mutate({ outfitId });
    },
    [deleteOutfitMutation],
  );

  const savedOutfits = outfitsQuery.data ?? [];

  // IDs of all full_look garments — used for radio deselection
  const fullLookIds = useMemo(
    () => garments.filter((g) => g.slotType === "full_look").map((g) => g.id),
    [garments],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Drag & Drop ────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((f) => f.type.startsWith("image/"));
      if (imageFile) {
        uploadGarment(imageFile);
      }
    },
    [uploadGarment],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadGarment(file);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [uploadGarment],
  );

  const slotIsFull = slotCounts[activeSlot] >= MAX_GARMENTS_PER_SLOT;

  return (
    <div className="flex flex-col h-full" style={{ background: "#FAFAFA" }}>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-semibold"
            style={{
              fontSize: 13,
              color: "#1a1a1a",
              letterSpacing: "-0.02em",
            }}
          >
            Wardrobe
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDecomposeOpen(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[#FAFAFA]"
              title="Import from outfit photo"
              style={{ color: "#999" }}
            >
              <Scissors size={13} strokeWidth={1.5} />
            </button>
            <span
              className="font-mono"
              style={{ fontSize: 9, color: "#71717A" }}
            >
              {slotCounts[activeSlot]}/{MAX_GARMENTS_PER_SLOT}
            </span>
          </div>
        </div>

        {/* ── Slot Tabs ───────────────────────────────────── */}
        <div className="flex gap-1">
          {SLOT_TABS.map((tab) => {
            const isActive = activeSlot === tab.id;
            const count = slotCounts[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSlot(tab.id)}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all flex-1"
                style={{
                  background: isActive ? "#1a1a1a" : "transparent",
                  color: isActive ? "#fff" : "#999",
                  fontSize: 9,
                }}
              >
                <tab.icon size={14} strokeWidth={1.5} />
                <span
                  className="font-medium"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {tab.shortLabel}
                </span>
                {count > 0 && (
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 7,
                      opacity: 0.6,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────── */}
      <div className="px-4 pb-2">
        <input
          type="text"
          placeholder="Search garments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg border-none outline-none"
          style={{
            background: "#ffffff",
            fontSize: 10,
            color: "#1a1a1a",
          }}
        />
      </div>

      {/* ── Garment Grid ────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop} style={{paddingTop: '8px'}}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredGarments.length === 0 && !isDragOver && !(isLooksTab && savedOutfits.length > 0) ? (
          <EmptySlot
            slotType={activeSlot}
            onUploadClick={() => fileInputRef.current?.click()}
            isUploading={isUploading}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredGarments.map((garment) => (
              <GarmentCard
                key={garment.id}
                id={garment.id}
                imageUrl={garment.originalImageUrl}
                isolatedImageUrl={garment.isolatedImageUrl}
                shortName={garment.shortName}
                description={garment.description}
                tags={
                  Array.isArray(garment.tags)
                    ? (garment.tags as string[])
                    : []
                }
                styleNote={styleNotes[String(garment.id)]}
                qualityIssues={parseQualityIssues(garment.qualityIssues)}
                isSelected={selectedGarmentIds.has(garment.id)}
                isProcessing={garment.status === "processing"}
                slotType={garment.slotType as import("../types").GarmentSlotType}
                suggestedActions={
                  Array.isArray(garment.suggestedActions)
                    ? (garment.suggestedActions as string[])
                    : []
                }
                onToggleSelect={(id, slot, _deselect) =>
                  toggleSelection(id, slot, slot === "full_look" ? fullLookIds : undefined)
                }
                onRemove={removeGarment}
              />
            ))}

            {/* Add garment card */}
            {!slotIsFull && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:border-[#1a1a1a] hover:bg-[#ffffff]"
                style={{
                  borderColor: "#ddd",
                  color: "#999",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="font-mono" style={{ fontSize: 8 }}>
                  {isUploading ? "UPLOADING..." : "ADD"}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ── Saved Outfits (Looks tab only) ────────────── */}
        {isLooksTab && savedOutfits.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex-1 h-px"
                style={{ background: "#E4E4E7" }}
              />
              <span
                className="font-mono uppercase"
                style={{ fontSize: 8, color: "#71717A", letterSpacing: "0.05em" }}
              >
                Saved Outfits
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: "#E4E4E7" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {savedOutfits.map((outfit) => (
                <SavedOutfitCard
                  key={outfit.id}
                  id={outfit.id}
                  name={outfit.name}
                  garmentIds={outfit.garmentIds as number[]}
                  styleNotes={outfit.styleNotes as Record<string, string> | null}
                  resultThumbUrl={outfit.resultThumbUrl}
                  createdAt={outfit.createdAt}
                  onLoad={handleLoadOutfit}
                  onDelete={handleDeleteOutfit}
                  isDeleting={deleteOutfitMutation.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Drag overlay */}
        {isDragOver && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center rounded-xl"
            style={{
              background: "rgba(26, 26, 26, 0.85)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="text-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="1.5"
                className="mx-auto mb-2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span
                className="font-mono uppercase"
                style={{ fontSize: 10, color: "#fff" }}
              >
                Drop to add garment
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

function EmptySlot({
  slotType,
  onUploadClick,
  isUploading,
}: {
  slotType: GarmentSlotType;
  onUploadClick: () => void;
  isUploading: boolean;
}) {
  const labels: Record<GarmentSlotType, string> = {
    full_look: "full looks",
    tops: "tops",
    bottoms: "bottoms",
    shoes: "shoes",
    accessories: "accessories",
  };

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "#ffffff" }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ccc"
          strokeWidth="1.5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <p
        className="text-center mb-1"
        style={{ fontSize: 11, color: "#1a1a1a", fontWeight: 500 }}
      >
        No {labels[slotType]} yet
      </p>
      <p
        className="text-center mb-4"
        style={{ fontSize: 9, color: "#71717A" }}
      >
        Upload a photo or drag & drop
      </p>
      <button
        onClick={onUploadClick}
        disabled={isUploading}
        className="px-4 py-2 rounded-full font-medium transition-all hover:opacity-80 disabled:opacity-40"
        style={{
          background: "#1a1a1a",
          color: "#fff",
          fontSize: 10,
        }}
      >
        {isUploading ? "Uploading..." : "Upload Garment"}
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse">
          <div
            className="aspect-[3/4] rounded-2xl"
            style={{ background: "#ffffff" }}
          />
          <div
            className="h-2 rounded mt-2 w-2/3"
            style={{ background: "#ffffff" }}
          />
        </div>
      ))}
    </div>
  );
}
