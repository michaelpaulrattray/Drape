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
import { captureCastingSession } from '@/features/casting/castingSessionToken';
import { beginCastingOperation } from '@/features/casting/pendingCastRegistry';
import { editablePreferencesFromStored } from '@/features/casting/engineChoicePersistence';
import type { CanonicalViewAngle } from '@shared/boardTypes';
import type { CastingBindings } from "./castingBindings";
import { createClientRequestId } from "@shared/clientRequestId";
import { parseCastingClarification } from "@shared/castingClarification";

type IterationOutcome = "completed" | "clarification" | "failed";

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
    setPrefs,
    setEngineChoices,
    getReferenceImage,
    getSessionToken,
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
      ok('castingBrand', prefs.castingBrand) &&
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
    const session = captureCastingSession(getSessionToken);
    setIsLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const result = await suggestionsMutation.mutateAsync({
        masterPrompt,
        imageBase64: imageUrl,
        activeView,
        profileSummary,
      });
      if (session.isCurrent() && result.suggestions?.length) {
        setSuggestions(result.suggestions);
      }
    } catch (err) {
      console.warn('[Suggestions] Failed to fetch:', err);
    } finally {
      if (session.isCurrent()) setIsLoadingSuggestions(false);
    }
  }, [activeView, profileSummary, getSessionToken]);

  // Compact prompt — MANUAL only (Batch C: iterations never auto-compact;
  // the server keeps raw text whenever compaction would touch mark language)
  const handleCompactPrompt = useCallback(async () => {
    if (!currentModelId || !currentMasterPrompt) return;
    const session = captureCastingSession(getSessionToken);
    try {
      const result = await compactPromptMutation.mutateAsync({
        clientRequestId: createClientRequestId(),
        modelId: currentModelId,
      });
      if (session.isCurrent() && result.masterPrompt) {
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
    const session = captureCastingSession(getSessionToken);
    try {
      const result = await analyzeReferenceMutation.mutateAsync({
        referenceImageBase64: referenceBase64,
        currentModelImageBase64: currentImageBase64,
        masterPrompt: currentMasterPrompt || undefined,
      });
      return session.isCurrent() ? result.attributes || [] : [];
    } catch (err) {
      console.warn('[Reference] Failed to analyze:', err);
      return [];
    }
  }, [currentMasterPrompt, getSessionToken]);

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

    const session = captureCastingSession(getSessionToken);
    const createRequestId = createClientRequestId();
    const headshotRequestId = createClientRequestId();
    const castingOperation = beginCastingOperation({
      kind: 'newCast',
      angles: ['frontClose'],
      clientRequestIds: [createRequestId, headshotRequestId],
    });
    setGenState({ isGenerating: true, currentStep: "Writing Casting Spec...", error: null, progress: 0, startTime: Date.now(), estimatedDuration: 15000 });

    // Open brand resolves at fire time (D-41). The explicit flag remains
    // durable authority; the concrete pick stays read-only schema truth.
    let resolvedBrand = prefs.castingBrand;
    if (engineChoice.castingBrand) {
      resolvedBrand = CASTING_BRANDS[Math.floor(Math.random() * CASTING_BRANDS.length)];
    }

    try {
      // Batch C (§10.3): the creation payload is built by a pure helper that
      // can never carry `referenceImage` — the strict server schema rejects
      // the key, and superjson would otherwise round-trip even undefined.
      const backendPrefs = buildCreationPreferences(prefs, resolvedBrand, engineChoice);
      setGenState((prev) => ({ ...prev, currentStep: "Generating casting specification...", progress: 20 }));
      const modelResult = await createModelMutation.mutateAsync({
        clientRequestId: createRequestId,
        preferences: backendPrefs,
        name: modelName || undefined,
        ...(castingOperation.origin
          ? {
              originBoardId: castingOperation.origin.boardId,
              originItemId: castingOperation.origin.itemId,
            }
          : {}),
      });

      // The op begins before models.create so the originating node responds
      // immediately. Bind the durable model id as soon as the row exists;
      // this also makes the headshot's per-angle busy state discoverable by
      // a reopened Casting session.
      castingOperation.setModelId(modelResult.modelId!);

      if (session.isCurrent()) {
        setCurrentModelId(modelResult.modelId ?? null);
        setCurrentMasterPrompt(modelResult.masterPrompt || "");
        setCurrentTechnicalSchema((modelResult.technicalSchema || null) as Record<string, unknown> | null);
        setGenState((prev) => ({ ...prev, currentStep: "Casting Headshot...", progress: 50 }));
      }

      // Batch C (§10.3): a new cast is established from the selections and
      // brief alone — the server schema-rejects creation references.
      // References join after the first headshot, through the refine bar.
      const imageResult = await generateCastingMutation.mutateAsync({
        clientRequestId: headshotRequestId,
        modelId: modelResult.modelId!,
        ...(castingOperation.origin
          ? {
              originBoardId: castingOperation.origin.boardId,
              originItemId: castingOperation.origin.itemId,
            }
          : {}),
      });

      if (!imageResult.success || !imageResult.imageUrl) {
        throw new Error('The headshot did not finish generating');
      }

      if (imageResult.success && imageResult.imageUrl) {
        if (!session.isCurrent()) {
          castingOperation.succeed({
            modelId: modelResult.modelId!,
            background: true,
          });
          return;
        }
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

        // Foreground settlement still completes the originating node's job,
        // but the app-level owner suppresses the background-only notice and
        // leaves landing to the takeover's normal close ceremony.
        castingOperation.succeed({
          modelId: modelResult.modelId!,
          background: false,
        });
      }

      if (session.isCurrent()) setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      castingOperation.fail({ message, background: !session.isCurrent() });
      if (!session.isCurrent()) {
        return;
      }
      setGenState({ isGenerating: false, currentStep: "", error: message });
      setFailedAction({ type: 'NEW' });
      toast.error(message);
    }
  }, [isFormValid, creditsData, prefs, modelName, engineChoice, getSessionToken]);

  // Handle iteration/refinement
  const performIteration = useCallback(async (prompt: string, maskBase64?: string): Promise<IterationOutcome> => {
    if (!currentModelId) return "failed";

    const session = captureCastingSession(getSessionToken);
    const clientRequestId = createClientRequestId();
    const castingOperation = beginCastingOperation({
      kind: 'iterate',
      modelId: currentModelId,
      angles: [activeView as CanonicalViewAngle],
      clientRequestIds: [clientRequestId],
    });
    setGenState({ isGenerating: true, currentStep: maskBase64 ? "Applying surgical edit..." : "Iterating...", error: null, progress: 0, startTime: Date.now(), estimatedDuration: 8000 });

    try {
      const currentAsset = currentAssets.find(a => a.viewType === activeView);
      if (!currentAsset) {
        throw new Error('No asset found for current view');
      }
      
      // Read referenceImage fresh (not from a render-time closure)
      const freshRefImage = getReferenceImage();
      
      const result = await iterateMutation.mutateAsync({
        clientRequestId,
        modelId: currentModelId,
        feedback: prompt,
        assetId: currentAsset.id,
        maskBase64,
        referenceImage: freshRefImage || undefined,
      });

      const clarification = "clarification" in result
        ? parseCastingClarification(result.clarification)
        : null;
      if (clarification) {
        castingOperation.succeed({ modelId: currentModelId, background: !session.isCurrent() });
        if (session.isCurrent()) {
          setGenState({
            isGenerating: false,
            currentStep: "",
            error: null,
            clarification,
          });
        }
        return "clarification";
      }

      if (!result.success || !result.imageUrl) {
        throw new Error('The edit did not produce an image');
      }

      if (!session.isCurrent()) {
        castingOperation.succeed({
          modelId: currentModelId,
          background: true,
        });
        // Cache truth must advance even though the closed session stays
        // immutable. Board and reopened Studio consumers rehydrate the saved
        // model/package rows after the durable receipt settles.
        void utils.generation.packageState.invalidate({ modelId: currentModelId });
        void utils.credits.getBalance.invalidate();
        return "completed";
      }

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
        if (
          'preferences' in result
          && result.preferences !== undefined
          && result.masterPrompt !== undefined
          && result.technicalSchema !== undefined
        ) {
          // W6-D: this discriminator exists only on the server's committed
          // identity branch. Image-only edits structurally cannot enter it.
          const restored = editablePreferencesFromStored(result.preferences);
          setCurrentMasterPrompt(result.masterPrompt);
          setCurrentTechnicalSchema(result.technicalSchema as Record<string, unknown> | null);
          setPrefs(restored.preferences);
          setEngineChoices(restored.engineChoice);
          void utils.models.get.invalidate({ modelId: currentModelId });
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

        castingOperation.succeed({
          modelId: currentModelId,
          background: false,
        });
        
        // Batch C (R7 ratified — reconcile KEPT OFF, M4): the automatic
        // reconcile call after every iterate is REMOVED. Identity documents
        // change only through deliberate authorized operations; a generated
        // image never silently rewrites them. The auto-compaction trigger is
        // gone with it (§5.3/M17): image-only iterations never compact, and
        // identity edits write the document atomically server-side.
      }

      if (session.isCurrent()) setGenState({ isGenerating: false, currentStep: "", error: null });
      return "completed";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Iteration failed";
      castingOperation.fail({ message, background: !session.isCurrent() });
      if (!session.isCurrent()) return "failed";
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
        return "failed";
      }
      if (/insufficient credits/i.test(message)) {
        setIsTopupOpen(true);
      }
      setGenState({ isGenerating: false, currentStep: "", error: message });
      setFailedAction({ type: 'ITERATE', args: { text: prompt, view: activeView, mask: maskBase64 } });
      toast.error(message);
      return "failed";
    }
  }, [currentModelId, currentAssets, activeView, getSessionToken, setIsTopupOpen]);

  const handleRefineSubmit = useCallback(async () => {
    if (!currentModelId || !currentImageUrl) return;

    const session = captureCastingSession(getSessionToken);

    const maskBase64 = isMasking ? await getGuideOverlayDataUrl() : undefined;
    if (!session.isCurrent()) return;

    if (activeTool === 'eraser') {
      if (!maskBase64) {
        toast.error('Failed to generate mask overlay. Please try again.');
        return;
      }
      const prompt = "FIX ARTIFACT: Remove the content in the masked area. Inpaint with surrounding skin texture, lighting, and noise. Restore the background if needed. Do not add new objects.";
      const outcome = await performIteration(prompt, maskBase64);
      if (!session.isCurrent()) return;
      if (outcome === "completed") {
        setActiveTool('none');
        clearMask();
      }
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
      const outcome = await performIteration(refineInput, maskBase64);
      if (!session.isCurrent()) return;
      if (outcome === "completed") {
        setRefineInput("");
        setActiveTool('none');
        clearMask();
      }
      return;
    }

    if (refineInput.trim()) {
      const outcome = await performIteration(refineInput, maskBase64);
      if (!session.isCurrent()) return;
      if (outcome === "completed") {
        setRefineInput("");
        setActiveTool('none');
        clearMask();
      }
    }
  }, [currentModelId, currentImageUrl, isMasking, activeTool, refineInput, performIteration, getGuideOverlayDataUrl, clearMask, getSessionToken]);

  // AI prompt enhancement
  const handleEnhance = useCallback(async () => {
    if (!refineInput.trim() || isEnhancing) return;
    const session = captureCastingSession(getSessionToken);
    setIsEnhancing(true);
    try {
      const result = await enhanceMutation.mutateAsync({ prompt: refineInput.trim() });
      if (session.isCurrent() && result.success && result.enhancedPrompt) {
        setRefineInput(result.enhancedPrompt);
        toast.success("Prompt enhanced!");
      }
    } catch (error) {
      if (!session.isCurrent()) return;
      console.error("Enhance error:", error);
      toast.error("Failed to enhance prompt");
    } finally {
      if (session.isCurrent()) setIsEnhancing(false);
    }
  }, [refineInput, isEnhancing, getSessionToken]);

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
