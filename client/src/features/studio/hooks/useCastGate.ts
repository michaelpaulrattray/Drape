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
  /** D-55 (VC-R6 final): a stays-draft confirm succeeded — the host lands
   *  the DRAFT on its node (session stays open; the walkable loop must not
   *  dead-end at a takeover close that drops the work on the floor). */
  onStayDraft?: (modelId: number, nickname: string) => void;
}

export function useCastGate({
  currentModelId,
  currentAssets,
  refetchCreditsWithWarning,
  onMinted,
  onStayDraft,
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
    async (characterName: string, tier: MintTier = 'core', upgrade = false, stayDraft = false) => {
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
        // Trap ruling (a): stayDraft = generate the tier's views, model stays
        // a draft (no mint) — identity iteration stays free. A typed name
        // rides as an OPTIONAL NICKNAME (D-42 honest naming, never a mint).
        // Batch 0 (mint-transition invariant): UPGRADE is also mint:false —
        // the model is already minted; only a clean draft may request the
        // mint transition, and the server fails anything else closed.
        const nickname = stayDraft ? characterName.trim() : '';
        const result = await mintPackageMutation.mutateAsync({
          modelId: currentModelId,
          tier,
          ...(stayDraft
            ? { mint: false as const, ...(nickname ? { characterName: nickname } : {}) }
            : upgrade
              ? { mint: false as const }
              : { characterName }),
        });

        // Land freshly generated views in the studio viewer state
        if (result.generated.length > 0) {
          const castStore = useCastingGenerationStore.getState();
          const fresh: GeneratedAsset[] = result.generated.map((g, i) => ({
            // The REAL ledger id (D-55 / VC-R6 final r2 defect 1): the draft
            // session stays open and iterates these views straight away — a
            // synthesized id makes the server's assetId lookup miss ("Asset
            // not found"). Fall back only if the server somehow omitted it.
            id: g.assetId ?? Date.now() + i,
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

        // Batch B: the post-action gate state is the SERVER result's status
        // truth (result.minted), never an inference from which action the
        // client requested — a stays-draft request on an inconsistent row,
        // or an upgrade on a legacy 'locked' model, must read what the
        // server says, not what the client asked for.
        setCanvas({
          isMinted: result.minted,
          ...(result.minted ? { castModelId: currentModelId } : {}),
        });

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

        if (upgrade || stayDraft) {
          // D-39c upgrade / trap-(a) stays-draft views: stay in the session;
          // the new views filling the strip ARE the feedback (D-40, no toast).
          if (stayDraft) {
            // The nickname must reach the picker's Drafts section honestly
            utils.boardOps.listCastableModels.invalidate();
            // VC-R6 final fix 1(b): the draft LANDS on its node now — the
            // loop must not dead-end at a close that drops it
            onStayDraft?.(currentModelId, nickname);
          }
        } else {
          // D-40: the node landing on the board IS the feedback — no
          // "has been cast!" toast (a legacy survivor Fable caught at VC-R3b).
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
      onStayDraft,
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
