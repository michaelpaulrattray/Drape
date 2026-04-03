/**
 * GarmentCard — Individual garment display in the rack panel.
 *
 * Shows the garment image (isolated flat-lay or original), processing
 * state, selection indicator, quality badge, name, tags, and style note.
 * Matches the SOT's warm minimalist aesthetic.
 */
import { useEffect, useState } from "react";
import { QualityBadge } from "./QualityBadge";
import type { QualityIssue, GarmentSlotType } from "../types";

interface GarmentCardProps {
  id: number;
  imageUrl: string | null;
  isolatedImageUrl: string | null;
  shortName: string | null;
  description: string | null;
  tags: string[];
  styleNote?: string;
  qualityIssues: QualityIssue[];
  isSelected: boolean;
  isProcessing: boolean;
  slotType?: GarmentSlotType;
  suggestedActions?: string[];
  onToggleSelect: (id: number, slotType?: GarmentSlotType, fullLookIdsToDeselect?: number[]) => void;
  onRemove: (id: number) => void;
}

export function GarmentCard({
  id,
  imageUrl,
  isolatedImageUrl,
  shortName,
  description,
  tags,
  styleNote,
  qualityIssues,
  isSelected,
  isProcessing,
  slotType,
  suggestedActions = [],
  onToggleSelect,
  onRemove,
}: GarmentCardProps) {
  const displayUrl = isolatedImageUrl || imageUrl;
  const displayName =
    shortName || description?.split(" ").slice(0, 3).join(" ") || "Garment";
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset load state when the image URL changes (e.g., processing → ready)
  useEffect(() => {
    setImageLoaded(false);
  }, [displayUrl]);

  return (
    <div
      className="relative flex flex-col group rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        boxShadow: isSelected
          ? "0 0 0 2.5px #1a1a1a, 0 4px 14px rgba(0,0,0,0.08)"
          : "0 1px 4px rgba(0,0,0,0.06)",
        background: "#F5F3F0",
      }}
    >
      {/* Image Area */}
      <div
        className="aspect-[3/4] relative cursor-pointer overflow-hidden"
        style={{ background: "#ffffff" }}
        onClick={() => !isProcessing && onToggleSelect(id, slotType)}
      >
        {/* Skeleton placeholder */}
        {displayUrl && !imageLoaded && !isProcessing && (
          <div className="absolute inset-0 animate-pulse" style={{ background: "#ece8e0" }} />
        )}

        {displayUrl && (
          <img
            src={displayUrl}
            alt={displayName}
            onLoad={() => setImageLoaded(true)}
            className={`
              w-full h-full object-contain p-2 transition-all duration-500
              ${isProcessing ? "blur-sm scale-90 opacity-50" : imageLoaded ? "scale-100 opacity-100" : "scale-100 opacity-0"}
            `}
          />
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div
              className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mb-2"
              style={{ borderColor: "#fff", borderTopColor: "transparent" }}
            />
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, color: "#999" }}
            >
              Analyzing
            </span>
          </div>
        )}

        {/* Quality badge */}
        {!isProcessing && <QualityBadge issues={qualityIssues} />}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "#1a1a1a" }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        className={`
          absolute top-3 left-3 z-30 w-5 h-5 flex items-center justify-center
          rounded-full transition-all
          ${isProcessing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
        `}
        style={{ background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 14 }}
      >
        &times;
      </button>

      {/* Card info */}
      <div
        className="px-2.5 pt-2 pb-2 flex-1 flex flex-col"
        style={{ background: "#fff" }}
      >
        {/* Name */}
        <div
          className="font-semibold truncate"
          style={{
            fontSize: 12,
            color: "#1a1a1a",
            letterSpacing: "-0.01em",
          }}
        >
          {displayName}
        </div>

        {/* Tags */}
        {!isProcessing && tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1 overflow-hidden">
            {tags.slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-px rounded-full flex-shrink-0"
                style={{
                  fontSize: 9,
                  background: "rgba(0,0,0,0.04)",
                  color: "#999",
                }}
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span
                className="flex-shrink-0"
                style={{ fontSize: 9, color: "#ccc" }}
              >
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Style note */}
        {styleNote && (
          <div className="flex items-center gap-1 mt-1">
            <div
              className="w-1 h-1 rounded-full flex-shrink-0"
              style={{ background: "#c9a84c" }}
            />
            <span
              className="italic truncate"
              style={{ fontSize: 9, color: "#bbb" }}
              title={styleNote}
            >
              {styleNote}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
