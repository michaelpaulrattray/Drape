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
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const isMintedEdit = !!editContext && !editContext.draft;

  // Session setup: always a clean slate; edit sessions then hydrate via the
  // workspace's gallery path (canvas.castModelId), and minted edits raise the
  // shared-state mode flag (D-11 routing survives a /studio resume)
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
      // Leaving the takeover never strands the mode on an unrelated session
      if (editContext && !editContext.draft) {
        useStudioStore.getState().setMintedEditContext(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { genState, currentModelId, currentAssets } = useCastingGenerationStore();
  const prefs = useCastingFormStore((s) => s.prefs);
  const modelNameInStore = useCastingFormStore((s) => s.modelName);
  const { isTopupOpen, setIsTopupOpen } = useCastingUIStore();

  // Baseline for the identity diff — captured once, after hydration lands
  const baselineRef = useRef<ModelPreferences | null>(null);
  const hydrated = !editContext || currentAssets.length > 0;
  useEffect(() => {
    if (editContext && hydrated && !baselineRef.current) {
      baselineRef.current = JSON.parse(JSON.stringify(useCastingFormStore.getState().prefs));
    }
  }, [editContext, hydrated]);

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
    needsSideView,
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
    if (!isMintedEdit || !baselineRef.current) return null;
    const diff = diffPreferences(baselineRef.current, prefs);
    return Object.keys(diff.changes).length > 0 ? diff : null;
  }, [isMintedEdit, prefs]);

  const workInProgress = isMintedEdit
    ? unsavedDiff() !== null
    : genState.isGenerating || currentModelId !== null;

  const attemptClose = useCallback(() => {
    if (isCasting) return; // mint in flight — landing imminent, don't tear down
    if (workInProgress) {
      setConfirmingLeave(true);
      return;
    }
    onClose();
  }, [isCasting, workInProgress, onClose]);

  const handleSaveChanges = useCallback(() => {
    const diff = unsavedDiff();
    if (!diff) {
      toast.info('No identity changes yet');
      return;
    }
    setIdentityDialog(diff);
  }, [unsavedDiff]);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FAFAF8' }}>
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
      <div className="flex-1 flex min-h-0">
        <CastingWorkspace
          user={user}
          isAuthenticated={isAuthenticated}
          isReadOnly={false}
          onNewModel={resetCastingSession}
        />
      </div>

      {/* Leave confirmation */}
      {confirmingLeave && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
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
                : 'Your draft stays in your studio, but nothing will land on this board.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingLeave(false);
                  onClose();
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
        onConfirm={handleCastAndContinue}
        needsSideView={needsSideView}
        isCasting={isCasting}
        castingMessage={castingMessage}
        previewImage={currentAssets.find((a) => a.viewType === 'frontClose')?.storageUrl}
      />

      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />
    </div>
  );
}
