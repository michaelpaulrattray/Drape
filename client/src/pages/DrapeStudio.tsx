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
import { AnimatedPanel } from '@/features/studio/components/AnimatedPanel';
import { useStudioTransition } from '@/features/studio/hooks/useStudioTransition';
import type { StudioTool } from '@/features/studio/types';

// Wardrobe tool imports
import { WardrobeWorkspaceSection } from '@/features/wardrobe';

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
import { generateRandomPreferences } from '@/features/casting/castingHelpers';
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

  // Orchestrated transition phases
  const transition = useStudioTransition(activeTool);

  // Session persistence — restore on mount, auto-save on changes
  const { isRestoring } = useSessionRestore(isAuthenticated);
  useSessionAutoSave();

  // Parse ?tool= query param on mount
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const toolParam = params.get('tool') as StudioTool | null;
    if (toolParam && VALID_TOOLS.includes(toolParam)) {
      setActiveTool(toolParam);
    }
  }, []); // Only on mount

  // Casting stores
  const { prefs, setPrefs, modelName } = useCastingFormStore();
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

  // Sync canvas state from casting assets → shared canvas.
  // Skip when the canvas is owned by an uploaded photo or a gallery-loaded model
  // (those sources manage their own canvas state via useSessionReset).
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const randomPrefs = generateRandomPreferences();
        setPrefs({ ...prefs, ...randomPrefs });
        toast.success('Debug: Form populated with random preferences');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        const randomPrefs = generateRandomPreferences();
        setPrefs({ ...prefs, ...randomPrefs });
        toast.success('Debug: Auto-generating model...');
        setTimeout(() => {
          const generateBtn = document.querySelector(
            '[data-debug-generate]'
          ) as HTMLButtonElement;
          if (generateBtn && !generateBtn.disabled) {
            generateBtn.click();
          }
        }, 200);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prefs, setPrefs]);

  // Read-only mode: casting overview is locked for any saved/minted model
  // This allows seamless switching to Casting without a destructive reset modal
  const isReadOnly = activeTool === 'casting' && (
    canvas.isMinted || canvas.castModelId !== null
  );

  // Uploaded models have no casting data — show a "not cast" placeholder
  const isUploadedModel = activeTool === 'casting' && canvas.modelSource === 'uploaded';

  // New Model — resets entire session
  const handleNewModel = useCallback(() => {
    useStudioStore.getState().resetStudio();
    useCastingGenerationStore.getState().resetGeneration();
    useCastingFormStore.getState().resetForm();
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

  // Derive full-body URL for wardrobe VTO base image
  // Priority: uploaded model URL > gallery cast URL > casting full body asset
  const fullBodyUrl = useMemo(() => {
    if (canvas.uploadedModelUrl) return canvas.uploadedModelUrl;
    if (canvas.castFullBodyUrl) return canvas.castFullBodyUrl;
    const fullBodyAsset = currentAssets.find((a) => a.viewType === 'frontFull' && a.storageUrl);
    return fullBodyAsset?.storageUrl || null;
  }, [canvas.uploadedModelUrl, canvas.castFullBodyUrl, currentAssets]);

  // Form completion progress
  const formProgress = useMemo(() => {
    let completed = 0;
    const totalFields = 12;
    if (prefs.castingBrand) completed += 1;
    if (
      prefs.castingVibe &&
      (prefs.castingVibe.editorial > 0 ||
        prefs.castingVibe.commercial > 0 ||
        prefs.castingVibe.runway > 0)
    )
      completed += 1;
    if (prefs.gender) completed += 1;
    if (prefs.age && prefs.ethnicity) completed += 1;
    if (prefs.bodyType) completed += 1;
    if (prefs.faceShape) completed += 1;
    if (prefs.skinTone) completed += 1;
    if (prefs.skinTexture || prefs.skinFinish) completed += 1;
    if (prefs.eyeColor) completed += 2;
    if (prefs.hairColor) completed += 1;
    if (prefs.hairStyle) completed += 1;
    return Math.round((completed / totalFields) * 100);
  }, [prefs]);

  // Loading state
  if (authLoading || isRestoring) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#f0ebe3' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1a1a1a' }} />
      </div>
    );
  }

  const isLobby = activeTool === null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#f0ebe3' }}>
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
                onSelectCasting={() => setActiveTool('casting')}
              />
            </div>
          )}

          {/* Casting workspace — panels slide in from edges */}
          {activeTool === 'casting' && isUploadedModel && (
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
                  <Camera className="w-6 h-6" style={{ color: '#999' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
                  This model was uploaded
                </p>
                <p style={{ fontSize: 12, color: '#999', lineHeight: 1.5, marginBottom: 20 }}>
                  Uploaded photos skip the casting process. To use the Casting Studio,
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

          {activeTool === 'casting' && !isUploadedModel && (
            <>
              {/* Left Panel — Control (slides from left) */}
              <AnimatedPanel
                ready={transition.leftReady}
                from="left"
                offset={60}
                duration={500}
                className="w-full lg:w-auto flex-shrink-0"
              >
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
              </AnimatedPanel>

              {/* Center — Image Viewer (scales up) */}
              <div
                className="flex-1 min-w-0 h-full"
                style={{
                  opacity: transition.centerReady ? 1 : 0,
                  transform: transition.centerReady ? 'scale(1)' : 'scale(0.97)',
                  transition: 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
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
                <MasterPromptPanel />
              </AnimatedPanel>
            </>
          )}

          {/* Wardrobe workspace — panels slide in from edges */}
          {activeTool === 'wardrobe' && (
            <WardrobeWorkspaceSection
              modelImageUrl={fullBodyUrl}
              modelId={currentModelId}
              leftReady={transition.leftReady}
              centerReady={transition.centerReady}
              rightReady={transition.rightReady}
            />
          )}

          {/* Export placeholder */}
          {activeTool === 'export' && (
            <div
              className="flex-1 flex items-center justify-center"
              style={{
                opacity: transition.centerReady ? 1 : 0,
                transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div className="text-center" style={{ color: '#999' }}>
                <p style={{ fontSize: 13, fontWeight: 500 }}>Export Pack</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Coming soon</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cast Model Modal — gate before wardrobe for draft models */}
      <CastModelModal
        isOpen={showCastModal}
        onClose={() => setShowCastModal(false)}
        onConfirm={handleCastAndContinue}
        needsSideView={needsSideView}
        isCasting={isCasting}
        castingMessage={castingMessage}
        previewImage={currentAssets.find((a) => a.viewType === 'frontClose')?.storageUrl}
      />

      {/* Credit Top-up Modal */}
      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />
    </div>
  );
}
