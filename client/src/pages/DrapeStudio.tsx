import { useEffect, useMemo } from 'react';
import { useLocation, useSearch } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Studio infrastructure
import { useStudioStore } from '@/features/studio/stores/useStudioStore';
import { ToolRail } from '@/features/studio/components/ToolRail';
import { StudioHeader } from '@/features/studio/components/StudioHeader';
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
}: {
  modelImageUrl: string | null;
  modelId: number | null;
}) {
  const gen = useWardrobeGeneration({ modelImageUrl, modelId });

  return (
    <>
      {/* Left Panel — Garment Rack */}
      <div
        className="w-full lg:w-[280px] xl:w-[300px] flex-shrink-0 overflow-y-auto border-r relative"
        style={{ borderColor: '#e5e0d8' }}
      >
        <RackPanel />
      </div>

      {/* Center — VTO Canvas */}
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

      {/* Right Panel — Layers */}
      <div
        className="hidden lg:block w-[240px] xl:w-[260px] flex-shrink-0 overflow-y-auto border-l"
        style={{ borderColor: '#e5e0d8' }}
      >
        <LayersPanel
          isGenerating={gen.isGenerating}
          hasResult={gen.currentResult !== null}
          onGenerate={gen.generate}
          currentResultUrl={gen.currentResult}
        />
      </div>
    </>
  );
}

export default function DrapeStudio() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // Studio store
  const { activeTool, setActiveTool, canvas, setCanvas } = useStudioStore();

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

  // Derive full-body URL for wardrobe VTO base image
  const fullBodyUrl = useMemo(() => {
    const fullBodyAsset = currentAssets.find((a) => a.viewType === 'fullBody' && a.storageUrl);
    return fullBodyAsset?.storageUrl || null;
  }, [currentAssets]);

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
        {/* Tool Rail — far left */}
        <ToolRail canvas={canvas} />

        {/* Tool Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {activeTool === 'casting' && (
            <>
              {/* Left Panel — Control */}
              <ControlPanel
                user={user}
                isFormValid={isFormValid}
                genState={genState}
                currentAssets={currentAssets}
                handleGenerate={handleGenerate}
              />

              {/* Center — Image Viewer */}
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

              {/* Right Panel — Master Prompt */}
              <MasterPromptPanel />
            </>
          )}

          {activeTool === 'wardrobe' && (
            <WardrobeWorkspaceSection
              modelImageUrl={fullBodyUrl}
              modelId={currentModelId}
            />
          )}

          {activeTool === 'export' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: '#999' }}>
                <p style={{ fontSize: 13, fontWeight: 500 }}>Export Pack</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>Coming in Phase 4</p>
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
