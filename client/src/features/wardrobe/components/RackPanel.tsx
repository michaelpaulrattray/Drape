/**
 * RackPanel — Garment inventory panel for the Wardrobe tool.
 *
 * Displays the 5-slot tab bar, garment grid, upload drop zone,
 * search filter, and slot counts. Matches the warm minimalist
 * aesthetic of the Drape Studio.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useWardrobeStore } from "../stores/useWardrobeStore";
import { useWardrobeInventory } from "../hooks/useWardrobeInventory";
import { GarmentCard } from "./GarmentCard";
import { SLOT_TABS, MAX_GARMENTS_PER_SLOT } from "../constants";
import type { GarmentSlotType } from "../types";

export function RackPanel() {
  const activeSlot = useWardrobeStore((s) => s.activeSlot);
  const setActiveSlot = useWardrobeStore((s) => s.setActiveSlot);
  const searchTerm = useWardrobeStore((s) => s.searchTerm);
  const setSearchTerm = useWardrobeStore((s) => s.setSearchTerm);
  const selectedGarmentIds = useWardrobeStore((s) => s.selectedGarmentIds);
  const styleNotes = useWardrobeStore((s) => s.styleNotes);

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
    <div className="flex flex-col h-full" style={{ background: "#faf8f5" }}>
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
          <span
            className="font-mono"
            style={{ fontSize: 9, color: "#b8b3a8" }}
          >
            {slotCounts[activeSlot]}/{MAX_GARMENTS_PER_SLOT}
          </span>
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
            background: "#f0ebe3",
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
        onDrop={handleDrop}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredGarments.length === 0 && !isDragOver ? (
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
                qualityIssues={
                  Array.isArray(garment.qualityIssues)
                    ? (garment.qualityIssues as {
                        severity: "low" | "medium" | "high";
                        message: string;
                      }[])
                    : []
                }
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
                className="aspect-[3/4] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all hover:border-[#1a1a1a] hover:bg-[#f0ebe3]"
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
        style={{ background: "#f0ebe3" }}
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
        style={{ fontSize: 9, color: "#b8b3a8" }}
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
            style={{ background: "#f0ebe3" }}
          />
          <div
            className="h-2 rounded mt-2 w-2/3"
            style={{ background: "#f0ebe3" }}
          />
        </div>
      ))}
    </div>
  );
}
