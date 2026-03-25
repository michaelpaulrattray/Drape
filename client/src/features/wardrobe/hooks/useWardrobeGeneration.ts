/**
 * useWardrobeGeneration — Hook for VTO generation, undo/redo, and tattoo analysis.
 *
 * Wraps tRPC mutations for VTO generation (full, incremental, refine),
 * manages session lifecycle, cooldown timer, retry mechanism, overlay
 * detection, and delegates history to useWardrobeStore.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useWardrobeStore } from "../stores/useWardrobeStore";

/** Cooldown duration in seconds after each generation */
const COOLDOWN_DURATION = 5;

/** Params required to initialise the generation hook */
interface UseWardrobeGenerationParams {
  /** The clean full-body model image URL (VTO base) */
  modelImageUrl: string | null;
  /** The casting model ID (null if uploaded model) */
  modelId: number | null;
}

/** Shape of the last operation for retry */
interface LastOperation {
  type: "generate" | "incremental" | "refine" | "styleRefresh";
  args?: Record<string, unknown>;
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
  const snapshotSelection = useWardrobeStore((s) => s.snapshotSelection);
  const restoreSelectionForIndex = useWardrobeStore((s) => s.restoreSelectionForIndex);
  const cooldownSeconds = useWardrobeStore((s) => s.cooldownSeconds);
  const setCooldownSeconds = useWardrobeStore((s) => s.setCooldownSeconds);
  const errorMessage = useWardrobeStore((s) => s.errorMessage);
  const setErrorMessage = useWardrobeStore((s) => s.setErrorMessage);

  // Style refresh selectors
  const setLastGenStyleNotes = useWardrobeStore((s) => s.setLastGenStyleNotes);
  const hasDirtyStyles = useWardrobeStore((s) => s.hasDirtyStyles);

  // Overlay detection selectors
  const setResultOverlayItems = useWardrobeStore((s) => s.setResultOverlayItems);
  const setIsScanningResult = useWardrobeStore((s) => s.setIsScanningResult);
  const cacheOverlayItems = useWardrobeStore((s) => s.cacheOverlayItems);
  const getCachedOverlay = useWardrobeStore((s) => s.getCachedOverlay);
  const vtoHistoryIndex = useWardrobeStore((s) => s.vtoHistoryIndex);
  const vtoHistory = useWardrobeStore((s) => s.vtoHistory);

  // Local generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMessage, setGeneratingMessage] = useState<string | null>(null);

  // Track previous garment selection for incremental detection
  const prevGarmentIdsRef = useRef<Set<number>>(new Set());

  // Last operation for retry
  const lastOperationRef = useRef<LastOperation | null>(null);

  // Generation ID to detect stale overlay results
  const generationIdRef = useRef(0);

  // ── Cooldown Timer ─────────────────────────────────────────
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds(Math.max(0, cooldownSeconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds, setCooldownSeconds]);

  const startCooldown = useCallback(() => {
    setCooldownSeconds(COOLDOWN_DURATION);
  }, [setCooldownSeconds]);

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

  const detectMutation = trpc.wardrobe.vto.detectResultGarments.useMutation();
  const classifyMutation = trpc.wardrobe.vto.classifyEdit.useMutation();
  const identityMutation = trpc.wardrobe.vto.checkIdentity.useMutation();
  const seedChatMutation = trpc.wardrobe.sessions.seedChat.useMutation();
  const clearChatMutation = trpc.wardrobe.sessions.clearChat.useMutation();

  // Prevent infinite identity-retry loops
  const identityRetryRef = useRef(false);

  // ── Overlay Scanning ───────────────────────────────────────

  /** Fire-and-forget overlay scan after a successful generation */
  const scanResultOverlay = useCallback(
    (resultUrl: string, genId: number) => {
      setIsScanningResult(true);
      detectMutation
        .mutateAsync({ resultUrl })
        .then((detected) => {
          if (generationIdRef.current !== genId) return;
          const idx = useWardrobeStore.getState().vtoHistoryIndex;
          setResultOverlayItems(detected);
          cacheOverlayItems(idx, detected);
        })
        .catch((e) => {
          console.warn("Overlay detection failed:", e);
        })
        .finally(() => {
          if (generationIdRef.current === genId) {
            setIsScanningResult(false);
          }
        });
    },
    [detectMutation, setIsScanningResult, setResultOverlayItems, cacheOverlayItems],
  );

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

  const generateVTO = useCallback(async (isRetry = false) => {
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
    const genId = ++generationIdRef.current;

    try {
      const sessionId = await ensureSession();
      const garmentIds = Array.from(selectedGarmentIds);

      // Build style notes map (only for selected garments that have notes)
      const notes: Record<string, string> = {};
      for (const id of garmentIds) {
        const note = styleNotes[String(id)];
        if (note?.trim()) notes[String(id)] = note;
      }

      lastOperationRef.current = { type: "generate" };

      const result = await generateMutation.mutateAsync({
        modelImageUrl,
        garmentIds,
        styleNotes: Object.keys(notes).length > 0 ? notes : undefined,
        tattooMap: tattooMap ?? undefined,
        sessionId: sessionId ?? undefined,
      });

      if (genId !== generationIdRef.current) return; // stale

      pushVTOResult(result.resultUrl);
      snapshotSelection();
      prevGarmentIdsRef.current = new Set(garmentIds);
      startCooldown();
      scanResultOverlay(result.resultUrl, genId);
      // Snapshot style notes for dirty detection
      const snap: Record<string, string> = {};
      for (const id of garmentIds) snap[String(id)] = styleNotes[String(id)] || "";
      setLastGenStyleNotes(snap);
      // Seed Gemini chat session for context continuity in refinements
      if (modelImageUrl && activeSessionId) {
        const garmentDescs = garmentIds.map((id) => styleNotes[String(id)] || "").filter(Boolean);
        seedChatMutation.mutateAsync({
          sessionId: String(activeSessionId),
          modelImageUrl,
          resultUrl: result.resultUrl,
          outfitDescription: garmentDescs.join(", ") || undefined,
        }).catch(() => {}); // non-blocking
      }
      toast.success("Virtual try-on complete");
    } catch (err: unknown) {
      if (genId !== generationIdRef.current) return;
      const msg = (err as Error)?.message || "VTO generation failed";
      if (msg.includes("SAFETY_BLOCK") && !isRetry) {
        // Auto-retry once — server sanitizes descriptions on re-fetch
        console.warn("[VTO] Safety block detected — retrying with sanitized descriptions");
        setGeneratingMessage("Adjusting descriptions...");
        try {
          await generateVTO(true);
          return;
        } catch {
          // Retry also failed — fall through to show error
        }
      }
      if (msg.includes("SAFETY_BLOCK")) {
        setErrorMessage("Generation blocked by safety filters — try different garments");
        toast.error("Safety filter triggered — try different garments");
      } else if (msg.includes("TOO_MANY_REQUESTS")) {
        setErrorMessage("Rate limit reached. Please wait a moment.");
        toast.error("Too many requests — please wait");
      } else {
        setErrorMessage(msg);
        toast.error("VTO generation failed");
      }
    } finally {
      if (genId === generationIdRef.current) {
        setIsGenerating(false);
        setGeneratingMessage(null);
      }
    }
  }, [
    modelImageUrl, selectedGarmentIds, styleNotes, tattooMap,
    ensureSession, generateMutation, pushVTOResult, snapshotSelection,
    startCooldown, setErrorMessage, seedChatMutation, activeSessionId,
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

    // If too many changes or removals, do full generation
    if (added.length === 0 && removed.length === 0) {
      return generateVTO();
    }
    if (added.length > 2 || removed.length > 0) {
      return generateVTO();
    }

    setIsGenerating(true);
    setGeneratingMessage("Updating outfit...");
    setErrorMessage(null);
    const genId = ++generationIdRef.current;

    try {
      const sessionId = await ensureSession();
      const notes: Record<string, string> = {};
      for (const id of currentIds) {
        const note = styleNotes[String(id)];
        if (note?.trim()) notes[String(id)] = note;
      }

      lastOperationRef.current = { type: "incremental" };

      const result = await incrementalMutation.mutateAsync({
        previousResultUrl: currentResult,
        modelImageUrl,
        changedGarmentIds: added,
        changedSlots: [],
        allGarmentIds: currentIds,
        styleNotes: Object.keys(notes).length > 0 ? notes : undefined,
        tattooMap: tattooMap ?? undefined,
        sessionId: sessionId ?? undefined,
      });

      if (genId !== generationIdRef.current) return;

      pushVTOResult(result.resultUrl);
      snapshotSelection();
      prevGarmentIdsRef.current = new Set(currentIds);
      startCooldown();
      scanResultOverlay(result.resultUrl, genId);
      // Snapshot style notes for dirty detection
      const incSnap: Record<string, string> = {};
      for (const id of currentIds) incSnap[String(id)] = styleNotes[String(id)] || "";
      setLastGenStyleNotes(incSnap);
      // Re-seed chat session with updated result
      if (modelImageUrl && activeSessionId) {
        const descs = currentIds.map((id) => styleNotes[String(id)] || "").filter(Boolean);
        seedChatMutation.mutateAsync({
          sessionId: String(activeSessionId),
          modelImageUrl,
          resultUrl: result.resultUrl,
          outfitDescription: descs.join(", ") || undefined,
        }).catch(() => {});
      }
      toast.success("Outfit updated");
    } catch {
      if (genId !== generationIdRef.current) return;
      toast.error("Incremental update failed — trying full generation");
      return generateVTO();
    } finally {
      if (genId === generationIdRef.current) {
        setIsGenerating(false);
        setGeneratingMessage(null);
      }
    }
  }, [
    currentVTOResult, modelImageUrl, selectedGarmentIds, styleNotes,
    tattooMap, ensureSession, incrementalMutation, pushVTOResult,
    snapshotSelection, startCooldown, generateVTO, setErrorMessage,
    seedChatMutation, activeSessionId,
  ]);

  // ── Refinement ─────────────────────────────────────────────

  const refineResult = useCallback(async (garmentId: number, instruction: string) => {
    const currentResult = currentVTOResult();
    if (!currentResult || !modelImageUrl) {
      toast.error("No VTO result to refine");
      return;
    }

    setIsGenerating(true);
    setGeneratingMessage("Classifying edit...");
    setErrorMessage(null);

    // Classify the edit to decide refinement vs full regeneration
    let editSize: "small" | "large" = "small";
    try {
      const classified = await classifyMutation.mutateAsync({ instruction });
      editSize = classified.editSize;
    } catch {
      // Default to small on failure
    }

    // Large edits trigger full regeneration instead of refinement
    if (editSize === "large") {
      // Clear stale chat session before full regen
      if (activeSessionId) {
        clearChatMutation.mutateAsync({ sessionId: String(activeSessionId) }).catch(() => {});
      }
      setIsGenerating(false);
      setGeneratingMessage(null);
      toast.info("Structural change detected — regenerating full look");
      return generateVTO();
    }

    setGeneratingMessage("Refining garment...");
    const genId = ++generationIdRef.current;

    try {
      const sessionId = await ensureSession();

      lastOperationRef.current = {
        type: "refine",
        args: { garmentId, instruction },
      };

      const result = await refineMutation.mutateAsync({
        currentResultUrl: currentResult,
        modelImageUrl,
        garmentId,
        instruction,
        sessionId: sessionId ?? undefined,
      });

      if (genId !== generationIdRef.current) return;

      pushVTOResult(result.resultUrl);
      snapshotSelection();
      startCooldown();
      scanResultOverlay(result.resultUrl, genId);
      // Snapshot style notes for dirty detection
      const refSnap: Record<string, string> = {};
      for (const id of Array.from(selectedGarmentIds)) refSnap[String(id)] = styleNotes[String(id)] || "";
      setLastGenStyleNotes(refSnap);

      // Identity check — only on first attempt, not on auto-retries
      if (!identityRetryRef.current) {
        identityMutation
          .mutateAsync({ modelImageUrl, resultImageUrl: result.resultUrl })
          .then((res) => {
            if (!res.match && genId === generationIdRef.current) {
              console.warn("[Identity Check] Drift detected — regenerating");
              identityRetryRef.current = true;
              setGeneratingMessage("Identity drift — regenerating...");
              setIsGenerating(true);
              generateVTO().finally(() => {
                identityRetryRef.current = false;
              });
            }
          })
          .catch(() => {
            // Non-critical — silently ignore
          });
      } else {
        identityRetryRef.current = false;
      }

      toast.success("Refinement applied");
    } catch (err: unknown) {
      if (genId !== generationIdRef.current) return;
      const msg = (err as Error)?.message || "Refinement failed";
      setErrorMessage(msg);
      toast.error("Refinement failed");
    } finally {
      if (genId === generationIdRef.current) {
        setIsGenerating(false);
        setGeneratingMessage(null);
      }
    }
  }, [currentVTOResult, modelImageUrl, ensureSession, refineMutation, classifyMutation, identityMutation, generateVTO, pushVTOResult, snapshotSelection, startCooldown, setErrorMessage, clearChatMutation, activeSessionId]);

  // ── Retry Last Operation ───────────────────────────────────

  const handleRetry = useCallback(async () => {
    const lastOp = lastOperationRef.current;
    if (!lastOp) {
      toast.error("Nothing to retry");
      return;
    }

    setErrorMessage(null);

    switch (lastOp.type) {
      case "generate":
        return generateVTO();
      case "incremental":
        return generateIncremental();
      case "refine": {
        const args = lastOp.args as { garmentId: number; instruction: string } | undefined;
        if (args) return refineResult(args.garmentId, args.instruction);
        break;
      }
      case "styleRefresh":
        return generateVTO();
    }
  }, [generateVTO, generateIncremental, refineResult, setErrorMessage]);

  // ── Style Refresh ─────────────────────────────────────────

  const handleApplyStyleChanges = useCallback(async () => {
    const result = currentVTOResult();
    if (!result || !modelImageUrl || isGenerating) return;

    // Find garments whose style notes changed since last generation
    const state = useWardrobeStore.getState();
    const dirtyIds: number[] = [];
    for (const id of Array.from(state.selectedGarmentIds)) {
      const key = String(id);
      const lastNote = state.lastGenStyleNotes[key];
      const currentNote = state.styleNotes[key] || "";
      if (lastNote !== undefined && lastNote !== currentNote) {
        dirtyIds.push(id);
      }
    }
    if (dirtyIds.length === 0) return;

    setIsGenerating(true);
    setGeneratingMessage("Applying style changes...");
    setResultOverlayItems([]);
    setErrorMessage(null);
    const genId = ++generationIdRef.current;

    try {
      const sessionId = await ensureSession();
      lastOperationRef.current = { type: "styleRefresh" };

      const res = await incrementalMutation.mutateAsync({
        modelImageUrl,
        previousResultUrl: result,
        allGarmentIds: Array.from(state.selectedGarmentIds),
        changedGarmentIds: dirtyIds,
        changedSlots: [],
        styleNotes: Object.keys(state.styleNotes).length > 0 ? state.styleNotes : undefined,
        tattooMap: tattooMap ?? undefined,
        sessionId: sessionId ?? undefined,
        isStyleRefresh: true,
      });

      if (genId !== generationIdRef.current) return;

      pushVTOResult(res.resultUrl);
      snapshotSelection();
      startCooldown();
      scanResultOverlay(res.resultUrl, genId);
      // Update snapshot
      const snap: Record<string, string> = {};
      for (const id of Array.from(state.selectedGarmentIds)) snap[String(id)] = state.styleNotes[String(id)] || "";
      setLastGenStyleNotes(snap);
      // Re-seed chat session with updated result
      if (modelImageUrl && activeSessionId) {
        const descs = Array.from(state.selectedGarmentIds).map((id) => state.styleNotes[String(id)] || "").filter(Boolean);
        seedChatMutation.mutateAsync({
          sessionId: String(activeSessionId),
          modelImageUrl,
          resultUrl: res.resultUrl,
          outfitDescription: descs.join(", ") || undefined,
        }).catch(() => {});
      }
      toast.success("Style changes applied");
    } catch {
      if (genId !== generationIdRef.current) return;
      toast.error("Style refresh failed");
    } finally {
      if (genId === generationIdRef.current) {
        setIsGenerating(false);
        setGeneratingMessage(null);
      }
    }
  }, [
    currentVTOResult, modelImageUrl, isGenerating, tattooMap,
    ensureSession, incrementalMutation, pushVTOResult, snapshotSelection,
    startCooldown, setErrorMessage, setLastGenStyleNotes, setResultOverlayItems,
    scanResultOverlay, seedChatMutation, activeSessionId,
  ]);

  // ── Smart Generate (decides full vs incremental) ───────────

  const smartGenerate = useCallback(async () => {
    if (cooldownSeconds > 0) {
      toast.error(`Please wait ${cooldownSeconds}s before generating again`);
      return;
    }
    const hasExistingResult = currentVTOResult() !== null;
    if (hasExistingResult) {
      return generateIncremental();
    }
    return generateVTO();
  }, [currentVTOResult, generateIncremental, generateVTO, cooldownSeconds]);

  // ── Undo/Redo with selection restore ───────────────────────

  const handleUndo = useCallback(() => {
    undoVTO();
    setTimeout(() => {
      restoreSelectionForIndex();
      const state = useWardrobeStore.getState();
      const cached = state.overlayCache.get(state.vtoHistoryIndex);
      if (cached) {
        setResultOverlayItems(cached);
      } else {
        const url = state.vtoHistory[state.vtoHistoryIndex];
        if (url) scanResultOverlay(url, generationIdRef.current);
      }
    }, 0);
  }, [undoVTO, restoreSelectionForIndex, setResultOverlayItems, scanResultOverlay]);

  const handleRedo = useCallback(() => {
    redoVTO();
    setTimeout(() => {
      restoreSelectionForIndex();
      const state = useWardrobeStore.getState();
      const cached = state.overlayCache.get(state.vtoHistoryIndex);
      if (cached) {
        setResultOverlayItems(cached);
      } else {
        const url = state.vtoHistory[state.vtoHistoryIndex];
        if (url) scanResultOverlay(url, generationIdRef.current);
      }
    }, 0);
  }, [redoVTO, restoreSelectionForIndex, setResultOverlayItems, scanResultOverlay]);

  return {
    /** Whether a VTO generation is in progress */
    isGenerating,
    /** Current generation step message */
    generatingMessage,
    /** Error message from last generation attempt */
    errorMessage,
    /** Clear error message */
    clearError: () => setErrorMessage(null),

    /** Cooldown seconds remaining */
    cooldownSeconds,

    /** Generate VTO (smart: full or incremental based on state) */
    generate: smartGenerate,
    /** Force full VTO generation */
    generateFull: generateVTO,
    /** Refine a specific garment in the current result */
    refineResult,
    /** Retry last failed operation */
    handleRetry,

    /** Undo to previous VTO result (with selection restore) */
    undo: handleUndo,
    /** Redo to next VTO result (with selection restore) */
    redo: handleRedo,
    /** Whether undo is available */
    canUndo: canUndoVTO(),
    /** Whether redo is available */
    canRedo: canRedoVTO(),
    /** Current VTO result URL */
    currentResult: currentVTOResult(),

    /** Current index in VTO history (0 = first result) */
    historyIndex: vtoHistoryIndex,

    /** Active session ID */
    sessionId: activeSessionId,

    /** Whether any selected garment has dirty style notes */
    hasDirtyStyles: hasDirtyStyles(),
    /** Apply only the changed style notes (style refresh) */
    handleApplyStyleChanges,
  };
}
