import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useCastingFormStore } from "@/features/casting/stores/useCastingFormStore";
import { useCastingGenerationStore } from "@/features/casting/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { showLowBalanceToast, LOW_BALANCE_THRESHOLD } from "@/features/billing/LowBalanceWarning";
import {
  CREDIT_COSTS,
  type GeneratedAsset,
  type EditTool,
  type Amendment,
} from "@/features/casting/constants";

interface UseCastingGenerationParams {
  isAuthenticated: boolean;
  activeTool: EditTool;
  isMasking: boolean;
  getGuideOverlayDataUrl: () => Promise<string | undefined>;
  clearMask: () => void;
}

export function useCastingGeneration({
  isAuthenticated,
  activeTool,
  isMasking,
  getGuideOverlayDataUrl,
  clearMask,
}: UseCastingGenerationParams) {
  const { prefs, modelName } = useCastingFormStore();
  const {
    genState,
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
    canUndo,
    canRedo,
    getCurrentImageUrl,
    setSuggestions,
    setIsLoadingSuggestions,
    amendments,
    addAmendment,
    clearAmendments,
    setIdentityWarning,
  } = useCastingGenerationStore();
  const {
    activeView,
    setActiveView,
    setActiveTool,
    refineInput,
    setRefineInput,
    isEnhancing,
    setIsEnhancing,
    setIsTopupOpen,
  } = useCastingUIStore();

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
  const suggestionsMutation = trpc.generation.suggestions.useMutation();
  const reconcileMutation = trpc.generation.reconcile.useMutation();
  const compactPromptMutation = trpc.generation.compactPrompt.useMutation();
  const clearSessionMutation = trpc.generation.clearSession.useMutation();
  const analyzeReferenceMutation = trpc.generation.analyzeReference.useMutation();

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      !!prefs.gender &&
      !!prefs.age &&
      !!prefs.ethnicity &&
      !!prefs.skinTone &&
      !!prefs.eyeColor &&
      !!prefs.hairColor &&
      !!prefs.hairStyle
    );
  }, [prefs]);

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

  // Compact prompt (manual or auto after 3+ amendments)
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

  // View locking logic
  const isViewLocked = useMemo(() => {
    if (currentAssets.length === 0) return false;
    if (activeView === 'frontClose' && currentAssets.some(a => a.viewType === 'frontFull')) return true;
    if (activeView === 'frontFull' && currentAssets.some(a => a.viewType === 'sideClose')) return true;
    if (activeView === 'backFull') return true;
    return false;
  }, [activeView, currentAssets]);

  const hasDownstreamDependencies = useMemo(() => {
    if (currentAssets.length === 0) return false;
    if (activeView === 'frontClose' && currentAssets.some(a => a.viewType === 'frontFull')) return true;
    if (activeView === 'frontFull' && currentAssets.some(a => a.viewType === 'sideClose')) return true;
    return false;
  }, [activeView, currentAssets]);

  const isIterationAllowed = useMemo(() => {
    return ['frontClose', 'frontFull', 'backFull'].includes(activeView);
  }, [activeView]);

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

    try {
      const backendPrefs = {
        gender: prefs.gender,
        age: prefs.age,
        ethnicity: prefs.ethnicity,
        bodyType: prefs.bodyType,
        faceShape: prefs.faceShape,
        jawline: prefs.jawline,
        cheekbones: prefs.cheekbones,
        cheeks: prefs.cheeks,
        eyeShape: prefs.eyeShape,
        noseShape: prefs.noseShape,
        lipShape: prefs.lipShape,
        eyebrowStyle: prefs.eyebrowStyle,
        skinTone: prefs.skinTone,
        skinTexture: prefs.skinTexture,
        skinFinish: prefs.skinFinish,
        eyeColor: prefs.eyeColor,
        hairStyle: prefs.hairStyle,
        hairColor: prefs.hairColor,
        hairLength: prefs.hairLength,
        hairTexture: prefs.hairTexture,
        hairFringe: prefs.hairFringe,
        hairParting: prefs.hairParting,
        hairVolume: prefs.hairVolume,
        hairFlyaways: prefs.hairFlyaways,
        hairHairline: prefs.hairHairline,
        hairTuck: prefs.hairTuck,
        hairFade: prefs.hairFade,
        facialHair: prefs.facialHair,
        castingBrand: prefs.castingBrand,
        castingVibe: prefs.castingVibe,
        features: prefs.features,
        referenceImage: prefs.referenceImage,
        userPrompt: prefs.userPrompt,
        ethnicityBlend: prefs.ethnicityBlend,
      };
      
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
      const imageResult = await generateCastingMutation.mutateAsync({
        modelId: modelResult.modelId!,
        referenceImage: prefs.referenceImage,
      });

      if (imageResult.success && imageResult.imageUrl) {
        const newAsset: GeneratedAsset = {
          id: imageResult.assetId || Date.now(),
          viewType: "frontClose",
          storageUrl: imageResult.imageUrl,
        };
        setCurrentAssets([newAsset]);
        setHistory([[newAsset]]);
        setHistoryIndex(0);
        setActiveView("frontClose");
        clearAmendments();
        setIdentityWarning(null);
        toast.success("Model generated successfully!");
        refetchCreditsWithWarning();
        
        // Fire-and-forget: clear old session + fetch suggestions
        handleClearSession();
        fetchSuggestions(modelResult.masterPrompt || '', imageResult.imageUrl);
      }

      setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      setGenState({ isGenerating: false, currentStep: "", error: message });
      toast.error(message);
    }
  }, [isFormValid, creditsData, prefs, modelName]);

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
      
      const result = await iterateMutation.mutateAsync({
        modelId: currentModelId,
        feedback: prompt,
        assetId: currentAsset.id,
        maskBase64,
      });

      if (result.success && result.imageUrl) {
        const newAsset: GeneratedAsset = {
          id: result.assetId || Date.now(),
          viewType: activeView,
          storageUrl: result.imageUrl,
        };
        
        let newAssets = [...currentAssets];
        if (activeView === 'frontClose') {
          newAssets = newAssets.filter(a => a.viewType === 'frontClose');
        } else if (activeView === 'frontFull') {
          newAssets = newAssets.filter(a => ['frontClose', 'frontFull'].includes(a.viewType));
        }
        
        newAssets = [...newAssets.filter((a) => a.viewType !== activeView), newAsset];
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
        
        toast.success("Iteration complete!");
        refetchCreditsWithWarning();
        
        // Fire-and-forget: fetch suggestions
        fetchSuggestions(updatedPrompt, result.imageUrl);
        
        // Auto-compact after 3+ amendments
        if (amendments.length + 1 >= 3 && (amendments.length + 1) % 3 === 0) {
          console.log('[Compaction] Auto-triggering after', amendments.length + 1, 'amendments');
          handleCompactPrompt();
        }
      }

      setGenState({ isGenerating: false, currentStep: "", error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Iteration failed";
      setGenState({ isGenerating: false, currentStep: "", error: message });
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

  // Retry handler
  const handleRetry = useCallback(() => {
    setGenState({ isGenerating: false, currentStep: "", error: null });
    handleGenerate();
  }, [handleGenerate]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (canUndo()) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentAssets(history[newIndex]);
    }
  }, [canUndo, historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (canRedo()) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentAssets(history[newIndex]);
    }
  }, [canRedo, historyIndex, history]);

  return {
    creditsData,
    refetchCreditsWithWarning,
    isFormValid,
    currentImageUrl,
    isViewLocked,
    hasDownstreamDependencies,
    isIterationAllowed,
    handleGenerate,
    handleRefineSubmit,
    handleEnhance,
    handleRetry,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    // Phase 2 additions
    fetchSuggestions,
    handleCompactPrompt,
    handleClearSession,
    handleAnalyzeReference,
  };
}
