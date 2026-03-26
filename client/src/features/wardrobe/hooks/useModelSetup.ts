/**
 * useModelSetup — Runs side effects when the model photo changes.
 *
 * Clears VTO history and tattoo map, then fires non-blocking
 * tattoo analysis and quality check mutations in parallel.
 */
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useWardrobeStore } from "../stores/useWardrobeStore";

export function useModelSetup(modelImageUrl: string | null): void {
  const clearVTOHistory = useWardrobeStore((s) => s.clearVTOHistory);
  const setTattooMap = useWardrobeStore((s) => s.setTattooMap);

  const analyzeMutation = trpc.wardrobe.model.analyzeTattoos.useMutation();
  const qualityMutation = trpc.wardrobe.model.checkQuality.useMutation();

  // Track previous URL to avoid re-running on same value
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if URL hasn't actually changed
    if (modelImageUrl === prevUrlRef.current) return;
    prevUrlRef.current = modelImageUrl;

    // Clear state on model change — but skip if VTO history already exists
    // (session resume case: history was just hydrated, don't wipe it)
    const hasHistory = useWardrobeStore.getState().vtoHistory.length > 0;
    if (!hasHistory) {
      clearVTOHistory();
    }
    // Skip tattoo clear + re-analysis if already restored from DB (session resume)
    const existingTattooMap = useWardrobeStore.getState().tattooMap;
    if (!existingTattooMap) {
      setTattooMap(null);
    }

    // No API calls if model is cleared
    if (!modelImageUrl) return;

    // Skip tattoo analysis if we already have a map (restored from DB)
    if (!existingTattooMap) {
      analyzeMutation
        .mutateAsync({ imageUrl: modelImageUrl })
        .then((map) => {
          setTattooMap(map);
          if (map.hasTattoos) {
            console.log(`[Tattoo Map] Found: ${map.tattooAreas.join(", ")}`);
            console.log(`[Tattoo Map] Clean: ${map.cleanAreas.join(", ")}`);
          }
        })
        .catch(() => {
          // Non-critical — tattoo map stays null
        });
    }

    // Fire-and-forget quality check
    qualityMutation
      .mutateAsync({ imageUrl: modelImageUrl })
      .then((result) => {
        if (result.quality === "poor") {
          console.log("[Quality Check] Issues:", result.issues);
          toast.warning("Model photo quality is low — results may vary", {
            description: result.issues.join(", "),
            duration: 6000,
          });
        }
      })
      .catch(() => {
        // Non-critical — skip quality warning
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelImageUrl]);
}
