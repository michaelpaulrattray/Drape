import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { showLowBalanceToast, LOW_BALANCE_THRESHOLD } from "@/features/billing/LowBalanceWarning";
import { CASTING_BRANDS } from "@shared/castingOptions";
import {
  CREDIT_COSTS,
  type GeneratedAsset,
  type EditTool,
  type Amendment,
} from "@/features/casting/constants";
import { buildCreationPreferences } from "@/features/casting/creationPayload";
import type { CastingBindings } from "./castingBindings";

interface UseCastingGenerationParams {
  isAuthenticated: boolean;
  activeTool: EditTool;
  isMasking: boolean;
  getGuideOverlayDataUrl: () => Promise<string | undefined>;
  clearMask: () => void;
  /**
   * Where casting state lives — supplied by the caller (audit A1). /studio
   * passes useLegacyCastingBindings(); the canvas controller (M4) passes
   * node-local bindings. This hook imports no store.
   */
  bindings: CastingBindings;
}

export function useCastingGeneration({
  isAuthenticated,
  activeTool,
  isMasking,
  getGuideOverlayDataUrl,
  clearMask,
  bindings,
}: UseCastingGenerationParams) {
  const {
    prefs,
    modelName,
    engineChoice,
    updatePrefs,
    getReferenceImage,
    setGenState,
    currentModelId,
    setCurrentModelId,
    currentAssets,
    setCurrentAssets,
    currentMasterPrompt,
    setCurrentMasterPrompt,
    currentTechnicalSchema,
    setCurrentTechnicalSchema,
    history,
    setHistory,
    historyIndex,
    setHistoryIndex,
    pushHistory,
    resetHistoryAmendments,
    canUndo,
    canRedo,
    getCurrentImageUrl,
    setSuggestions,
    setIsLoadingSuggestions,
    amendments,
    addAmendment,
    clearAmendments,
    setIdentityWarning,
    getFailedAction,
    setFailedAction,
    activeView,
    setActiveView,
    setActiveTool,
    refineInput,
    setRefineInput,
    isEnhancing,
    setIsEnhancing,
    setIsTopupOpen,
  } = bindings;

  // Credits query
  const { data: creditsData, refetch: refetchCredits } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const refetchCreditsWithWarning = useCallback(async () => {
    const result = await refetchCredits();
    const newBalance = result.data?.balance;
    if (newBalance !== undefined && newBalance < LOW_BALANCE_THRESHOLD) {
      showLowBalanceToast(newBalance, () => setIsTopupOpen(true));
    }
  }, [refetchCredits, setIsTopupOpen]);

  // Mutations
  const createModelMutation = trpc.models.create.useMutation();
  const generateCastingMutation = trpc.generation.castingImage.useMutation();
  const iterateMutation = trpc.generation.iterate.useMutation();
  const enhanceMutation = trpc.generation.enhance.useMutation();
  
  // New Phase 2 mutations
  // (The reconcile mutation is gone — Batch C/R7: no client may auto-rewrite
  // the identity document from a generated image.)
  const suggestionsMutation = trpc.generation.suggestions.useMutation();
  const compactPromptMutation = trpc.generation.compactPrompt.useMutation();
  const clearSessionMutation = trpc.generation.clearSession.useMutation();
  const analyzeReferenceMutation = trpc.generation.analyzeReference.useMutation();
  const utils = trpc.useUtils();

  // Form validation — matches original: ethnicity OR ethnicityBlend satisfies requirement
  const isFormValid = useMemo(() => {
    // A required field is satisfied by a value OR by an explicit
    // Engine's-choice delegation (D-41) — absence in prefs then becomes an
    // honest engine directive in the prompt builder
    const ec = engineChoice ?? {};
    const ok = (field: string, value: unknown) => !!value || !!ec[field];
    return (
      ok('gender', prefs.gender) &&
      ok('age', prefs.age) &&
      (!!prefs.ethnicity ||
        (Array.isArray(prefs.ethnicityBlend) && prefs.ethnicityBlend.length > 0) ||
        !!ec.ethnicity) &&
      ok('skinTone', prefs.skinTone) &&
      ok('eyeColor', prefs.eyeColor) &&
      ok('hairColor', prefs.hairColor) &&
      ok('hairStyle', prefs.hairStyle)
    );
  }, [prefs, engineChoice]);

  // Current image URL
  const currentImageUrl = getCurrentImageUrl(activeView);

  // Build profile summary for suggestion context
  const profileSummary = useMemo(() => {
    const parts = [prefs.ethnicity, prefs.gender, prefs.age, prefs.castingBrand].filter(Boolean);
    return parts.join(', ');
  }, [prefs.ethnicity, prefs.gender, prefs.age, prefs.castingBrand]);

  // Fire-and-forget suggestion fetch (non-blocking, errors swallowed)
  const fetchSuggestions = useCallback(async (masterPrompt: string, imageUrl?: string) => {
    setIsLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const result = await suggestionsMutation.mutateAsync({
        masterPrompt,
        imageBase64: imageUrl,
        activeView,
        profileSummary,
      });
      if (result.suggestions?.length) {
        setSuggestions(result.suggestions);
      }
    } catch (err) {
      console.warn('[Suggestions] Failed to fetch:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [activeView, profileSummary]);

  // Compact prompt — MANUAL only (Batch C: iterations never auto-compact;
  // the server keeps raw text whenever compaction would touch mark language)
  const handleCompactPrompt = useCallback(async () => {
    if (!currentModelId || !currentMasterPrompt) return;
    try {
      const result = await compactPromptMutation.mutateAsync({
        modelId: currentModelId,
      });
      if (result.masterPrompt) {
        setCurrentMasterPrompt(result.masterPrompt);
        toast.success('Prompt compacted');
      }
    } catch (err) {
      console.warn('[Compaction] Failed:', err);
    }
  }, [currentModelId, currentMasterPrompt, currentTechnicalSchema]);

  // Clear Gemini chat session
  const handleClearSession = useCallback(async () => {
    try {
      await clearSessionMutation.mutateAsync();
    } catch (err) {
      console.warn('[Session] Failed to clear:', err);
    }
  }, []);

  // Analyze reference image for attribute transfer
  const handleAnalyzeReference = useCallback(async (referenceBase64: string, currentImageBase64?: string) => {
    try {
      const result = await analyzeReferenceMutation.mutateAsync({
        referenceImageBase64: referenceBase64,
        currentModelImageBase64: currentImageBase64,
        masterPrompt: currentMasterPrompt || undefined,
      });
      return result.attributes || [];
    } catch (err) {
      console.warn('[Reference] Failed to analyze:', err);
      return [];
    }
  }, [currentMasterPrompt]);

  // V1+V14 (Batch A-coupled): the stabilization per-view allowlist is gone —
  // typed iteration is uniform across the canonical six now that the server
  // frames each view from the exhaustive canonical map (iterationFraming.ts).
  // The server classifier + identity seal remain the real gates. Iteration
  // is still an individual selected-image generation: it does not propagate
  // to sibling views (the stale-writer marks divergence instead).

  // Handle initial generation (headshot)
  const handleGenerate = useCallback(async () => {
    if (!isFormValid) {
      toast.error("Please fill in all required fields");
      return;
    }

    const totalCost = CREDIT_COSTS.masterPrompt + CREDIT_COSTS.castingImage;
    if (!creditsData || creditsData.balance < totalCost) {
      toast.error(`Insufficient credits. Need ${totalCost} credits.`);
      setIsTopupOpen(true);
      return;
    }

    setGenState({ isGenerating: true, currentStep: "Writing Casting Spec...", error: null, progress: 0, startTime: Date.now(), estimatedDuration: 15000 });

    // Engine's-choice brand resolves at fire time (founder ruling 2026-07-11
    // — kills the silent Gucci fallback): a random pick from the eight,
    // written back to the form so the user sees what the engine received,
    // and recorded in preferences so the cast is reproducible (D-12)
    let resolvedBrand = prefs.castingBrand;
    if (!resolvedBrand) {
      resolvedBrand = CASTING_BRANDS[Math.floor(Math.random() * CASTING_BRANDS.length)];
      updatePrefs({ castingBrand: resolvedBrand });
    }

    try {
      // Batch C (§10.3): the creation payload is built by a pure helper that
      // can never carry `referenceImage` — the strict server schema rejects
      // the key, and superjson would otherwise round-trip even undefined.
      const backendPrefs = buildCreationPreferences(prefs, resolvedBrand);

      console.log('[CastingStudio] Sending preferences to backend:', JSON.stringify(backendPrefs, null, 2));

      setGenState((prev) => ({ ...prev, currentStep: "Generating casting specification...", progress: 20 }));
      const modelResult = await createModelMutation.mutateAsync({
        preferences: backendPrefs,
        name: modelName || undefined,
      });

      setCurrentModelId(modelResult.modelId ?? null);
      setCurrentMasterPrompt(modelResult.masterPrompt || "");
      setCurrentTechnicalSchema(modelResult.technicalSchema || null);

      setGenState((prev) => ({ ...prev, currentStep: "Casting Headshot...", progress: 50 }));
      // Batch C (§10.3): a new cast is established from the selections and
      // brief alone — the server schema-rejects creation references.
      // References join after the first headshot, through the refine bar.
      const imageResult = await generateCastingMutation.mutateAsync({
        modelId: modelResult.modelId!,
      });

      if (imageResult.success && imageResult.imageUrl) {
        const newAsset: GeneratedAsset = {
          id: imageResult.assetId || Date.now(),
          viewType: "frontClose",
          storageUrl: imageResult.imageUrl,
        };
        setCurrentAssets([newAsset]);
        setHistory([[newAsset]]);
        // Reset historyAmendments in sync with history — v1 has no amendments
        resetHistoryAmendments();
        setHistoryIndex(0);
        setActiveView("frontClose");
        clearAmendments();
        setIdentityWarning(null);
        toast.success("Model generated successfully!");
        // (The legacy setCanvas side-effect was removed here — DrapeStudio's
        // currentAssets→canvas sync effect derives the same state; audit A1.)
        refetchCreditsWithWarning();
        
        // Fire-and-forget: fetch suggestions (session lifecycle handled server-side)
        fetchSuggestions(modelResult.masterPrompt || '', imageResult.imageUrl);
      }

      setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      setGenState({ isGenerating: false, currentStep: "", error: message });
      setFailedAction({ type: 'NEW' });
      toast.error(message);
    }
  }, [isFormValid, creditsData, prefs, modelName, updatePrefs]);

  // Handle iteration/refinement
  const performIteration = useCallback(async (prompt: string, maskBase64?: string) => {
    if (!currentModelId) return;

    if (!creditsData || creditsData.balance < CREDIT_COSTS.iteration) {
      toast.error(`Insufficient credits. Need ${CREDIT_COSTS.iteration} credits.`);
      setIsTopupOpen(true);
      return;
    }

    setGenState({ isGenerating: true, currentStep: maskBase64 ? "Applying surgical edit..." : "Iterating...", error: null, progress: 0, startTime: Date.now(), estimatedDuration: 8000 });

    try {
      const currentAsset = currentAssets.find(a => a.viewType === activeView);
      if (!currentAsset) {
        throw new Error('No asset found for current view');
      }
      
      // Read referenceImage fresh (not from a render-time closure)
      const freshRefImage = getReferenceImage();
      
      const result = await iterateMutation.mutateAsync({
        modelId: currentModelId,
        feedback: prompt,
        assetId: currentAsset.id,
        maskBase64,
        referenceImage: freshRefImage || undefined,
      });

      if (result.success && result.imageUrl) {
        const newAsset: GeneratedAsset = {
          id: result.assetId || Date.now(),
          viewType: activeView,
          storageUrl: result.imageUrl,
        };
        
        // D-53: every change to a slot is a new ledger row for THAT slot —
        // siblings STAY. (The pre-package ladder dropped downstream views
        // here on the theory they'd be regenerated; post-D-46 that made the
        // strip lie against the ledger — the rows were alive, VC-R5 F1.
        // Divergence marking is the R6 stale-writer's job, never removal.)
        const newAssets = [...currentAssets.filter((a) => a.viewType !== activeView), newAsset];
        setCurrentAssets(newAssets);
        pushHistory(newAssets);
        
        const updatedPrompt = result.masterPrompt || currentMasterPrompt;
        if (result.masterPrompt) {
          setCurrentMasterPrompt(result.masterPrompt);
        }
        
        // Log amendment
        const amendment: Amendment = {
          text: prompt,
          view: activeView,
          version: amendments.length + 1,
          timestamp: Date.now(),
        };
        addAmendment(amendment);

        if (result.staledAngles.length > 0 && result.staleMessage) {
          setIdentityWarning(result.staleMessage);
        } else {
          setIdentityWarning(null);
        }
        
        toast.success("Iteration complete!");
        refetchCreditsWithWarning();
        // F5: a divergent edit may have staled siblings (F6 writer) — refetch
        // the package so the STRIP shows the stale dot/dim live, where the
        // edit was made (D-40), not only on the board mosaic after close.
        if (currentModelId) void utils.generation.packageState.invalidate({ modelId: currentModelId });
        
        // Fire-and-forget: fetch suggestions — re-analyze reference if present (matches SOT)
        // Read fresh (not from a render-time closure)
        const latestRefImage = getReferenceImage();
        if (latestRefImage) {
          handleAnalyzeReference(latestRefImage, result.imageUrl)
            .then((attrs) => {
              if (attrs.length > 0) setSuggestions(attrs.map((a: string) => a));
              else fetchSuggestions(updatedPrompt, result.imageUrl);
            })
            .catch(() => fetchSuggestions(updatedPrompt, result.imageUrl));
        } else {
          fetchSuggestions(updatedPrompt, result.imageUrl);
        }
        
        // Batch C (R7 ratified — reconcile KEPT OFF, M4): the automatic
        // reconcile call after every iterate is REMOVED. Identity documents
        // change only through deliberate authorized operations; a generated
        // image never silently rewrites them. The auto-compaction trigger is
        // gone with it (§5.3/M17): image-only iterations never compact, and
        // identity edits write the document atomically server-side.
      }

      setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Iteration failed";
      // A1 stage 2: the identity seal's refusal is TAUGHT, not toasted —
      // the designed fork-guidance surface renders where the edit happened
      // (D-40), with a working Fork door. No failed-action retry: retrying
      // the same edit would be refused again by design.
      if (message.includes("identity is minted")) {
        setGenState({
          isGenerating: false,
          currentStep: "",
          error: null,
          identityRefusal: { message, editText: prompt },
        });
        return;
      }
      setGenState({ isGenerating: false, currentStep: "", error: message });
      setFailedAction({ type: 'ITERATE', args: { text: prompt, view: activeView, mask: maskBase64 } });
      toast.error(message);
    }
  }, [currentModelId, creditsData, currentAssets, activeView]);

  const handleRefineSubmit = useCallback(async () => {
    if (!currentModelId || !currentImageUrl) return;

    const maskBase64 = isMasking ? await getGuideOverlayDataUrl() : undefined;

    if (activeTool === 'eraser') {
      if (!maskBase64) {
        toast.error('Failed to generate mask overlay. Please try again.');
        return;
      }
      const prompt = "FIX ARTIFACT: Remove the content in the masked area. Inpaint with surrounding skin texture, lighting, and noise. Restore the background if needed. Do not add new objects.";
      await performIteration(prompt, maskBase64);
      setActiveTool('none');
      clearMask();
      return;
    }

    if (activeTool === 'surgical') {
      if (!refineInput.trim()) {
        toast.error('Please describe the change you want to make');
        return;
      }
      if (!maskBase64) {
        toast.error('Failed to generate mask overlay. Please try again.');
        return;
      }
      await performIteration(refineInput, maskBase64);
      setRefineInput("");
      setActiveTool('none');
      clearMask();
      return;
    }

    if (refineInput.trim()) {
      await performIteration(refineInput, maskBase64);
      setRefineInput("");
      setActiveTool('none');
      clearMask();
    }
  }, [currentModelId, currentImageUrl, isMasking, activeTool, refineInput, performIteration, getGuideOverlayDataUrl, clearMask]);

  // AI prompt enhancement
  const handleEnhance = useCallback(async () => {
    if (!refineInput.trim() || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const result = await enhanceMutation.mutateAsync({ prompt: refineInput.trim() });
      if (result.success && result.enhancedPrompt) {
        setRefineInput(result.enhancedPrompt);
        toast.success("Prompt enhanced!");
      }
    } catch (error) {
      console.error("Enhance error:", error);
      toast.error("Failed to enhance prompt");
    } finally {
      setIsEnhancing(false);
    }
  }, [refineInput, isEnhancing]);

  // Retry handler — replays the exact failed action instead of always re-casting
  const handleRetry = useCallback(() => {
    const failedAction = getFailedAction();
    setGenState({ isGenerating: false, currentStep: "", error: null });
    setFailedAction(null);
    
    if (!failedAction || failedAction.type === 'NEW') {
      handleGenerate();
    } else if (failedAction.type === 'ITERATE' && failedAction.args) {
      performIteration(failedAction.args.text, failedAction.args.mask);
    } else {
      // Fallback: re-generate
      handleGenerate();
    }
  }, [handleGenerate, performIteration]);

  // Undo/redo RETIRED (D-53/A3): the client snapshot stack performed version
  // control it didn't have — full cross-view snapshots meant undo on one view
  // rewound others, and nothing it did survived a save. The slot ledger is
  // the single version history now ("Use this version", copy-forward). The
  // history stack itself stays: hold-to-compare and hydration read it.

  return {
    creditsData,
    refetchCreditsWithWarning,
    isFormValid,
    currentImageUrl,
    handleGenerate,
    handleRefineSubmit,
    handleEnhance,
    handleRetry,
    // Phase 2 additions
    fetchSuggestions,
    handleCompactPrompt,
    handleClearSession,
    handleAnalyzeReference,
  };
}
