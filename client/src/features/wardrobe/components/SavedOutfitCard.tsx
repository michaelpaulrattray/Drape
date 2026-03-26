/**
 * SavedOutfitCard — Displays a saved outfit in the Looks tab.
 *
 * Shows the outfit thumbnail (VTO result), name, garment count,
 * and a delete button. Clicking loads the outfit's garment selection
 * and style notes into the wardrobe store.
 */
import { useCallback, useState } from "react";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { DeleteOverlayButton } from "@/features/studio/components/DeleteOverlayButton";

interface SavedOutfitCardProps {
  id: number;
  name: string;
  garmentIds: number[];
  styleNotes?: Record<string, string> | null;
  resultThumbUrl?: string | null;
  createdAt: string | Date;
  onLoad: (garmentIds: number[], styleNotes: Record<string, string>) => void;
  onDelete: (id: number) => void;
  isDeleting?: boolean;
}

export function SavedOutfitCard({
  id,
  name,
  garmentIds,
  styleNotes,
  resultThumbUrl,
  createdAt,
  onLoad,
  onDelete,
  isDeleting,
}: SavedOutfitCardProps) {
  const [imgError, setImgError] = useState(false);

  const handleLoad = useCallback(() => {
    const notes: Record<string, string> = {};
    if (styleNotes && typeof styleNotes === "object") {
      for (const [k, v] of Object.entries(styleNotes)) {
        if (typeof v === "string") notes[k] = v;
      }
    }
    onLoad(garmentIds, notes);
    toast.success(`Loaded "${name}"`);
  }, [garmentIds, styleNotes, name, onLoad]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(id);
    },
    [id, onDelete],
  );

  const formattedDate =
    typeof createdAt === "string"
      ? new Date(createdAt).toLocaleDateString()
      : createdAt.toLocaleDateString();

  return (
    <div
      onClick={isDeleting ? undefined : handleLoad}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isDeleting) {
          e.preventDefault();
          handleLoad();
        }
      }}
      role="button"
      tabIndex={isDeleting ? -1 : 0}
      className="group relative rounded-2xl overflow-hidden transition-all hover:ring-2 hover:ring-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#1a1a1a] text-left w-full cursor-pointer"
      style={{ background: "#f0ebe3", opacity: isDeleting ? 0.4 : 1 }}
    >
      {/* Thumbnail */}
      <div className="aspect-[3/4] relative overflow-hidden">
        {resultThumbUrl && !imgError ? (
          <img
            src={resultThumbUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers size={24} strokeWidth={1.5} style={{ color: "#ccc" }} />
          </div>
        )}

        {/* Outfit badge */}
        <div
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full"
          style={{
            background: "rgba(26,26,26,0.7)",
            backdropFilter: "blur(4px)",
          }}
        >
          <span
            className="font-mono uppercase"
            style={{ fontSize: 7, color: "#fff", letterSpacing: "0.05em" }}
          >
            Outfit · {garmentIds.length}
          </span>
        </div>

        {/* Delete button — standardized overlay */}
        <DeleteOverlayButton
          onClick={handleDelete}
          isDeleting={isDeleting}
          size={24}
          placement="top-right"
          title="Delete outfit"
        />
      </div>

      {/* Info */}
      <div className="px-2 py-1.5">
        <p
          className="font-medium truncate"
          style={{ fontSize: 10, color: "#1a1a1a" }}
        >
          {name}
        </p>
        <p
          className="font-mono"
          style={{ fontSize: 7, color: "#b8b3a8" }}
        >
          {formattedDate}
        </p>
      </div>
    </div>
  );
}
