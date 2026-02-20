import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useCastingGenerationStore } from "@/features/casting/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/features/casting/stores/useCastingUIStore";
import { CREDIT_COSTS, type GeneratedAsset } from "@/features/casting/constants";

interface UseCastingViewGenerationParams {
  isAuthenticated: boolean;
  creditsData: { balance: number } | undefined;
  refetchCreditsWithWarning: () => Promise<void>;
}

export function useCastingViewGeneration({
  isAuthenticated,
  creditsData,
  refetchCreditsWithWarning,
}: UseCastingViewGenerationParams) {
  const {
    genState,
    setGenState,
    currentModelId,
    currentAssets,
    setCurrentAssets,
    pushHistory,
  } = useCastingGenerationStore();
  const {
    setActiveView,
    setShowExportModal,
    setLockModal,
    closeLockModal,
    isAutoGenerating,
    setIsAutoGenerating,
    setAutoGenCancelled,
    setIsTopupOpen,
  } = useCastingUIStore();

  // Mutations
  const generateFullBodyMutation = trpc.generation.fullBody.useMutation();
  const generateMultiViewMutation = trpc.generation.multiView.useMutation();

  // View capability checks
  const canGenerateFullBody = currentAssets.some((a) => a.viewType === "frontClose");
  const canGenerateMultiView = currentAssets.some((a) => a.viewType === "frontFull" || a.viewType === "frontClose");

  // Handle generate full body with stage lock
  const handleGenerateFullBody = useCallback(async () => {
    if (!currentModelId) return;

    setLockModal({
      isOpen: true,
      title: 'Lock Headshot & Generate Body?',
      message: "Are you sure you want to proceed to full-body generation? You won't be able to return and edit the head without resetting the body generation.",
      onConfirm: async () => {
        closeLockModal();
        
        if (!creditsData || creditsData.balance < CREDIT_COSTS.fullBody) {
          toast.error(`Insufficient credits. Need ${CREDIT_COSTS.fullBody} credits.`);
          setIsTopupOpen(true);
          return;
        }

        setGenState({ isGenerating: true, currentStep: "Generating Full Body View...", error: null, progress: 0, startTime: Date.now(), estimatedDuration: 12000 });

        try {
          const result = await generateFullBodyMutation.mutateAsync({ modelId: currentModelId });

          if (result.success && result.imageUrl) {
            const newAsset: GeneratedAsset = {
              id: result.assetId || Date.now(),
              viewType: "frontFull",
              storageUrl: result.imageUrl,
            };
            const newAssets = [...currentAssets.filter((a) => a.viewType !== "frontFull"), newAsset];
            setCurrentAssets(newAssets);
            pushHistory(newAssets);
            setActiveView("frontFull");
            toast.success("Full body generated!");
            refetchCreditsWithWarning();
          }

          setGenState({ isGenerating: false, currentStep: "", error: null });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Generation failed";
          setGenState({ isGenerating: false, currentStep: "", error: message });
          toast.error(message);
        }
      }
    });
  }, [currentModelId, creditsData, currentAssets]);

  // Handle generate multi-view with stage lock
  const handleGenerateMultiView = useCallback(async (viewType: "side" | "back" | "walk", isAutoGen: boolean = false): Promise<boolean> => {
    if (!currentModelId) return false;

    const skipLockModal = viewType === 'walk' || viewType === 'back' || isAutoGen;
    
    const doGenerate = async (): Promise<boolean> => {
      if (!creditsData || creditsData.balance < CREDIT_COSTS.multiView) {
        toast.error(`Insufficient credits. Need ${CREDIT_COSTS.multiView} credits.`);
        setIsTopupOpen(true);
        setIsAutoGenerating(false);
        return false;
      }

      const viewLabel = viewType === 'walk' ? 'walking' : viewType;
      setGenState({ isGenerating: true, currentStep: `Generating ${viewLabel} view...`, error: null, progress: 0, startTime: Date.now(), estimatedDuration: 10000 });

      try {
        const backendViewType = viewType === 'walk' ? 'walk' : viewType;
        const result = await generateMultiViewMutation.mutateAsync({
          modelId: currentModelId,
          viewType: backendViewType as "side" | "back",
        });

        if (result.success && result.imageUrl) {
          const viewKey = viewType === "side" ? "sideClose" : viewType === "walk" ? "sideFull" : "backFull";
          const newAsset: GeneratedAsset = {
            id: result.assetId || Date.now(),
            viewType: viewKey,
            storageUrl: result.imageUrl,
          };
          const newAssets = [...currentAssets.filter((a) => a.viewType !== viewKey), newAsset];
          setCurrentAssets(newAssets);
          pushHistory(newAssets);
          setActiveView(viewKey);
          toast.success(`${viewLabel} view generated!`);
          refetchCreditsWithWarning();
        }

        setGenState({ isGenerating: false, currentStep: "", error: null });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Generation failed";
        setGenState({ isGenerating: false, currentStep: "", error: message });
        toast.error(message);
        setIsAutoGenerating(false);
        return false;
      }
    };

    if (skipLockModal) {
      return await doGenerate();
    } else {
      return new Promise((resolve) => {
        setLockModal({
          isOpen: true,
          title: 'Lock Body & Generate Side View?',
          message: "This will generate the side profile view. You won't be able to edit the body pose without resetting the entire sheet.",
          onConfirm: async () => {
            closeLockModal();
            const success = await doGenerate();
            resolve(success);
          }
        });
      });
    }
  }, [currentModelId, creditsData, currentAssets]);

  // Auto-generate all remaining views sequentially (side only post-Patch 15)
  const handleAutoGenerateAllViews = useCallback(async () => {
    if (!currentModelId || isAutoGenerating) return;
    
    return new Promise<void>((resolve) => {
      setLockModal({
        isOpen: true,
        title: 'Lock Body & Generate Side View?',
        message: "This will generate the side profile view. You won't be able to edit the body pose without resetting the entire sheet.",
        onConfirm: async () => {
          closeLockModal();
          
          setIsAutoGenerating(true);
          setAutoGenCancelled(false);
          
          if (!creditsData || creditsData.balance < CREDIT_COSTS.multiView) {
            toast.error(`Insufficient credits. Need ${CREDIT_COSTS.multiView} credits.`);
            setIsTopupOpen(true);
            setIsAutoGenerating(false);
            resolve();
            return;
          }
          
          // Generate side view only (walking and back views removed in Patch 15)
          const success = await handleGenerateMultiView('side', true);
          
          if (!success) {
            toast.error('Side view generation failed.');
          }
          
          setIsAutoGenerating(false);
          resolve();
        }
      });
    });
  }, [currentModelId, isAutoGenerating, creditsData, currentAssets, handleGenerateMultiView]);

  // Next stage calculation
  const nextStage = useMemo(() => {
    if (currentAssets.length === 0 || genState.isGenerating) return null;
    
    if (!currentAssets.some(a => a.viewType === 'frontFull')) {
      return { 
        label: 'Generate Full Body', 
        action: handleGenerateFullBody,
        step: 2,
        total: 3,
      };
    }
    
    if (!currentAssets.some(a => a.viewType === 'sideClose')) {
      return { 
        label: 'Generate Side View', 
        action: handleAutoGenerateAllViews,
        step: 3,
        total: 3,
        isAutoGen: true,
      };
    }

    return {
      label: 'Export Character Pack',
      action: () => setShowExportModal(true),
      step: 4, 
      total: 3,
    };
  }, [currentAssets, genState.isGenerating, isAutoGenerating, handleGenerateFullBody, handleAutoGenerateAllViews, handleGenerateMultiView]);

  return {
    canGenerateFullBody,
    canGenerateMultiView,
    handleGenerateFullBody,
    handleGenerateMultiView,
    handleAutoGenerateAllViews,
    nextStage,
  };
}
