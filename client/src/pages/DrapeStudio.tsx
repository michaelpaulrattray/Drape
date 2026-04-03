import { useCallback, useEffect, useMemo, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLocation, useSearch } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Camera, Loader2 } from 'lucide-react';

// Studio infrastructure
import { useStudioStore } from '@/features/studio/stores/useStudioStore';
import { ToolRail } from '@/features/studio/components/ToolRail';
import { StudioHeader } from '@/features/studio/components/StudioHeader';
import { StudioLobby } from '@/features/studio/components/StudioLobby';
import type { DraftModel } from '@/features/studio/components/DraftCastsRow';
import { buildHistoryFromAssets } from '@/features/casting/utils/buildHistoryFromAssets';
import { AnimatedPanel } from '@/features/studio/components/AnimatedPanel';
import { StudioSidePanel } from '@/features/studio/components/StudioSidePanel';
import { useStudioTransition } from '@/features/studio/hooks/useStudioTransition';
import type { StudioTool } from '@/features/studio/types';

// Wardrobe tool imports
import { WardrobeWorkspaceSection } from '@/features/wardrobe';
import { useWardrobeStore } from '@/features/wardrobe/stores/useWardrobeStore';

// Export tool imports
import { ExportPanel, ExportHeroPreview } from '@/features/export';

// Casting tool imports
import { CreditTopupModal } from '@/features/billing/CreditTopupModal';
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

/** Valid tool query param values */
const VALID_TOOLS: StudioTool[] = ['casting', 'wardrobe', 'export'];

export default function DrapeStudio() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Studio store
  const { activeTool, setActiveTool, canvas, setCanvas } = useStudioStore();

  // tRPC utils for imperative fetching (draft resume)
  const trpcUtils = trpc.useUtils();

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

  // Always start in lobby on mount, then check for ?tool= override
  useEffect(() => {
    setActiveTool(null); // Reset to lobby on every navigation to /studio
    const params = new URLSearchParams(searchString);
    const toolParam = params.get('tool') as StudioTool | null;
    if (toolParam && VALID_TOOLS.includes(toolParam)) {
      setActiveTool(toolParam);
    }
  }, []); // Only on mount

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

  // New Model — resets entire session
  const handleNewModel = useCallback(() => {
    useStudioStore.getState().resetStudio();
    useCastingGenerationStore.getState().resetGeneration();
    useCastingFormStore.getState().resetForm();
    useWardrobeStore.getState().resetWardrobe();
    clearPersistedSession();
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

  // Loading state
  if (authLoading || isRestoring) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#FAFAF8' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1a1a1a' }} />
      </div>
    );
  }

  const isLobby = activeTool === null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#FAFAF8' }}>
      {/* Studio Header */}
      <StudioHeader
        creditsBalance={creditsData?.balance || 0}
        planTier={creditsData?.planTier || 'free'}
      />

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

      {/* Main workspace: Tool Rail + Tool Content */}
      <div className="flex-1 flex min-h-0">
        {/* Tool Rail — slides in from left */}
        {!isLobby && (
          <div
            style={{
              opacity: transition.railReady ? 1 : 0,
              transform: transition.railReady ? 'translateX(0)' : 'translateX(-48px)',
              transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <ToolRail canvas={canvas} onWardrobeGate={() => setShowCastModal(true)} />
          </div>
        )}

        {/* Tool Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative">
          {/* Lobby — fades in/out */}
          {isLobby && (
            <div
              className="absolute inset-0 z-10"
              style={{
                opacity: transition.lobbyVisible ? 1 : 0,
                transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: transition.lobbyVisible ? 'auto' : 'none',
              }}
            >
              <StudioLobby
                onSelectCasting={() => {
                  useCastingGenerationStore.getState().resetGeneration();
                  useCastingFormStore.getState().resetForm();
                  useWardrobeStore.getState().resetWardrobe();
                  setCanvas({ castModelId: null, castFullBodyUrl: null, castMasterPrompt: null, hasModel: false, hasFullBody: false, hasAllViews: false, modelSource: null, uploadedModelUrl: null, isMinted: false });
                  setActiveTool('casting');
                }}
                onResumeDraft={(draft: DraftModel) => {
                  // Reset stores first
                  useCastingGenerationStore.getState().resetGeneration();
                  useCastingUIStore.getState().resetUI();
                  useWardrobeStore.getState().resetWardrobe();

                  // Restore casting generation state from the draft
                  const genStore = useCastingGenerationStore.getState();
                  genStore.setCurrentModelId(draft.id);
                  genStore.setCurrentMasterPrompt(draft.masterPrompt);
                  if (draft.technicalSchema) {
                    genStore.setCurrentTechnicalSchema(draft.technicalSchema);
                  }

                  // Restore form preferences if available
                  if (draft.preferences) {
                    const formStore = useCastingFormStore.getState();
                    formStore.setPrefs(draft.preferences as any);
                    formStore.setModelName(draft.name || '');
                  }

                  // Set canvas immediately with the thumbnail we already have
                  // (the draft thumbnail is the headshot — good enough for instant transition)
                  setCanvas({
                    castModelId: draft.id,
                    castFullBodyUrl: null,
                    castMasterPrompt: draft.masterPrompt,
                    hasModel: true,
                    hasFullBody: false,
                    hasAllViews: false,
                    modelSource: 'cast',
                    uploadedModelUrl: null,
                    isMinted: false,
                  });

                  // Switch to casting tool instantly — no waiting
                  setActiveTool('casting');
                  toast.success(`Resumed draft \u2014 ${draft.name || 'Draft Model'}`);

                  // Fetch full assets in background and update stores when ready
                  trpcUtils.models.get.fetch({ modelId: draft.id }).then((model) => {
                    if (model?.assets?.length) {
                      const currentGenStore = useCastingGenerationStore.getState();
                      // Only update if we're still on this draft (user didn't navigate away)
                      if (currentGenStore.currentModelId !== draft.id) return;

                      const { history: rebuiltHistory, historyIndex: rebuiltIndex, currentAssets: rebuiltAssets } = buildHistoryFromAssets(
                        model.assets as Array<{ id: number; viewType: string; storageUrl: string }>
                      );
                      currentGenStore.setCurrentAssets(rebuiltAssets);
                      currentGenStore.setHistory(rebuiltHistory);
                      currentGenStore.setHistoryIndex(rebuiltIndex);
                      useCastingGenerationStore.setState({ historyAmendments: rebuiltHistory.map(() => []) });

                      const fullBody = model.assets.find((a: { viewType: string }) => a.viewType === 'frontFull');
                      const sideView = model.assets.find((a: { viewType: string }) => a.viewType === 'sideClose');

                      setCanvas({
                        castModelId: draft.id,
                        castFullBodyUrl: fullBody?.storageUrl || null,
                        castMasterPrompt: draft.masterPrompt,
                        hasModel: true,
                        hasFullBody: !!fullBody,
                        hasAllViews: !!(fullBody && sideView),
                        modelSource: 'cast',
                        uploadedModelUrl: null,
                        isMinted: false,
                      });
                    }
                  }).catch(() => {
                    // Silently fail — canvas already has minimal state set above
                  });
                }}
              />
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
    </div>
  );
}
