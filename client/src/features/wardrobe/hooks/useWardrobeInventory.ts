/**
 * useWardrobeInventory — Hook for garment CRUD operations.
 *
 * Wraps tRPC queries/mutations for the garment inventory with
 * optimistic updates, file validation, and upload state tracking.
 *
 * Smart decomposition: non-full-look uploads are pre-scanned via
 * quickDetect. If >SMART_DETECT_THRESHOLD items are found in the
 * target category, the DecompositionDrawer opens for user review
 * instead of uploading directly.
 */
import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useWardrobeStore } from "../stores/useWardrobeStore";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_GARMENTS_PER_SLOT,
  SMART_DETECT_THRESHOLD,
} from "../constants";
import type { GarmentSlotType } from "../types";

/** Convert a File to base64 data URL */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Validate a file before upload */
function validateFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, and WebP images are supported";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `File too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`;
  }
  return null;
}

/** Slots eligible for smart decomposition pre-scan */
const SCANNABLE_SLOTS: GarmentSlotType[] = ["tops", "bottoms", "shoes", "accessories"];

export function useWardrobeInventory() {
  const utils = trpc.useUtils();
  const activeSlot = useWardrobeStore((s) => s.activeSlot);
  const toggleGarmentSelection = useWardrobeStore(
    (s) => s.toggleGarmentSelection,
  );

  // Track which garments are currently uploading
  const [uploadingSlots, setUploadingSlots] = useState<
    Set<GarmentSlotType>
  >(new Set());

  // ── Queries ──────────────────────────────────────────────
  const {
    data: garments = [],
    isLoading,
    error,
  } = trpc.wardrobe.garments.list.useQuery(undefined, {
    staleTime: 30_000,
  });

  // ── Upload mutation ──────────────────────────────────────
  const uploadMutation = trpc.wardrobe.garments.upload.useMutation({
    onSuccess: () => {
      utils.wardrobe.garments.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to upload garment");
    },
  });

  // ── Quick detect mutation (smart decomposition pre-scan) ─
  const quickDetectMutation = trpc.wardrobe.garments.quickDetect.useMutation();

  // ── Delete mutation ──────────────────────────────────────
  const deleteMutation = trpc.wardrobe.garments.delete.useMutation({
    onMutate: async ({ garmentId }) => {
      // Optimistic removal
      await utils.wardrobe.garments.list.cancel();
      const previous = utils.wardrobe.garments.list.getData();
      utils.wardrobe.garments.list.setData(undefined, (old) =>
        old ? old.filter((g) => g.id !== garmentId) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        utils.wardrobe.garments.list.setData(undefined, context.previous);
      }
      toast.error("Failed to remove garment");
    },
    onSettled: () => {
      utils.wardrobe.garments.list.invalidate();
    },
  });

  // ── Upload handler ───────────────────────────────────────
  const uploadGarment = useCallback(
    async (file: File, slotType?: GarmentSlotType) => {
      const slot = slotType || activeSlot;

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        toast.error(validationError);
        return null;
      }

      // Full look uploads are intercepted — open decomposition drawer
      if (slot === "full_look") {
        useWardrobeStore.getState().setPendingDecomposeFile(file);
        useWardrobeStore.getState().setDecomposeOpen(true);
        return null;
      }

      // Check slot capacity
      const slotGarments = garments.filter((g) => g.slotType === slot);
      if (slotGarments.length >= MAX_GARMENTS_PER_SLOT) {
        toast.error(
          `Maximum ${MAX_GARMENTS_PER_SLOT} garments per slot. Remove one first.`,
        );
        return null;
      }

      // Track uploading state
      setUploadingSlots((prev) => {
        const next = new Set(Array.from(prev));
        next.add(slot);
        return next;
      });

      try {
        const base64 = await fileToBase64(file);
        toast.info("Analyzing garment...", { duration: 5000 });

        // Smart decomposition: pre-scan for scannable slots
        if (SCANNABLE_SLOTS.includes(slot)) {
          try {
            const scan = await quickDetectMutation.mutateAsync({
              imageBase64: base64,
              targetSlot: slot as "tops" | "bottoms" | "shoes" | "accessories",
            });

            if (scan.matchingCount > SMART_DETECT_THRESHOLD) {
              // Multiple items detected — open drawer for user review
              useWardrobeStore.getState().setPendingQuickDetect({
                sourceImageUrl: scan.sourceImageUrl,
                garments: scan.garments,
              });
              useWardrobeStore.getState().setPendingDecomposeFile(file);
              useWardrobeStore.getState().setDecomposeOpen(true);
              return null;
            }
          } catch {
            // Detection failed — fall through to normal upload
          }
        }

        // Normal upload pipeline (single garment or detection passed)
        const result = await uploadMutation.mutateAsync({
          imageBase64: base64,
          slotType: slot,
          fileName: file.name,
        });

        // Gentle tip if quality issues detected, otherwise normal success
        if (result.qualityIssues && Array.isArray(result.qualityIssues) && result.qualityIssues.length > 0) {
          toast.success(
            `${result.shortName || "Garment"} added \u2014 tip: higher res photos give better results`,
          );
        } else {
          toast.success(
            `${result.shortName || "Garment"} added to your wardrobe`,
          );
        }
        return result;
      } catch {
        // Error toast handled by mutation onError
        return null;
      } finally {
        setUploadingSlots((prev) => {
          const next = new Set(prev);
          next.delete(slot);
          return next;
        });
      }
    },
    [activeSlot, garments, uploadMutation, quickDetectMutation],
  );

  // ── Delete handler ───────────────────────────────────────
  const removeGarment = useCallback(
    (garmentId: number) => {
      deleteMutation.mutate({ garmentId });
    },
    [deleteMutation],
  );

  // ── Filtered garments for the active slot ────────────────
  const searchTerm = useWardrobeStore((s) => s.searchTerm);

  const filteredGarments = garments
    .filter((g) => g.slotType === activeSlot)
    .filter((g) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (g.shortName?.toLowerCase().includes(term) ?? false) ||
        (g.description?.toLowerCase().includes(term) ?? false) ||
        (Array.isArray(g.tags) &&
          g.tags.some(
            (t) => typeof t === "string" && t.toLowerCase().includes(term),
          ))
      );
    });

  // ── Slot counts ──────────────────────────────────────────
  const slotCounts: Record<GarmentSlotType, number> = {
    full_look: garments.filter((g) => g.slotType === "full_look").length,
    tops: garments.filter((g) => g.slotType === "tops").length,
    bottoms: garments.filter((g) => g.slotType === "bottoms").length,
    shoes: garments.filter((g) => g.slotType === "shoes").length,
    accessories: garments.filter((g) => g.slotType === "accessories").length,
  };

  return {
    /** All garments in the user's wardrobe */
    garments,
    /** Garments filtered by active slot and search term */
    filteredGarments,
    /** Whether the garment list is loading */
    isLoading,
    /** Error from the garment list query */
    error,
    /** Count of garments per slot */
    slotCounts,
    /** Upload a garment image */
    uploadGarment,
    /** Whether an upload is in progress for a slot */
    isUploading: uploadingSlots.size > 0,
    /** Which slots are currently uploading */
    uploadingSlots,
    /** Remove a garment */
    removeGarment,
    /** Toggle garment selection (for VTO) */
    toggleSelection: toggleGarmentSelection,
  };
}
