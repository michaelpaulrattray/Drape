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
import { planModelSetup, shouldShowQualityWarning } from "../modelSetupPlan";
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
    const store = useWardrobeStore.getState();
    const plan = planModelSetup({
      newUrl: modelImageUrl,
      prevUrl: prevUrlRef.current,
      hasHistory: store.vtoHistory.length > 0,
      hasTattooMap: !!store.tattooMap,
      lastAnalyzedUrl: lastAnalyzedUrlRef.current,
      lastQualityUrl: lastQualityUrlRef.current,
    });
    if (!plan) return;
    prevUrlRef.current = modelImageUrl;

    if (plan.clearHistory) clearVTOHistory();
    if (plan.clearTattooMap) setTattooMap(null);

    if (plan.runTattooAnalysis && modelImageUrl) {
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

    if (plan.runQualityCheck && modelImageUrl) {
      qualityMutation
        .mutateAsync({ imageUrl: modelImageUrl })
        .then((result) => {
          lastQualityUrlRef.current = modelImageUrl;
          if (shouldShowQualityWarning(result.quality)) {
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
