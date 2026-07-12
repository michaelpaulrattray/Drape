/**
 * CastingTakeover — the casting environment as a board takeover (D-35,
 * Option B). Near-full-screen overlay in the image-viewer shell pattern:
 * slim frame, back/close, Esc. The board stays mounted underneath.
 *
 * Three sessions, one shell (R3):
 *  - NEW cast: fresh session → mint gate → the model lands on the node.
 *  - DRAFT promotion (D-42): opens with the draft loaded; the same mint gate
 *    names/mints it and the node updates in place.
 *  - MINTED EDIT (D-11/D-41): opens with the model loaded, stage-lock off,
 *    the panel's generate hidden — the ONLY save path is the top bar's
 *    "Save changes" → IdentityChangeDialog (update-with-cascade / fork /
 *    cancel). The mode lives in shared workspace state so a /studio resume
 *    carries the same routing.
 *
 * Studio-scoped code hosted by BoardPage — the D-24 boundary in practice.
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { showLowBalanceToast, LOW_BALANCE_THRESHOLD } from '@/features/billing/LowBalanceWarning';
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import type { ModelPreferences } from '@/features/casting/constants';
import { useStudioStore } from '../stores/useStudioStore';
import { BrandLoader } from '@/components/BrandLoader';
import { CastingWorkspace } from '../components/CastingWorkspace';
import { CastModelModal } from '../components/CastModelModal';
import { useCastGate } from '../hooks/useCastGate';
import { resetCastingSession } from '../hooks/castingSessionReset';
import { IdentityChangeDialog } from './IdentityChangeDialog';

export interface CastEditContext {
  boardId: number;
  itemId: number;
  modelId: number;
  /** Placed draft — Edit is the promotion route (mint gate, not D-11). */
  draft: boolean;
}

export interface CastingTakeoverProps {
  user: { role?: string } | null;
  isAuthenticated: boolean;
  /** Present = Edit session on a placed cast; absent = new cast. */
  editContext?: CastEditContext | null;
  /** Mint completed (new cast or draft promotion) — host lands the model on
   *  the originating node and closes. Carries client-held data for the D-38
   *  optimistic fill. */
  onMinted: (modelId: number, info: { name: string; headshotUrl: string | null }) => void;
  /** Minted-edit save confirmed in the D-11 dialog — host closes the
   *  takeover and runs boardOps.applyModelEdit with a node-local job. */
  onIdentityCommit: (decision: 'update' | 'fork', changes: Record<string, unknown>) => void;
  /** User backed out (Esc / back / close), after the leave-confirm if work exists. */
  onClose: () => void;
}

/** Fields compared for identity changes (everything the form can set). */
const DIFF_LABELS: Record<string, string> = {
  castingBrand: 'brand', castingVibe: 'vibe', gender: 'gender', age: 'age',
  ethnicity: 'ethnicity', ethnicityBlend: 'ethnicity', bodyType: 'body type',
  faceShape: 'face shape', skinTone: 'skin tone', skinTexture: 'skin texture',
  skinFinish: 'skin finish', eyeColor: 'iris color', hairColor: 'hair color',
  hairStyle: 'hair style', hairLength: 'hair length', hairTexture: 'hair texture',
  hairFringe: 'bangs', hairParting: 'parting', hairVolume: 'volume',
  hairTuck: 'tuck', hairFade: 'fade', hairFlyaways: 'flyaways',
  hairHairline: 'hairline', facialHair: 'facial hair', jawline: 'jawline',
  cheekbones: 'cheekbones', cheeks: 'cheeks', eyeShape: 'eye shape',
  noseShape: 'nose shape', lipShape: 'lip shape', eyebrowStyle: 'brows',
  features: 'details',
};

function diffPreferences(
  baseline: ModelPreferences,
  current: ModelPreferences,
): { changes: Record<string, unknown>; labels: string[] } {
  const changes: Record<string, unknown> = {};
  const labels = new Set<string>();
  const base = baseline as unknown as Record<string, unknown>;
  const curr = current as unknown as Record<string, unknown>;
  for (const key of Object.keys(DIFF_LABELS)) {
    const a = base[key];
    const b = curr[key];
    const same = JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!same) {
      changes[key] = b ?? '';
      labels.add(DIFF_LABELS[key]);
    }
  }
  return { changes, labels: Array.from(labels) };
}

export function CastingTakeover({
  user,
  isAuthenticated,
  editContext,
  onMinted,
  onIdentityCommit,
  onClose,
}: CastingTakeoverProps) {
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [identityDialog, setIdentityDialog] = useState<{
    changes: Record<string, unknown>;
    labels: string[];
  } | null>(null);
  // D-39c: a ghost slot in the view strip opens the mint dialog in upgrade
  // mode (add the missing views to an already-minted package)
  const [upgradeMode, setUpgradeMode] = useState(false);
  const isMintedEdit = !!editContext && !editContext.draft;

  // Fold-in (VC-R1 feedback, folded post-VC-R3): the takeover ARRIVES over
  // the board — scale+fade entrance, mirrored exit, board visible around it
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const startClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 210);
  }, [onClose]);

  // Session setup: always a clean slate; edit sessions then hydrate via the
  // workspace's gallery path (canvas.castModelId), and minted edits raise the
  // shared-state mode flag (D-11 routing survives a /studio resume).
  //
  // BLEED CONTRACT (bug-1 fix, founder-verified invariant): a minted-edit
  // session is CONSUMED on close — every exit path unmounts this component,
  // and the cleanup below hard-resets the whole session (stores + canvas +
  // mode flag together). Leave means discarded; re-entering Edit hydrates
  // from the model's true baseline; plain /studio opens fresh. The mode flag
  // and the session can only live or die together — if a session ever DID
  // survive, the flag survives with it and /studio arrives in minted-edit
  // mode (stage-lock off, no direct Cast) rather than as a D-11 bypass.
  useEffect(() => {
    resetCastingSession();
    if (editContext) {
      useStudioStore.getState().setCanvas({ castModelId: editContext.modelId });
      if (!editContext.draft) {
        useStudioStore.getState().setMintedEditContext({
          boardId: editContext.boardId,
          itemId: editContext.itemId,
          modelId: editContext.modelId,
        });
      }
    }
    return () => {
      if (editContext && !editContext.draft) {
        resetCastingSession(); // full discard — never just the flag
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { genState, currentModelId, currentAssets } = useCastingGenerationStore();
  const prefs = useCastingFormStore((s) => s.prefs);
  const modelNameInStore = useCastingFormStore((s) => s.modelName);
  const { isTopupOpen, setIsTopupOpen } = useCastingUIStore();

  // Baseline for the identity diff — written by the hydration path itself
  // (CastingWorkspace) from the exact payload that filled the form. The old
  // capture-on-hydrated-flag effect mixed a render-time flag with an
  // effect-time store read across the mount reset: with a prior session's
  // assets still in the store, it captured freshly-reset defaults and every
  // hydrated field became a "change" (VC-R3b bug 2 — the fork ceremony on a
  // zero-edit save).
  const baselinePrefs = useStudioStore((s) => s.mintedEditContext?.baselinePrefs);
  const hydrated =
    !editContext ||
    (currentAssets.length > 0 && (editContext.draft || baselinePrefs !== undefined));

  const { data: creditsData, refetch: refetchCredits } = trpc.credits.getBalance.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );
  const refetchCreditsWithWarning = useCallback(async () => {
    const result = await refetchCredits();
    const balance = result.data?.balance;
    if (balance !== undefined && balance < LOW_BALANCE_THRESHOLD) {
      showLowBalanceToast(balance, () => setIsTopupOpen(true));
    }
  }, [refetchCredits, setIsTopupOpen]);

  const {
    showCastModal,
    setShowCastModal,
    isCasting,
    castingMessage,
    tierPlan,
    handleCastAndContinue,
  } = useCastGate({
    currentModelId,
    currentAssets,
    refetchCreditsWithWarning,
    onMinted: (modelId, characterName) =>
      onMinted(modelId, {
        name: characterName,
        headshotUrl:
          currentAssets.find((a) => a.viewType === 'frontClose' && a.storageUrl)?.storageUrl ?? null,
      }),
  });

  const hasHeadshot = currentAssets.some((a) => a.viewType === 'frontClose' && a.storageUrl);

  // Unsaved work: minted edits = a non-empty identity diff; authoring
  // sessions = a draft in progress (which persists server-side either way)
  const unsavedDiff = useCallback(() => {
    if (!isMintedEdit || !baselinePrefs) return null;
    const diff = diffPreferences(baselinePrefs as unknown as ModelPreferences, prefs);
    return Object.keys(diff.changes).length > 0 ? diff : null;
  }, [isMintedEdit, baselinePrefs, prefs]);

  const workInProgress = isMintedEdit
    ? unsavedDiff() !== null
    : genState.isGenerating || currentModelId !== null;

  const attemptClose = useCallback(() => {
    if (isCasting) return; // mint in flight — landing imminent, don't tear down
    if (workInProgress) {
      setConfirmingLeave(true);
      return;
    }
    startClose();
  }, [isCasting, workInProgress, startClose]);

  const handleSaveChanges = useCallback(() => {
    const diff = unsavedDiff();
    if (!diff) {
      toast.info('No identity changes yet');
      return;
    }
    setIdentityDialog(diff);
  }, [unsavedDiff]);

  // Ghost slots in the view strip (D-46, one view system): a minted model's
  // ghost opens the UPGRADE dialog; a draft's ghost opens the MINT gate — the
  // draft's "add views is a Core mint away". Both are CastModelModal.
  useEffect(() => {
    const onUpgrade = () => {
      if (!isMintedEdit) return;
      setUpgradeMode(true);
      setShowCastModal(true);
    };
    const onMint = () => {
      if (isMintedEdit) return; // a minted model can't re-mint; upgrade only
      setUpgradeMode(false);
      setShowCastModal(true);
    };
    window.addEventListener('casting-open-package-upgrade', onUpgrade);
    window.addEventListener('casting-open-mint', onMint);
    return () => {
      window.removeEventListener('casting-open-package-upgrade', onUpgrade);
      window.removeEventListener('casting-open-mint', onMint);
    };
  }, [isMintedEdit, setShowCastModal]);
  useEffect(() => {
    if (!showCastModal) setUpgradeMode(false);
  }, [showCastModal]);

  // Esc closes (capture so board-level handlers never see it while we're up)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (showCastModal || isTopupOpen || identityDialog) return; // inner surfaces own their Esc
      if (confirmingLeave) {
        setConfirmingLeave(false);
        return;
      }
      attemptClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [attemptClose, confirmingLeave, showCastModal, isTopupOpen, identityDialog]);

  const title = isMintedEdit
    ? `Edit — ${modelNameInStore || 'cast'}`
    : editContext?.draft
      ? 'Finish this cast'
      : 'Cast a model';

  const open = entered && !closing;

  return (
    <div className="fixed inset-0 z-50">
      {/* Scrim — the board stays visible, dimmed, around the takeover */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(10,10,10,0.25)',
          opacity: open ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        onClick={attemptClose}
      />

      {/* The panel — arrives over the board (VC-R1 fold-in): slim visible
          board margin, ~200ms scale+fade in, mirrored out */}
      <div
        className="absolute flex flex-col overflow-hidden"
        style={{
          inset: 16,
          borderRadius: 14,
          background: '#FAFAF8',
          border: '1px solid rgba(0,0,0,0.10)',
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1)' : 'scale(0.975)',
          transformOrigin: 'center center',
          transition: 'opacity 200ms cubic-bezier(0.16,1,0.3,1), transform 200ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
      {/* Slim frame — image-viewer shell conventions */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{ height: 52, borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Back to board"
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/[0.04]"
            style={{ color: '#71716A' }}
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
          </button>
          <span className="truncate" style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* D-45(1): the balance lives where credits are spent — a quiet
              tertiary figure left of the primary action, click = top up.
              Labeled "credits" + hairline-separated so it can never read as
              the action's price (VC-R4 fix 1 / D-15). Updates on the same
              refetch that follows every generation. */}
          {isAuthenticated && creditsData && (
            <>
              <button
                type="button"
                onClick={() => setIsTopupOpen(true)}
                title="Credit balance — top up"
                className="px-2 py-1 rounded-md transition-colors hover:bg-black/[0.04]"
                style={{ fontSize: 12, color: '#71716A', fontVariantNumeric: 'tabular-nums' }}
              >
                {creditsData.balance.toLocaleString()} credits
              </button>
              <span aria-hidden style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', marginRight: 4 }} />
            </>
          )}
          {isMintedEdit ? (
            <button
              type="button"
              disabled={!hydrated || genState.isGenerating}
              onClick={handleSaveChanges}
              className="px-4 py-1.5 rounded-full transition-all duration-200 disabled:opacity-40"
              style={{ fontSize: 12, fontWeight: 500, color: '#fff', background: '#1a1a1a' }}
            >
              Save changes
            </button>
          ) : (
            <button
              type="button"
              disabled={!hasHeadshot || isCasting || genState.isGenerating}
              onClick={() => setShowCastModal(true)}
              className="px-4 py-1.5 rounded-full transition-all duration-200 disabled:opacity-40"
              style={{ fontSize: 12, fontWeight: 500, color: '#fff', background: '#1a1a1a' }}
            >
              {isCasting ? 'Casting…' : 'Cast this model'}
            </button>
          )}
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Close"
            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-black/[0.04]"
            style={{ color: '#71716A' }}
          >
            <X size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* The environment */}
      <div className="flex-1 flex min-h-0 relative">
        <CastingWorkspace
          user={user}
          isAuthenticated={isAuthenticated}
          isReadOnly={false}
          onNewModel={resetCastingSession}
        />
        {/* Cold-mount loader (P1): edit sessions hydrate the model first —
            never flash the default studio */}
        {editContext && !hydrated && (
          <div className="absolute inset-0 z-10" style={{ background: '#FAFAF8' }}>
            <BrandLoader label={isMintedEdit ? 'Loading this cast' : 'Loading your draft'} />
          </div>
        )}
      </div>

      {/* Leave confirmation — above ALL environment chrome (the viewer's
          LoadingOverlay sits at z-40 and occluded the Leave button at
          VC-R3b bug 4; a confirm the user cannot answer is worse than none) */}
      {confirmingLeave && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,10,0.3)' }} onClick={() => setConfirmingLeave(false)} />
          <div
            className="relative rounded-xl p-5"
            style={{ width: 380, background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
              {isMintedEdit ? 'Leave editing?' : 'Leave casting?'}
            </p>
            <p style={{ fontSize: 12.5, color: '#71716A', lineHeight: 1.55, marginBottom: 18 }}>
              {isMintedEdit
                ? 'Unsaved identity changes are discarded — the placed cast stays as it is.'
                : genState.isGenerating
                  ? 'This cast keeps generating and saves to your draft — nothing will land on this board.'
                  : 'Your draft stays in your studio, but nothing will land on this board.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingLeave(false);
                  startClose();
                }}
                className="px-3.5 py-1.5 rounded-full transition-colors hover:bg-black/[0.04]"
                style={{ fontSize: 12, fontWeight: 500, color: '#52524B', border: '1px solid rgba(0,0,0,0.12)' }}
              >
                Leave
              </button>
              <button
                type="button"
                onClick={() => setConfirmingLeave(false)}
                className="px-3.5 py-1.5 rounded-full transition-opacity hover:opacity-90"
                style={{ fontSize: 12, fontWeight: 500, color: '#fff', background: '#1a1a1a' }}
              >
                {isMintedEdit ? 'Keep editing' : 'Keep casting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The D-11 identity dialog (minted edits only) */}
      {identityDialog && editContext && (
        <IdentityChangeDialog
          boardId={editContext.boardId}
          itemId={editContext.itemId}
          changedLabels={identityDialog.labels}
          onCancel={() => setIdentityDialog(null)}
          onCommit={(decision) => {
            const changes = identityDialog.changes;
            setIdentityDialog(null);
            onIdentityCommit(decision, changes);
          }}
        />
      )}

      <CastModelModal
        isOpen={showCastModal}
        onClose={() => setShowCastModal(false)}
        onConfirm={(name, tier) => handleCastAndContinue(name, tier, upgradeMode)}
        tiers={tierPlan}
        isCasting={isCasting}
        castingMessage={castingMessage}
        previewImage={currentAssets.find((a) => a.viewType === 'frontClose')?.storageUrl}
        mode={upgradeMode ? 'upgrade' : 'mint'}
        fixedName={upgradeMode ? modelNameInStore : undefined}
      />

      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />
      </div>
    </div>
  );
}
