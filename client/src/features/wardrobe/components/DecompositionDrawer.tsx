/**
 * DecompositionDrawer — Modal for outfit photo decomposition.
 *
 * Upload a full outfit photo, detect individual garments via AI,
 * and selectively import them into the wardrobe rack.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useWardrobeStore } from "../stores/useWardrobeStore";
import type { DetectedItem } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  tops: "#555048",
  bottoms: "#777168",
  shoes: "#6B7B8B",
  accessories: "#C4A35A",
  full_look: "#7BA3C4",
};

interface DecompositionDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function DecompositionDrawer({ open, onClose }: DecompositionDrawerProps) {
  const [items, setItems] = useState<DetectedItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [visible, setVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = trpc.wardrobe.decompose.analyze.useMutation();
  const importMutation = trpc.wardrobe.decompose.import.useMutation();
  const utils = trpc.useUtils();

  // Animate in/out
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Reset state when closed — revoke blob URL to prevent memory leak (fix #7)
  useEffect(() => {
    if (!open) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setItems([]);
      setPreviewUrl(null);
      setSourceImageUrl(null);
      setSelectedIds(new Set());
      setEditingId(null);
      setIsScanning(false);
      // Clear pending state when drawer closes
      useWardrobeStore.getState().setPendingDecomposeFile(null);
      useWardrobeStore.getState().setPendingQuickDetect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pendingDecomposeFile = useWardrobeStore((s) => s.pendingDecomposeFile);
  const pendingQuickDetect = useWardrobeStore((s) => s.pendingQuickDetect);
  const pendingProcessedRef = useRef(false);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be under 10 MB");
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setIsScanning(true);
      setItems([]);
      setSelectedIds(new Set());
      setEditingId(null);

      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const result = await analyzeMutation.mutateAsync({ imageBase64: base64 });
        setSourceImageUrl(result.sourceImageUrl);
        const detected = result.garments as DetectedItem[];
        setItems(detected);
        setSelectedIds(new Set(detected.map((d) => d.id)));
      } catch {
        toast.error("Failed to analyze outfit");
      } finally {
        setIsScanning(false);
      }
    },
    [analyzeMutation],
  );

  // Auto-populate from pending file or pre-scanned quickDetect results
  useEffect(() => {
    if (!open || pendingProcessedRef.current) return;
    if (!pendingDecomposeFile && !pendingQuickDetect) return;

    pendingProcessedRef.current = true;

    // If quickDetect already ran (smart decomposition), skip the full analyze call
    if (pendingQuickDetect && pendingDecomposeFile) {
      const blobUrl = URL.createObjectURL(pendingDecomposeFile);
      setPreviewUrl(blobUrl);
      setSourceImageUrl(pendingQuickDetect.sourceImageUrl);
      setItems(pendingQuickDetect.garments);
      setSelectedIds(new Set(pendingQuickDetect.garments.map((d) => d.id)));
      return;
    }

    // Otherwise run the full analyze (full_look upload path)
    if (pendingDecomposeFile) {
      handleFileSelect(pendingDecomposeFile);
    }

    if (!open) pendingProcessedRef.current = false;
  }, [open, pendingDecomposeFile, pendingQuickDetect, handleFileSelect]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updateLabel = useCallback((id: string, newLabel: string) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, label: newLabel } : item)),
    );
  }, []);

  const handleImport = useCallback(async () => {
    if (!sourceImageUrl) return;
    const selected = items.filter((i) => selectedIds.has(i.id));
    if (selected.length === 0) return;

    setIsImporting(true);

    try {
      const results = await Promise.allSettled(
        selected.map((item) =>
          importMutation.mutateAsync({
            sourceImageUrl,
            label: item.label,
            slotType: item.category as "tops" | "bottoms" | "shoes" | "accessories" | "full_look",
          }),
        ),
      );

      const imported = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (imported > 0) {
        await utils.wardrobe.garments.list.invalidate();
        const msg = failed > 0
          ? `Imported ${imported} garment${imported > 1 ? "s" : ""} (${failed} failed)`
          : `Imported ${imported} garment${imported > 1 ? "s" : ""}`;
        toast.success(msg);
        onClose();
      } else {
        toast.error("Failed to import garments");
      }
    } finally {
      setIsImporting(false);
    }
  }, [items, selectedIds, sourceImageUrl, importMutation, utils, onClose]);

  const handleKeepAsFullLook = useCallback(async () => {
    if (!sourceImageUrl) return;
    setIsImporting(true);
    try {
      await importMutation.mutateAsync({
        sourceImageUrl,
        label: "Full Outfit",
        slotType: "full_look",
      });
      await utils.wardrobe.garments.list.invalidate();
      toast.success("Added as full look");
      onClose();
    } catch {
      toast.error("Failed to import as full look");
    } finally {
      setIsImporting(false);
    }
  }, [sourceImageUrl, importMutation, utils, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)" }}
      />

      {/* Modal */}
      <div
        className={`fixed z-50 flex flex-col overflow-hidden transition-all duration-300 ease-out ${visible ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]"}`}
        style={{
          top: "50%",
          left: "50%",
          transform: visible ? "translate(-50%, -50%)" : "translate(-50%, calc(-50% + 16px))",
          width: "min(900px, 90vw)",
          height: "min(680px, 85vh)",
          borderRadius: 20,
          background: "#fff",
          boxShadow: "0 24px 80px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{ height: 48, borderBottom: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isScanning ? "#e8a83e" : isImporting ? "#5c7cad" : "#5cad5c",
                boxShadow: isScanning ? "0 0 6px rgba(232,168,62,0.4)" : "none",
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 500, color: "#888" }}>
              {isScanning
                ? "Detecting garments..."
                : isImporting
                  ? "Importing..."
                  : items.length > 0
                    ? `${items.length} items detected`
                    : "Upload an outfit photo"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[#f5f3ef]"
            style={{ color: "#aaa", fontSize: 18 }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: Image preview */}
          <div
            className="flex-1 h-full flex items-center justify-center p-5 relative"
            style={{ background: "#faf9f7" }}
          >
            {previewUrl ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Source outfit"
                  className="max-h-full max-w-full transition-opacity duration-500"
                  style={{
                    objectFit: "contain",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
                    opacity: isScanning ? 0.4 : 1,
                  }}
                  draggable={false}
                />

                {/* Scanning spinner */}
                {isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <div
                      className="w-5 h-5 rounded-full border-2 animate-spin mb-2"
                      style={{ borderColor: "#e8e5df", borderTopColor: "#1a1a1a" }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 500, color: "#999" }}>Detecting...</span>
                  </div>
                )}

                {/* Item pills */}
                {!isScanning &&
                  items.map((item) => {
                    const [ymin, xmin, ymax, xmax] = item.box_2d;
                    const centerX = ((xmin + xmax) / 2) * 100;
                    const centerY = ((ymin + ymax) / 2) * 100;
                    const isSelected = selectedIds.has(item.id);
                    const isHovered = hoveredItemId === item.id;
                    const color = CATEGORY_COLORS[item.category] || "#555";

                    return (
                      <button
                        key={item.id}
                        className="absolute z-10 px-2.5 py-1 whitespace-nowrap cursor-pointer transition-all duration-200"
                        style={{
                          top: `${centerY}%`,
                          left: `${centerX}%`,
                          transform: `translate(-50%, -50%) scale(${isHovered ? 1.08 : 1})`,
                          borderRadius: 20,
                          fontSize: 10,
                          fontWeight: 600,
                          backgroundColor: isSelected ? color : "rgba(255,255,255,0.85)",
                          color: isSelected ? "#fff" : color,
                          border: `1.5px solid ${color}`,
                          opacity: isSelected || isHovered ? 1 : 0.7,
                          boxShadow: isHovered
                            ? "0 4px 16px rgba(0,0,0,0.1)"
                            : "0 2px 8px rgba(0,0,0,0.04)",
                          backdropFilter: "blur(4px)",
                        }}
                        onClick={() => toggleSelection(item.id)}
                        onMouseEnter={() => setHoveredItemId(item.id)}
                        onMouseLeave={() => setHoveredItemId(null)}
                      >
                        {item.label.length > 22 ? item.label.slice(0, 20) + "\u2026" : item.label}
                      </button>
                    );
                  })}
              </div>
            ) : (
              /* Drop zone */
              <div
                className="flex flex-col items-center justify-center gap-3 cursor-pointer rounded-2xl border-2 border-dashed transition-colors hover:border-[#999] hover:bg-[#f0ede8]"
                style={{ width: "80%", height: "60%", borderColor: "#d8d4cc" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Scissors size={28} strokeWidth={1.5} style={{ color: "#999" }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#999" }}>
                  Drop an outfit photo or click to browse
                </span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* Right: Item list */}
          <div className="flex flex-col" style={{ width: 320, borderLeft: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {isScanning ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "#f5f3ef" }} />
                  ))}
                </div>
              ) : (
                items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const isHovered = hoveredItemId === item.id;
                  const color = CATEGORY_COLORS[item.category] || "#555";

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl transition-all cursor-pointer"
                      style={{
                        padding: "10px 12px",
                        background: isHovered ? "#f5f3ef" : isSelected ? "#faf9f7" : "transparent",
                        border: isHovered ? "1.5px solid rgba(0,0,0,0.08)" : "1.5px solid transparent",
                      }}
                      onMouseEnter={() => setHoveredItemId(item.id)}
                      onMouseLeave={() => setHoveredItemId(null)}
                    >
                      <div className="flex items-start gap-2.5" onClick={() => toggleSelection(item.id)}>
                        {/* Checkbox */}
                        <div
                          className="flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 6,
                            background: isSelected ? "#1a1a1a" : "#fff",
                            border: isSelected ? "none" : "1.5px solid #d8d4cc",
                          }}
                        >
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {editingId === item.id ? (
                            <input
                              type="text"
                              autoFocus
                              value={item.label}
                              onChange={(e) => updateLabel(item.id, e.target.value)}
                              onBlur={() => setEditingId(null)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") setEditingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-2 py-1 rounded-lg outline-none"
                              style={{
                                background: "#f0ede8",
                                border: "1px solid rgba(0,0,0,0.08)",
                                fontSize: 12,
                                color: "#1a1a1a",
                              }}
                            />
                          ) : (
                            <div
                              className="cursor-text group/label"
                              style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingId(item.id);
                              }}
                              title="Click to edit label"
                            >
                              {item.label}
                              <span
                                className="ml-1 opacity-0 group-hover/label:opacity-100 transition-opacity"
                                style={{ fontSize: 9, color: "#bbb" }}
                              >
                                edit
                              </span>
                            </div>
                          )}

                          {/* Category badge */}
                          <span
                            className="inline-block mt-1.5 px-2 py-0.5 rounded-full"
                            style={{
                              fontSize: 9,
                              fontWeight: 600,
                              backgroundColor: color + "12",
                              color: color,
                              border: `1px solid ${color}25`,
                            }}
                          >
                            {item.category.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {!isScanning && items.length === 0 && !previewUrl && (
                <div className="py-12 text-center">
                  <span style={{ fontSize: 11, color: "#bbb" }}>Select a photo to get started</span>
                </div>
              )}

              {!isScanning && items.length === 0 && previewUrl && (
                <div className="py-12 text-center">
                  <span style={{ fontSize: 11, color: "#bbb" }}>No garments detected</span>
                </div>
              )}
            </div>

            {/* Bottom actions */}
            <div className="p-4 flex-shrink-0 space-y-2" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <button
                onClick={handleImport}
                disabled={isScanning || isImporting || selectedIds.size === 0}
                className="w-full py-3 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: "#1a1a1a",
                  color: "#f0ede8",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                }}
              >
                {isImporting ? "Importing..." : `Add to Wardrobe (${selectedIds.size})`}
              </button>

              {items.length > 0 && (
                <button
                  onClick={handleKeepAsFullLook}
                  disabled={isScanning || isImporting}
                  className="w-full py-2.5 rounded-xl transition-colors hover:bg-[#f5f3ef]"
                  style={{ fontSize: 10, fontWeight: 500, color: "#999", background: "transparent" }}
                >
                  Keep as Full Look Instead
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
