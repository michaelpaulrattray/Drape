import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useCastingGenerationStore } from "@/stores/useCastingGenerationStore";
import { useCastingUIStore } from "@/stores/useCastingUIStore";
import { showLowBalanceToast, LOW_BALANCE_THRESHOLD } from "@/components/LowBalanceWarning";
import { CREDIT_COSTS, type GeneratedAsset } from "@/constants/casting";

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
  } = useCastingUIStore();

  // Mutations
  const generateFullBodyMutation = trpc.generation.fullBody.useMutation();
  const generateMultiViewMutation = trpc.generation.multiView.useMutation();
  const generateAllViewsMutation = trpc.generation.generateAllViews.useMutation();

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
          toast.error(`Insufficient credits. Need ${CREDIT_COSTS.fullBody} points.`);
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
        toast.error(`Insufficient credits. Need ${CREDIT_COSTS.multiView} points.`);
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
          title: 'Lock Body & Generate All Views?',
          message: "This will generate all remaining views (side, walking, back) automatically. You won't be able to edit the body pose without resetting the entire sheet.",
          onConfirm: async () => {
            closeLockModal();
            const success = await doGenerate();
            resolve(success);
          }
        });
      });
    }
  }, [currentModelId, creditsData, currentAssets]);

  // Auto-generate all remaining views
  const handleAutoGenerateAllViews = useCallback(async () => {
    if (!currentModelId || isAutoGenerating) return;
    
    return new Promise<void>((resolve) => {
      setLockModal({
        isOpen: true,
        title: 'Lock Body & Generate All Views?',
        message: "This will generate all remaining views (side, walking, back) in parallel. You won't be able to edit the body pose without resetting the entire sheet.",
        onConfirm: async () => {
          closeLockModal();
          
          setIsAutoGenerating(true);
          setAutoGenCancelled(false);
          
          const totalCost = CREDIT_COSTS.multiView * 3;
          if (!creditsData || creditsData.balance < totalCost) {
            toast.error(`Insufficient credits. Need ${totalCost} credits for all views.`);
            setIsAutoGenerating(false);
            resolve();
            return;
          }
          
          setGenState({ 
            isGenerating: true, 
            currentStep: 'Generating all views (side, walk, back)...', 
            error: null, 
            progress: 0, 
            startTime: Date.now(), 
            estimatedDuration: 30000
          });
          
          try {
            const result = await generateAllViewsMutation.mutateAsync({
              modelId: currentModelId,
            });
            
            if (result.success && result.views) {
              const newAssets: GeneratedAsset[] = [
                ...currentAssets.filter(a => !['sideClose', 'sideFull', 'backFull'].includes(a.viewType)),
                { id: result.views.sideClose.assetId ?? Date.now(), viewType: 'sideClose' as const, storageUrl: result.views.sideClose.imageUrl },
                { id: result.views.sideFull.assetId ?? Date.now() + 1, viewType: 'sideFull' as const, storageUrl: result.views.sideFull.imageUrl },
                { id: result.views.backFull.assetId ?? Date.now() + 2, viewType: 'backFull' as const, storageUrl: result.views.backFull.imageUrl },
              ];
              
              setCurrentAssets(newAssets);
              pushHistory(newAssets);
              setActiveView('sideClose');
              toast.success('All views generated! Ready to export.');
              refetchCreditsWithWarning();
            }
            
            setGenState({ isGenerating: false, currentStep: '', error: null });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Generation failed';
            setGenState({ isGenerating: false, currentStep: '', error: message });
            toast.error(message);
          }
          
          setIsAutoGenerating(false);
          resolve();
        }
      });
    });
  }, [currentModelId, isAutoGenerating, creditsData, currentAssets]);

  // Next stage calculation
  const nextStage = useMemo(() => {
    if (currentAssets.length === 0 || genState.isGenerating) return null;
    
    if (!currentAssets.some(a => a.viewType === 'frontFull')) {
      return { 
        label: 'Generate Full Body', 
        action: handleGenerateFullBody,
        step: 2,
        total: 5,
      };
    }
    
    if (!currentAssets.some(a => a.viewType === 'sideClose')) {
      return { 
        label: 'Generate All Views', 
        action: handleAutoGenerateAllViews,
        step: 3,
        total: 5,
        isAutoGen: true,
      };
    }
    
    if (isAutoGenerating) {
      if (!currentAssets.some(a => a.viewType === 'sideFull')) {
        return { 
          label: 'Generating Walking View...', 
          action: () => {},
          step: 4,
          total: 5,
          isProgress: true,
        };
      }
      if (!currentAssets.some(a => a.viewType === 'backFull')) {
        return { 
          label: 'Generating Back View...', 
          action: () => {},
          step: 5,
          total: 5,
          isProgress: true,
        };
      }
    }
    
    if (!currentAssets.some(a => a.viewType === 'sideFull')) {
      return { 
        label: 'Generate Walking View', 
        action: () => handleGenerateMultiView('walk'),
        step: 4,
        total: 5,
      };
    }
    
    if (!currentAssets.some(a => a.viewType === 'backFull')) {
      return { 
        label: 'Generate Back View', 
        action: () => handleGenerateMultiView('back'),
        step: 5,
        total: 5,
      };
    }

    return {
      label: 'Export Character Pack',
      action: () => setShowExportModal(true),
      step: 6, 
      total: 5,
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
