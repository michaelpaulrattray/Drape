/**
 * useWardrobeGeneration — Hook for VTO generation, undo/redo, and tattoo analysis.
 *
 * Wraps tRPC mutations for VTO generation (full, incremental, refine),
 * manages session lifecycle, and delegates history to useWardrobeStore.
 */
import { useCallback, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useWardrobeStore } from "../stores/useWardrobeStore";

/** Params required to initialise the generation hook */
interface UseWardrobeGenerationParams {
  /** The clean full-body model image URL (VTO base) */
  modelImageUrl: string | null;
  /** The casting model ID (null if uploaded model) */
  modelId: number | null;
}

export function useWardrobeGeneration({
  modelImageUrl,
  modelId,
}: UseWardrobeGenerationParams) {
  const utils = trpc.useUtils();

  // Store selectors
  const selectedGarmentIds = useWardrobeStore((s) => s.selectedGarmentIds);
  const styleNotes = useWardrobeStore((s) => s.styleNotes);
  const tattooMap = useWardrobeStore((s) => s.tattooMap);
  const setTattooMap = useWardrobeStore((s) => s.setTattooMap);
  const activeSessionId = useWardrobeStore((s) => s.activeSessionId);
  const setActiveSessionId = useWardrobeStore((s) => s.setActiveSessionId);
  const pushVTOResult = useWardrobeStore((s) => s.pushVTOResult);
  const undoVTO = useWardrobeStore((s) => s.undoVTO);
  const redoVTO = useWardrobeStore((s) => s.redoVTO);
  const canUndoVTO = useWardrobeStore((s) => s.canUndoVTO);
  const canRedoVTO = useWardrobeStore((s) => s.canRedoVTO);
  const currentVTOResult = useWardrobeStore((s) => s.currentVTOResult);

  // Local generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Track previous garment selection for incremental detection
  const prevGarmentIdsRef = useRef<Set<number>>(new Set());

  // ── Mutations ──────────────────────────────────────────────

  const createSessionMutation = trpc.wardrobe.sessions.create.useMutation();

  const generateMutation = trpc.wardrobe.vto.generate.useMutation({
    onSuccess: () => {
      utils.wardrobe.sessions.list.invalidate();
    },
  });

  const incrementalMutation = trpc.wardrobe.vto.incremental.useMutation({
    onSuccess: () => {
      utils.wardrobe.sessions.list.invalidate();
    },
  });

  const refineMutation = trpc.wardrobe.vto.refine.useMutation({
    onSuccess: () => {
      utils.wardrobe.sessions.list.invalidate();
    },
  });

  // ── Session Management ─────────────────────────────────────

  const ensureSession = useCallback(async (): Promise<number | null> => {
    if (activeSessionId) return activeSessionId;
    if (!modelImageUrl) return null;

    try {
      const result = await createSessionMutation.mutateAsync({
        modelId: modelId ?? undefined,
        modelImageUrl,
      });
      setActiveSessionId(result.sessionId);
      return result.sessionId;
    } catch {
      toast.error("Failed to create wardrobe session");
      return null;
    }
  }, [activeSessionId, modelImageUrl, modelId, createSessionMutation, setActiveSessionId]);

  // ── Full VTO Generation ────────────────────────────────────

  const generateVTO = useCallback(async () => {
    if (!modelImageUrl) {
      toast.error("No model image available for VTO");
      return;
    }
    if (selectedGarmentIds.size === 0) {
      toast.error("Select at least one garment");
      return;
    }

    setIsGenerating(true);
    setGeneratingMessage("Dressing your model...");
    setErrorMessage(null);

    try {
      const sessionId = await ensureSession();
      const garmentIds = Array.from(selectedGarmentIds);

      // Build style notes map (only for selected garments that have notes)
      const notes: Record<string, string> = {};
      for (const id of garmentIds) {
        const note = styleNotes[String(id)];
        if (note?.trim()) notes[String(id)] = note;
      }

      const result = await generateMutation.mutateAsync({
        modelImageUrl,
        garmentIds,
        styleNotes: Object.keys(notes).length > 0 ? notes : undefined,
        tattooMap: tattooMap ?? undefined,
        sessionId: sessionId ?? undefined,
      });

      pushVTOResult(result.resultUrl);
      prevGarmentIdsRef.current = new Set(garmentIds);
      toast.success("Virtual try-on complete");
    } catch (err: any) {
      const msg = err?.message || "VTO generation failed";
      if (msg.includes("SAFETY_BLOCK")) {
        setErrorMessage("Generation blocked by safety filters. Try different garments or style notes.");
        toast.error("Safety filter triggered — try adjusting your garments");
      } else if (msg.includes("TOO_MANY_REQUESTS")) {
        setErrorMessage("Rate limit reached. Please wait a moment.");
        toast.error("Too many requests — please wait");
      } else {
        setErrorMessage(msg);
        toast.error("VTO generation failed");
      }
    } finally {
      setIsGenerating(false);
      setGeneratingMessage(null);
    }
  }, [
    modelImageUrl, selectedGarmentIds, styleNotes, tattooMap,
    ensureSession, generateMutation, pushVTOResult,
  ]);

  // ── Incremental Composite ──────────────────────────────────

  const generateIncremental = useCallback(async () => {
    const currentResult = currentVTOResult();
    if (!currentResult || !modelImageUrl) {
      return generateVTO();
    }

    const currentIds = Array.from(selectedGarmentIds);
    const prevIds = prevGarmentIdsRef.current;

    // Detect which garments changed
    const added = currentIds.filter((id) => !prevIds.has(id));
    const removed = Array.from(prevIds).filter((id) => !selectedGarmentIds.has(id));
    const changedIds = [...added, ...removed.filter((id) => selectedGarmentIds.has(id))];

    // If too many changes or no previous result, do full generation
    if (changedIds.length === 0 && added.length === 0) {
      return generateVTO();
    }
    if (changedIds.length > 2 || removed.length > 0) {
      return generateVTO();
    }

    setIsGenerating(true);
    setGeneratingMessage("Updating outfit...");
    setErrorMessage(null);

    try {
      const sessionId = await ensureSession();
      const notes: Record<string, string> = {};
      for (const id of currentIds) {
        const note = styleNotes[String(id)];
        if (note?.trim()) notes[String(id)] = note;
      }

      // Determine changed slots (simplified — use the added garment IDs)
      const changedSlots = added.length > 0 ? ["tops", "bottoms", "shoes", "accessories"] : [];

      const result = await incrementalMutation.mutateAsync({
        previousResultUrl: currentResult,
        modelImageUrl,
        changedGarmentIds: added.length > 0 ? added : currentIds,
        changedSlots,
        allGarmentIds: currentIds,
        styleNotes: Object.keys(notes).length > 0 ? notes : undefined,
        tattooMap: tattooMap ?? undefined,
        sessionId: sessionId ?? undefined,
      });

      pushVTOResult(result.resultUrl);
      prevGarmentIdsRef.current = new Set(currentIds);
      toast.success("Outfit updated");
    } catch {
      toast.error("Incremental update failed — trying full generation");
      return generateVTO();
    } finally {
      setIsGenerating(false);
      setGeneratingMessage(null);
    }
  }, [
    currentVTOResult, modelImageUrl, selectedGarmentIds, styleNotes,
    tattooMap, ensureSession, incrementalMutation, pushVTOResult, generateVTO,
  ]);

  // ── Refinement ─────────────────────────────────────────────

  const refineResult = useCallback(async (garmentId: number, instruction: string) => {
    const currentResult = currentVTOResult();
    if (!currentResult || !modelImageUrl) {
      toast.error("No VTO result to refine");
      return;
    }

    setIsGenerating(true);
    setGeneratingMessage("Refining garment...");
    setErrorMessage(null);

    try {
      const sessionId = await ensureSession();
      const result = await refineMutation.mutateAsync({
        currentResultUrl: currentResult,
        modelImageUrl,
        garmentId,
        instruction,
        sessionId: sessionId ?? undefined,
      });

      pushVTOResult(result.resultUrl);
      toast.success("Refinement applied");
    } catch (err: any) {
      const msg = err?.message || "Refinement failed";
      setErrorMessage(msg);
      toast.error("Refinement failed");
    } finally {
      setIsGenerating(false);
      setGeneratingMessage(null);
    }
  }, [currentVTOResult, modelImageUrl, ensureSession, refineMutation, pushVTOResult]);

  // ── Smart Generate (decides full vs incremental) ───────────

  const smartGenerate = useCallback(async () => {
    const hasExistingResult = currentVTOResult() !== null;
    if (hasExistingResult) {
      return generateIncremental();
    }
    return generateVTO();
  }, [currentVTOResult, generateIncremental, generateVTO]);

  return {
    /** Whether a VTO generation is in progress */
    isGenerating,
    /** Current generation step message */
    generatingMessage,
    /** Error message from last generation attempt */
    errorMessage,
    /** Clear error message */
    clearError: () => setErrorMessage(null),

    /** Generate VTO (smart: full or incremental based on state) */
    generate: smartGenerate,
    /** Force full VTO generation */
    generateFull: generateVTO,
    /** Refine a specific garment in the current result */
    refineResult,

    /** Undo to previous VTO result */
    undo: undoVTO,
    /** Redo to next VTO result */
    redo: redoVTO,
    /** Whether undo is available */
    canUndo: canUndoVTO(),
    /** Whether redo is available */
    canRedo: canRedoVTO(),
    /** Current VTO result URL */
    currentResult: currentVTOResult(),

    /** Active session ID */
    sessionId: activeSessionId,
  };
}
