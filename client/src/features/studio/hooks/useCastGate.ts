/**
 * useCastGate — Hook that manages the "Cast this model" gate.
 *
 * R3b: one mintPackage call does the whole thing server-side —
 * generates the chosen tier's missing views (back views behind the
 * identity gate), names the model, and mints. Tier costs come from
 * the plan query (server truth, D-15). Failed slots arrive named-
 * and-refunded and are surfaced honestly (D-39).
 */
import { useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useStudioStore } from '../stores/useStudioStore';
import type { GeneratedAsset } from '@/features/casting/constants';
import type { MintTier } from '@shared/boardTypes';

interface UseCastGateParams {
  currentModelId: number | null;
  currentAssets: GeneratedAsset[];
  refetchCreditsWithWarning: () => void;
  /** Override the post-mint destination: the studio transitions to wardrobe
   *  by default; the board takeover (D-35) lands the model on its node. */
  onMinted?: (modelId: number, characterName: string) => void;
}

export function useCastGate({
  currentModelId,
  currentAssets,
  refetchCreditsWithWarning,
  onMinted,
}: UseCastGateParams) {
  const setActiveTool = useStudioStore((s) => s.setActiveTool);
  const setCanvas = useStudioStore((s) => s.setCanvas);
  const isMinted = useStudioStore((s) => s.canvas.isMinted);

  const [showCastModal, setShowCastModal] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castingMessage, setCastingMessage] = useState('');

  const utils = trpc.useUtils();
  const mintPackageMutation = trpc.generation.mintPackage.useMutation();
  const planQuery = trpc.generation.mintPackagePlan.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: showCastModal && !!currentModelId }
  );

  const handleCastAndContinue = useCallback(
    async (characterName: string, tier: MintTier = 'core', upgrade = false) => {
      if (!currentModelId) {
        toast.error('No model to cast');
        return;
      }
      setIsCasting(true);
      const missingCount = planQuery.data?.tiers[tier]?.missing.length ?? 0;
      setCastingMessage(
        missingCount > 0
          ? `Casting ${missingCount} view${missingCount === 1 ? '' : 's'}...`
          : 'Saving identity...'
      );
      try {
        const result = await mintPackageMutation.mutateAsync({
          modelId: currentModelId,
          tier,
          characterName,
        });

        // Land freshly generated views in the studio viewer state
        if (result.generated.length > 0) {
          const castStore = useCastingGenerationStore.getState();
          const fresh: GeneratedAsset[] = result.generated.map((g, i) => ({
            id: Date.now() + i,
            viewType: g.angle,
            storageUrl: g.imageUrl,
          }));
          const newAssets = [
            ...currentAssets.filter(
              (a) => !result.generated.some((g) => g.angle === a.viewType)
            ),
            ...fresh,
          ];
          castStore.setCurrentAssets(newAssets);
          castStore.pushHistory(newAssets);
        }

        // Mark as minted in canvas state
        setCanvas({ isMinted: true, castModelId: currentModelId });

        // Named-and-refunded slot failures surface honestly (D-39/D-40). A
        // long duration: the takeover may be closing under this toast, and a
        // fleeting notice is what made the failure feel silent at VC-R3b. The
        // failed slot also renders retryable in the view strip (durable).
        for (const f of result.failed) {
          toast.error(
            `${f.label} view couldn't match this identity — ${f.refunded} credits refunded, nothing charged. It's marked "Retry" in the package.`,
            { duration: 9000 }
          );
        }

        setShowCastModal(false);
        utils.models.get.invalidate({ modelId: currentModelId });
        utils.generation.packageState.invalidate({ modelId: currentModelId });
        utils.generation.mintPackagePlan.invalidate({ modelId: currentModelId });

        if (upgrade) {
          // D-39c upgrade: already minted and placed — stay in the session,
          // the new views are in the strip
          if (result.generated.length > 0) {
            toast.success(
              `${result.generated.length} view${result.generated.length === 1 ? '' : 's'} added to ${characterName}'s package`
            );
          }
        } else {
          toast.success(`${characterName} has been cast!`);
          if (onMinted) {
            // Takeover host: land the model on the board node
            onMinted(currentModelId, characterName);
          } else {
            // Studio default: transition to wardrobe
            setActiveTool('wardrobe');
          }
        }

        if (result.generated.length > 0 || result.failed.length > 0) {
          refetchCreditsWithWarning();
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Casting failed';
        toast.error(message);
        refetchCreditsWithWarning();
      } finally {
        setIsCasting(false);
        setCastingMessage('');
      }
    },
    [
      currentModelId,
      currentAssets,
      planQuery.data,
      mintPackageMutation,
      utils,
      setActiveTool,
      setCanvas,
      refetchCreditsWithWarning,
      onMinted,
    ]
  );

  return {
    showCastModal,
    setShowCastModal,
    isCasting,
    isMinted,
    castingMessage,
    tierPlan: planQuery.data?.tiers,
    handleCastAndContinue,
  };
}
