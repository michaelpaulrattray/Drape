/**
 * useCastGate — Hook that manages the "Cast this model" gate
 * shown when a user tries to enter Wardrobe with a draft model.
 *
 * Handles: side view generation, model name update, minting,
 * and transition to wardrobe.
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useStudioStore } from '../stores/useStudioStore';
import type { GeneratedAsset } from '@/features/casting/constants';

interface UseCastGateParams {
  currentModelId: number | null;
  currentAssets: GeneratedAsset[];
  refetchCreditsWithWarning: () => void;
}

export function useCastGate({
  currentModelId,
  currentAssets,
  refetchCreditsWithWarning,
}: UseCastGateParams) {
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const setCanvas = useStudioStore((s) => s.setCanvas);
  const isMinted = useStudioStore((s) => s.canvas.isMinted);

  const [showCastModal, setShowCastModal] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castingMessage, setCastingMessage] = useState('');

  const needsSideView = !currentAssets.some(
    (a) => a.viewType === 'sideClose' && a.storageUrl
  );

  const mintMutation = trpc.generation.mint.useMutation();
  const generateMultiViewMutation = trpc.generation.multiView.useMutation();
  const updateModelMutation = trpc.models.update.useMutation();

  const handleCastAndContinue = useCallback(
    async (characterName: string, generateSideView: boolean = true) => {
      if (!currentModelId) {
        toast.error('No model to cast');
        return;
      }
      setIsCasting(true);
      try {
        // Step 1: Generate side view if requested and missing
        if (needsSideView && generateSideView) {
          setCastingMessage('Generating side view...');
          const result = await generateMultiViewMutation.mutateAsync({
            modelId: currentModelId,
            viewType: 'side',
          });
          if (result.success && result.imageUrl) {
            const newAsset = {
              id: result.assetId || Date.now(),
              viewType: 'sideClose' as const,
              storageUrl: result.imageUrl,
            };
            const newAssets = [
              ...currentAssets.filter((a) => a.viewType !== 'sideClose'),
              newAsset,
            ];
            useCastingGenerationStore.getState().setCurrentAssets(newAssets);
            useCastingGenerationStore.getState().pushHistory(newAssets);
          }
        }

        // Step 2: Update model name
        setCastingMessage('Saving identity...');
        await updateModelMutation.mutateAsync({
          modelId: currentModelId,
          name: characterName,
        });

        // Step 3: Mint the model (status → active, agencyId assigned)
        const mintResult = await mintMutation.mutateAsync({
          modelId: currentModelId,
        });
        if (!mintResult.agencyId) {
          throw new Error('Failed to cast model');
        }

        // Mark as minted in canvas state
        setCanvas({ isMinted: true, castModelId: currentModelId });

        toast.success(`${characterName} has been cast!`);
        setShowCastModal(false);

        // Transition to wardrobe
        setActiveTool('wardrobe');

        // Refetch credits after side view generation
        if (needsSideView && generateSideView) refetchCreditsWithWarning();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Casting failed';
        toast.error(message);
      } finally {
        setIsCasting(false);
        setCastingMessage('');
      }
    },
    [
      currentModelId,
      currentAssets,
      needsSideView,
      mintMutation,
      generateMultiViewMutation,
      updateModelMutation,
      setActiveTool,
      setCanvas,
      refetchCreditsWithWarning,
    ]
  );

  return {
    showCastModal,
    setShowCastModal,
    isCasting,
    isMinted,
    castingMessage,
    needsSideView,
    handleCastAndContinue,
  };
}
