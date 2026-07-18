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
import { BrandLoader } from '@/components/BrandLoader';
import { CastingWorkspace } from '../components/CastingWorkspace';
import { CastModelModal, draftNameToPersist } from '../components/CastModelModal';
import { useCastGate } from '../hooks/useCastGate';
import { resetCastingSession } from '../hooks/castingSessionReset';
import { IdentityChangeDialog } from './IdentityChangeDialog';
import { honestModelName } from '@/features/casting/modelDisplayTruth';
import { openPackageHealth } from '@/features/casting/components/PackageHealthDialog';
import { useCastingRefreshStore } from '@/features/casting/stores/useCastingRefreshStore';

export interface CastEditContext {
  boardId: number;
  itemId: number;
  modelId: number;
  /** Placed draft — Edit is the promotion route (mint gate, not D-11). */
  draft: boolean;
  /** R5/D-51: the board's package verb + ghost tiles open the takeover with
   *  the mint/upgrade dialog already up (mint gate for drafts, Rider 1). */
  openUpgrade?: boolean;
  /** D-54: a comp-card tile was double-clicked — the environment opens
   *  focused on that view (viewType, e.g. 'sideClose'). */
  initialAngle?: string;
  /** The originating board node was still blank when this saved draft opened. */
  originNeedsLanding?: boolean;
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
   *  takeover and runs boardOps.applyModelEdit with a node-local job.
   *  Batch C (review finding 7): resolves when the server ACCEPTED the
   *  commit; rejects on a (free) refusal — the takeover then stays open with
   *  the user's changes intact and the dialog shows the server's message. */
  onIdentityCommit: (decision: 'update' | 'fork', changes: Record<string, unknown>) => Promise<void> | void;
  /** User backed out (Esc / back / close), after the leave-confirm if work exists. */
  onClose: () => void;
  /** D-38: fired just before close on minted-edit sessions with the CLIENT-
   *  HELD slot heads (plain data across the D-24 boundary) — the host paints
   *  the mosaic from these immediately; refetch reconciles behind. */
  onSessionSlots?: (modelId: number, slots: Array<{ angle: string; url: string }>) => void;
  /** D-55 (VC-R6 final): a stays-draft confirm landed — the host fills the
   *  originating node with the DRAFT (badge, strip verb, Edit) while the
   *  session stays open. Without this the walkable loop dead-ended at a
   *  close that dropped the work on the floor. */
  onDraftLanded?: (modelId: number, info: { name: string | null; headshotUrl: string | null }) => void;
  /** Headshot completed after exit; the host can reopen the saved draft. */
  onBackgroundDraftReady?: (modelId: number, landed: boolean) => void;
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
  onSessionSlots,
  onDraftLanded,
  onBackgroundDraftReady,
}: CastingTakeoverProps) {
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // D-55: once a stays-draft confirm lands the draft on the board, closing
  // this session abandons NOTHING — the leave-confirm would be a false alarm
  const [draftLanded, setDraftLanded] = useState(
    !!editContext?.draft && !editContext.originNeedsLanding,
  );
  const [identityDialog, setIdentityDialog] = useState<{
    changes: Record<string, unknown>;
    labels: string[];
  } | null>(null);
  // Finding 7: the D-11 dialog owns the fork round-trip — pending holds the
  // dialog (and the takeover) open; a free refusal renders in the dialog.
  const [identityCommitPending, setIdentityCommitPending] = useState(false);
  const [identityCommitError, setIdentityCommitError] = useState<string | null>(null);
  // D-39c: a ghost slot in the view strip opens the mint dialog in upgrade
  // mode (add the missing views to an already-minted package)
  const [upgradeMode, setUpgradeMode] = useState(false);
  const isMintedEdit = !!editContext && !editContext.draft;

  // Fold-in (VC-R1 feedback, folded post-VC-R3): the takeover ARRIVES over
  // the board — scale+fade entrance, mirrored exit, board visible around it
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingStartedRef = useRef(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const startClose = useCallback(() => {
    if (closingStartedRef.current) return;
    closingStartedRef.current = true;
    setClosing(true);
    // D-38 straggler (R6 close-out log 1): a cosmetic iterate writes new
    // ledger heads mid-session — carry the CLIENT-HELD slot urls across the
    // close as plain data (the mint path's pattern; the D-24 boundary passes
    // data, never stores) so the board mosaic updates the instant the room
    // folds. The host patches its packageState cache and revalidates behind.
    //
    // VC-R6 final r3 (F2 + F3b): fire for EVERY session, not just minted
    // edits. A stays-draft / draft-edit session generates views and writes
    // sibling-stale marks that the board never saw until a hard refresh —
    // the patch paints the fresh views (F2) and the revalidate the host runs
    // surfaces the {N} stale segment from a mark edit (F3b). Model id comes
    // from the edit context, or the live session for a fresh cast.
    const state = useCastingGenerationStore.getState();
    const sessionModelId = editContext?.modelId ?? state.currentModelId;
    const needsBoardLanding = !draftLanded && (!editContext || !!editContext.originNeedsLanding);
    const headshot = state.currentAssets.find(
      (asset) => asset.viewType === 'frontClose' && asset.storageUrl,
    );
    if (needsBoardLanding && sessionModelId && headshot && onDraftLanded) {
      setDraftLanded(true);
      onDraftLanded(sessionModelId, {
        name: honestModelName(useCastingFormStore.getState().modelName),
        headshotUrl: headshot.storageUrl,
      });
    }
    if (sessionModelId) {
      onSessionSlots?.(
        sessionModelId,
        state.currentAssets
          .filter((a) => a.storageUrl)
          .map((a) => ({ angle: a.viewType, url: a.storageUrl })),
      );
    }
    // W4/R2: leaving becomes authoritative NOW, not after the 210ms exit
    // animation. A headshot resolving during that window must take the
    // background-draft path and must never write into this closing session.
    state.invalidateSession();
    window.setTimeout(onClose, 210);
  }, [onClose, onSessionSlots, onDraftLanded, editContext, draftLanded]);

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
    // D-54: the session STARTS on the double-clicked view; without an intent
    // it starts on the headshot. Explicit either way — resetCastingSession
    // never touched activeView, so sessions inherited the previous session's
    // view (a quiet bleed this closes).
    useCastingUIStore.getState().setActiveView(editContext?.initialAngle ?? 'frontClose');
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
      // VC-R6 final r3 F1 (session-reentry corruption): reset on EVERY close,
      // not just minted edits. A fresh cast / draft edit used to leave
      // currentModelId, currentAssets, and canvas.castModelId in the stores;
      // the NEXT session's child-hydration effect (runs before this parent's
      // mount reset) then read the stale canvas.castModelId and its async
      // fetch re-poisoned the store AFTER the reset — the iterate fired
      // against a stale (often minted) model + stale asset id. Three faces:
      // the seal spoke on a "draft" (wrong model was minted), "asset not
      // found" (stale id), and "Unable to transform" (compounded mismatch).
      // Drafts persist server-side, so a clean re-hydrate on next open loses
      // nothing. The bleed contract still holds — mintedEditContext dies here.
      resetCastingSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { genState, currentModelId, currentAssets } = useCastingGenerationStore();
  const prefs = useCastingFormStore((s) => s.prefs);
  const modelNameInStore = useCastingFormStore((s) => s.modelName);
  const { isTopupOpen, setIsTopupOpen } = useCastingUIStore();
  const utils = trpc.useUtils();
  const persistedModel = trpc.models.get.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId != null, staleTime: 0 },
  );
  const updateDraftName = trpc.models.update.useMutation();

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
    castingOperation,
    viewsGenerating,
    castingMessage,
    tierPlan,
    mintIntegrity,
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
    // D-55 (VC-R6 final): the stays-draft confirm lands the DRAFT on its
    // node — session stays open, closing later abandons nothing
    onStayDraft: (modelId, nickname) => {
      setDraftLanded(true);
      onDraftLanded?.(modelId, {
        name: nickname || null,
        headshotUrl:
          useCastingGenerationStore
            .getState()
            .currentAssets.find((a) => a.viewType === 'frontClose' && a.storageUrl)?.storageUrl ?? null,
      });
    },
  });

  const dismissCastModal = useCallback((typedName: string) => {
    setShowCastModal(false);
    const nextName = typedName.trim();
    if (!nextName || isMintedEdit) return;

    // W6-C: the open session keeps the label even if its server save fails.
    useCastingFormStore.getState().setModelName(nextName);
    if (currentModelId == null) return;

    const pendingName = draftNameToPersist(
      nextName,
      persistedModel.data?.name ?? modelNameInStore,
    );
    if (!pendingName) return;

    void updateDraftName.mutateAsync({ modelId: currentModelId, name: pendingName })
      .then(() => {
        // Cache refresh is follow-up optics, not part of the durable save.
        // Its failure must never falsely claim the name was forgotten.
        void Promise.all([
          utils.models.get.invalidate({ modelId: currentModelId }),
          utils.boardOps.listCastableModels.invalidate(),
          // Linked placements render the model's live sourceName unless the
          // user gave that one node a custom label. Refresh every active board
          // query so the saved draft label replaces the "Cast" placeholder.
          utils.boards.getItems.invalidate(),
        ]).catch(() => undefined);
      })
      .catch(() => {
        toast.error("Couldn't save the name — it will not be remembered");
      });
  }, [
    currentModelId,
    isMintedEdit,
    modelNameInStore,
    persistedModel.data?.name,
    setShowCastModal,
    updateDraftName,
    utils,
  ]);

  const hasHeadshot = currentAssets.some((a) => a.viewType === 'frontClose' && a.storageUrl);
  const needsBoardLanding = !draftLanded && (!editContext || !!editContext.originNeedsLanding);

  // Unsaved work: minted edits = a non-empty identity diff; authoring
  // sessions = a draft in progress (which persists server-side either way)
  const unsavedDiff = useCallback(() => {
    if (!isMintedEdit || !baselinePrefs) return null;
    const diff = diffPreferences(baselinePrefs as unknown as ModelPreferences, prefs);
    return Object.keys(diff.changes).length > 0 ? diff : null;
  }, [isMintedEdit, baselinePrefs, prefs]);

  // Authoring sessions: a landed draft (D-55) means closing abandons
  // nothing — the node carries the work; only an in-flight generation
  // still warrants the confirm
  const workInProgress = isMintedEdit
    ? unsavedDiff() !== null
    : genState.isGenerating
      || (isCasting && castingOperation !== 'mint')
      || (currentModelId !== null && !draftLanded);

  const attemptClose = useCallback(() => {
    // A true mint still owns a synchronous landing ceremony. Add Views and
    // upgrades are background-safe and must honor the continuation copy.
    if (isCasting && castingOperation === 'mint') return;
    if (workInProgress) {
      setConfirmingLeave(true);
      return;
    }
    startClose();
  }, [isCasting, castingOperation, workInProgress, startClose]);

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

  // A1 stage 2: the fork-guidance banner's Fork door — the refused edit
  // routes into the SAME D-11 fork ceremony as Save changes, carried as the
  // fork's casting note (`features`), so "fork with this edit" is one flow.
  useEffect(() => {
    if (!isMintedEdit) return;
    const onForkFromRefusal = (e: Event) => {
      const editText = (e as CustomEvent<{ editText: string }>).detail?.editText ?? '';
      setIdentityDialog({
        changes: { features: editText },
        labels: ['the requested change'],
      });
    };
    window.addEventListener('casting-fork-from-refusal', onForkFromRefusal);
    return () => window.removeEventListener('casting-fork-from-refusal', onForkFromRefusal);
  }, [isMintedEdit]);
  useEffect(() => {
    if (!showCastModal) setUpgradeMode(false);
  }, [showCastModal]);

  // R5/D-51 upgrade intent: the board's "Build comp card"/"Complete card"
  // verb (and ghost tiles) arrive with the dialog pre-opened — once the
  // session has hydrated, so the tier plan reads the real model
  const openedUpgradeIntentRef = useRef(false);
  useEffect(() => {
    if (!editContext?.openUpgrade || openedUpgradeIntentRef.current || !hydrated) return;
    openedUpgradeIntentRef.current = true;
    setUpgradeMode(isMintedEdit);
    setShowCastModal(true);
  }, [editContext?.openUpgrade, hydrated, isMintedEdit, setShowCastModal]);

  const packageHealthOpen = useCastingRefreshStore((s) => s.packageHealthOpen);

  // Esc closes (capture so board-level handlers never see it while we're up)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (showCastModal || isTopupOpen || identityDialog || packageHealthOpen) return; // inner surfaces own their Esc
      if (confirmingLeave) {
        setConfirmingLeave(false);
        return;
      }
      attemptClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [attemptClose, confirmingLeave, showCastModal, isTopupOpen, identityDialog, packageHealthOpen]);

  // Founder ruling (Batch C final corrections): a minted identity must never
  // present as editable-in-place. This session is honestly framed as the
  // locked cast whose only identity door is FORK; the proper read-only Cast
  // Profile with additive view generation is the recorded R7 deliverable.
  const displayModelName = honestModelName(modelNameInStore);
  const title = isMintedEdit
    ? `${displayModelName || 'Cast'} — identity locked`
    : editContext?.draft
      ? displayModelName ? `${displayModelName} — finish this cast` : 'Finish this cast'
      : currentModelId && displayModelName
        ? `${displayModelName} — draft`
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
          background: 'var(--color-canvas-field)',
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
            className="w-7 h-7 rounded-canvas-sm flex items-center justify-center transition-colors text-canvas-ink-soft hover:bg-canvas-surface-inset"
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
          </button>
          <span className="truncate text-canvas-lg font-medium text-canvas-ink">{title}</span>
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
                className="px-2 py-1 rounded-canvas-sm transition-colors text-canvas-md text-canvas-ink-soft hover:bg-canvas-surface-inset"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {creditsData.balance.toLocaleString()} credits
              </button>
              <span aria-hidden className="w-px h-4 mr-1 bg-canvas-border" />
            </>
          )}
          {/* R6 ruling R-3(a): same anchor, different weight. The paid path
              ("Cast this model" → the plan-priced tier dialog) wears the dark
              pill; "Save changes" (→ the D-11 decision dialog) wears a quiet
              outline — different action weights, same stable coordinates. No
              cost on the header pill: the tier dialog is the D-15 cost
              surface, and a header label would have to guess a tier. */}
          {isMintedEdit ? (
            // Founder ruling: the door says where it leads BEFORE the user
            // attempts a save — a minted identity only changes by forking
            <button
              type="button"
              disabled={!hydrated || genState.isGenerating}
              onClick={handleSaveChanges}
              className="px-4 py-1.5 rounded-canvas-pill transition-colors duration-200 disabled:opacity-40 text-canvas-md font-medium text-canvas-ink-soft bg-canvas-surface border-hairline border-canvas-border-strong hover:text-canvas-ink hover:border-canvas-ink"
            >
              Fork changes
            </button>
          ) : (
            <button
              type="button"
              disabled={!hasHeadshot || isCasting || genState.isGenerating}
              onClick={() => setShowCastModal(true)}
              className="px-4 py-1.5 rounded-canvas-pill transition-opacity duration-200 disabled:opacity-40 text-canvas-md font-medium bg-canvas-ink hover:opacity-90"
              style={{ color: 'var(--color-canvas-surface)' }}
            >
              {isCasting ? 'Casting…' : 'Cast this model'}
            </button>
          )}
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Close"
            className="w-7 h-7 rounded-canvas-sm flex items-center justify-center transition-colors text-canvas-ink-soft hover:bg-canvas-surface-inset"
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
          onBackgroundDraftReady={onBackgroundDraftReady}
        />
        {/* Cold-mount loader (P1): edit sessions hydrate the model first —
            never flash the default studio */}
        {editContext && !hydrated && (
          <div className="absolute inset-0 z-10" style={{ background: 'var(--color-canvas-field)' }}>
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
            className="relative rounded-canvas-lg p-5 bg-canvas-surface border-hairline border-canvas-border-strong"
            style={{ width: 380 }}
          >
            <p className="text-canvas-lg font-medium text-canvas-ink mb-1.5">
              {isMintedEdit ? 'Leave editing?' : 'Leave casting?'}
            </p>
            <p className="text-canvas-md text-canvas-ink-soft mb-4" style={{ lineHeight: 1.55 }}>
              {isMintedEdit
                ? 'Unsaved identity changes are discarded — the placed cast stays as it is.'
                : isCasting && castingOperation !== 'mint'
                  ? 'Your new views will keep generating and appear on this card when they are ready.'
                : genState.isGenerating && !hasHeadshot && needsBoardLanding
                  ? 'Generation will continue and save to Drafts. Until the headshot is ready, this node stays empty.'
                  : hasHeadshot && needsBoardLanding
                    ? genState.isGenerating
                      ? 'Your draft will be placed on this board before Casting closes. The in-flight change will keep saving to this draft.'
                      : 'Your draft will be placed on this board before Casting closes.'
                    : genState.isGenerating
                      ? 'Your draft is already saved. The in-flight change will keep saving to it.'
                      : 'Your draft is already saved. Closing Casting will not delete it.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingLeave(false);
                  startClose();
                }}
                className="px-3.5 py-1.5 rounded-canvas-pill transition-colors text-canvas-md font-medium text-canvas-ink-soft border-hairline border-canvas-border-strong hover:bg-canvas-surface-inset"
              >
                Leave
              </button>
              <button
                type="button"
                onClick={() => setConfirmingLeave(false)}
                className="px-3.5 py-1.5 rounded-canvas-pill transition-opacity hover:opacity-90 text-canvas-md font-medium bg-canvas-ink"
                style={{ color: 'var(--color-canvas-surface)' }}
              >
                {isMintedEdit ? 'Keep editing' : 'Keep casting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The D-11 identity dialog (minted edits only). Finding 7: the
          dialog stays open through the round-trip — the takeover (and the
          user's changes) survive a free server refusal, which renders here
          in context. Success closes the dialog; the host closes the room. */}
      {identityDialog && editContext && (
        <IdentityChangeDialog
          boardId={editContext.boardId}
          itemId={editContext.itemId}
          changedLabels={identityDialog.labels}
          contextOnly={Object.keys(identityDialog.changes).every((k) =>
            k === 'castingBrand' || k === 'castingVibe',
          )}
          pending={identityCommitPending}
          errorMessage={identityCommitError}
          onCancel={() => {
            if (identityCommitPending) return;
            setIdentityDialog(null);
            setIdentityCommitError(null);
          }}
          onCommit={(decision) => {
            const changes = identityDialog.changes;
            setIdentityCommitPending(true);
            setIdentityCommitError(null);
            Promise.resolve(onIdentityCommit(decision, changes))
              .then(() => {
                setIdentityDialog(null);
              })
              .catch((err: unknown) => {
                setIdentityCommitError(
                  err instanceof Error && err.message
                    ? err.message
                    : 'The fork was refused — nothing was charged.',
                );
              })
              .finally(() => setIdentityCommitPending(false));
          }}
        />
      )}

      <CastModelModal
        isOpen={showCastModal}
        onClose={dismissCastModal}
        onConfirm={(name, tier, stayDraft) => handleCastAndContinue(name, tier, upgradeMode, stayDraft)}
        tiers={tierPlan}
        integrity={mintIntegrity}
        isCasting={isCasting}
        viewsGenerating={viewsGenerating}
        castingMessage={castingMessage}
        previewImage={currentAssets.find((a) => a.viewType === 'frontClose')?.storageUrl}
        mode={upgradeMode ? 'upgrade' : 'mint'}
        fixedName={upgradeMode ? modelNameInStore : undefined}
        initialName={!upgradeMode ? displayModelName : undefined}
        onResolvePackage={() => openPackageHealth()}
        // Defect 4: an existing placed draft's tier dialog leads with adding
        // views; a fresh cast leads with mint. Every door says where it leads.
        existingDraft={!!editContext?.draft}
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
