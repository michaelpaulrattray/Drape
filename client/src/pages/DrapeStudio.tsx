import { useCallback, useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';

// Studio infrastructure
import { useStudioStore } from '@/features/studio/stores/useStudioStore';
import { StudioSlimHeader } from '@/features/studio/components/StudioSlimHeader';
import { WardrobeStart } from '@/features/studio/components/WardrobeStart';
import { CastingWorkspace } from '@/features/studio/components/CastingWorkspace';
import { useStudioTransition } from '@/features/studio/hooks/useStudioTransition';
import { useStudioEntry } from '@/features/studio/hooks/useStudioEntry';

// Wardrobe tool imports
import { WardrobeWorkspaceSection } from '@/features/wardrobe';
import { useWardrobeStore } from '@/features/wardrobe/stores/useWardrobeStore';

// Casting tool imports
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';
import { BillingModal } from '@/features/billing/BillingModal';
import { ReferralModal } from '@/features/referral/ReferralModal';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import { showLowBalanceToast, LOW_BALANCE_THRESHOLD } from '@/features/billing/LowBalanceWarning';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { useDebugShortcuts } from '@/features/studio/hooks/useDebugShortcuts';
import { CastModelModal, draftNameToPersist } from '@/features/studio/components/CastModelModal';
import { useCastGate } from '@/features/studio/hooks/useCastGate';
import { useSessionRestore, useSessionAutoSave, clearPersistedSession } from '@/features/studio/hooks/useSessionPersistence';
import { openCastingDetails } from '@/features/casting/components/PackageHealthDialog';
import { honestModelName } from '@/features/casting/modelDisplayTruth';
import { publishCastProjectionChanged } from '@/features/operations/castProjectionSync';
import type { MintTier } from '@shared/boardTypes';

export default function DrapeStudio() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();

  // Studio store
  const { activeTool, canvas, setCanvas, wardrobeStart } = useStudioStore();
  const modelName = useCastingFormStore((s) => s.modelName);
  const [upgradeMode, setUpgradeMode] = useState(false);
  const [requestedTier, setRequestedTier] = useState<MintTier>('core');

  // Sidebar: profile, billing, referral modals
  const [showSettings, setShowSettings] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [isReferralOpen, setIsReferralOpen] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const { data: profileData, refetch: refetchProfile } = trpc.profile.get.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );
  useEffect(() => {
    if (profileData?.avatarUrl) setProfileImage(profileData.avatarUrl);
    if (profileData?.bannerUrl) setBannerImage(profileData.bannerUrl);
  }, [profileData?.avatarUrl, profileData?.bannerUrl]);

  // Orchestrated transition phases
  const baseTransition = useStudioTransition(activeTool);
  const transition = baseTransition;

  // Session persistence — restore on mount, auto-save on changes
  const { isRestoring } = useSessionRestore(isAuthenticated);
  useSessionAutoSave();

  // URL-driven entry: resolves ?tool/?new/?modelId/?sessionId once auth
  // and the localStorage restore have settled; bare /studio → /app.
  const { entryStatus } = useStudioEntry({ isAuthenticated, isRestoring });

  // Null-tool watcher — with the studio lobby retired, landing on
  // activeTool=null without the wardrobe-start screen means "leave the
  // studio" (e.g. sidebar Home reset). Gated on entryStatus so it cannot
  // fire while the async entry above is still resolving (see the
  // invariants documented in useStudioEntry).
  useEffect(() => {
    if (entryStatus !== 'settled') return;
    if (activeTool === null && !wardrobeStart) {
      navigate('/app');
    }
  }, [entryStatus, activeTool, wardrobeStart, navigate]);

  // Casting stores — only what the studio shell itself needs; the casting
  // surface's own wiring lives in CastingWorkspace (shared with the D-35
  // board takeover)
  const { currentModelId, currentAssets, genState } = useCastingGenerationStore();
  const { isTopupOpen, setIsTopupOpen } = useCastingUIStore();
  const utils = trpc.useUtils();
  const persistedModel = trpc.models.get.useQuery(
    { modelId: currentModelId ?? 0 },
    { enabled: currentModelId != null, staleTime: 0 },
  );
  const updateDraftName = trpc.models.update.useMutation();
  const hasHeadshot = currentAssets.some(
    (asset) => asset.viewType === 'frontClose' && Boolean(asset.storageUrl),
  );

  // Credits for the sidebar / top-up / cast gate (same query key as the
  // workspace's internal query — TanStack dedupes)
  const { data: creditsData, refetch: refetchCredits } = trpc.credits.getBalance.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );
  const refetchCreditsWithWarning = useCallback(async () => {
    const result = await refetchCredits();
    const newBalance = result.data?.balance;
    if (newBalance !== undefined && newBalance < LOW_BALANCE_THRESHOLD) {
      showLowBalanceToast(newBalance, () => setIsTopupOpen(true));
    }
  }, [refetchCredits, setIsTopupOpen]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [authLoading, isAuthenticated, navigate]);

  // Pre-launch gate
  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !user.approved && user.role !== 'admin') {
      navigate('/login?error=no_code');
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Keyboard shortcuts (admin debug)
  useDebugShortcuts();

  // Read-only: locked only for minted models (drafts remain editable).
  // A minted-EDIT session (R3, shared state — survives a takeover→/studio
  // resume) is editable: its saves route through the D-11 dialog instead.
  const mintedEditContext = useStudioStore((s) => s.mintedEditContext);
  const isReadOnly = activeTool === 'casting' && canvas.isMinted && !mintedEditContext;

  const isNonCastModel = activeTool === 'casting' && canvas.modelSource === 'uploaded';

  // New Model — resets entire session, then stays in casting (with the
  // lobby gone, landing on activeTool=null would bounce to /app)
  const handleNewModel = useCallback(() => {
    useStudioStore.getState().resetStudio();
    useCastingGenerationStore.getState().resetGeneration();
    useCastingFormStore.getState().resetForm();
    useWardrobeStore.getState().resetWardrobe();
    clearPersistedSession();
    useStudioStore.getState().setActiveTool('casting');
    toast.success('Starting fresh canvas');
  }, []);

  // ── Cast Model Gate ──────────────────────────────────────
  const {
    showCastModal,
    setShowCastModal,
    isCasting,
    viewsGenerating,
    castingMessage,
    tierPlan,
    mintIntegrity,
    handleCastAndContinue,
  } = useCastGate({
    currentModelId,
    currentAssets,
    refetchCreditsWithWarning,
  });

  const dismissCastModal = useCallback((typedName: string) => {
    setShowCastModal(false);
    const nextName = typedName.trim();
    if (!nextName || canvas.isMinted) return;

    // W6-C: before a model row exists, the label stays with the form and
    // rides the existing models.create name field. Once a row exists, save
    // through the display-name-only route; this can never mint the model.
    useCastingFormStore.getState().setModelName(nextName);
    if (currentModelId == null) return;

    const pendingName = draftNameToPersist(
      nextName,
      persistedModel.data?.name ?? modelName,
    );
    if (!pendingName) return;

    void updateDraftName.mutateAsync({ modelId: currentModelId, name: pendingName })
      .then(() => {
        publishCastProjectionChanged(currentModelId);
        // Cache refresh is follow-up optics, not part of the durable save.
        // Its failure must never falsely claim the name was forgotten.
        void Promise.all([
          utils.models.get.invalidate({ modelId: currentModelId }),
          utils.boardOps.listCastableModels.invalidate(),
          utils.boards.getItems.invalidate(),
        ]).catch(() => undefined);
      })
      .catch(() => {
        toast.error("Couldn't save the name — it will not be remembered");
      });
  }, [
    canvas.isMinted,
    currentModelId,
    modelName,
    persistedModel.data?.name,
    setShowCastModal,
    updateDraftName,
    utils,
  ]);

  // A view-strip ghost opens the mint gate (D-46 one view system — in /studio
  // every model is a draft until cast, so "add a view" is a mint away)
  useEffect(() => {
    const tierFromEvent = (event: Event): MintTier => {
      const tier = (event as CustomEvent<{ tier?: MintTier }>).detail?.tier;
      return tier === 'production' || tier === 'draft' ? tier : 'core';
    };
    const onMint = (event: Event) => {
      if (canvas.isMinted) return;
      setRequestedTier(tierFromEvent(event));
      setUpgradeMode(false);
      setShowCastModal(true);
    };
    const onUpgrade = (event: Event) => {
      if (!canvas.isMinted) return;
      setRequestedTier(tierFromEvent(event));
      setUpgradeMode(true);
      setShowCastModal(true);
    };
    window.addEventListener('casting-open-mint', onMint);
    window.addEventListener('casting-open-package-upgrade', onUpgrade);
    return () => {
      window.removeEventListener('casting-open-mint', onMint);
      window.removeEventListener('casting-open-package-upgrade', onUpgrade);
    };
  }, [canvas.isMinted, setShowCastModal]);

  useEffect(() => {
    if (!showCastModal) {
      setUpgradeMode(false);
      setRequestedTier('core');
    }
  }, [showCastModal]);

  // Full-body URL for wardrobe (uploaded > gallery > casting asset)
  const fullBodyUrl = useMemo(() => {
    if (canvas.uploadedModelUrl) return canvas.uploadedModelUrl;
    if (canvas.castFullBodyUrl) return canvas.castFullBodyUrl;
    const fullBodyAsset = currentAssets.find((a) => a.viewType === 'frontFull' && a.storageUrl);
    return fullBodyAsset?.storageUrl || null;
  }, [canvas.uploadedModelUrl, canvas.castFullBodyUrl, currentAssets]);

  // Loading state — held until the URL entry has resolved, so no stale
  // tool (or nothing at all) flashes while an async resume is in flight
  if (authLoading || isRestoring || entryStatus === 'resolving') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-canvas-field)' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1a1a1a' }} />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'var(--color-canvas-field)' }}>
      {/* One environment chrome, two doors (R6 shell unification, R-4a):
          the same slim header regardless of tool — casting AND wardrobe.
          The legacy sidebar's load-bearing functions live in it now. */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <StudioSlimHeader
          title={activeTool === 'wardrobe' ? 'Wardrobe' : activeTool === 'casting' ? 'Casting' : 'Studio'}
          user={user}
          profileImage={profileImage}
          creditsBalance={creditsData?.balance || 0}
          onOpenTopup={() => setIsTopupOpen(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenBilling={() => setIsBillingOpen(true)}
          onOpenReferral={() => setIsReferralOpen(true)}
          onLogout={logout}
          primaryAction={
            activeTool === 'casting' && currentModelId !== null && !canvas.isMinted && hasHeadshot
              ? {
                  label: isCasting ? 'Casting...' : 'Cast this model',
                  disabled: isCasting || genState.isGenerating,
                  onClick: () => setShowCastModal(true),
                }
              : undefined
          }
        />

        {/* Tool Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
          {/* Wardrobe start — pick/upload a model (no session to resume) */}
          {activeTool === null && wardrobeStart && (
            <div
              className="flex-1 min-h-0 flex"
              style={{
                opacity: transition.lobbyVisible ? 1 : 0,
                transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <WardrobeStart />
            </div>
          )}

          {activeTool === 'casting' && isNonCastModel && (
            <div
              className="flex-1 flex items-center justify-center"
              style={{
                opacity: transition.centerReady ? 1 : 0,
                transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div className="text-center" style={{ maxWidth: 340 }}>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(0,0,0,0.04)' }}
                >
                  <Camera className="w-6 h-6" style={{ color: '#71716A' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
                  This model was not cast
                </p>
                <p style={{ fontSize: 12, color: '#71716A', lineHeight: 1.5, marginBottom: 20 }}>
                  This model was loaded without casting data. To use the Casting Studio,
                  start a new model from scratch.
                </p>
                <button
                  onClick={handleNewModel}
                  className="px-5 py-2.5 rounded-full text-white transition-all duration-200"
                  style={{ background: '#1a1a1a', fontSize: 12, fontWeight: 500 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#1a1a1a'; }}
                >
                  Cast New Model
                </button>
              </div>
            </div>
          )}

          {activeTool === 'casting' && !isNonCastModel && (
            <CastingWorkspace
              user={user}
              isAuthenticated={isAuthenticated}
              isReadOnly={isReadOnly}
              onNewModel={handleNewModel}
              leftReady={transition.leftReady}
              rightReady={transition.rightReady}
            />
          )}

          {/* Wardrobe workspace — panels slide in from edges */}
          {activeTool === 'wardrobe' && (
            <WardrobeWorkspaceSection
              modelImageUrl={fullBodyUrl}
              modelId={canvas.castModelId}
              leftReady={transition.leftReady}
              centerReady={transition.centerReady}
              rightReady={transition.rightReady}
            />
          )}

        </div>
      </div>

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
        fixedName={upgradeMode ? honestModelName(modelName, persistedModel.data?.name) : undefined}
        initialName={!upgradeMode ? honestModelName(modelName) : undefined}
        initialTier={requestedTier}
        onResolvePackage={() => openCastingDetails()}
      />

      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />

      {/* Sidebar modals — settings, billing, referral */}
      <ProfileSettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onProfileUpdate={() => refetchProfile()}
        user={user}
        profileImage={profileImage}
        bannerImage={bannerImage}
        onProfileImageChange={setProfileImage}
        onBannerImageChange={setBannerImage}
        creditsBalance={creditsData?.balance || 0}
        planTier={creditsData?.planTier || 'free'}
        onOpenBilling={() => { setShowSettings(false); setIsBillingOpen(true); }}
        onOpenTopup={() => { setShowSettings(false); setIsTopupOpen(true); }}
        defaultAvatar=""
        defaultBanner=""
      />

      <BillingModal
        isOpen={isBillingOpen}
        onClose={() => setIsBillingOpen(false)}
        onOpenTopup={() => { setIsBillingOpen(false); setIsTopupOpen(true); }}
      />

      <ReferralModal
        open={isReferralOpen}
        onClose={() => setIsReferralOpen(false)}
      />
    </div>
  );
}
