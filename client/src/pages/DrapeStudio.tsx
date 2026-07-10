import { useCallback, useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';

// Studio infrastructure
import { useStudioStore } from '@/features/studio/stores/useStudioStore';
import { AppSidebar } from '@/features/studio/components/AppSidebar';
import { StudioHeader } from '@/features/studio/components/StudioHeader';
import { WardrobeStart } from '@/features/studio/components/WardrobeStart';
import { buildHistoryFromAssets } from '@/features/casting/utils/buildHistoryFromAssets';
import { AnimatedPanel } from '@/features/studio/components/AnimatedPanel';
import { StudioSidePanel } from '@/features/studio/components/StudioSidePanel';
import { useStudioTransition } from '@/features/studio/hooks/useStudioTransition';
import { useStudioEntry } from '@/features/studio/hooks/useStudioEntry';

// Wardrobe tool imports
import { WardrobeWorkspaceSection } from '@/features/wardrobe';
import { useWardrobeStore } from '@/features/wardrobe/stores/useWardrobeStore';

// Export tool imports
import { ExportPanel, ExportHeroPreview } from '@/features/export';

// Casting tool imports
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';
import { BillingModal } from '@/features/billing/BillingModal';
import { ReferralModal } from '@/features/referral/ReferralModal';
import ProfileSettingsModal from '@/components/ProfileSettingsModal';
import { useCastingFormStore } from '@/features/casting/stores/useCastingFormStore';
import { useCastingGenerationStore } from '@/features/casting/stores/useCastingGenerationStore';
import { useCastingUIStore } from '@/features/casting/stores/useCastingUIStore';
import { ControlPanel } from '@/features/casting/ControlPanel';
import { ImageViewerPanel } from '@/features/casting/ImageViewerPanel';
import { MasterPromptPanel } from '@/features/casting/MasterPromptPanel';
import { StageLockModal } from '@/features/casting/StageLockModal';
import { ExportModal } from '@/features/casting/ExportModal';
import { useCastingCanvas } from '@/features/casting/hooks/useCastingCanvas';
import { useCastingGeneration } from '@/features/casting/hooks/useCastingGeneration';
import { useCastingExport } from '@/features/casting/hooks/useCastingExport';
import { useCastingViewGeneration } from '@/features/casting/hooks/useCastingViewGeneration';
import { useDebugShortcuts } from '@/features/studio/hooks/useDebugShortcuts';
import { useImagePreloader } from '@/features/studio/hooks/useImagePreloader';
import { CastModelModal } from '@/features/studio/components/CastModelModal';
import { useCastGate } from '@/features/studio/hooks/useCastGate';
import { useSessionRestore, useSessionAutoSave, clearPersistedSession } from '@/features/studio/hooks/useSessionPersistence';

export default function DrapeStudio() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();

  // Studio store
  const { activeTool, canvas, setCanvas, wardrobeStart } = useStudioStore();

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

  // Eagerly preload casting images into browser cache (warm S3 URLs)
  const castingAssets = useCastingGenerationStore((s) => s.currentAssets);
  const castingAssetUrls = useMemo(
    () => activeTool === 'casting' ? castingAssets.map((a) => a.storageUrl) : [],
    [activeTool, castingAssets],
  );
  useImagePreloader(castingAssetUrls); // cache-warm only, don't gate transitions
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

  // Casting stores
  const { prefs, modelName } = useCastingFormStore();
  const {
    genState,
    setGenState,
    currentModelId,
    currentAssets,
  } = useCastingGenerationStore();
  const {
    activeView,
    activeTool: castingActiveTool,
    showExportModal,
    setShowExportModal,
    lockModal,
    closeLockModal,
    isTopupOpen,
    setIsTopupOpen,
  } = useCastingUIStore();

  // Sync casting assets → shared canvas (skip for uploaded/gallery models)
  useEffect(() => {
    const isExternalModel = canvas.modelSource === 'uploaded' || canvas.castModelId !== null;
    if (isExternalModel) return;

    const hasModel = currentAssets.some((a) => a.viewType === 'frontClose' && a.storageUrl);
    const hasFullBody = currentAssets.some((a) => a.viewType === 'frontFull' && a.storageUrl);
    const hasAllViews =
      hasModel &&
      hasFullBody &&
      currentAssets.some((a) => a.viewType === 'sideClose' && a.storageUrl);

    setCanvas({
      hasModel,
      hasFullBody,
      hasAllViews,
      modelSource: currentModelId ? 'cast' : canvas.modelSource,
    });
  }, [currentAssets, currentModelId]);

  // Canvas drawing hook
  const {
    canvasRef,
    imageRef,
    maskPaths,
    isMasking,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    getGuideOverlayDataUrl,
    clearMask,
  } = useCastingCanvas(castingActiveTool, activeView, currentAssets);

  // Generation hook
  const {
    creditsData,
    refetchCreditsWithWarning,
    isFormValid,
    currentImageUrl,
    isViewLocked,
    hasDownstreamDependencies,
    isIterationAllowed,
    handleGenerate,
    handleRefineSubmit,
    handleEnhance,
    handleRetry,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useCastingGeneration({
    isAuthenticated,
    activeTool: castingActiveTool,
    isMasking,
    getGuideOverlayDataUrl,
    clearMask,
  });

  // View generation hook
  const { nextStage } = useCastingViewGeneration({
    isAuthenticated,
    creditsData,
    refetchCreditsWithWarning,
  });

  // Export hook
  const { handleExport } = useCastingExport({
    currentModelId,
    currentAssets,
    genState,
    setGenState,
    setShowExportModal,
  });

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

  // Hydrate casting store for gallery-loaded models (assets in DB, not Zustand)
  const modelAssetsQuery = trpc.models.get.useQuery(
    { modelId: canvas.castModelId! },
    {
      enabled: activeTool === 'casting' && canvas.castModelId !== null && currentAssets.length === 0,
      retry: false,
    }
  );

  useEffect(() => {
    if (!modelAssetsQuery.data) return;
    if (currentAssets.length > 0) return; // already hydrated

    const model = modelAssetsQuery.data;
    const assets = (model.assets || []) as Array<{ id: number; viewType: string; storageUrl: string }>;
    const genStore = useCastingGenerationStore.getState();

    const { history, historyIndex, currentAssets: rebuilt } = buildHistoryFromAssets(assets);

    if (rebuilt.length > 0) {
      genStore.setCurrentModelId(model.id);
      genStore.setCurrentAssets(rebuilt);
      genStore.setHistory(history);
      genStore.setHistoryIndex(historyIndex);
      useCastingGenerationStore.setState({ historyAmendments: history.map(() => []) });
      if (model.masterPrompt) {
        genStore.setCurrentMasterPrompt(model.masterPrompt);
      }
    }
    // Restore form preferences so ControlPanel shows actual model identity
    if ((model as any).preferences) {
      const formStore = useCastingFormStore.getState();
      formStore.setPrefs((model as any).preferences as any);
      formStore.setModelName(model.name || '');
    }
  }, [modelAssetsQuery.data, currentAssets.length]);

  // Read-only: locked only for minted models (drafts remain editable)
  const isReadOnly = activeTool === 'casting' && canvas.isMinted;

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
    castingMessage,
    needsSideView,
    handleCastAndContinue,
  } = useCastGate({
    currentModelId,
    currentAssets,
    refetchCreditsWithWarning,
  });

  // Full-body URL for wardrobe (uploaded > gallery > casting asset)
  const fullBodyUrl = useMemo(() => {
    if (canvas.uploadedModelUrl) return canvas.uploadedModelUrl;
    if (canvas.castFullBodyUrl) return canvas.castFullBodyUrl;
    const fullBodyAsset = currentAssets.find((a) => a.viewType === 'frontFull' && a.storageUrl);
    return fullBodyAsset?.storageUrl || null;
  }, [canvas.uploadedModelUrl, canvas.castFullBodyUrl, currentAssets]);

  // Form completion progress (12 fields)
  const formProgress = useMemo(() => {
    const c = [!!prefs.castingBrand, !!(prefs.castingVibe && (prefs.castingVibe.editorial > 0 || prefs.castingVibe.commercial > 0 || prefs.castingVibe.runway > 0)), !!prefs.gender, !!(prefs.age && prefs.ethnicity), !!prefs.bodyType, !!prefs.faceShape, !!prefs.skinTone, !!(prefs.skinTexture || prefs.skinFinish), !!prefs.eyeColor, !!prefs.eyeColor, !!prefs.hairColor, !!prefs.hairStyle];
    return Math.round((c.filter(Boolean).length / 12) * 100);
  }, [prefs]);

  // Loading state — held until the URL entry has resolved, so no stale
  // tool (or nothing at all) flashes while an async resume is in flight
  if (authLoading || isRestoring || entryStatus === 'resolving') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#FAFAF8' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1a1a1a' }} />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#FAFAF8' }}>
      {/* App Sidebar — full viewport height */}
      <AppSidebar
        canvas={canvas}
        onWardrobeGate={() => setShowCastModal(true)}
        user={user}
        profileImage={profileImage}
        creditsBalance={creditsData?.balance || 0}
        planTier={creditsData?.planTier || 'free'}
        onOpenSettings={() => setShowSettings(true)}
        onOpenBilling={() => setIsBillingOpen(true)}
        onOpenReferral={() => setIsReferralOpen(true)}
        onLogout={logout}
      />

      {/* Right side: Header + Content */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Studio Header — spans content area only */}
        <StudioHeader />

        {/* Stage Lock Modal */}
        <StageLockModal
          isOpen={lockModal.isOpen}
          title={lockModal.title}
          message={lockModal.message}
          onConfirm={lockModal.onConfirm}
          onCancel={closeLockModal}
        />

        {/* Export Modal */}
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExport={handleExport}
          previewImage={
            currentAssets.find((a) => a.viewType === 'frontClose')?.storageUrl ?? undefined
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
            <>
              {/* Left Panel — Control (slides from left) */}
              <AnimatedPanel
                ready={transition.leftReady}
                from="left"
                offset={60}
                duration={500}
                className="w-full lg:w-auto flex-shrink-0 relative z-10"
              >
                <StudioSidePanel side="left" width={320}>
                  <ControlPanel
                    user={user}
                    isFormValid={isFormValid}
                    genState={genState}
                    currentAssets={currentAssets}
                    handleGenerate={handleGenerate}
                    isReadOnly={isReadOnly}
                    onNewModel={handleNewModel}
                    modelName={modelName}
                  />
                </StudioSidePanel>
              </AnimatedPanel>

              {/* Center — Image Viewer */}
              <div className="flex-1 min-w-0 h-full relative">
                <ImageViewerPanel
                  currentImageUrl={currentImageUrl ?? undefined}
                  currentAssets={currentAssets}
                  genState={genState}
                  isViewLocked={isViewLocked}
                  hasDownstreamDependencies={hasDownstreamDependencies}
                  isIterationAllowed={isIterationAllowed}
                  isMasking={isMasking}
                  maskPathsCount={maskPaths.length}
                  formProgress={formProgress}
                  nextStage={nextStage}
                  canvasRef={canvasRef}
                  imageRef={imageRef}
                  handlePointerDown={handlePointerDown}
                  handlePointerMove={handlePointerMove}
                  handlePointerUp={handlePointerUp}
                  handleUndo={handleUndo}
                  handleRedo={handleRedo}
                  handleRetry={handleRetry}
                  handleGenerate={handleGenerate}
                  handleEnhance={handleEnhance}
                  handleRefineSubmit={handleRefineSubmit}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  isReadOnly={isReadOnly}
                />
              </div>

              {/* Right Panel — Master Prompt (slides from right) */}
              <AnimatedPanel
                ready={transition.rightReady}
                from="right"
                offset={60}
                duration={500}
                className="hidden lg:block flex-shrink-0"
              >
                <StudioSidePanel side="right" width={320}>
                  <MasterPromptPanel />
                </StudioSidePanel>
              </AnimatedPanel>
            </>
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

          {activeTool === 'export' && (
            <>
              {/* Center — Model preview (largest view or latest saved look) */}
              <ExportHeroPreview
                assets={currentAssets}
                modelId={canvas.castModelId || currentModelId}
                centerReady={transition.centerReady}
              />

              {/* Right Panel — Export controls */}
              <AnimatedPanel
                ready={transition.rightReady}
                from="right"
                offset={60}
                duration={500}
                className="hidden lg:block flex-shrink-0"
              >
                <StudioSidePanel side="right" width={320}>
                  <ExportPanel modelId={canvas.castModelId || currentModelId} assets={currentAssets} />
                </StudioSidePanel>
              </AnimatedPanel>
            </>
          )}
        </div>
      </div>

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
