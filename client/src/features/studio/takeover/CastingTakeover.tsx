/**
 * CastingTakeover — the casting environment as a board takeover (D-35,
 * Option B). Near-full-screen overlay in the image-viewer shell pattern:
 * slim frame, back/close, Esc. The board stays mounted underneath and is
 * untouched until mint lands the finished cast on the originating node.
 *
 * Studio-scoped code hosted by BoardPage — this is the D-24 boundary in
 * practice: the casting stores live and are managed HERE; nothing under
 * features/boards imports them.
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { showLowBalanceToast, LOW_BALANCE_THRESHOLD } from '@/features/billing/LowBalanceWarning';
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { CastingWorkspace } from '../components/CastingWorkspace';
import { CastModelModal } from '../components/CastModelModal';
import { useCastGate } from '../hooks/useCastGate';
import { resetCastingSession } from '../hooks/castingSessionReset';

export interface CastingTakeoverProps {
  user: { role?: string } | null;
  isAuthenticated: boolean;
  /** Mint completed — host lands the model on the originating node and closes.
   *  Carries the client-held headshot + name as plain data so the host can
   *  fill optimistically (D-38) without touching casting stores (D-24). */
  onMinted: (modelId: number, info: { name: string; headshotUrl: string | null }) => void;
  /** User backed out (Esc / back / close), after the leave-confirm if work exists. */
  onClose: () => void;
}

export function CastingTakeover({ user, isAuthenticated, onMinted, onClose }: CastingTakeoverProps) {
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  // Fresh session every open — the takeover always starts a new cast in R1
  // (the R3 edit path opens with a model loaded instead)
  useEffect(() => {
    resetCastingSession();
  }, []);

  const { genState, currentModelId, currentAssets } = useCastingGenerationStore();
  const { isTopupOpen, setIsTopupOpen } = useCastingUIStore();

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
  // Drafts persist server-side; leaving discards the board landing, not the work
  const workInProgress = genState.isGenerating || currentModelId !== null;

  const attemptClose = useCallback(() => {
    if (isCasting) return; // mint in flight — landing imminent, don't tear down
    if (workInProgress) {
      setConfirmingLeave(true);
      return;
    }
    onClose();
  }, [isCasting, workInProgress, onClose]);

  // Esc closes (capture so board-level handlers never see it while we're up)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (showCastModal || isTopupOpen) return; // inner modals own their Esc
      if (confirmingLeave) {
        setConfirmingLeave(false);
        return;
      }
      attemptClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [attemptClose, confirmingLeave, showCastModal, isTopupOpen]);

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
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Cast a model</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasHeadshot || isCasting || genState.isGenerating}
            onClick={() => setShowCastModal(true)}
            className="px-4 py-1.5 rounded-full transition-all duration-200 disabled:opacity-40"
            style={{ fontSize: 12, fontWeight: 500, color: '#fff', background: '#1a1a1a' }}
          >
            {isCasting ? 'Casting…' : 'Cast this model'}
          </button>
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

      {/* Leave confirmation — drafts persist in the studio; nothing lands on the board */}
      {confirmingLeave && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: 'rgba(10,10,10,0.3)' }} onClick={() => setConfirmingLeave(false)} />
          <div
            className="relative rounded-xl p-5"
            style={{ width: 380, background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
              Leave casting?
            </p>
            <p style={{ fontSize: 12.5, color: '#71716A', lineHeight: 1.55, marginBottom: 18 }}>
              Your draft stays in your studio, but nothing will land on this board.
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
                Keep casting
              </button>
            </div>
          </div>
        </div>
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
