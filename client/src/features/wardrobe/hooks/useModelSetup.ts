/**
 * useModelSetup — Runs side effects when the model photo changes.
 *
 * Clears VTO history and tattoo map, then fires non-blocking
 * tattoo analysis and quality check mutations in parallel.
 *
 * Guards: tracks the last URL each mutation succeeded for, so
 * rapid Wardrobe↔Casting switching won't re-fire mutations
 * for the same model image (avoids rate-limit errors).
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

  // Track previous URL to avoid re-running state resets on same value
  const prevUrlRef = useRef<string | null>(null);
  // Track last URL each mutation succeeded for — survives remounts from tool switching
  const lastAnalyzedUrlRef = useRef<string | null>(null);
  const lastQualityUrlRef = useRef<string | null>(null);

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
    // OR if we already successfully analyzed this exact URL
    if (!existingTattooMap && lastAnalyzedUrlRef.current !== modelImageUrl) {
      analyzeMutation
        .mutateAsync({ imageUrl: modelImageUrl })
        .then((map) => {
          lastAnalyzedUrlRef.current = modelImageUrl;
          setTattooMap(map);
          if (map.hasTattoos) {
            console.log(`[Tattoo Map] Found: ${map.tattooAreas.join(", ")}`);
            console.log(`[Tattoo Map] Clean: ${map.cleanAreas.join(", ")}`);
          }
        })
        .catch(() => {
          // Non-critical — tattoo map stays null, don't mark as succeeded
        });
    }

    // Skip quality check if we already checked this exact URL
    if (lastQualityUrlRef.current !== modelImageUrl) {
      qualityMutation
        .mutateAsync({ imageUrl: modelImageUrl })
        .then((result) => {
          lastQualityUrlRef.current = modelImageUrl;
          if (result.quality === "poor") {
            console.log("[Quality Check] Issues:", result.issues);
            toast.warning("Model photo quality is low — results may vary", {
              description: result.issues.join(", "),
              duration: 6000,
            });
          }
        })
        .catch(() => {
          // Non-critical — skip quality warning, don't mark as succeeded
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelImageUrl]);
}
