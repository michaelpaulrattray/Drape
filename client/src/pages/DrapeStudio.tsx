import { useEffect, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Studio infrastructure
import { useStudioStore } from '@/features/studio/stores/useStudioStore';
import { ToolRail } from '@/features/studio/components/ToolRail';
import { StudioHeader } from '@/features/studio/components/StudioHeader';
import { StudioLobby } from '@/features/studio/components/StudioLobby';
import { AnimatedPanel } from '@/features/studio/components/AnimatedPanel';
import { useStudioTransition } from '@/features/studio/hooks/useStudioTransition';
import type { StudioTool } from '@/features/studio/types';

// Wardrobe tool imports
import { RackPanel, MainStage, LayersPanel, useWardrobeGeneration } from '@/features/wardrobe';

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

/** Valid tool query param values */
const VALID_TOOLS: StudioTool[] = ['casting', 'wardrobe', 'export'];

/** Wardrobe workspace — extracted to avoid hook-in-conditional issues */
function WardrobeWorkspaceSection({
  modelImageUrl,
  modelId,
  leftReady,
  centerReady,
  rightReady,
}: {
  modelImageUrl: string | null;
  modelId: number | null;
  leftReady: boolean;
  centerReady: boolean;
  rightReady: boolean;
}) {
  const gen = useWardrobeGeneration({ modelImageUrl, modelId });

  return (
    <>
      {/* Left Panel — Garment Rack */}
      <AnimatedPanel
        ready={leftReady}
        from="left"
        offset={60}
        duration={500}
        className="w-full lg:w-[280px] xl:w-[300px] flex-shrink-0 overflow-y-auto border-r relative"
        style={{ borderColor: '#e5e0d8' }}
      >
        <RackPanel />
      </AnimatedPanel>

      {/* Center — VTO Canvas */}
      <div
        className="flex-1 min-w-0"
        style={{
          opacity: centerReady ? 1 : 0,
          transform: centerReady ? 'scale(1)' : 'scale(0.97)',
          transition: 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <MainStage
          modelImageUrl={modelImageUrl}
          isGenerating={gen.isGenerating}
          generatingMessage={gen.generatingMessage}
          errorMessage={gen.errorMessage}
          onClearError={gen.clearError}
          currentResult={gen.currentResult}
          onGenerate={gen.generate}
          onUndo={gen.undo}
          onRedo={gen.redo}
          canUndo={gen.canUndo}
          canRedo={gen.canRedo}
        />
      </div>

      {/* Right Panel — Layers */}
      <AnimatedPanel
        ready={rightReady}
        from="right"
        offset={60}
        duration={500}
        className="hidden lg:block w-[240px] xl:w-[260px] flex-shrink-0 overflow-y-auto border-l"
        style={{ borderColor: '#e5e0d8' }}
      >
        <LayersPanel
          isGenerating={gen.isGenerating}
          hasResult={gen.currentResult !== null}
          onGenerate={gen.generate}
          currentResultUrl={gen.currentResult}
        />
      </AnimatedPanel>
    </>
  );
}

export default function DrapeStudio() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Studio store
  const { activeTool, setActiveTool, canvas, setCanvas } = useStudioStore();

  // Orchestrated transition phases
  const transition = useStudioTransition(activeTool);

  // Parse ?tool= query param on mount
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const toolParam = params.get('tool') as StudioTool | null;
    if (toolParam && VALID_TOOLS.includes(toolParam)) {
      setActiveTool(toolParam);
    }
  }, []); // Only on mount

  // Casting stores
  const { prefs, setPrefs } = useCastingFormStore();
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

  // Sync canvas state from casting assets
  useEffect(() => {
    const hasModel = currentAssets.some((a) => a.viewType === 'frontClose' && a.storageUrl);
    const hasFullBody = currentAssets.some((a) => a.viewType === 'fullBody' && a.storageUrl);
    const hasAllViews =
      hasModel &&
      hasFullBody &&
      currentAssets.some((a) => a.viewType === 'sideProfile' && a.storageUrl);

    // Only sync casting state if we're not in uploaded-model mode
    if (canvas.modelSource !== 'uploaded') {
      setCanvas({
        hasModel,
        hasFullBody,
        hasAllViews,
        modelSource: currentModelId ? 'cast' : canvas.modelSource,
      });
    }
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

  // Derive full-body URL for wardrobe VTO base image
  // Priority: uploaded model URL > gallery cast URL > casting full body asset
  const fullBodyUrl = useMemo(() => {
    if (canvas.uploadedModelUrl) return canvas.uploadedModelUrl;
    if (canvas.castFullBodyUrl) return canvas.castFullBodyUrl;
    const fullBodyAsset = currentAssets.find((a) => a.viewType === 'fullBody' && a.storageUrl);
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
  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#eae7e1' }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#1a1a1a' }} />
      </div>
    );
  }

  const isLobby = activeTool === null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#eae7e1' }}>
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
            <ToolRail canvas={canvas} />
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
          {activeTool === 'casting' && (
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
                />
              </AnimatedPanel>

              {/* Center — Image Viewer (scales up) */}
              <div
                className="flex-1 min-w-0"
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

      {/* Credit Top-up Modal */}
      <CreditTopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        currentBalance={creditsData?.balance || 0}
      />
    </div>
  );
}
