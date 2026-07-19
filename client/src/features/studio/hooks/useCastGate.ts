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
import { slotFailureMessage } from '@shared/refundCopy';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useStudioStore } from '../stores/useStudioStore';
import { captureCastingSession } from '@/features/casting/castingSessionToken';
import { beginCastingOperation } from '@/features/casting/pendingCastRegistry';
import type { GeneratedAsset } from '@/features/casting/constants';
import type { CanonicalViewAngle, MintTier } from '@shared/boardTypes';
import { createClientRequestId } from '@shared/clientRequestId';

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
  const [castingOperation, setCastingOperation] = useState<'mint' | 'addViews' | 'upgrade' | null>(null);
  const [viewsGenerating, setViewsGenerating] = useState(false);
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
      const operationMode = upgrade ? 'upgrade' : stayDraft ? 'addViews' : 'mint';
      setIsCasting(true);
      setCastingOperation(operationMode);
      const missingAngles = (planQuery.data?.tiers[tier]?.missing ?? []) as CanonicalViewAngle[];
      const missingCount = missingAngles.length;
      const session = captureCastingSession(
        () => useCastingGenerationStore.getState().sessionToken,
      );
      // Every missing-view run uses the registry as the one per-angle truth.
      // `operationMode` separately keeps a true mint's close/landing ceremony
      // blocked; stays-draft and upgrade work may outlive this hook.
      const backgroundOperation = missingAngles.length > 0
        ? beginCastingOperation({
            kind: 'addViews',
            modelId: currentModelId,
            angles: missingAngles,
          })
        : null;
      setViewsGenerating(missingAngles.length > 0);
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
          clientRequestId: createClientRequestId(),
          modelId: currentModelId,
          tier,
          ...(stayDraft
            ? { mint: false as const, ...(nickname ? { characterName: nickname } : {}) }
            : upgrade
              ? { mint: false as const }
              : { characterName }),
        });

        // Land freshly generated views in the studio viewer state
        if (session.isCurrent() && result.generated.length > 0) {
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

        backgroundOperation?.succeed({
          modelId: currentModelId,
          assets: result.generated.map((row) => ({
            angle: row.angle,
            assetId: row.assetId ?? Date.now(),
            url: row.imageUrl,
          })),
          name: characterName.trim() || null,
          background: !session.isCurrent(),
        });

        // Batch B: the post-action gate state is the SERVER result's status
        // truth (result.minted), never an inference from which action the
        // client requested — a stays-draft request on an inconsistent row,
        // or an upgrade on a legacy 'locked' model, must read what the
        // server says, not what the client asked for.
        if (session.isCurrent()) {
          setCanvas({
            isMinted: result.minted,
            ...(result.minted ? { castModelId: currentModelId } : {}),
          });
        }

        // Slot failures surface honestly (D-39/D-40 + Batch C final
        // correction 1): the sentence derives from the ledger's actual
        // outcome — refunded amount, a support reference when the refund
        // could not be recorded, and no "Retry marker" promise when the
        // durable marker itself failed to persist (correction 6). A long
        // duration: the takeover may be closing under this toast.
        for (const f of result.failed) {
          toast.error(slotFailureMessage(f), { duration: 9000 });
        }

        if (session.isCurrent()) setShowCastModal(false);
        utils.models.get.invalidate({ modelId: currentModelId });
        utils.generation.packageState.invalidate({ modelId: currentModelId });
        utils.generation.mintPackagePlan.invalidate({ modelId: currentModelId });

        if (!session.isCurrent()) {
          // The durable server result and its user-facing outcome above still
          // stand, but a closed/newer Casting session must never be rewritten.
        } else if (upgrade || stayDraft) {
          // D-39c upgrade / trap-(a) stays-draft views: stay in the session;
          // the new views filling the strip ARE the feedback (D-40, no toast).
          if (stayDraft) {
            // The nickname must reach the picker's Drafts section honestly
            utils.boardOps.listCastableModels.invalidate();
            if (nickname) {
              useCastingFormStore.getState().setModelName(nickname);
            }
            // VC-R6 final fix 1(b): the draft LANDS on its node now — the
            // loop must not dead-end at a close that drops it
            onStayDraft?.(currentModelId, nickname);
          }
        } else if (!result.minted) {
          // §14/R8 (Batch C): a slot failed during the mint's generation —
          // the successful views persisted on the draft, the failure was
          // refunded (toasted above), and the MINT TRANSITION aborted.
          // Retrying with the slots filled charges nothing (M20).
          toast.error(
            'Minting paused — a view needs a retry first. Your generated views are safe; retrying the mint with all views filled is free.',
            { duration: 9000 }
          );
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
        backgroundOperation?.fail({
          message,
          background: !session.isCurrent(),
          // useCastGate already owns this refund-honest notice even after
          // the takeover unmounts; the app subscriber must not duplicate it.
          notifyFailure: false,
        });
        toast.error(message);
        refetchCreditsWithWarning();
      } finally {
        if (session.isCurrent()) {
          setIsCasting(false);
          setCastingOperation(null);
          setViewsGenerating(false);
          setCastingMessage('');
        }
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
    castingOperation,
    viewsGenerating,
    isMinted,
    castingMessage,
    tierPlan: planQuery.data?.tiers,
    /** §14 (R8, Batch C): per-tier mint-integrity prediction — the dialog
     *  renders each failing check's own copy before anyone spends. */
    mintIntegrity: planQuery.data?.integrity,
    handleCastAndContinue,
  };
}
