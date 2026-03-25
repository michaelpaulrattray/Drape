import { useCallback, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
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
import { RackPanel, LayersPanel, DecompositionDrawer, useWardrobeGeneration, useModelSetup, useWardrobeStore, WardrobeEmptyState, WardrobeImageOverlay, WardrobeShortcutsBar } from '@/features/wardrobe';
import { StudioCanvas } from '@/features/studio/components/StudioCanvas';

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
  useModelSetup(modelImageUrl);

  const resultOverlayItems = useWardrobeStore((s) => s.resultOverlayItems);
  const selectedGarmentIds = useWardrobeStore((s) => s.selectedGarmentIds);
  const selectedCount = useWardrobeStore((s) => s.selectedGarmentIds.size);
  const isDecomposeOpen = useWardrobeStore((s) => s.isDecomposeOpen);
  const setDecomposeOpen = useWardrobeStore((s) => s.setDecomposeOpen);
  const { data: garments = [] } = trpc.wardrobe.garments.list.useQuery();

  const hasResult = gen.currentResult !== null;
  const canGenerate = selectedCount > 0 && !!modelImageUrl && !gen.isGenerating && gen.cooldownSeconds <= 0;

  const handleStyleNote = useCallback((note: { garmentLabel: string; category: string; instruction: string }) => {
    const selectedArr = Array.from(selectedGarmentIds);
    const categoryGarments = garments.filter(
      (g) => selectedArr.includes(g.id) && g.slotType === note.category
    );

    if (categoryGarments.length === 0) {
      const fallbackId = selectedArr[0];
      if (!fallbackId) return;
      gen.refineResult(fallbackId, note.instruction);
      return;
    }

    let bestMatch = categoryGarments[0];
    if (categoryGarments.length > 1) {
      const overlayWords = note.garmentLabel.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      let bestScore = -1;
      for (const g of categoryGarments) {
        const haystack = `${g.shortName || ''} ${g.description || ''}`.toLowerCase();
        const score = overlayWords.filter((w) => haystack.includes(w)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = g;
        }
      }
    }

    gen.refineResult(bestMatch.id, note.instruction);
  }, [gen, garments, selectedGarmentIds]);

  // Wardrobe-specific keyboard handler (Space to generate)
  const wardrobeKeyHandler = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (canGenerate) gen.generate();
      return true;
    }
    return false;
  }, [canGenerate, gen]);

  // Derive toolbar status
  const statusLabel = gen.isGenerating
    ? (gen.generatingMessage || 'Generating...')
    : hasResult
      ? `Dressed · v${gen.historyIndex + 1}`
      : 'Wardrobe Studio';
  const statusColor = gen.isGenerating ? '#e8a83e' : hasResult ? '#5cad5c' : '#ccc';
  const statusGlow = gen.isGenerating ? '0 0 6px rgba(232,168,62,0.4)' : undefined;

  // Compare URL: original model image when there's a result
  const compareUrl = hasResult ? modelImageUrl : null;
  const compareLabel = gen.historyIndex <= 0 ? 'Original' : 'Previous';

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

      {/* Center — Unified StudioCanvas */}
      <div
        className="flex-1 min-w-0 h-full"
        style={{
          opacity: centerReady ? 1 : 0,
          transform: centerReady ? 'scale(1)' : 'scale(0.97)',
          transition: 'opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <StudioCanvas
          displayUrl={gen.currentResult || modelImageUrl}
          imageAlt={hasResult ? 'Virtual try-on result' : 'Model'}
          isGenerating={gen.isGenerating}
          generatingMessage={gen.generatingMessage}
          hasResult={hasResult}
          onUndo={gen.undo}
          onRedo={gen.redo}
          canUndo={gen.canUndo}
          canRedo={gen.canRedo}
          statusLabel={statusLabel}
          statusColor={statusColor}
          statusGlow={statusGlow}
          errorMessage={gen.errorMessage}
          onClearError={gen.clearError}
          onRetry={gen.handleRetry}
          compareUrl={compareUrl}
          compareLabel={compareLabel}
          loadingMessage={gen.generatingMessage || 'Dressing model...'}
          isFirstGeneration={!hasResult}
          showToolbar={!!modelImageUrl}
          emptyState={!modelImageUrl ? <WardrobeEmptyState /> : undefined}
          extraKeyHandler={wardrobeKeyHandler}
          imageOverlay={
            <WardrobeImageOverlay
              resultOverlayItems={resultOverlayItems}
              isGenerating={gen.isGenerating}
              isComparing={false}
              onStyleNote={handleStyleNote}
            />
          }
          bottomOverlay={
            <WardrobeShortcutsBar
              hasResult={hasResult}
              isGenerating={gen.isGenerating}
              controlsVisible={true}
            />
          }
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
          hasResult={hasResult}
          onGenerate={gen.generate}
          currentResultUrl={gen.currentResult}
          onRefine={gen.refineResult}
          isRefining={gen.isGenerating}
          hasDirtyStyles={gen.hasDirtyStyles}
          onApplyStyleChanges={gen.handleApplyStyleChanges}
        />
      </AnimatedPanel>

      {/* Decomposition Drawer */}
      <DecompositionDrawer open={isDecomposeOpen} onClose={() => setDecomposeOpen(false)} />
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

  // Sync canvas state from casting assets → shared canvas.
  // Skip when the canvas is owned by an uploaded photo or a gallery-loaded model
  // (those sources manage their own canvas state via useSessionReset).
  useEffect(() => {
    const isExternalModel = canvas.modelSource === 'uploaded' || canvas.castModelId !== null;
    if (isExternalModel) return;

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
